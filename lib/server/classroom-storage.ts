import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { UserRole } from '@/lib/auth';
import type { Scene, Stage } from '@/lib/types/stage';

const RUNTIME_DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? '.runtime-data');
const LEGACY_DATA_DIR = path.join(process.cwd(), 'data');

export const CLASSROOMS_DIR = path.join(RUNTIME_DATA_DIR, 'classrooms');
export const CLASSROOM_JOBS_DIR = path.join(RUNTIME_DATA_DIR, 'classroom-jobs');
export const LEGACY_CLASSROOMS_DIR = path.join(LEGACY_DATA_DIR, 'classrooms');

export type ClassroomAccessRole = Extract<UserRole, 'teacher' | 'student' | 'school_admin' | 'admin'>;

export interface ClassroomAccessActor {
  userId: string;
  role: ClassroomAccessRole;
  schoolId?: string;
  name?: string;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureClassroomsDir() {
  await ensureDir(CLASSROOMS_DIR);
}

export async function ensureClassroomJobsDir() {
  await ensureDir(CLASSROOM_JOBS_DIR);
}

export async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}

export function buildRequestOrigin(req: Request | NextRequest): string {
  if (req.headers.get('x-forwarded-host')) {
    return `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('x-forwarded-host')}`;
  }

  if ('nextUrl' in req && req.nextUrl?.origin) {
    return req.nextUrl.origin;
  }

  return new URL(req.url).origin;
}

export interface PersistedClassroomData {
  id: string;
  stage: Stage;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
  ownerUserId?: string;
  ownerRole?: ClassroomAccessRole;
  ownerSchoolId?: string;
  ownerName?: string;
}

export function isValidClassroomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function buildClassroomAccessActor(
  user?:
    | {
        id: string;
        role: UserRole;
        schoolId?: string | null;
        name?: string | null;
      }
    | null,
): ClassroomAccessActor | null {
  if (
    !user ||
    (user.role !== 'teacher' &&
      user.role !== 'student' &&
      user.role !== 'school_admin' &&
      user.role !== 'admin')
  ) {
    return null;
  }

  return {
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId ?? undefined,
    name: user.name ?? undefined,
  };
}

function matchesLegacyClassroomOwner(
  classroom: PersistedClassroomData,
  actor: ClassroomAccessActor,
): boolean {
  const meta = classroom.stage.classroomMeta;
  if (!meta) {
    return false;
  }

  if (actor.role === 'teacher' && meta.teacher?.id === actor.userId) {
    return true;
  }

  if (actor.role === 'student' && meta.learner?.id === actor.userId) {
    return true;
  }

  return false;
}

export function isAudienceClassroom(classroom: PersistedClassroomData): boolean {
  const meta = classroom.stage.classroomMeta;
  return meta?.audienceMode === 'whole-class' || Boolean(meta?.publishedUrl);
}

export function canManageClassroom(
  classroom: PersistedClassroomData,
  actor?: ClassroomAccessActor | null,
): boolean {
  if (!actor) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (classroom.ownerUserId) {
    return classroom.ownerUserId === actor.userId;
  }

  if (matchesLegacyClassroomOwner(classroom, actor)) {
    return true;
  }

  // Legacy unowned unpublished classrooms may be claimed on the next authenticated save.
  return !isAudienceClassroom(classroom);
}

export function canReadClassroom(
  classroom: PersistedClassroomData,
  options: {
    actor?: ClassroomAccessActor | null;
    audienceView?: boolean;
  } = {},
): boolean {
  if (options.audienceView && isAudienceClassroom(classroom)) {
    return isAudienceClassroom(classroom);
  }

  return canManageClassroom(classroom, options.actor);
}

export async function readClassroom(id: string): Promise<PersistedClassroomData | null> {
  const candidatePaths = [
    path.join(CLASSROOMS_DIR, `${id}.json`),
    path.join(LEGACY_CLASSROOMS_DIR, `${id}.json`),
  ];

  for (const filePath of candidatePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as PersistedClassroomData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return null;
}

export async function persistClassroom(
  data: {
    id: string;
    stage: Stage;
    scenes: Scene[];
  },
  baseUrl: string,
  options: {
    actor?: ClassroomAccessActor | null;
  } = {},
): Promise<PersistedClassroomData & { url: string }> {
  const existing = await readClassroom(data.id);
  const now = new Date().toISOString();
  const owner = existing?.ownerUserId
    ? {
        userId: existing.ownerUserId,
        role: existing.ownerRole,
        schoolId: existing.ownerSchoolId,
        name: existing.ownerName,
      }
    : options.actor;
  const classroomData: PersistedClassroomData = {
    id: data.id,
    stage: data.stage,
    scenes: data.scenes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(owner
      ? {
          ownerUserId: owner.userId,
          ownerRole: owner.role,
          ...(owner.schoolId ? { ownerSchoolId: owner.schoolId } : {}),
          ...(owner.name ? { ownerName: owner.name } : {}),
        }
      : {}),
  };

  await ensureClassroomsDir();
  const filePath = path.join(CLASSROOMS_DIR, `${data.id}.json`);
  await writeJsonFileAtomic(filePath, classroomData);

  return {
    ...classroomData,
    url: `${baseUrl}/classroom/${data.id}`,
  };
}
