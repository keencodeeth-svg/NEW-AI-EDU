import fs from "fs";
import path from "path";
import pg from "pg";
import { normalizeSeedUser } from "./password-seed-utils.mjs";
import { bootstrapProjectEnv } from "./script-env.mjs";

const { Pool } = pg;

bootstrapProjectEnv();

const SCHOOL = {
  id: "hangke-school-lingang",
  code: "HKIC",
  name: "知序实验学校"
};

const PASSWORDS = {
  schoolAdmin: "Hangke-School-2026",
  teacher: "Hangke-Teacher-2026",
  student: "Hangke-Student-2026",
  parent: "Hangke-Parent-2026"
};

const EXPORT_PATH = path.resolve(process.cwd(), "exports", "hangke-realistic-accounts.csv");
const DRY_RUN = process.argv.includes("--dry-run");
const BASE64_TEXT = Buffer.from("课堂学习单：完成基础任务后，再根据老师批注进行二次订正。", "utf8").toString("base64");

const SUBJECT_LABELS = {
  math: "数学",
  chinese: "语文",
  english: "英语"
};

const CLASS_SECTION = {
  "4": "2",
  "7": "3",
  "10": "1"
};

const STUDENT_TARGETS = {
  "4": "巩固基础习惯，形成课堂跟进与作业复盘节奏",
  "7": "稳定核心学科成绩，强化错因复盘与表达能力",
  "10": "完成高中阶段衔接，建立自主学习与阶段诊断机制"
};

const TEACHER_BLUEPRINTS = [
  { key: "liu-min", name: "刘敏", subject: "math", email: "liu.min@faculty.hkic.eduai.net.cn" },
  { key: "wen-qi", name: "温琪", subject: "chinese", email: "wen.qi@faculty.hkic.eduai.net.cn" },
  { key: "he-yan", name: "何妍", subject: "english", email: "he.yan@faculty.hkic.eduai.net.cn" },
  { key: "qin-lang", name: "秦朗", subject: "math", email: "qin.lang@faculty.hkic.eduai.net.cn" },
  { key: "xu-jia", name: "徐嘉", subject: "chinese", email: "xu.jia@faculty.hkic.eduai.net.cn" },
  { key: "fang-yu", name: "方雨", subject: "english", email: "fang.yu@faculty.hkic.eduai.net.cn" },
  { key: "zhou-hang", name: "周航", subject: "math", email: "zhou.hang@faculty.hkic.eduai.net.cn" },
  { key: "shao-ning", name: "邵宁", subject: "chinese", email: "shao.ning@faculty.hkic.eduai.net.cn" },
  { key: "guo-yue", name: "郭悦", subject: "english", email: "guo.yue@faculty.hkic.eduai.net.cn" }
];

const CLASS_BLUEPRINTS = [
  { key: "g4-math", grade: "4", subject: "math", name: "四年级（2）班·数学", joinCode: "HK4M2", teacherKey: "liu-min" },
  { key: "g4-chinese", grade: "4", subject: "chinese", name: "四年级（2）班·语文", joinCode: "HK4C2", teacherKey: "wen-qi" },
  { key: "g4-english", grade: "4", subject: "english", name: "四年级（2）班·英语", joinCode: "HK4E2", teacherKey: "he-yan" },
  { key: "g7-math", grade: "7", subject: "math", name: "七年级（3）班·数学", joinCode: "HK7M3", teacherKey: "qin-lang" },
  { key: "g7-chinese", grade: "7", subject: "chinese", name: "七年级（3）班·语文", joinCode: "HK7C3", teacherKey: "xu-jia" },
  { key: "g7-english", grade: "7", subject: "english", name: "七年级（3）班·英语", joinCode: "HK7E3", teacherKey: "fang-yu" },
  { key: "g10-math", grade: "10", subject: "math", name: "高一（1）班·数学", joinCode: "HK10M1", teacherKey: "zhou-hang" },
  { key: "g10-chinese", grade: "10", subject: "chinese", name: "高一（1）班·语文", joinCode: "HK10C1", teacherKey: "shao-ning" },
  { key: "g10-english", grade: "10", subject: "english", name: "高一（1）班·英语", joinCode: "HK10E1", teacherKey: "guo-yue" }
];

const STUDENT_NAME_POOL = {
  "4": ["林知远", "苏语桐", "陈奕辰", "许沐晴", "赵宇航", "何嘉宁", "郭书禾", "宋雨菲", "唐启航", "谢安然", "潘若汐", "梁博文"],
  "7": ["江昊辰", "沈芷若", "周景行", "顾语安", "唐一凡", "宋可欣", "韩嘉禾", "曹思齐", "邓若宁", "叶明轩", "吕佳宁", "姜子睿"],
  "10": ["冯思源", "袁舒然", "董清妍", "魏浩然", "余星辰", "苏予安", "曾乐彤", "田慕言", "罗希文", "彭宸睿", "于心怡", "高一诺"]
};

const PARENT_GIVEN_NAMES = {
  male: ["建国", "海涛", "志强", "国梁", "明远", "振华", "德胜", "浩南", "伟东", "启明", "成林", "耀文"],
  female: ["丽华", "雪梅", "文静", "秀兰", "雅君", "慧敏", "晓岚", "春燕", "玉兰", "惠芳", "雪琴", "蓉蓉"]
};

const KNOWLEDGE_POINT_TEMPLATES = {
  "4-math": ["整数四则混合运算", "小数意义与比较", "长方形面积应用"],
  "4-chinese": ["段落中心句提取", "人物动作描写", "观察类习作结构"],
  "4-english": ["There be 句型运用", "Daily routine 表达", "Weather and clothes"],
  "7-math": ["有理数运算", "一元一次方程", "整式化简与求值"],
  "7-chinese": ["记叙文线索梳理", "文言实词积累", "说明方法辨析"],
  "7-english": ["一般过去时", "阅读定位策略", "应用文写作结构"],
  "10-math": ["集合表示与运算", "函数单调性初步", "二次函数图像"],
  "10-chinese": ["论述类文本论点提取", "文言句式判断", "材料作文立意"],
  "10-english": ["阅读长难句分析", "概要写作信息整合", "邀请信写作"]
};

