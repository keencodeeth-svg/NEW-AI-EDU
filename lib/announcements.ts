import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type Announcement = {
  id: string;
  classId: string;
  authorId?: string;
  title: string;
  content: string;
  createdAt: string;
};

const FILE = "announcements.json";

type DbAnnouncement = {
  id: string;
  class_id: string;
  author_id: string | null;
  title: string;
  content: string;
  created_at: string;
};

function mapAnnouncement(row: DbAnnouncement): Announcement {
  return {
    id: row.id,
    classId: row.class_id,
    authorId: row.author_id ?? undefined,
    title: row.title,
    content: row.content,
    createdAt: row.created_at
  };
}

export async function getAnnouncements(): Promise<Announcement[]> {
  if (!isDbEnabled()) {
    return readJson<Announcement[]>(FILE, []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const rows = await query<DbAnnouncement>("SELECT * FROM announcements ORDER BY created_at DESC");
  return rows.map(mapAnnouncement);
}

export async function getAnnouncementsByClass(classId: string): Promise<Announcement[]> {
  if (!isDbEnabled()) {
    const list = await getAnnouncements();
    return list.filter((item) => item.classId === classId);
  }
  const rows = await query<DbAnnouncement>(
    "SELECT * FROM announcements WHERE class_id = $1 ORDER BY created_at DESC",
    [classId]
  );
  return rows.map(mapAnnouncement);
}

export async function getAnnouncementsByClassIds(classIds: string[]): Promise<Announcement[]> {
  if (!classIds.length) return [];
  if (!isDbEnabled()) {
    const list = await getAnnouncements();
    return list.filter((item) => classIds.includes(item.classId));
  }
  const rows = await query<DbAnnouncement>(
    "SELECT * FROM announcements WHERE class_id = ANY($1) ORDER BY created_at DESC",
    [classIds]
  );
  return rows.map(mapAnnouncement);
}

export async function createAnnouncement(input: {
  classId: string;
  authorId?: string;
  title: string;
  content: string;
}): Promise<Announcement> {
  const createdAt = new Date().toISOString();
  const next: Announcement = {
    id: `ann-${crypto.randomBytes(6).toString("hex")}`,
    classId: input.classId,
    authorId: input.authorId,
    title: input.title,
    content: input.content,
    createdAt
  };

  if (!isDbEnabled()) {
    const list = readJson<Announcement[]>(FILE, []);
    list.push(next);
    writeJson(FILE, list);
    return next;
  }

  const row = await queryOne<DbAnnouncement>(
    `INSERT INTO announcements (id, class_id, author_id, title, content, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [next.id, input.classId, input.authorId ?? null, input.title, input.content, createdAt]
  );

  return row ? mapAnnouncement(row) : next;
}
