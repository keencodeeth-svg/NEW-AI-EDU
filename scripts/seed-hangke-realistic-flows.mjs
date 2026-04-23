import pg from "pg";
import { bootstrapProjectEnv } from "./script-env.mjs";

const { Pool } = pg;

bootstrapProjectEnv();

const SCHOOL_ID = "hangke-school-lingang";
const FLOW_PREFIX = "hangke-flow";
const DRY_RUN = process.argv.includes("--dry-run");

function now() {
  return new Date();
}

function withOffset({ days = 0, hours = 0, minutes = 0, atHour, atMinute = 0, anchor = now() }) {
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
  return withOffset({ days: -days, atHour: hour, atMinute: minute });
}

function daysAhead(days, hour = 9, minute = 0) {
  return withOffset({ days, atHour: hour, atMinute: minute });
}

function hoursAgo(hours) {
  return withOffset({ hours: -hours });
}

function hoursAhead(hours) {
  return withOffset({ hours });
}

function makeId(...parts) {
  return [FLOW_PREFIX, ...parts].join("-");
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function stableNumber(seed) {
  return Array.from(String(seed)).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 13), 101);
}

function stableRatio(seed) {
  return (stableNumber(seed) % 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function groupBy(items, getKey) {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  });
  return map;
}

function compareByCreatedDesc(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function buildWritingFeedback(input) {
  return {
    scores: input.scores,
    summary: input.summary,
    strengths: input.strengths,
    improvements: input.improvements,
    corrected: input.corrected,
    quality: {
      confidenceScore: input.qualityScore ?? 86,
      riskLevel: "low",
      needsHumanReview: false,
      fallbackAction: "",
      reasons: ["seeded-demo"],
      minQualityScore: 70,
      policyViolated: false
    }
  };
}

function buildExamReviewPack(input) {
  const topWeakKnowledgePoints = Array.from(
    input.wrongQuestions.reduce((map, item) => {
      const current = map.get(item.knowledgePointId) ?? {
        knowledgePointId: item.knowledgePointId,
        title: item.knowledgePointTitle,
        wrongCount: 0
      };
      current.wrongCount += 1;
      map.set(item.knowledgePointId, current);
      return map;
    }, new Map()).values()
  )
    .sort((left, right) => right.wrongCount - left.wrongCount)
    .slice(0, 3);

  const wrongByDifficulty = Array.from(
    input.wrongQuestions.reduce((map, item) => {
      map.set(item.difficulty, (map.get(item.difficulty) ?? 0) + 1);
      return map;
    }, new Map()).entries()
  ).map(([difficulty, count]) => ({ difficulty, count }));

  const wrongByType = Array.from(
    input.wrongQuestions.reduce((map, item) => {
      map.set(item.questionType, (map.get(item.questionType) ?? 0) + 1);
      return map;
    }, new Map()).entries()
  ).map(([questionType, count]) => ({ questionType, count }));

  const focusTitle = topWeakKnowledgePoints[0]?.title ?? "核心知识点";

  return {
    wrongCount: input.wrongQuestions.length,
    generatedAt: input.generatedAt,
    summary: {
      topWeakKnowledgePoints,
      wrongByDifficulty,
      wrongByType,
      estimatedMinutes: Math.max(18, input.wrongQuestions.length * 9)
    },
    rootCauses: [
      "错题集中在同一组知识点，建议先做专项修复，再回到综合题。",
      "存在审题和表达不完整的问题，复盘时要先写依据再写答案。"
    ],
    actionItems: [
      {
        id: "review-pack-action-kp",
        title: "专项修复",
        description: `优先围绕「${focusTitle}」完成 5 题专项练习。`,
        estimatedMinutes: 20,
        knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
      },
      {
        id: "review-pack-action-wrongbook",
        title: "24h 复练",
        description: "将本次错题加入今日错题复练清单，优先在 24 小时内再做一轮。",
        estimatedMinutes: 12,
        knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
      }
    ],
    sevenDayPlan: [
      { day: 1, title: "D1 错因复盘", focus: "逐题回顾失分点和关键依据", estimatedMinutes: 20 },
      { day: 2, title: "D2 定向补练", focus: `完成「${focusTitle}」专项练习`, estimatedMinutes: 15 },
      { day: 3, title: "D3 变式训练", focus: "围绕同类题做迁移练习", estimatedMinutes: 15 },
      { day: 5, title: "D5 72h 复练", focus: "检验是否真正掌握", estimatedMinutes: 15 },
      { day: 7, title: "D7 总结", focus: "整理本周提分点和下一步计划", estimatedMinutes: 10 }
    ],
    wrongQuestions: input.wrongQuestions
  };
}

async function upsertRows(client, table, rows, options = {}) {
  if (!rows.length) return;

  const columns = options.columns ?? Object.keys(rows[0]);
  const conflict = options.conflict ?? ["id"];
  const updateColumns = options.updateColumns ?? columns.filter((column) => !conflict.includes(column));
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

async function loadContext(client) {
  const usersResult = await client.query(
    `SELECT id, email, name, role, grade, school_id, student_id, created_at
     FROM users
     WHERE school_id = $1
     ORDER BY role, email`,
    [SCHOOL_ID]
  );
  const classesResult = await client.query(
    `SELECT id, name, subject, grade, school_id, teacher_id, join_code, join_mode, created_at
     FROM classes
     WHERE school_id = $1
     ORDER BY grade, subject, name`,
    [SCHOOL_ID]
  );

  const classIds = classesResult.rows.map((item) => item.id);
  const classStudentsResult = classIds.length
    ? await client.query(
        `SELECT id, class_id, student_id, joined_at
         FROM class_students
         WHERE class_id = ANY($1)
         ORDER BY class_id, student_id`,
        [classIds]
      )
    : { rows: [] };

  const grades = Array.from(new Set(classesResult.rows.map((item) => item.grade)));
  const subjects = Array.from(new Set(classesResult.rows.map((item) => item.subject)));
  const knowledgePointsResult =
    grades.length && subjects.length
      ? await client.query(
          `SELECT id, subject, grade, title, chapter, unit
           FROM knowledge_points
           WHERE grade = ANY($1) AND subject = ANY($2)
           ORDER BY grade, subject, chapter, title`,
          [grades, subjects]
        )
      : { rows: [] };

  const questionsResult =
    grades.length && subjects.length
      ? await client.query(
          `SELECT id, subject, grade, knowledge_point_id, stem, options, answer, explanation, difficulty, question_type, created_at, updated_at
           FROM questions
           WHERE grade = ANY($1) AND subject = ANY($2)
           ORDER BY grade, subject, knowledge_point_id, id`,
          [grades, subjects]
        )
      : { rows: [] };

  return {
    users: usersResult.rows,
    classes: classesResult.rows,
    classStudents: classStudentsResult.rows,
    knowledgePoints: knowledgePointsResult.rows,
    questions: questionsResult.rows
  };
}

function buildExams(context) {
  const knowledgePointById = new Map(context.knowledgePoints.map((item) => [item.id, item]));
  const questionsBySubjectGrade = groupBy(
    context.questions.filter((item) => item.knowledge_point_id),
    (item) => `${item.subject}:${item.grade}`
  );
  const rosterByClassId = groupBy(context.classStudents, (item) => item.class_id);
  const papers = [];
  const paperItems = [];
  const examAssignments = [];
  const examAnswers = [];
  const examSubmissions = [];
  const examReviewPackages = [];
  const examEvents = [];

  context.classes.forEach((klass, classIndex) => {
    const pool = (questionsBySubjectGrade.get(`${klass.subject}:${klass.grade}`) ?? []).slice(0, 6);
    if (!pool.length) return;

    const paperId = makeId("exam-paper", klass.id);
    const paper =
      classIndex % 3 === 0
        ? {
            id: paperId,
            classId: klass.id,
            title: `${klass.name}阶段诊断`,
            description: "围绕本周课堂重点完成阶段检测与复盘。",
            publishMode: "teacher_assigned",
            antiCheatLevel: "basic",
            startAt: daysAgo(1, 14, 0),
            endAt: daysAhead(1, 20, 0),
            durationMinutes: 35,
            status: "published",
            createdBy: klass.teacher_id,
            createdAt: daysAgo(2, 18, 0),
            updatedAt: daysAgo(1, 8, 30)
          }
        : classIndex % 3 === 1
          ? {
              id: paperId,
              classId: klass.id,
              title: `${klass.name}单元测验`,
              description: "课前完成预习后参加单元检测。",
              publishMode: "teacher_assigned",
              antiCheatLevel: "basic",
              startAt: daysAhead(1, 9, 0),
              endAt: daysAhead(1, 12, 0),
              durationMinutes: 30,
              status: "published",
              createdBy: klass.teacher_id,
              createdAt: daysAgo(1, 17, 0),
              updatedAt: daysAgo(1, 17, 0)
            }
          : {
              id: paperId,
              classId: klass.id,
              title: `${klass.name}周测复盘卷`,
              description: "课堂讲评后完成周测，系统自动生成错因建议。",
              publishMode: "teacher_assigned",
              antiCheatLevel: "basic",
              startAt: daysAgo(1, 8, 30),
              endAt: daysAhead(0, 21, 0),
              durationMinutes: 30,
              status: "published",
              createdBy: klass.teacher_id,
              createdAt: daysAgo(2, 12, 0),
              updatedAt: daysAgo(0, 7, 30)
            };
    papers.push(paper);

    pool.forEach((question, questionIndex) => {
      paperItems.push({
        id: makeId("exam-item", paperId, pad(questionIndex + 1)),
        paperId,
        questionId: question.id,
        score: 10,
        orderIndex: questionIndex + 1
      });
    });

    const roster = rosterByClassId.get(klass.id) ?? [];
    roster.forEach((row, rosterIndex) => {
      const studentId = row.student_id;
      const seed = `${paperId}:${studentId}`;
      const ratio = stableRatio(seed);
      const total = pool.length * 10;
      let status = "pending";
      if (classIndex % 3 === 0 && rosterIndex === 0) {
        status = "in_progress";
      } else if (ratio < 0.62) {
        status = "submitted";
      }

      const assignedAt = daysAgo(1 + (classIndex % 2), 15, 0);
      const startedAt = status === "in_progress" || status === "submitted" ? hoursAgo(3 + (rosterIndex % 2)) : null;
      const submittedAt = status === "submitted" ? hoursAgo(1 + (rosterIndex % 3)) : null;
      const wrongQuestions = [];
      const answers = {};
      let score = total;

      pool.forEach((question, questionIndex) => {
        const questionSeed = `${seed}:${question.id}`;
        const wrong = status === "submitted" ? stableRatio(questionSeed) > 0.72 || questionIndex === 1 : questionIndex === 0;
        const chosenAnswer =
          wrong && question.options?.length > 1
            ? question.options.find((item) => item !== question.answer) ?? question.options[0]
            : question.answer;
        answers[question.id] = chosenAnswer;

        if (status === "submitted" && chosenAnswer !== question.answer) {
          score -= 10;
          const kp = knowledgePointById.get(question.knowledge_point_id);
          wrongQuestions.push({
            questionId: question.id,
            stem: question.stem,
            knowledgePointId: question.knowledge_point_id,
            knowledgePointTitle: kp?.title ?? question.knowledge_point_id,
            difficulty: question.difficulty ?? "medium",
            questionType: question.question_type ?? "choice",
            yourAnswer: chosenAnswer,
            correctAnswer: question.answer,
            score: 10
          });
        }
      });

      examAssignments.push({
        id: makeId("exam-assignment", paperId, studentId),
        paperId,
        studentId,
        status,
        assignedAt,
        startedAt,
        autoSavedAt: status === "in_progress" ? hoursAgo(1) : null,
        submittedAt,
        score: status === "submitted" ? score : null,
        total: status === "submitted" ? total : null
      });

      if (status === "in_progress") {
        const draftAnswers = Object.fromEntries(Object.entries(answers).slice(0, 3));
        examAnswers.push({
          id: makeId("exam-answer", paperId, studentId),
          paperId,
          studentId,
          answers: draftAnswers,
          updatedAt: hoursAgo(1)
        });
        examEvents.push({
          id: makeId("exam-event", paperId, studentId),
          paperId,
          studentId,
          blurCount: 1,
          visibilityHiddenCount: 0,
          lastEventAt: hoursAgo(1),
          updatedAt: hoursAgo(1)
        });
      }

      if (status === "submitted") {
        examAnswers.push({
          id: makeId("exam-answer", paperId, studentId),
          paperId,
          studentId,
          answers,
          updatedAt: submittedAt
        });
        examSubmissions.push({
          id: makeId("exam-submission", paperId, studentId),
          paperId,
          studentId,
          answers,
          score,
          total,
          submittedAt
        });
        examReviewPackages.push({
          id: makeId("exam-review-pack", paperId, studentId),
          paperId,
          studentId,
          data: buildExamReviewPack({
            generatedAt: submittedAt,
            wrongQuestions
          }),
          generatedAt: submittedAt
        });
        examEvents.push({
          id: makeId("exam-event", paperId, studentId),
          paperId,
          studentId,
          blurCount: classIndex % 2,
          visibilityHiddenCount: rosterIndex % 2,
          lastEventAt: submittedAt,
          updatedAt: submittedAt
        });
      }
    });
  });

  return { papers, paperItems, examAssignments, examAnswers, examSubmissions, examReviewPackages, examEvents };
}

function buildAttemptsAndLearningData(context) {
  const students = context.users.filter((item) => item.role === "student");
  const parents = context.users.filter((item) => item.role === "parent");
  const parentByStudentId = new Map(parents.map((parent) => [parent.student_id, parent]));
  const knowledgePointsBySubjectGrade = groupBy(context.knowledgePoints, (item) => `${item.subject}:${item.grade}`);
  const questionsByKnowledgePoint = groupBy(
    context.questions.filter((item) => item.knowledge_point_id),
    (item) => item.knowledge_point_id
  );
  const attempts = [];
  const masteryRecords = [];
  const studyPlans = [];
  const studyPlanItems = [];
  const wrongReviewItems = [];
  const reviewTasks = [];
  const memoryReviews = [];
  const focusSessions = [];
  const writingSubmissions = [];
  const parentActionReceipts = [];
  const aiHistory = [];
  const favorites = [];

  students.forEach((student, studentIndex) => {
    const bySubjectAttempts = new Map();
    const allStudentAttempts = [];

    ["math", "chinese", "english"].forEach((subject, subjectIndex) => {
      const knowledgePoints = knowledgePointsBySubjectGrade.get(`${subject}:${student.grade}`) ?? [];
      const subjectAttempts = [];

      knowledgePoints.slice(0, 3).forEach((kp, kpIndex) => {
        const questionPool = (questionsByKnowledgePoint.get(kp.id) ?? []).slice(0, 2);
        questionPool.forEach((question, questionIndex) => {
          const createdAt = daysAgo(9 - kpIndex - questionIndex, 19 - subjectIndex, 10 + studentIndex % 7);
          const ratio = stableRatio(`${student.id}:${question.id}:${questionIndex}`);
          const bias = studentIndex % 4 === 0 ? -0.16 : studentIndex % 4 === 1 ? 0.08 : 0;
          const correct = ratio + bias < (subject === "math" ? 0.58 : subject === "english" ? 0.64 : 0.68);
          const attempt = {
            id: makeId("attempt", student.id, question.id, pad(questionIndex + 1)),
            userId: student.id,
            questionId: question.id,
            subject,
            knowledgePointId: kp.id,
            correct,
            answer:
              correct
                ? question.answer
                : question.options?.find((item) => item !== question.answer) ?? question.answer,
            reason:
              studentIndex < 6 && kpIndex === 0 && questionIndex === 1
                ? "study-variant"
                : subjectIndex === 0
                  ? "practice"
                  : "diagnostic",
            createdAt
          };
          subjectAttempts.push(attempt);
          allStudentAttempts.push(attempt);
          attempts.push(attempt);
        });
      });

      bySubjectAttempts.set(subject, subjectAttempts);
    });

    ["math", "chinese", "english"].forEach((subject) => {
      const subjectAttempts = bySubjectAttempts.get(subject) ?? [];
      const byKnowledgePoint = groupBy(subjectAttempts, (item) => item.knowledgePointId);
      const weakest = Array.from(byKnowledgePoint.entries())
        .map(([knowledgePointId, items]) => {
          const correctCount = items.filter((item) => item.correct).length;
          const totalCount = items.length;
          const score = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
          const latest = [...items].sort(compareByCreatedDesc)[0];
          return {
            knowledgePointId,
            correctCount,
            totalCount,
            masteryScore: score,
            lastAttemptAt: latest?.createdAt ?? null
          };
        })
        .sort((left, right) => left.masteryScore - right.masteryScore);

      weakest.forEach((item, index) => {
        masteryRecords.push({
          id: makeId("mastery", student.id, subject, item.knowledgePointId),
          userId: student.id,
          subject,
          knowledgePointId: item.knowledgePointId,
          correctCount: item.correctCount,
          totalCount: item.totalCount,
          masteryScore: clamp(item.masteryScore, 0, 100),
          confidenceScore: clamp(32 + item.totalCount * 18, 0, 100),
          recencyWeight: clamp(85 - index * 9, 35, 100),
          masteryTrend7d: index === 0 ? -12 : index === 1 ? -4 : 8,
          lastAttemptAt: item.lastAttemptAt,
          updatedAt: item.lastAttemptAt ?? daysAgo(1, 20, 0)
        });
      });

      const planId = makeId("study-plan", student.id, subject);
      studyPlans.push({
        id: planId,
        userId: student.id,
        subject,
        createdAt: daysAgo(1, 22, 0)
      });
      weakest.slice(0, 3).forEach((item, index) => {
        studyPlanItems.push({
          id: makeId("study-plan-item", student.id, subject, pad(index + 1)),
          planId,
          knowledgePointId: item.knowledgePointId,
          targetCount: index === 0 ? 6 : 4,
          dueDate: daysAhead(index, 21, 0)
        });
      });
    });

    const wrongAttempts = [...allStudentAttempts]
      .filter((item) => !item.correct)
      .sort(compareByCreatedDesc)
      .slice(0, 2);
    wrongAttempts.forEach((attempt, index) => {
      const nextReviewAt = index === 0 ? hoursAhead(2 + studentIndex % 3) : daysAhead(1, 18, 0);
      wrongReviewItems.push({
        id: makeId("wrong-review", student.id, attempt.questionId),
        userId: student.id,
        questionId: attempt.questionId,
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId,
        intervalLevel: index === 0 ? 1 : 2,
        nextReviewAt,
        lastReviewResult: "wrong",
        lastReviewAt: attempt.createdAt,
        reviewCount: index + 1,
        status: "active",
        firstWrongAt: attempt.createdAt,
        createdAt: attempt.createdAt,
        updatedAt: hoursAgo(2),
        sourceType: "practice",
        sourcePaperId: null,
        sourceSubmittedAt: null
      });
      reviewTasks.push({
        id: makeId("review-task", student.id, "wrong", pad(index + 1)),
        userId: student.id,
        questionId: attempt.questionId,
        sourceType: "wrong",
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId,
        status: "active",
        intervalLevel: index === 0 ? 1 : 2,
        dueAt: nextReviewAt,
        completedAt: null,
        lastReviewResult: "wrong",
        lastReviewAt: attempt.createdAt,
        reviewCount: index + 1,
        originType: "practice",
        originPaperId: null,
        originSubmittedAt: null,
        payload: { grade: student.grade },
        createdAt: attempt.createdAt,
        updatedAt: hoursAgo(2)
      });
    });

    const correctAttempts = [...allStudentAttempts]
      .filter((item) => item.correct)
      .sort(compareByCreatedDesc)
      .slice(0, 1);
    correctAttempts.forEach((attempt, index) => {
      const nextReviewAt = hoursAhead(5 + studentIndex % 4);
      memoryReviews.push({
        id: makeId("memory-review", student.id, attempt.questionId),
        userId: student.id,
        questionId: attempt.questionId,
        stage: 1 + (index % 2),
        nextReviewAt,
        lastReviewedAt: attempt.createdAt,
        createdAt: attempt.createdAt,
        updatedAt: hoursAgo(1)
      });
      reviewTasks.push({
        id: makeId("review-task", student.id, "memory", pad(index + 1)),
        userId: student.id,
        questionId: attempt.questionId,
        sourceType: "memory",
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId,
        status: "active",
        intervalLevel: 1 + (index % 2),
        dueAt: nextReviewAt,
        completedAt: null,
        lastReviewResult: null,
        lastReviewAt: attempt.createdAt,
        reviewCount: 1 + index,
        originType: null,
        originPaperId: null,
        originSubmittedAt: null,
        payload: { grade: student.grade },
        createdAt: attempt.createdAt,
        updatedAt: hoursAgo(1)
      });
    });

    if (studentIndex < 12) {
      focusSessions.push(
        {
          id: makeId("focus", student.id, "01"),
          userId: student.id,
          mode: "focus",
          durationMinutes: 25,
          startedAt: daysAgo(2, 19, 0),
          endedAt: daysAgo(2, 19, 25),
          createdAt: daysAgo(2, 19, 25)
        },
        {
          id: makeId("focus", student.id, "02"),
          userId: student.id,
          mode: "break",
          durationMinutes: 5,
          startedAt: daysAgo(2, 19, 25),
          endedAt: daysAgo(2, 19, 30),
          createdAt: daysAgo(2, 19, 30)
        },
        {
          id: makeId("focus", student.id, "03"),
          userId: student.id,
          mode: "focus",
          durationMinutes: 35,
          startedAt: daysAgo(1, 20, 0),
          endedAt: daysAgo(1, 20, 35),
          createdAt: daysAgo(1, 20, 35)
        }
      );
    }

    if (studentIndex < 12) {
      const subject = studentIndex % 2 === 0 ? "chinese" : "english";
      const title = subject === "chinese" ? "我的一次课堂发现" : "A meaningful class moment";
      writingSubmissions.push({
        id: makeId("writing", student.id),
        userId: student.id,
        subject,
        grade: student.grade,
        title,
        content:
          subject === "chinese"
            ? `${student.name}围绕课堂互动和课后复盘，写下了自己如何从“会听”走向“会学”的经历。`
            : `${student.name} described how interactive classroom feedback helped build confidence in English learning.`,
        feedback: buildWritingFeedback({
          scores: {
            structure: 84 - (studentIndex % 6),
            grammar: 81 - (studentIndex % 5),
            vocab: 86 - (studentIndex % 4)
          },
          summary:
            subject === "chinese"
              ? "结构比较完整，能结合课堂场景表达个人反思。"
              : "The writing is organized and close to real school learning scenes.",
          strengths:
            subject === "chinese"
              ? ["有真实课堂细节", "中心意思较明确"]
              : ["Clear structure", "Specific class details"],
          improvements:
            subject === "chinese"
              ? ["结尾可以再升华主题", "句式还可以更丰富"]
              : ["Add more transitions", "Check tense consistency"],
          corrected:
            subject === "chinese"
              ? "建议补充一段对老师反馈的具体回应，让文章的成长线更完整。"
              : "Consider adding one sentence about how the teacher's prompt changed your revision."
        }),
        createdAt: daysAgo(studentIndex % 3, 21, 10)
      });
    }

    if (studentIndex < 18) {
      const favoriteQuestions = [...allStudentAttempts].slice(0, 2);
      favoriteQuestions.forEach((attempt, index) => {
        favorites.push({
          id: makeId("favorite", student.id, pad(index + 1)),
          userId: student.id,
          questionId: attempt.questionId,
          tags: index === 0 ? ["易错", "复练"] : ["好题"],
          note: index === 0 ? "这题容易在审题时丢条件。" : "这类题适合再做一轮举一反三。",
          createdAt: daysAgo(1, 22, 0),
          updatedAt: daysAgo(0, 8, 0)
        });
      });
    }

    if (studentIndex < 12) {
      aiHistory.push({
        id: makeId("ai-history", student.id, "01"),
        userId: student.id,
        question: "老师让我先自己想一步再问 Tutor，这样真的有用吗？",
        answer: "有用。先自己尝试能暴露真正卡住的地方，Tutor 再针对你的卡点给提示，学习效率会更高。",
        favorite: studentIndex % 3 === 0,
        tags: ["学习方法", "Tutor"],
        createdAt: hoursAgo(8 + studentIndex),
        meta: {
          origin: "text",
          learningMode: "study",
          subject: studentIndex % 2 === 0 ? "math" : "english",
          grade: student.grade,
          answerMode: "hints_first",
          provider: "deepseek",
          recognizedQuestion: "如何更高效地使用 Tutor 做学科巩固",
          quality: {
            confidenceScore: 89,
            riskLevel: "low",
            needsHumanReview: false,
            fallbackAction: "",
            reasons: ["seeded-demo"],
            minQualityScore: 70,
            policyViolated: false
          }
        }
      });
    }

    const parent = parentByStudentId.get(student.id);
    if (parent && studentIndex < 18) {
      parentActionReceipts.push(
        {
          id: makeId("parent-receipt", parent.id, "weekly"),
          parentId: parent.id,
          studentId: student.id,
          source: "weekly_report",
          actionItemId: `weekly-${student.grade}-followup`,
          status: "done",
          note: "已按老师建议陪同完成本周错题复盘。",
          estimatedMinutes: 18,
          effectScore: 74,
          completedAt: daysAgo(1, 21, 10),
          createdAt: daysAgo(1, 21, 10),
          updatedAt: daysAgo(1, 21, 10)
        },
        {
          id: makeId("parent-receipt", parent.id, "assignment"),
          parentId: parent.id,
          studentId: student.id,
          source: "assignment_plan",
          actionItemId: `assignment-${student.grade}-check`,
          status: studentIndex % 5 === 0 ? "skipped" : "done",
          note: studentIndex % 5 === 0 ? "当天晚归，改为次日补做。" : "已确认作业拍照上传并提醒订正。",
          estimatedMinutes: 12,
          effectScore: studentIndex % 5 === 0 ? 28 : 68,
          completedAt: daysAgo(0, 20, 40),
          createdAt: daysAgo(0, 20, 40),
          updatedAt: daysAgo(0, 20, 40)
        }
      );
    }
  });

  return {
    attempts,
    masteryRecords,
    studyPlans,
    studyPlanItems,
    wrongReviewItems,
    reviewTasks,
    memoryReviews,
    focusSessions,
    writingSubmissions,
    parentActionReceipts,
    aiHistory,
    favorites
  };
}

function buildCommunicationData(context) {
  const parents = context.users.filter((item) => item.role === "parent");
  const usersById = new Map(context.users.map((item) => [item.id, item]));
  const rosterByClassId = groupBy(context.classStudents, (item) => item.class_id);
  const parentByStudentId = new Map(parents.map((item) => [item.student_id, item]));
  const discussions = [];
  const discussionReplies = [];
  const inboxThreads = [];
  const inboxParticipants = [];
  const inboxMessages = [];

  context.classes.forEach((klass, index) => {
    const teacher = usersById.get(klass.teacher_id);
    const roster = rosterByClassId.get(klass.id) ?? [];
    const firstStudent = usersById.get(roster[0]?.student_id);
    const secondStudent = usersById.get(roster[1]?.student_id);
    const parent = firstStudent ? parentByStudentId.get(firstStudent.id) : null;

    const discussionId = makeId("discussion", klass.id);
    discussions.push({
      id: discussionId,
      classId: klass.id,
      authorId: teacher?.id ?? null,
      title: `${klass.name}本周互动课堂回顾`,
      content: "请大家在讨论区补充本周课堂中最有帮助的一条提示，便于周末统一复盘。",
      pinned: index % 2 === 0,
      createdAt: daysAgo(2, 18, 0),
      updatedAt: daysAgo(1, 19, 0)
    });

    if (firstStudent) {
      discussionReplies.push({
        id: makeId("discussion-reply", klass.id, "01"),
        discussionId,
        authorId: firstStudent.id,
        parentId: null,
        content: "我觉得老师让我们先说错因再改答案特别有用，这样能知道自己到底卡在哪。",
        createdAt: daysAgo(1, 20, 0)
      });
    }

    if (secondStudent) {
      discussionReplies.push({
        id: makeId("discussion-reply", klass.id, "02"),
        discussionId,
        authorId: secondStudent.id,
        parentId: null,
        content: "互动课堂里的分步追问让我知道不是不会做，而是前面少写了一步依据。",
        createdAt: daysAgo(1, 20, 12)
      });
    }

    if (teacher && parent && firstStudent && index < 6) {
      const threadId = makeId("thread", klass.id, "parent");
      inboxThreads.push({
        id: threadId,
        subject: `${firstStudent.name}本周课堂与作业跟进`,
        createdAt: daysAgo(2, 17, 30),
        updatedAt: daysAgo(0, 19, 40)
      });
      [teacher.id, parent.id].forEach((userId, participantIndex) => {
        inboxParticipants.push({
          id: makeId("thread-participant", threadId, pad(participantIndex + 1)),
          threadId,
          userId,
          lastReadAt: userId === teacher.id ? daysAgo(0, 19, 45) : daysAgo(1, 19, 0)
        });
      });
      inboxMessages.push(
        {
          id: makeId("thread-message", threadId, "01"),
          threadId,
          senderId: teacher.id,
          content: `${firstStudent.name}这周课堂参与度明显提升，但错题复盘还需要家校一起盯一下。`,
          createdAt: daysAgo(1, 18, 20)
        },
        {
          id: makeId("thread-message", threadId, "02"),
          threadId,
          senderId: parent.id,
          content: "收到，我今晚会先陪他把错因说出来，再对着老师批注完成订正。",
          createdAt: daysAgo(0, 19, 40)
        }
      );
    }
  });

  return { discussions, discussionReplies, inboxThreads, inboxParticipants, inboxMessages };
}

function toDbRows(data) {
  return {
    examPapers: data.exams.papers.map((item) => ({
      id: item.id,
      class_id: item.classId,
      title: item.title,
      description: item.description,
      publish_mode: item.publishMode,
      anti_cheat_level: item.antiCheatLevel,
      start_at: item.startAt,
      end_at: item.endAt,
      duration_minutes: item.durationMinutes,
      status: item.status,
      created_by: item.createdBy,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    examPaperItems: data.exams.paperItems.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      question_id: item.questionId,
      score: item.score,
      order_index: item.orderIndex
    })),
    examAssignments: data.exams.examAssignments.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      status: item.status,
      assigned_at: item.assignedAt,
      started_at: item.startedAt,
      auto_saved_at: item.autoSavedAt,
      submitted_at: item.submittedAt,
      score: item.score,
      total: item.total
    })),
    examAnswers: data.exams.examAnswers.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      answers: item.answers,
      updated_at: item.updatedAt
    })),
    examSubmissions: data.exams.examSubmissions.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      answers: item.answers,
      score: item.score,
      total: item.total,
      submitted_at: item.submittedAt
    })),
    examReviewPackages: data.exams.examReviewPackages.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      data: item.data,
      generated_at: item.generatedAt
    })),
    examEvents: data.exams.examEvents.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      blur_count: item.blurCount,
      visibility_hidden_count: item.visibilityHiddenCount,
      last_event_at: item.lastEventAt,
      updated_at: item.updatedAt
    })),
    questionAttempts: data.learning.attempts.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      correct: item.correct,
      answer: item.answer,
      reason: item.reason ?? null,
      created_at: item.createdAt
    })),
    masteryRecords: data.learning.masteryRecords.map((item) => ({
      id: item.id,
      user_id: item.userId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      correct_count: item.correctCount,
      total_count: item.totalCount,
      mastery_score: item.masteryScore,
      confidence_score: item.confidenceScore,
      recency_weight: item.recencyWeight,
      mastery_trend_7d: item.masteryTrend7d,
      last_attempt_at: item.lastAttemptAt,
      updated_at: item.updatedAt
    })),
    studyPlans: data.learning.studyPlans.map((item) => ({
      id: item.id,
      user_id: item.userId,
      subject: item.subject,
      created_at: item.createdAt
    })),
    studyPlanItems: data.learning.studyPlanItems.map((item) => ({
      id: item.id,
      plan_id: item.planId,
      knowledge_point_id: item.knowledgePointId,
      target_count: item.targetCount,
      due_date: item.dueDate
    })),
    wrongReviewItems: data.learning.wrongReviewItems.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      interval_level: item.intervalLevel,
      next_review_at: item.nextReviewAt,
      last_review_result: item.lastReviewResult,
      last_review_at: item.lastReviewAt,
      review_count: item.reviewCount,
      status: item.status,
      first_wrong_at: item.firstWrongAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      source_type: item.sourceType,
      source_paper_id: item.sourcePaperId,
      source_submitted_at: item.sourceSubmittedAt
    })),
    reviewTasks: data.learning.reviewTasks.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      source_type: item.sourceType,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      status: item.status,
      interval_level: item.intervalLevel,
      due_at: item.dueAt,
      completed_at: item.completedAt,
      last_review_result: item.lastReviewResult,
      last_review_at: item.lastReviewAt,
      review_count: item.reviewCount,
      origin_type: item.originType,
      origin_paper_id: item.originPaperId,
      origin_submitted_at: item.originSubmittedAt,
      payload: item.payload,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    memoryReviews: data.learning.memoryReviews.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      stage: item.stage,
      next_review_at: item.nextReviewAt,
      last_reviewed_at: item.lastReviewedAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    focusSessions: data.learning.focusSessions.map((item) => ({
      id: item.id,
      user_id: item.userId,
      mode: item.mode,
      duration_minutes: item.durationMinutes,
      started_at: item.startedAt,
      ended_at: item.endedAt,
      created_at: item.createdAt
    })),
    writingSubmissions: data.learning.writingSubmissions.map((item) => ({
      id: item.id,
      user_id: item.userId,
      subject: item.subject,
      grade: item.grade,
      title: item.title,
      content: item.content,
      feedback: item.feedback,
      created_at: item.createdAt
    })),
    parentActionReceipts: data.learning.parentActionReceipts.map((item) => ({
      id: item.id,
      parent_id: item.parentId,
      student_id: item.studentId,
      source: item.source,
      action_item_id: item.actionItemId,
      status: item.status,
      note: item.note,
      estimated_minutes: item.estimatedMinutes,
      effect_score: item.effectScore,
      completed_at: item.completedAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    aiHistory: data.learning.aiHistory.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question: item.question,
      answer: item.answer,
      favorite: item.favorite,
      tags: item.tags,
      created_at: item.createdAt,
      meta: item.meta
    })),
    favorites: data.learning.favorites.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      tags: item.tags,
      note: item.note,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    discussions: data.communication.discussions.map((item) => ({
      id: item.id,
      class_id: item.classId,
      author_id: item.authorId,
      title: item.title,
      content: item.content,
      pinned: item.pinned,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    discussionReplies: data.communication.discussionReplies.map((item) => ({
      id: item.id,
      discussion_id: item.discussionId,
      author_id: item.authorId,
      parent_id: item.parentId,
      content: item.content,
      created_at: item.createdAt
    })),
    inboxThreads: data.communication.inboxThreads.map((item) => ({
      id: item.id,
      subject: item.subject,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    inboxParticipants: data.communication.inboxParticipants.map((item) => ({
      id: item.id,
      thread_id: item.threadId,
      user_id: item.userId,
      last_read_at: item.lastReadAt ?? null
    })),
    inboxMessages: data.communication.inboxMessages.map((item) => ({
      id: item.id,
      thread_id: item.threadId,
      sender_id: item.senderId ?? null,
      content: item.content,
      created_at: item.createdAt
    }))
  };
}

async function seedDatabase(client, rows) {
  await upsertRows(client, "exam_papers", rows.examPapers, {
    columns: ["id", "class_id", "title", "description", "publish_mode", "anti_cheat_level", "start_at", "end_at", "duration_minutes", "status", "created_by", "created_at", "updated_at"]
  });
  await upsertRows(client, "exam_paper_items", rows.examPaperItems, {
    columns: ["id", "paper_id", "question_id", "score", "order_index"]
  });
  await upsertRows(client, "exam_assignments", rows.examAssignments, {
    columns: ["id", "paper_id", "student_id", "status", "assigned_at", "started_at", "auto_saved_at", "submitted_at", "score", "total"],
    conflict: ["paper_id", "student_id"],
    updateColumns: ["id", "status", "assigned_at", "started_at", "auto_saved_at", "submitted_at", "score", "total"]
  });
  await upsertRows(client, "exam_answers", rows.examAnswers, {
    columns: ["id", "paper_id", "student_id", "answers", "updated_at"],
    conflict: ["paper_id", "student_id"],
    updateColumns: ["id", "answers", "updated_at"]
  });
  await upsertRows(client, "exam_submissions", rows.examSubmissions, {
    columns: ["id", "paper_id", "student_id", "answers", "score", "total", "submitted_at"],
    conflict: ["paper_id", "student_id"],
    updateColumns: ["id", "answers", "score", "total", "submitted_at"]
  });
  await upsertRows(client, "exam_review_packages", rows.examReviewPackages, {
    columns: ["id", "paper_id", "student_id", "data", "generated_at"],
    conflict: ["paper_id", "student_id"],
    updateColumns: ["id", "data", "generated_at"]
  });
  await upsertRows(client, "exam_events", rows.examEvents, {
    columns: ["id", "paper_id", "student_id", "blur_count", "visibility_hidden_count", "last_event_at", "updated_at"],
    conflict: ["paper_id", "student_id"],
    updateColumns: ["id", "blur_count", "visibility_hidden_count", "last_event_at", "updated_at"]
  });
  await upsertRows(client, "question_attempts", rows.questionAttempts, {
    columns: ["id", "user_id", "question_id", "subject", "knowledge_point_id", "correct", "answer", "reason", "created_at"]
  });
  await upsertRows(client, "mastery_records", rows.masteryRecords, {
    columns: ["id", "user_id", "subject", "knowledge_point_id", "correct_count", "total_count", "mastery_score", "confidence_score", "recency_weight", "mastery_trend_7d", "last_attempt_at", "updated_at"],
    conflict: ["user_id", "knowledge_point_id"],
    updateColumns: ["id", "subject", "correct_count", "total_count", "mastery_score", "confidence_score", "recency_weight", "mastery_trend_7d", "last_attempt_at", "updated_at"]
  });
  await upsertRows(client, "study_plans", rows.studyPlans, {
    columns: ["id", "user_id", "subject", "created_at"]
  });
  await upsertRows(client, "study_plan_items", rows.studyPlanItems, {
    columns: ["id", "plan_id", "knowledge_point_id", "target_count", "due_date"]
  });
  await upsertRows(client, "wrong_review_items", rows.wrongReviewItems, {
    columns: ["id", "user_id", "question_id", "subject", "knowledge_point_id", "interval_level", "next_review_at", "last_review_result", "last_review_at", "review_count", "status", "first_wrong_at", "created_at", "updated_at", "source_type", "source_paper_id", "source_submitted_at"],
    conflict: ["user_id", "question_id"],
    updateColumns: ["id", "subject", "knowledge_point_id", "interval_level", "next_review_at", "last_review_result", "last_review_at", "review_count", "status", "first_wrong_at", "created_at", "updated_at", "source_type", "source_paper_id", "source_submitted_at"]
  });
  await upsertRows(client, "review_tasks", rows.reviewTasks, {
    columns: ["id", "user_id", "question_id", "source_type", "subject", "knowledge_point_id", "status", "interval_level", "due_at", "completed_at", "last_review_result", "last_review_at", "review_count", "origin_type", "origin_paper_id", "origin_submitted_at", "payload", "created_at", "updated_at"],
    conflict: ["user_id", "question_id", "source_type"],
    updateColumns: ["id", "subject", "knowledge_point_id", "status", "interval_level", "due_at", "completed_at", "last_review_result", "last_review_at", "review_count", "origin_type", "origin_paper_id", "origin_submitted_at", "payload", "created_at", "updated_at"]
  });
  await upsertRows(client, "memory_reviews", rows.memoryReviews, {
    columns: ["id", "user_id", "question_id", "stage", "next_review_at", "last_reviewed_at", "created_at", "updated_at"],
    conflict: ["user_id", "question_id"],
    updateColumns: ["id", "stage", "next_review_at", "last_reviewed_at", "created_at", "updated_at"]
  });
  await upsertRows(client, "focus_sessions", rows.focusSessions, {
    columns: ["id", "user_id", "mode", "duration_minutes", "started_at", "ended_at", "created_at"]
  });
  await upsertRows(client, "writing_submissions", rows.writingSubmissions, {
    columns: ["id", "user_id", "subject", "grade", "title", "content", "feedback", "created_at"]
  });
  await upsertRows(client, "parent_action_receipts", rows.parentActionReceipts, {
    columns: ["id", "parent_id", "student_id", "source", "action_item_id", "status", "note", "estimated_minutes", "effect_score", "completed_at", "created_at", "updated_at"],
    conflict: ["parent_id", "student_id", "source", "action_item_id"],
    updateColumns: ["id", "status", "note", "estimated_minutes", "effect_score", "completed_at", "created_at", "updated_at"]
  });
  await upsertRows(client, "ai_history", rows.aiHistory, {
    columns: ["id", "user_id", "question", "answer", "favorite", "tags", "created_at", "meta"]
  });
  await upsertRows(client, "question_favorites", rows.favorites, {
    columns: ["id", "user_id", "question_id", "tags", "note", "created_at", "updated_at"],
    conflict: ["user_id", "question_id"],
    updateColumns: ["id", "tags", "note", "created_at", "updated_at"]
  });
  await upsertRows(client, "discussions", rows.discussions, {
    columns: ["id", "class_id", "author_id", "title", "content", "pinned", "created_at", "updated_at"]
  });
  await upsertRows(client, "discussion_replies", rows.discussionReplies, {
    columns: ["id", "discussion_id", "author_id", "parent_id", "content", "created_at"]
  });
  await upsertRows(client, "inbox_threads", rows.inboxThreads, {
    columns: ["id", "subject", "created_at", "updated_at"]
  });
  await upsertRows(client, "inbox_participants", rows.inboxParticipants, {
    columns: ["id", "thread_id", "user_id", "last_read_at"],
    conflict: ["thread_id", "user_id"],
    updateColumns: ["id", "last_read_at"]
  });
  await upsertRows(client, "inbox_messages", rows.inboxMessages, {
    columns: ["id", "thread_id", "sender_id", "content", "created_at"]
  });
}

function printSummary(context, rows) {
  const students = context.users.filter((item) => item.role === "student").length;
  const parents = context.users.filter((item) => item.role === "parent").length;
  const teachers = context.users.filter((item) => item.role === "teacher").length;
  console.log(`School: ${SCHOOL_ID}`);
  console.log(`Teachers: ${teachers}`);
  console.log(`Students: ${students}`);
  console.log(`Parents: ${parents}`);
  console.log(`Exam papers seeded: ${rows.examPapers.length}`);
  console.log(`Question attempts seeded: ${rows.questionAttempts.length}`);
  console.log(`Study plans seeded: ${rows.studyPlans.length}`);
  console.log(`Review tasks seeded: ${rows.reviewTasks.length}`);
  console.log(`Writing submissions seeded: ${rows.writingSubmissions.length}`);
  console.log(`Inbox threads seeded: ${rows.inboxThreads.length}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  const client = await pool.connect();

  try {
    const context = await loadContext(client);
    if (!context.users.length || !context.classes.length) {
      throw new Error(`Base school data missing for ${SCHOOL_ID}. Run seed-hangke-realistic first.`);
    }

    const data = {
      exams: buildExams(context),
      learning: buildAttemptsAndLearningData(context),
      communication: buildCommunicationData(context)
    };
    const rows = toDbRows(data);

    if (DRY_RUN) {
      printSummary(context, rows);
      console.log("Dry run complete. Database was not modified.");
      return;
    }

    await client.query("BEGIN");
    await seedDatabase(client, rows);
    await client.query("COMMIT");
    printSummary(context, rows);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? error);
  process.exit(1);
});