function now() {
  return new Date();
}

function shiftTime({ days = 0, hours = 0, minutes = 0, atHour, atMinute = 0, anchor = now() }) {
  const date = new Date(anchor);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  if (typeof atHour === "number") {
    date.setHours(atHour, atMinute, 0, 0);
  }
  return date.toISOString();
}

function daysAgo(days, hour = 9, minute = 0) {
  return shiftTime({ days: -days, atHour: hour, atMinute: minute });
}

function daysAhead(days, hour = 9, minute = 0) {
  return shiftTime({ days, atHour: hour, atMinute: minute });
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function makeId(...parts) {
  return ["hangke", ...parts].join("-");
}

function stableNumber(seed) {
  return Array.from(String(seed)).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 11), 73);
}

function stableRatio(seed) {
  return (stableNumber(seed) % 1000) / 1000;
}

function toCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function subjectDescriptor(subject) {
  return SUBJECT_LABELS[subject] ?? subject;
}

function buildSchoolAdmin() {
  return normalizeSeedUser({
    id: makeId("user", "school-admin", "xie-rong"),
    email: "xie.rong@hkic.eduai.net.cn",
    name: "谢蓉",
    role: "school_admin",
    schoolId: SCHOOL.id,
    password: `plain:${PASSWORDS.schoolAdmin}`
  });
}

function buildTeachers() {
  return TEACHER_BLUEPRINTS.map((teacher, index) =>
    normalizeSeedUser({
      id: makeId("user", "teacher", teacher.key),
      email: teacher.email,
      name: teacher.name,
      role: "teacher",
      schoolId: SCHOOL.id,
      password: `plain:${PASSWORDS.teacher}`,
      createdAt: daysAgo(40 - index, 8, 30)
    })
  );
}

function buildStudentsAndParents() {
  const students = [];
  const parents = [];

  Object.entries(STUDENT_NAME_POOL).forEach(([grade, names]) => {
    names.forEach((name, index) => {
      const sequence = index + 1;
      const seat = `${grade}${CLASS_SECTION[grade]}${pad(sequence)}`;
      const surname = Array.from(name)[0] ?? "张";
      const studentId = makeId("user", "student", `g${grade}`, pad(sequence));
      const parentId = makeId("user", "parent", `g${grade}`, pad(sequence));
      const parentGender = sequence % 2 === 0 ? "female" : "male";
      const parentGivenName = PARENT_GIVEN_NAMES[parentGender][index % PARENT_GIVEN_NAMES[parentGender].length];
      const studentEmail = `stu-${grade}-${pad(sequence, 3)}@student.hkic.eduai.net.cn`;
      const parentEmail = `guardian-${grade}-${pad(sequence, 3)}@family.hkic.eduai.net.cn`;

      students.push(
        normalizeSeedUser({
          id: studentId,
          email: studentEmail,
          name,
          role: "student",
          grade,
          schoolId: SCHOOL.id,
          password: `plain:${PASSWORDS.student}`,
          createdAt: daysAgo(25 - (sequence % 6), 7, 45),
          seat,
          rosterGrade: grade
        })
      );

      parents.push(
        normalizeSeedUser({
          id: parentId,
          email: parentEmail,
          name: `${surname}${parentGivenName}`,
          role: "parent",
          schoolId: SCHOOL.id,
          studentId,
          password: `plain:${PASSWORDS.parent}`,
          createdAt: daysAgo(22 - (sequence % 5), 20, 0)
        })
      );
    });
  });

  return { students, parents };
}

function buildUsers() {
  const schoolAdmin = buildSchoolAdmin();
  const teachers = buildTeachers();
  const { students, parents } = buildStudentsAndParents();
  return {
    schoolAdmin,
    teachers,
    students,
    parents,
    allUsers: [schoolAdmin, ...teachers, ...students, ...parents]
  };
}

function buildStudentProfiles(students) {
  return students.map((student, index) => ({
    id: makeId("student-profile", student.id),
    userId: student.id,
    grade: student.grade,
    subjects: ["math", "chinese", "english"],
    target: STUDENT_TARGETS[student.grade] ?? "完成阶段性巩固与提升",
    school: SCHOOL.name,
    observerCode: `HKOBS-${student.grade}-${pad(index + 1, 3)}`,
    updatedAt: daysAgo(index % 4, 18, 30)
  }));
}

function buildClasses(teachersById) {
  return CLASS_BLUEPRINTS.map((klass, index) => ({
    id: makeId("class", klass.key),
    name: klass.name,
    subject: klass.subject,
    grade: klass.grade,
    schoolId: SCHOOL.id,
    teacherId: teachersById.get(klass.teacherKey)?.id,
    createdAt: daysAgo(30 - index, 9, 0),
    joinCode: klass.joinCode,
    joinMode: index % 2 === 0 ? "auto" : "approval"
  }));
}

function buildKnowledgePoints() {
  const points = [];
  CLASS_BLUEPRINTS.forEach((klass) => {
    const templateKey = `${klass.grade}-${klass.subject}`;
    const titles = KNOWLEDGE_POINT_TEMPLATES[templateKey] ?? [];
    titles.forEach((title, index) => {
      points.push({
        id: makeId("kp", klass.grade, klass.subject, pad(index + 1)),
        subject: klass.subject,
        grade: klass.grade,
        title,
        chapter: `${subjectDescriptor(klass.subject)}阶段单元 ${index + 1}`,
        unit: `专题 ${index + 1}`,
        createdAt: daysAgo(18 - index, 10, 0),
        updatedAt: daysAgo(3, 8, 30)
      });
    });
  });
  return points;
}

