import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTruncatedExportBaseName,
  cleanupPptxSlideXml,
  detectParagraphListMarker,
  isBoldFontWeight,
  utf8ByteLength
} from "../../lib/export/pptx-formatting";

test("buildTruncatedExportBaseName keeps readable prefix and limits byte length", () => {
  const name = buildTruncatedExportBaseName({
    className: "高一（3）班",
    subject: "math",
    learningModeLabel: "兴趣培养",
    stageName:
      "请围绕“我大学的理论力学挂科了，想要考前冲刺一下”为小星设计一节适合学生自主使用的兴趣培养课堂，并支持课后回看与导出复用",
    fallback: "航科互动课堂"
  });

  assert.match(name, /^高一（3）班-math-兴趣培养-/);
  assert.ok(utf8ByteLength(name) <= 120, `expected <= 120 bytes, got ${utf8ByteLength(name)}`);
});

test("detectParagraphListMarker strips manual bullet prefixes", () => {
  assert.deepEqual(detectParagraphListMarker("• 需要高效、精准的复习方案"), {
    kind: "bullet",
    text: "需要高效、精准的复习方案"
  });
  assert.deepEqual(detectParagraphListMarker("2. 建立平衡方程"), {
    kind: "number",
    text: "建立平衡方程"
  });
  assert.equal(detectParagraphListMarker("欢迎来到理论力学冲刺营"), null);
});

test("isBoldFontWeight supports keyword and numeric weights", () => {
  assert.equal(isBoldFontWeight("bold"), true);
  assert.equal(isBoldFontWeight("700"), true);
  assert.equal(isBoldFontWeight("600"), true);
  assert.equal(isBoldFontWeight("500"), false);
  assert.equal(isBoldFontWeight(undefined), false);
});

test("cleanupPptxSlideXml removes unstable autofit and paragraph-before spacing", () => {
  const xml =
    '<a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:pPr><a:spcBef><a:spcPts val="360"/></a:spcBef><a:buNone/></a:pPr>';

  const cleaned = cleanupPptxSlideXml(xml);

  assert.equal(cleaned.includes("<a:spAutoFit/>"), false);
  assert.equal(cleaned.includes("<a:spcBef>"), false);
  assert.match(cleaned, /<a:bodyPr wrap="square"><\/a:bodyPr>/);
  assert.match(cleaned, /<a:buNone\/>/);
});
