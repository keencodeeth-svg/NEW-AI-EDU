import type { Scene, Stage } from '@/lib/types/stage';

type PersistClassroomSnapshotInput = {
  stage: Stage;
  scenes: Scene[];
  signal?: AbortSignal;
};

type PersistClassroomSnapshotResponse = {
  success: true;
  id: string;
  url: string;
};

type PersistClassroomSnapshotError = {
  success?: false;
  error?: string;
};

export async function persistClassroomSnapshot({
  stage,
  scenes,
  signal,
}: PersistClassroomSnapshotInput): Promise<PersistClassroomSnapshotResponse> {
  const response = await fetch('/api/classroom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stage, scenes }),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | PersistClassroomSnapshotResponse
    | PersistClassroomSnapshotError
    | null;

  if (
    !response.ok ||
    !payload ||
    payload.success !== true ||
    !('id' in payload) ||
    !('url' in payload)
  ) {
    throw new Error(
      payload && 'error' in payload && payload.error
        ? payload.error
        : 'Failed to persist classroom snapshot',
    );
  }

  return payload;
}