function questionPackage(subject, kpTitle, index) {
  if (subject === "math") {
    return {
      stem: `围绕“${kpTitle}”，下列哪一步最符合规范解题要求？`,
      options: ["A. 先审题并列出已知量", "B. 只写结果不写过程", "C. 先猜答案再补步骤", "D. 不核对单位直接提交"],
      answer: "A. 先审题并列出已知量",
      explanation: "数学诊断更强调审题、列式和过程的完整性。",
      abilities: ["审题", "列式", "复盘"]
    };
  }

  if (subject === "chinese") {
    return {
      stem: `学习“${kpTitle}”时，下列哪种做法最能帮助学生完成阅读或表达任务？`,
      options: ["A. 抓住中心句与关键信息", "B. 脱离文本自由发挥", "C. 只摘抄原文不加工", "D. 只写结论不说明依据"],
      answer: "A. 抓住中心句与关键信息",
      explanation: "语文任务更强调从文本依据出发，再完成表达组织。",
      abilities: ["信息提取", "文本理解", "表达组织"]
    };
  }

  const optionSets = [
    ["A. 先定位关键词再回到原文", "B. 只看题干不看语境", "C. 全文逐词硬译", "D. 遇到生词立即放弃"],
    ["A. 明确时态与人称后再作答", "B. 忽略上下文直接套模板", "C. 只记单词不看句子关系", "D. 不检查语法就提交"],
    ["A. 先搭建写作框架再填充内容", "B. 先写中文再逐词翻译", "C. 全篇只用简单句", "D. 开头结尾都省略"]
  ];
  const chosen = optionSets[index % optionSets.length];
  return {
    stem: `在“${kpTitle}”这一英语学习任务中，哪种处理方式更合理？`,
    options: chosen,
    answer: chosen[0],
    explanation: "英语任务要兼顾语境、结构和表达目的，不能只停留在词汇层面。",
    abilities: ["语境理解", "结构表达", "语法检查"]
  };
}

function buildQuestions(knowledgePoints) {
  const questions = [];

  knowledgePoints.forEach((kp) => {
    for (let index = 0; index < 4; index += 1) {
      const pack = questionPackage(kp.subject, kp.title, index);
      questions.push({
        id: makeId("question", kp.grade, kp.subject, kp.id, pad(index + 1)),
        subject: kp.subject,
        grade: kp.grade,
        knowledgePointId: kp.id,
        stem: pack.stem,
        options: pack.options,
        answer: pack.answer,
        explanation: pack.explanation,
        difficulty: index === 0 ? "easy" : index === 3 ? "hard" : "medium",
        questionType: "choice",
        tags: [kp.title],
        abilities: pack.abilities,
        createdAt: daysAgo(12 - index, 11, 0),
        updatedAt: daysAgo(2, 15, 0)
      });
    }
  });

  return questions;
}

function moduleBlueprint(subject) {
  if (subject === "math") {
    return [
      { title: "基础诊断与讲评", description: "围绕核心概念完成课内讲评与随堂订正。" },
      { title: "分层练习与错因复盘", description: "结合错题回流安排二次训练与讲评。" }
    ];
  }

  if (subject === "chinese") {
    return [
      { title: "阅读理解与文本分析", description: "强化文本证据意识和信息提取能力。" },
      { title: "表达训练与写作讲评", description: "完成片段写作、结构重组和讲评反馈。" }
    ];
  }

  return [
    { title: "词汇语法与课堂运用", description: "完成词汇、句型和口头表达基础训练。" },
    { title: "阅读表达与写作提升", description: "围绕阅读定位、应用写作和口语表达展开训练。" }
  ];
}

function buildModules(classes) {
  const modules = [];
  const resources = [];
  const modulesByClass = new Map();

  classes.forEach((klass, classIndex) => {
    const blueprints = moduleBlueprint(klass.subject);
    blueprints.forEach((blueprint, index) => {
      const moduleId = makeId("module", klass.id, pad(index + 1));
      const moduleRecord = {
        id: moduleId,
        classId: klass.id,
        parentId: null,
        title: blueprint.title,
        description: blueprint.description,
        orderIndex: index + 1,
        createdAt: daysAgo(20 - classIndex, 14, 0)
      };
      modules.push(moduleRecord);

      if (!modulesByClass.has(klass.id)) {
        modulesByClass.set(klass.id, []);
      }
      modulesByClass.get(klass.id).push(moduleRecord);

      resources.push({
        id: makeId("module-resource", moduleId, "link"),
        moduleId,
        title: `${klass.name}${blueprint.title}任务单`,
        resourceType: "link",
        linkUrl: `https://eduai.net.cn/${klass.subject}/overview`,
        createdAt: daysAgo(10 - index, 16, 0)
      });

      resources.push({
        id: makeId("module-resource", moduleId, "file"),
        moduleId,
        title: `${klass.name}${blueprint.title}学习单`,
        resourceType: "file",
        fileName: `${klass.name}-${blueprint.title}.txt`,
        mimeType: "text/plain",
        size: BASE64_TEXT.length,
        contentBase64: BASE64_TEXT,
        createdAt: daysAgo(9 - index, 17, 0)
      });
    });
  });

  return { modules, resources, modulesByClass };
}

function assignmentBlueprint(subject) {
  if (subject === "math") {
    return [
      { title: "周练诊断单", description: "围绕本周课堂重点完成限时诊断与订正。", submissionType: "quiz", gradingFocus: "审题与列式" },
      { title: "错因订正单", description: "根据课堂批注补写关键步骤并提交订正成果。", submissionType: "upload", gradingFocus: "步骤与规范" }
    ];
  }

  if (subject === "chinese") {
    return [
      { title: "阅读理解过关单", description: "完成文本阅读、信息提取与观点表达。", submissionType: "quiz", gradingFocus: "文本依据与表达" },
      { title: "片段写作任务", description: "根据课堂主题完成片段写作并提交修订稿。", submissionType: "essay", gradingFocus: "结构与表达" }
    ];
  }

  return [
    { title: "单元随堂检测", description: "完成词汇、语法与阅读基础检测。", submissionType: "quiz", gradingFocus: "语境与语法" },
    { title: "应用表达写作", description: "结合主题完成应用文或短文写作。", submissionType: "essay", gradingFocus: "结构与语言" }
  ];
}

