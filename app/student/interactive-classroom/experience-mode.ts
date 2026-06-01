import type { ClassroomContext } from "../../../lib/classroom-integration";
import { SUBJECT_LABELS } from "../../../lib/constants";
import type { StudentSelfStudyMode } from "@/lib/integrations/ai-classroom-launch";
import type { StudentProfilePayload } from "../profile/types";

type ExperienceModeLaunchCopyInput = {
  mode: StudentSelfStudyMode;
  topic: string;
  learnerGoal: string;
  subject?: string;
  learnerName?: string;
};

type ExperienceModeLaunchCopy = {
  sourceLabel: string;
  sourceSummary: string;
  classroomContext: ClassroomContext;
};

type ExperienceModeState = {
  bootstrapNotice: string;
  learnerName: string;
  profile: StudentProfilePayload;
  topic: string;
  learnerGoal: string;
};

const EXPERIENCE_MODE_LEARNER_NAME = "体验模式";
const EXPERIENCE_MODE_GOAL =
  "体验模式仅展示示例课堂流程，真实学习目标需登录后接入。";
const EXPERIENCE_MODE_NOTICE =
  "当前已切换为体验模式。真实画像、今日任务和课表暂未接入；本页与结果页仅展示示例课堂流程，登录后才会同步个人进度与真实学习数据。";

const EXPERIENCE_MODE_TOPIC_BY_MODE: Record<StudentSelfStudyMode, string> = {
  "preview-preparation": "新课预习示例",
  "subject-reinforcement": "当前薄弱点巩固示例",
  "interest-cultivation": "兴趣探索示例主题",
  "classroom-review": "课堂重点回看示例",
};

const EXPERIENCE_MODE_LABEL_BY_MODE: Record<StudentSelfStudyMode, string> = {
  "preview-preparation": "预习体验模式",
  "subject-reinforcement": "巩固体验模式",
  "interest-cultivation": "兴趣探索体验模式",
  "classroom-review": "回看体验模式",
};

export function getExperienceModeTopic(mode: StudentSelfStudyMode, subject?: string) {
  const subjectLabel = subject ? (SUBJECT_LABELS[subject] ?? subject) : "";
  const genericTopic = EXPERIENCE_MODE_TOPIC_BY_MODE[mode];
  return subjectLabel ? `${subjectLabel}${genericTopic}` : genericTopic;
}

export function buildExperienceModeState(mode: StudentSelfStudyMode): ExperienceModeState {
  return {
    bootstrapNotice: EXPERIENCE_MODE_NOTICE,
    learnerName: EXPERIENCE_MODE_LEARNER_NAME,
    profile: {
      grade: "",
      subjects: [],
      preferredName: "",
      target: "",
      strengths: "",
    },
    topic: getExperienceModeTopic(mode),
    learnerGoal: EXPERIENCE_MODE_GOAL,
  };
}

export function buildExperienceModeLaunchCopy(
  input: ExperienceModeLaunchCopyInput,
): ExperienceModeLaunchCopy {
  const learnerName = input.learnerName?.trim() || EXPERIENCE_MODE_LEARNER_NAME;
  const sourceLabel = `${EXPERIENCE_MODE_LABEL_BY_MODE[input.mode]}已准备`;
  const sourceSummary = `当前为体验模式，真实画像、任务、课表未接入；本次仅带入示例课堂主题“${input.topic}”，用于展示课堂生成与互动节奏。登录后才会同步真实学习数据。`;
  const classroomContext: ClassroomContext = {
    source: "student-self-study",
    className: "体验模式示例课堂",
    subject: input.subject?.trim() || undefined,
    learningMode: input.mode,
    teacher: null,
    learner: {
      id: "experience-mode-student",
      name: learnerName,
    },
    students: [],
    audienceMode: "teacher-private",
    exportFormats: ["pptx", "resource-pack"],
    learnerGoal: input.learnerGoal,
    focusKnowledgePointTitle:
      input.mode === "subject-reinforcement" || input.mode === "classroom-review"
        ? input.topic
        : undefined,
    interestTopic: input.mode === "interest-cultivation" ? input.topic : undefined,
  };

  return {
    sourceLabel,
    sourceSummary,
    classroomContext,
  };
}

export { EXPERIENCE_MODE_GOAL, EXPERIENCE_MODE_LEARNER_NAME, EXPERIENCE_MODE_NOTICE };
