import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExperienceModeLaunchCopy,
  buildExperienceModeState,
} from "../../app/student/interactive-classroom/experience-mode";

test("experience mode state avoids pseudo-personalized profile copy and marks missing live data", () => {
  const state = buildExperienceModeState("subject-reinforcement");

  assert.equal(state.profile.grade, "");
  assert.deepEqual(state.profile.subjects, []);
  assert.equal(state.profile.preferredName, "");
  assert.equal(state.profile.target, "");
  assert.equal(state.profile.strengths, "");
  assert.equal(state.topic, "当前薄弱点巩固示例");
  assert.equal(state.learnerGoal, "体验模式仅展示示例课堂流程，真实学习目标需登录后接入。");
  assert.match(state.bootstrapNotice, /体验模式/);
  assert.match(state.bootstrapNotice, /真实画像、今日任务和课表暂未接入/);
  assert.match(state.bootstrapNotice, /示例课堂流程/);
});

test("experience mode launch copy carries the boundary into ai classroom result context", () => {
  const copy = buildExperienceModeLaunchCopy({
    mode: "preview-preparation",
    topic: "分数乘法预习示例",
    learnerGoal: "体验模式仅展示示例课堂流程，真实学习目标需登录后接入。",
    subject: "math",
    learnerName: "体验模式",
  });

  assert.match(copy.sourceLabel, /体验模式/);
  assert.match(copy.sourceSummary, /真实画像、任务、课表未接入/);
  assert.match(copy.sourceSummary, /示例课堂/);
  assert.equal(copy.classroomContext.className, "体验模式示例课堂");
  assert.equal(copy.classroomContext.learner?.name, "体验模式");
  assert.equal(copy.classroomContext.subject, "math");
  assert.equal(copy.classroomContext.learnerGoal, "体验模式仅展示示例课堂流程，真实学习目标需登录后接入。");
});