function buildAssignments(classes, questionsByKey, modulesByClass) {
  const assignments = [];
  const assignmentItems = [];
  const assignmentRubrics = [];

  classes.forEach((klass, classIndex) => {
    const moduleList = modulesByClass.get(klass.id) ?? [];
    const pack = assignmentBlueprint(klass.subject);

    pack.forEach((blueprint, index) => {
      const assignmentId = makeId("assignment", klass.id, pad(index + 1));
      const assignment = {
        id: assignmentId,
        classId: klass.id,
        moduleId: moduleList[index]?.id ?? null,
        title: `${klass.name}${blueprint.title}`,
        description: blueprint.description,
        dueDate: daysAhead(3 + classIndex + index, 21, 0),
        createdAt: daysAgo(5 + index, 18, 0),
        submissionType: blueprint.submissionType,
        maxUploads: blueprint.submissionType === "upload" ? 3 : 2,
        gradingFocus: blueprint.gradingFocus
      };
      assignments.push(assignment);

      if (assignment.submissionType === "quiz") {
        const pool = questionsByKey.get(`${klass.subject}-${klass.grade}`) ?? [];
        pool.slice(0, 5).forEach((question, questionIndex) => {
          assignmentItems.push({
            id: makeId("assignment-item", assignmentId, pad(questionIndex + 1)),
            assignmentId,
            questionId: question.id
          });
        });
      } else {
        const rubrics =
          assignment.submissionType === "essay"
            ? [
                { title: "结构完整", description: "开头、主体与结尾组织完整", maxScore: 10 },
                { title: "内容质量", description: "观点、信息与例证足够支撑任务", maxScore: 10 },
                { title: "语言表达", description: "表达准确、衔接自然、格式规范", maxScore: 10 }
              ]
            : [
                { title: "完成度", description: "是否按要求完成订正内容", maxScore: 10 },
                { title: "准确性", description: "订正结果与老师要求是否一致", maxScore: 10 },
                { title: "规范性", description: "步骤、书写和提交材料是否规范", maxScore: 10 }
              ];

        rubrics.forEach((rubric, rubricIndex) => {
          assignmentRubrics.push({
            id: makeId("assignment-rubric", assignmentId, pad(rubricIndex + 1)),
            assignmentId,
            title: rubric.title,
            description: rubric.description,
            maxScore: rubric.maxScore,
            weight: 1,
            createdAt: daysAgo(4, 19, 0)
          });
        });
      }
    });
  });

  return { assignments, assignmentItems, assignmentRubrics };
}

function buildClassStudents(classes, students) {
  const studentsByGrade = new Map();
  students.forEach((student) => {
    if (!studentsByGrade.has(student.grade)) {
      studentsByGrade.set(student.grade, []);
    }
    studentsByGrade.get(student.grade).push(student);
  });

  const classStudents = [];
  const joinRequests = [];
  const rosterByClassId = new Map();

  classes.forEach((klass, classIndex) => {
    const roster = studentsByGrade.get(klass.grade) ?? [];
    rosterByClassId.set(
      klass.id,
      roster.map((student) => student.id)
    );

    roster.forEach((student, studentIndex) => {
      classStudents.push({
        id: makeId("class-student", klass.id, student.id),
        classId: klass.id,
        studentId: student.id,
        joinedAt: daysAgo(14 - (studentIndex % 3), 8, 0)
      });
    });

    const pendingStudent = roster[classIndex % Math.max(roster.length, 1)];
    if (pendingStudent) {
      joinRequests.push({
        id: makeId("join-request", klass.id, pendingStudent.id),
        classId: klass.id,
        studentId: pendingStudent.id,
        status: classIndex % 2 === 0 ? "approved" : "pending",
        createdAt: daysAgo(7 - (classIndex % 4), 13, 30),
        decidedAt: classIndex % 2 === 0 ? daysAgo(6 - (classIndex % 3), 16, 0) : null
      });
    }
  });

  return { classStudents, joinRequests, rosterByClassId };
}

