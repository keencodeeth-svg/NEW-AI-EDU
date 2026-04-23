import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

async function loadRuntimePortModule() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../../../scripts/api-test/runtime-port.mjs")).href;
  const importer = new Function("moduleUrl", "return import(moduleUrl);") as unknown as (
    moduleUrl: string
  ) => Promise<{
    resolveApiTestPort: (options?: {
      preferredPort?: number;
      explicitPort?: boolean;
      host?: string;
      isRemote?: boolean;
    }) => Promise<number>;
  }>;
  return importer(moduleUrl);
}

async function withListeningServer(run: (port: number) => Promise<void>) {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to reserve an occupied test port.");
  }

  try {
    await run(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test("resolveApiTestPort allocates a free ephemeral port when preferred port is zero", async () => {
  const { resolveApiTestPort } = await loadRuntimePortModule();
  const port = await resolveApiTestPort({ preferredPort: 0 });
  assert.equal(Number.isInteger(port), true);
  assert.ok(port > 0);
});

test("resolveApiTestPort falls back to a different port when the default port is occupied", async () => {
  const { resolveApiTestPort } = await loadRuntimePortModule();
  await withListeningServer(async (occupiedPort) => {
    const port = await resolveApiTestPort({ preferredPort: occupiedPort, host: "127.0.0.1" });
    assert.equal(Number.isInteger(port), true);
    assert.ok(port > 0);
    assert.notEqual(port, occupiedPort);
  });
});

test("resolveApiTestPort fails fast when an explicitly requested port is occupied", async () => {
  const { resolveApiTestPort } = await loadRuntimePortModule();
  await withListeningServer(async (occupiedPort) => {
    await assert.rejects(
      () => resolveApiTestPort({ preferredPort: occupiedPort, explicitPort: true, host: "127.0.0.1" }),
      /already in use/
    );
  });
});
