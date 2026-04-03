export const SUBJECT_OPTIONS = [
  { value: "math", label: "数学" },
  { value: "chinese", label: "语文" },
  { value: "english", label: "英语" },
  { value: "science", label: "科学" },
  { value: "physics", label: "物理" },
  { value: "chemistry", label: "化学" },
  { value: "biology", label: "生物" },
  { value: "history", label: "历史" },
  { value: "geography", label: "地理" },
  { value: "politics", label: "道德与法治" }
];

export const SUBJECT_LABELS: Record<string, string> = SUBJECT_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<string, string>);

export const GRADE_OPTIONS = [
  { value: "1", label: "一年级" },
  { value: "2", label: "二年级" },
  { value: "3", label: "三年级" },
  { value: "4", label: "四年级" },
  { value: "5", label: "五年级" },
  { value: "6", label: "六年级" },
  { value: "7", label: "七年级" },
  { value: "8", label: "八年级" },
  { value: "9", label: "九年级" },
  { value: "10", label: "高一" },
  { value: "11", label: "高二" },
  { value: "12", label: "高三" }
];

export const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  quiz: "在线作答",
  upload: "上传作业",
  essay: "作文/主观题"
};

export function getGradeLabel(value?: string) {
  if (!value) return "-";
  const hit = GRADE_OPTIONS.find((item) => item.value === value);
  return hit?.label ?? `${value}年级`;
}

export function getStageLabel(grade?: string) {
  const numeric = Number(grade);
  if (!Number.isFinite(numeric)) return "K12";
  if (numeric <= 6) return "小学";
  if (numeric <= 9) return "初中";
  return "高中";
}