function buildProgressAndSubmissions({ classes, assignments, assignmentItems, assignmentRubrics, rosterByClassId, studentsById }) {
  const progress = [];
  const submissions = [];
  const uploads = [];
  const reviews = [];
  const reviewItems = [];
  const reviewRubrics = [];
  const assignmentItemsByAssignment = new Map();
  const assignmentRubricsByAssignment = new Map();
  const classById = new Map(classes.map((klass) => [klass.id, klass]));

  assignmentItems.forEach((item) => {
    if (!assignmentItemsByAssignment.has(item.assignmentId)) {
      assignmentItemsByAssignment.set(item.assignmentId, []);
    }
    assignmentItemsByAssignment.get(item.assignmentId).push(item);
  });

  assignmentRubrics.forEach((rubric) => {
    if (!assignmentRubricsByAssignment.has(rubric.assignmentId)) {
      assignmentRubricsByAssignment.set(rubric.assignmentId, []);
    }
    assignmentRubricsByAssignment.get(rubric.assignmentId).push(rubric);
  });

  assignments.forEach((assignment) => {
    const klass = classById.get(assignment.classId);
    const roster = rosterByClassId.get(assignment.classId) ?? [];
    const quizItems = assignmentItemsByAssignment.get(assignment.id) ?? [];
    const rubrics = assignmentRubricsByAssignment.get(assignment.id) ?? [];

    roster.forEach((studentId, rosterIndex) => {
      const student = studentsById.get(studentId);
      const ratio = stableRatio(`${assignment.id}:${studentId}`);
      const status = ratio > 0.78 ? "pending" : ratio > 0.55 ? "in_progress" : "completed";
      const completed = status === "completed";
      const progressId = makeId("assignment-progress", assignment.id, studentId);
      const baseScore = 70 + Math.round((1 - ratio) * 22);
      const total = assignment.submissionType === "quiz" ? quizItems.length : 100;
      const score = assignment.submissionType === "quiz" ? Math.max(3, Math.min(total, total - Math.round(ratio * 2))) : baseScore;

      progress.push({
        id: progressId,
        assignmentId: assignment.id,
        studentId,
        status,
        completedAt: completed ? daysAgo(1 + (rosterIndex % 3), 20, 15) : null,
        score: completed ? score : null,
        total: completed ? total : null
      });

      if (!completed) {
        return;
      }

      const reviewId = makeId("assignment-review", assignment.id, studentId);
      const submittedAt = daysAgo(1 + (rosterIndex % 4), 19, 35);

      if (assignment.submissionType === "quiz") {
        const answers = {};
        quizItems.forEach((item, itemIndex) => {
          answers[item.questionId] = itemIndex === 1 && ratio > 0.25 ? "B. 脱离文本自由发挥" : "A. 先审题并列出已知量";
        });

        submissions.push({
          id: makeId("assignment-submission", assignment.id, studentId),
          assignmentId: assignment.id,
          studentId,
          answers,
          score,
          total,
          submittedAt,
          submissionText: null
        });

        reviews.push({
          id: reviewId,
          assignmentId: assignment.id,
          studentId,
          overallComment:
            klass?.subject === "math"
              ? `${student?.name ?? "学生"}整体完成度较稳，建议继续把列式依据写完整。`
              : klass?.subject === "chinese"
                ? `${student?.name ?? "学生"}能抓住关键信息，但表达依据还可以更具体。`
                : `${student?.name ?? "学生"}语境把握较好，建议提交前再检查时态和格式。`,
          createdAt: submittedAt,
          updatedAt: submittedAt
        });

        if (quizItems[1]) {
          reviewItems.push({
            id: makeId("assignment-review-item", assignment.id, studentId, "01"),
            reviewId,
            questionId: quizItems[1].questionId,
            wrongTag: klass?.subject === "math" ? "审题不完整" : klass?.subject === "chinese" ? "依据不足" : "语法细节",
            comment:
              klass?.subject === "math"
                ? "把已知量和单位写清楚后，再进入计算。"
                : klass?.subject === "chinese"
                  ? "建议先划出关键句，再组织答案。"
                  : "请先定位时态，再补写细节表达。"
          });
        }
      } else {
        const submissionText =
          assignment.submissionType === "essay"
            ? `${student?.name ?? "学生"}已按课堂要求完成《${assignment.title}》初稿，并根据讲评补写了结构与细节。`
            : `${student?.name ?? "学生"}已根据批注完成订正，并补充了关键步骤与错因说明。`;

        submissions.push({
          id: makeId("assignment-submission", assignment.id, studentId),
          assignmentId: assignment.id,
          studentId,
          answers: {},
          score,
          total: 100,
          submittedAt,
          submissionText
        });

        if (assignment.submissionType === "upload") {
          uploads.push({
            id: makeId("assignment-upload", assignment.id, studentId),
            assignmentId: assignment.id,
            studentId,
            fileName: `${student?.name ?? "学生"}-${assignment.title}.txt`,
            mimeType: "text/plain",
            size: BASE64_TEXT.length,
            contentBase64: BASE64_TEXT,
            createdAt: submittedAt
          });
        }

        reviews.push({
          id: reviewId,
          assignmentId: assignment.id,
          studentId,
          overallComment:
            assignment.submissionType === "essay"
              ? `${student?.name ?? "学生"}结构已经完整，下一步重点放在句子衔接与细节展开。`
              : `${student?.name ?? "学生"}订正态度较好，建议继续保持书写和步骤的完整性。`,
          createdAt: submittedAt,
          updatedAt: submittedAt
        });

        rubrics.forEach((rubric, rubricIndex) => {
          reviewRubrics.push({
            id: makeId("assignment-review-rubric", assignment.id, studentId, pad(rubricIndex + 1)),
            reviewId,
            rubricId: rubric.id,
            score: Math.max(7, rubric.maxScore - Math.round(ratio * 2)),
            comment:
              rubricIndex === 0
                ? "完成度达标，继续保持。"
                : rubricIndex === 1
                  ? "细节基本准确，仍可进一步精炼。"
                  : "表达较自然，注意提交前做一次自查。"
          });
        });
      }
    });
  });

  return { progress, submissions, uploads, reviews, reviewItems, reviewRubrics };
}

function buildAnnouncements(classes, teachersByUserId) {
  const announcements = [];

  classes.forEach((klass, index) => {
    const teacher = teachersByUserId.get(klass.teacherId);

    announcements.push({
      id: makeId("announcement", klass.id, "01"),
      classId: klass.id,
      authorId: teacher?.id ?? null,
      title: `${klass.name}本周课堂安排`,
      content: "本周以课堂讲评、分层练习和当堂订正为主，请按时完成自主学习任务单。",
      createdAt: daysAgo(3, 17, 30)
    });

    announcements.push({
      id: makeId("announcement", klass.id, "02"),
      classId: klass.id,
      authorId: teacher?.id ?? null,
      title: `${klass.name}阶段诊断提醒`,
      content: index % 2 === 0 ? "周五将进行阶段诊断，请完成错题复盘后再进入练习。" : "请同学们在课前完成预习任务，课堂将进行互动讲评。",
      createdAt: daysAgo(1, 12, 0)
    });
  });

  return announcements;
}

