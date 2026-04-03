import fs from "fs/promises";
import path from "path";
import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const options = {
    id: "uh_EAhPvJ-",
    output: "output/playwright/classroom-capture.png",
    baseUrl: "http://localhost:3127",
    viewportWidth: 1440,
    viewportHeight: 1120
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if ((value === "--id" || value === "-i") && argv[index + 1]) {
      options.id = argv[index + 1];
      index += 1;
      continue;
    }
    if ((value === "--output" || value === "-o") && argv[index + 1]) {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--base-url" && argv[index + 1]) {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--width" && argv[index + 1]) {
      options.viewportWidth = Number(argv[index + 1]) || options.viewportWidth;
      index += 1;
      continue;
    }
    if (value === "--height" && argv[index + 1]) {
      options.viewportHeight = Number(argv[index + 1]) || options.viewportHeight;
      index += 1;
      continue;
    }
  }

  return options;
}

async function loadClassroomPayload(cwd, classroomId) {
  const candidates = [
    path.join(cwd, ".runtime-data", "classrooms", `${classroomId}.json`),
    path.join(cwd, "data", "classrooms", `${classroomId}.json`)
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf8");
      return JSON.parse(raw);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`Unable to find classroom payload for "${classroomId}" in runtime or data directories.`);
}

async function ensureOutputDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const cwd = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const classroom = await loadClassroomPayload(cwd, options.id);
  const stageId = classroom.stage?.id ?? classroom.id;

  if (!classroom.stage || !Array.isArray(classroom.scenes)) {
    throw new Error(`Invalid classroom payload for "${options.id}".`);
  }

  const outputPath = path.isAbsolute(options.output)
    ? options.output
    : path.join(cwd, options.output);
  await ensureOutputDir(outputPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: options.viewportWidth,
      height: options.viewportHeight
    },
    deviceScaleFactor: 1
  });

  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`console:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`page:${error.message}`);
  });
  page.on("response", async (response) => {
    if (response.status() < 400) {
      return;
    }
    failedRequests.push({
      status: response.status(),
      url: response.url()
    });
  });

  await page.goto(`${options.baseUrl}/classroom/pw-missing-preview`, {
    waitUntil: "networkidle"
  });

  await page.evaluate(async ({ classroom: nextClassroom }) => {
    function ensureStores(db) {
      if (!db.objectStoreNames.contains("stages")) {
        db.createObjectStore("stages", { keyPath: "id" }).createIndex("updatedAt", "updatedAt", {
          unique: false
        });
      }
      if (!db.objectStoreNames.contains("scenes")) {
        const store = db.createObjectStore("scenes", { keyPath: "id" });
        store.createIndex("stageId", "stageId", { unique: false });
        store.createIndex("order", "order", { unique: false });
        store.createIndex("[stageId+order]", ["stageId", "order"], { unique: false });
      }
      if (!db.objectStoreNames.contains("audioFiles")) {
        db.createObjectStore("audioFiles", { keyPath: "id" }).createIndex("createdAt", "createdAt", {
          unique: false
        });
      }
      if (!db.objectStoreNames.contains("imageFiles")) {
        db.createObjectStore("imageFiles", { keyPath: "id" }).createIndex("createdAt", "createdAt", {
          unique: false
        });
      }
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("chatSessions")) {
        const store = db.createObjectStore("chatSessions", { keyPath: "id" });
        store.createIndex("stageId", "stageId", { unique: false });
        store.createIndex("[stageId+createdAt]", ["stageId", "createdAt"], { unique: false });
      }
      if (!db.objectStoreNames.contains("playbackState")) {
        db.createObjectStore("playbackState", { keyPath: "stageId" });
      }
      if (!db.objectStoreNames.contains("stageOutlines")) {
        db.createObjectStore("stageOutlines", { keyPath: "stageId" });
      }
      if (!db.objectStoreNames.contains("mediaFiles")) {
        const store = db.createObjectStore("mediaFiles", { keyPath: "id" });
        store.createIndex("stageId", "stageId", { unique: false });
        store.createIndex("[stageId+type]", ["stageId", "type"], { unique: false });
      }
      if (!db.objectStoreNames.contains("generatedAgents")) {
        const store = db.createObjectStore("generatedAgents", { keyPath: "id" });
        store.createIndex("stageId", "stageId", { unique: false });
      }
    }

    const openDb = () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("Hangke-Interactive-Classroom-Database");
        request.onupgradeneeded = () => {
          ensureStores(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(["stages", "scenes", "stageOutlines"], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      transaction.objectStore("stages").put({
        id: nextClassroom.stage.id,
        name: nextClassroom.stage.name || "Untitled Stage",
        description: nextClassroom.stage.description,
        createdAt: nextClassroom.stage.createdAt || Date.now(),
        updatedAt: nextClassroom.stage.updatedAt || Date.now(),
        language: nextClassroom.stage.language,
        style: nextClassroom.stage.style,
        classroomMeta: nextClassroom.stage.classroomMeta,
        currentSceneId: nextClassroom.stage.currentSceneId || nextClassroom.scenes?.[0]?.id || null
      });

      for (const scene of nextClassroom.scenes || []) {
        transaction.objectStore("scenes").put({
          ...scene,
          stageId: nextClassroom.stage.id,
          order: scene.order ?? 0,
          createdAt: scene.createdAt || Date.now(),
          updatedAt: scene.updatedAt || Date.now()
        });
      }

      transaction.objectStore("stageOutlines").put({
        stageId: nextClassroom.stage.id,
        outlines: nextClassroom.outlines || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    });

    db.close();
  }, { classroom });

  await page.goto(`${options.baseUrl}/classroom/${stageId}`, {
    waitUntil: "networkidle"
  });
  await page.waitForTimeout(5000);
  await page.screenshot({
    path: outputPath,
    fullPage: true
  });

  console.log(
    JSON.stringify(
      {
        stageId,
        outputPath,
        consoleErrors,
        failedRequests
      },
      null,
      2
    )
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
