"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  STUDENT_SELF_STUDY_ARTIFACTS_UPDATED_EVENT,
  getStudentSelfStudyArtifact,
  listStudentSelfStudyArtifacts,
  markStudentSelfStudyArtifactSaved,
  upsertStudentSelfStudyArtifact,
  type StudentSelfStudyArtifact,
  type StudentSelfStudyArtifactSaveTarget,
} from '@/lib/student-self-study-artifacts';
import type { StageClassroomMeta } from '@/lib/classroom-integration';

type StudentSelfStudyArtifactInput = {
  stageId: string;
  stageName?: string | null;
  sceneCount?: number;
  classroomMeta?: StageClassroomMeta | null;
  stageHref?: string | null;
};

export function useStudentSelfStudyArtifacts() {
  const [artifacts, setArtifacts] = useState<StudentSelfStudyArtifact[]>(listStudentSelfStudyArtifacts);

  const refresh = useCallback(() => {
    setArtifacts(listStudentSelfStudyArtifacts());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleUpdated = () => {
      refresh();
    };

    window.addEventListener(
      STUDENT_SELF_STUDY_ARTIFACTS_UPDATED_EVENT,
      handleUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        STUDENT_SELF_STUDY_ARTIFACTS_UPDATED_EVENT,
        handleUpdated as EventListener,
      );
    };
  }, [refresh]);

  const upsertArtifact = useCallback(
    (input: StudentSelfStudyArtifactInput) => {
      const nextArtifact = upsertStudentSelfStudyArtifact(input);
      refresh();
      return nextArtifact;
    },
    [refresh],
  );

  const markSaved = useCallback(
    (stageId: string, target: StudentSelfStudyArtifactSaveTarget) => {
      const nextArtifact = markStudentSelfStudyArtifactSaved(stageId, target);
      refresh();
      return nextArtifact;
    },
    [refresh],
  );

  const artifactMap = useMemo(() => {
    return new Map(artifacts.map((artifact) => [artifact.stageId, artifact]));
  }, [artifacts]);

  const findArtifact = useCallback(
    (stageId: string) => {
      return artifactMap.get(stageId) ?? getStudentSelfStudyArtifact(stageId);
    },
    [artifactMap],
  );

  return {
    artifacts,
    refresh,
    upsertArtifact,
    markSaved,
    findArtifact,
  };
}
