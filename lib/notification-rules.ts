import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type NotificationRule = {
  id: string;
  classId: string;
  enabled: boolean;
  dueDays: number;
  overdueDays: number;
  includeParents: boolean;
  createdAt: string;
  updatedAt: string;
};

const FILE = "notification-rules.json";

type DbRule = {
  id: string;
  class_id: string;
  enabled: boolean;
  due_days: number;
  overdue_days: number;
  include_parents: boolean;
  created_at: string;
  updated_at: string;
};

function mapRule(row: DbRule): NotificationRule {
  return {
    id: row.id,
    classId: row.class_id,
    enabled: row.enabled,
    dueDays: row.due_days,
    overdueDays: row.overdue_days,
    includeParents: row.include_parents,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getRulesByClassIds(classIds: string[]): Promise<NotificationRule[]> {
  if (!classIds.length) return [];
  if (!isDbEnabled()) {
    const list = readJson<NotificationRule[]>(FILE, []);
    return list.filter((item) => classIds.includes(item.classId));
  }
  const rows = await query<DbRule>(
    "SELECT * FROM notification_rules WHERE class_id = ANY($1)",
    [classIds]
  );
  return rows.map(mapRule);
}

export async function upsertRule(input: {
  classId: string;
  enabled: boolean;
  dueDays: number;
  overdueDays: number;
  includeParents: boolean;
}): Promise<NotificationRule> {
  const updatedAt = new Date().toISOString();
  if (!isDbEnabled()) {
    const list = readJson<NotificationRule[]>(FILE, []);
    const index = list.findIndex((item) => item.classId === input.classId);
    const next: NotificationRule = {
      id: index >= 0 ? list[index].id : `rule-${crypto.randomBytes(6).toString("hex")}`,
      classId: input.classId,
      enabled: input.enabled,
      dueDays: input.dueDays,
      overdueDays: input.overdueDays,
      includeParents: input.includeParents,
      createdAt: index >= 0 ? list[index].createdAt : updatedAt,
      updatedAt
    };
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(FILE, list);
    return next;
  }

  const id = `rule-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbRule>(
    `INSERT INTO notification_rules (id, class_id, enabled, due_days, overdue_days, include_parents, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (class_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       due_days = EXCLUDED.due_days,
       overdue_days = EXCLUDED.overdue_days,
       include_parents = EXCLUDED.include_parents,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      id,
      input.classId,
      input.enabled,
      input.dueDays,
      input.overdueDays,
      input.includeParents,
      updatedAt,
      updatedAt
    ]
  );
  return row ? mapRule(row) : {
    id,
    classId: input.classId,
    enabled: input.enabled,
    dueDays: input.dueDays,
    overdueDays: input.overdueDays,
    includeParents: input.includeParents,
    createdAt: updatedAt,
    updatedAt
  };
}