function buildNotifications({ schoolAdmin, teachers, students, parents }) {
  const notifications = [];

  notifications.push({
    id: makeId("notification", "school-admin", "01"),
    userId: schoolAdmin.id,
    title: `${SCHOOL.name}测试数据已初始化`,
    content: "学校、教师、学生、家长与课堂作业数据已同步完成，可直接开始全链路测试。",
    type: "system",
    createdAt: daysAgo(0, 9, 0)
  });

  teachers.forEach((teacher, index) => {
    notifications.push({
      id: makeId("notification", "teacher", pad(index + 1)),
      userId: teacher.id,
      title: "课堂数据已同步",
      content: "本周课堂任务、作业诊断与学生提交记录已生成，可直接进入教师端查看。",
      type: "teacher_alert",
      createdAt: daysAgo(index % 3, 8, 45)
    });
  });

  students.forEach((student, index) => {
    notifications.push({
      id: makeId("notification", "student", pad(index + 1, 3)),
      userId: student.id,
      title: "你的自主学习任务已发布",
      content: index % 2 === 0 ? "请先完成本周基础诊断，再查看老师推送的复盘建议。" : "今日已为你生成针对性巩固任务，建议在晚自习前完成。",
      type: "student_task",
      createdAt: daysAgo(index % 4, 18, 20)
    });
  });

  parents.forEach((parent, index) => {
    notifications.push({
      id: makeId("notification", "parent", pad(index + 1, 3)),
      userId: parent.id,
      title: "请查看学生本周学习反馈",
      content: index % 2 === 0 ? "系统已生成本周课堂表现与作业完成情况，建议今晚共同完成复盘。" : "孩子的阶段任务已更新，建议优先关注拖延项和订正项。",
      type: "parent_action",
      createdAt: daysAgo(index % 5, 20, 10)
    });
  });

  return notifications;
}

function buildSeedData() {
  const users = buildUsers();
  const teachersByKey = new Map(
    TEACHER_BLUEPRINTS.map((teacher, index) => [teacher.key, users.teachers[index]])
  );
  const teachersByUserId = new Map(users.teachers.map((teacher) => [teacher.id, teacher]));
  const studentsById = new Map(users.students.map((student) => [student.id, student]));

  const school = {
    id: SCHOOL.id,
    name: SCHOOL.name,
    code: SCHOOL.code,
    status: "active",
    createdAt: daysAgo(60, 9, 0),
    updatedAt: daysAgo(1, 9, 0)
  };
  const studentProfiles = buildStudentProfiles(users.students);
  const classes = buildClasses(teachersByKey);
  const knowledgePoints = buildKnowledgePoints();
  const questions = buildQuestions(knowledgePoints);
  const { modules, resources: moduleResources, modulesByClass } = buildModules(classes);
  const questionsByKey = new Map();

  questions.forEach((question) => {
    const key = `${question.subject}-${question.grade}`;
    if (!questionsByKey.has(key)) questionsByKey.set(key, []);
    questionsByKey.get(key).push(question);
  });

  const { assignments, assignmentItems, assignmentRubrics } = buildAssignments(classes, questionsByKey, modulesByClass);
  const { classStudents, joinRequests, rosterByClassId } = buildClassStudents(classes, users.students);
  const { progress, submissions, uploads, reviews, reviewItems, reviewRubrics } = buildProgressAndSubmissions({
    classes,
    assignments,
    assignmentItems,
    assignmentRubrics,
    rosterByClassId,
    studentsById
  });
  const announcements = buildAnnouncements(classes, teachersByUserId);
  const notifications = buildNotifications(users);

  return {
    school,
    users,
    studentProfiles,
    classes,
    knowledgePoints,
    questions,
    modules,
    moduleResources,
    assignments,
    assignmentItems,
    assignmentRubrics,
    classStudents,
    joinRequests,
    assignmentProgress: progress,
    assignmentSubmissions: submissions,
    assignmentUploads: uploads,
    assignmentReviews: reviews,
    assignmentReviewItems: reviewItems,
    assignmentReviewRubrics: reviewRubrics,
    announcements,
    notifications
  };
}

function toExportRows(data) {
  const classHints = new Map();
  CLASS_BLUEPRINTS.forEach((klass) => {
    const hint = klass.name.replace("·数学", "").replace("·语文", "").replace("·英语", "");
    if (!classHints.has(klass.grade)) {
      classHints.set(klass.grade, hint);
    }
  });

  const rows = [];
  rows.push({
    school: SCHOOL.name,
    role: "school_admin",
    name: data.users.schoolAdmin.name,
    email: data.users.schoolAdmin.email,
    password: PASSWORDS.schoolAdmin,
    grade: "",
    class_hint: "管理后台"
  });

  data.users.teachers.forEach((teacher, index) => {
    rows.push({
      school: SCHOOL.name,
      role: "teacher",
      name: teacher.name,
      email: teacher.email,
      password: PASSWORDS.teacher,
      grade: CLASS_BLUEPRINTS[index]?.grade ?? "",
      class_hint: CLASS_BLUEPRINTS[index]?.name ?? "教师端"
    });
  });

  data.users.students.forEach((student) => {
    rows.push({
      school: SCHOOL.name,
      role: "student",
      name: student.name,
      email: student.email,
      password: PASSWORDS.student,
      grade: student.grade,
      class_hint: classHints.get(student.grade) ?? ""
    });
  });

  data.users.parents.forEach((parent) => {
    const linkedStudent = data.users.students.find((student) => student.id === parent.studentId);
    rows.push({
      school: SCHOOL.name,
      role: "parent",
      name: parent.name,
      email: parent.email,
      password: PASSWORDS.parent,
      grade: linkedStudent?.grade ?? "",
      class_hint: linkedStudent ? `${classHints.get(linkedStudent.grade) ?? ""} / 关联学生：${linkedStudent.name}` : ""
    });
  });

  return rows;
}

function writeAccountExport(rows) {
  fs.mkdirSync(path.dirname(EXPORT_PATH), { recursive: true });
  const columns = ["school", "role", "name", "email", "password", "grade", "class_hint"];
  const lines = [columns.map(toCsvCell).join(",")];
  rows.forEach((row) => {
    lines.push(columns.map((column) => toCsvCell(row[column])).join(","));
  });
  fs.writeFileSync(EXPORT_PATH, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

async function upsertRows(client, table, rows, options = {}) {
  if (!rows.length) return;

  const columns = options.columns ?? Object.keys(rows[0]);
  const conflict = options.conflict ?? ["id"];
  const updateColumns =
    options.updateColumns ??
    columns.filter((column) => !conflict.includes(column));

  const chunkSize = options.chunkSize ?? 100;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const params = [];
    const values = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        params.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    const updateClause = updateColumns.length
      ? `DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}`
      : "DO NOTHING";

    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")})
       VALUES ${values.join(", ")}
       ON CONFLICT (${conflict.join(", ")}) ${updateClause}`,
      params
    );
  }
}

function toDbRows(data) {
  return {
    school: {
      id: data.school.id,
      name: data.school.name,
      code: data.school.code,
      status: data.school.status,
      created_at: data.school.createdAt,
      updated_at: data.school.updatedAt
    },
    users: data.users.allUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      password: user.password,
      grade: user.grade ?? null,
      school_id: user.schoolId ?? null,
      student_id: user.studentId ?? null,
      created_at: user.createdAt ?? daysAgo(15, 8, 0)
    })),
    studentProfiles: data.studentProfiles.map((profile) => ({
      id: profile.id,
      user_id: profile.userId,
      grade: profile.grade,
      subjects: profile.subjects,
      target: profile.target,
      school: profile.school,
      observer_code: profile.observerCode,
      updated_at: profile.updatedAt
    })),
    knowledgePoints: data.knowledgePoints.map((kp) => ({
      id: kp.id,
      subject: kp.subject,
      grade: kp.grade,
      title: kp.title,
      chapter: kp.chapter,
      unit: kp.unit,
      created_at: kp.createdAt,
      updated_at: kp.updatedAt
    })),
    questions: data.questions.map((question) => ({
      id: question.id,
      subject: question.subject,
      grade: question.grade,
      knowledge_point_id: question.knowledgePointId,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      question_type: question.questionType,
      tags: question.tags,
      abilities: question.abilities,
      created_at: question.createdAt,
      updated_at: question.updatedAt
    })),
    classes: data.classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      subject: klass.subject,
      grade: klass.grade,
      school_id: klass.schoolId,
      teacher_id: klass.teacherId,
      created_at: klass.createdAt,
      join_code: klass.joinCode,
      join_mode: klass.joinMode
    })),
    classStudents: data.classStudents.map((row) => ({
      id: row.id,
      class_id: row.classId,
      student_id: row.studentId,
      joined_at: row.joinedAt
    })),
    joinRequests: data.joinRequests.map((row) => ({
      id: row.id,
      class_id: row.classId,
      student_id: row.studentId,
      status: row.status,
      created_at: row.createdAt,
      decided_at: row.decidedAt
    })),
    modules: data.modules.map((module) => ({
      id: module.id,
      class_id: module.classId,
      parent_id: module.parentId,
      title: module.title,
      description: module.description,
      order_index: module.orderIndex,
      created_at: module.createdAt
    })),
    moduleResources: data.moduleResources.map((resource) => ({
      id: resource.id,
      module_id: resource.moduleId,
      title: resource.title,
      resource_type: resource.resourceType,
      file_name: resource.fileName ?? null,
      mime_type: resource.mimeType ?? null,
      size: resource.size ?? null,
      content_base64: resource.contentBase64 ?? null,
      link_url: resource.linkUrl ?? null,
      created_at: resource.createdAt
    })),
    assignments: data.assignments.map((assignment) => ({
      id: assignment.id,
      class_id: assignment.classId,
      module_id: assignment.moduleId ?? null,
      title: assignment.title,
      description: assignment.description,
      due_date: assignment.dueDate,
      created_at: assignment.createdAt,
      submission_type: assignment.submissionType,
      max_uploads: assignment.maxUploads,
      grading_focus: assignment.gradingFocus
    })),
    assignmentItems: data.assignmentItems.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      question_id: item.questionId
    })),
    assignmentRubrics: data.assignmentRubrics.map((rubric) => ({
      id: rubric.id,
      assignment_id: rubric.assignmentId,
      title: rubric.title,
      description: rubric.description,
      max_score: rubric.maxScore,
      weight: rubric.weight,
      created_at: rubric.createdAt
    })),
    assignmentProgress: data.assignmentProgress.map((row) => ({
      id: row.id,
      assignment_id: row.assignmentId,
      student_id: row.studentId,
      status: row.status,
      completed_at: row.completedAt,
      score: row.score,
      total: row.total
    })),
    assignmentSubmissions: data.assignmentSubmissions.map((row) => ({
      id: row.id,
      assignment_id: row.assignmentId,
      student_id: row.studentId,
      answers: row.answers,
      score: row.score,
      total: row.total,
      submitted_at: row.submittedAt,
      submission_text: row.submissionText ?? null
    })),
    assignmentUploads: data.assignmentUploads.map((row) => ({
      id: row.id,
      assignment_id: row.assignmentId,
      student_id: row.studentId,
      file_name: row.fileName,
      mime_type: row.mimeType,
      size: row.size,
      content_base64: row.contentBase64 ?? null,
      created_at: row.createdAt
    })),
    assignmentReviews: data.assignmentReviews.map((row) => ({
      id: row.id,
      assignment_id: row.assignmentId,
      student_id: row.studentId,
      overall_comment: row.overallComment,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    })),
    assignmentReviewItems: data.assignmentReviewItems.map((row) => ({
      id: row.id,
      review_id: row.reviewId,
      question_id: row.questionId,
      wrong_tag: row.wrongTag ?? null,
      comment: row.comment ?? null
    })),
    assignmentReviewRubrics: data.assignmentReviewRubrics.map((row) => ({
      id: row.id,
      review_id: row.reviewId,
      rubric_id: row.rubricId,
      score: row.score,
      comment: row.comment
    })),
    announcements: data.announcements.map((row) => ({
      id: row.id,
      class_id: row.classId,
      author_id: row.authorId,
      title: row.title,
      content: row.content,
      created_at: row.createdAt
    })),
    notifications: data.notifications.map((row) => ({
      id: row.id,
      user_id: row.userId,
      title: row.title,
      content: row.content,
      type: row.type,
      created_at: row.createdAt
    }))
  };
}

async function seedDatabase(rows) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await upsertRows(client, "schools", [rows.school], {
      columns: ["id", "name", "code", "status", "created_at", "updated_at"]
    });
    await upsertRows(client, "users", rows.users, {
      columns: ["id", "email", "name", "role", "password", "grade", "school_id", "student_id", "created_at"],
      conflict: ["email"],
      updateColumns: ["name", "role", "password", "grade", "school_id", "student_id", "created_at"]
    });
    await upsertRows(client, "student_profiles", rows.studentProfiles, {
      columns: ["id", "user_id", "grade", "subjects", "target", "school", "observer_code", "updated_at"],
      conflict: ["user_id"],
      updateColumns: ["grade", "subjects", "target", "school", "observer_code", "updated_at"]
    });
    await upsertRows(client, "knowledge_points", rows.knowledgePoints, {
      columns: ["id", "subject", "grade", "title", "chapter", "unit", "created_at", "updated_at"]
    });
    await upsertRows(client, "questions", rows.questions, {
      columns: ["id", "subject", "grade", "knowledge_point_id", "stem", "options", "answer", "explanation", "difficulty", "question_type", "tags", "abilities", "created_at", "updated_at"]
    });
    await upsertRows(client, "classes", rows.classes, {
      columns: ["id", "name", "subject", "grade", "school_id", "teacher_id", "created_at", "join_code", "join_mode"]
    });
    await upsertRows(client, "class_students", rows.classStudents, {
      columns: ["id", "class_id", "student_id", "joined_at"],
      conflict: ["class_id", "student_id"],
      updateColumns: ["id", "joined_at"]
    });
    await upsertRows(client, "class_join_requests", rows.joinRequests, {
      columns: ["id", "class_id", "student_id", "status", "created_at", "decided_at"],
      conflict: ["class_id", "student_id"],
      updateColumns: ["id", "status", "created_at", "decided_at"]
    });
    await upsertRows(client, "course_modules", rows.modules, {
      columns: ["id", "class_id", "parent_id", "title", "description", "order_index", "created_at"]
    });
    await upsertRows(client, "module_resources", rows.moduleResources, {
      columns: ["id", "module_id", "title", "resource_type", "file_name", "mime_type", "size", "content_base64", "link_url", "created_at"]
    });
    await upsertRows(client, "assignments", rows.assignments, {
      columns: ["id", "class_id", "module_id", "title", "description", "due_date", "created_at", "submission_type", "max_uploads", "grading_focus"]
    });
    await upsertRows(client, "assignment_items", rows.assignmentItems, {
      columns: ["id", "assignment_id", "question_id"]
    });
    await upsertRows(client, "assignment_rubrics", rows.assignmentRubrics, {
      columns: ["id", "assignment_id", "title", "description", "max_score", "weight", "created_at"]
    });
    await upsertRows(client, "assignment_progress", rows.assignmentProgress, {
      columns: ["id", "assignment_id", "student_id", "status", "completed_at", "score", "total"],
      conflict: ["assignment_id", "student_id"],
      updateColumns: ["id", "status", "completed_at", "score", "total"]
    });
    await upsertRows(client, "assignment_submissions", rows.assignmentSubmissions, {
      columns: ["id", "assignment_id", "student_id", "answers", "score", "total", "submitted_at", "submission_text"],
      conflict: ["assignment_id", "student_id"],
      updateColumns: ["id", "answers", "score", "total", "submitted_at", "submission_text"]
    });
    await upsertRows(client, "assignment_uploads", rows.assignmentUploads, {
      columns: ["id", "assignment_id", "student_id", "file_name", "mime_type", "size", "content_base64", "created_at"]
    });
    await upsertRows(client, "assignment_reviews", rows.assignmentReviews, {
      columns: ["id", "assignment_id", "student_id", "overall_comment", "created_at", "updated_at"],
      conflict: ["assignment_id", "student_id"],
      updateColumns: ["id", "overall_comment", "created_at", "updated_at"]
    });
    await upsertRows(client, "assignment_review_items", rows.assignmentReviewItems, {
      columns: ["id", "review_id", "question_id", "wrong_tag", "comment"]
    });
    await upsertRows(client, "assignment_review_rubrics", rows.assignmentReviewRubrics, {
      columns: ["id", "review_id", "rubric_id", "score", "comment"]
    });
    await upsertRows(client, "announcements", rows.announcements, {
      columns: ["id", "class_id", "author_id", "title", "content", "created_at"]
    });
    await upsertRows(client, "notifications", rows.notifications, {
      columns: ["id", "user_id", "title", "content", "type", "created_at"]
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function printSummary(data) {
  console.log(`Seed school: ${SCHOOL.name} (${SCHOOL.id})`);
  console.log(`School admin: ${data.users.schoolAdmin.email} / ${PASSWORDS.schoolAdmin}`);
  console.log(`Teachers: ${data.users.teachers.length}`);
  console.log(`Students: ${data.users.students.length}`);
  console.log(`Parents: ${data.users.parents.length}`);
  console.log(`Classes: ${data.classes.length}`);
  console.log(`Assignments: ${data.assignments.length}`);
  console.log(`Notifications: ${data.notifications.length}`);
  console.log(`Export: ${EXPORT_PATH}`);
}

async function main() {
  const data = buildSeedData();
  const exportRows = toExportRows(data);
  writeAccountExport(exportRows);

  if (DRY_RUN) {
    printSummary(data);
    console.log("Dry run complete. Database was not modified.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await seedDatabase(toDbRows(data));
  printSummary(data);
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? error);
  process.exit(1);
});
