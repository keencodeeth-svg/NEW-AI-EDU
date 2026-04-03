"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import StatePanel from "@/components/StatePanel";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";
import { useDiagnosticPage } from "./useDiagnosticPage";

export default function DiagnosticPage() {
  const {
    authRequired,
    questions,
    index,
    loadingQuestions,
    submitting,
    answers,
    result,
    subject,
    grade,
    pageError,
    startDiagnostic,
    setSubject,
    setGrade,
    setAnswers,
    reasons,
    setReasons,
    setIndex,
    submitDiagnostic,
    reportRef,
    exportImage
  } = useDiagnosticPage();

  const reasonOptions = [
    "概念不清",
    "审题不仔细",
    "计算粗心",
    "方法不会",
    "记忆不牢"
  ];

  const current = questions[index];
  const busy = loadingQuestions || submitting;
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const hasQuestions = questions.length > 0;
  const hasResult = Boolean(result);
  const setupOpen = !current && !hasResult;
  const focusTitle = hasResult
    ? "诊断完成，先看学习体检结果"
    : current
      ? index === questions.length - 1
        ? "完成最后一题，提交后生成诊断报告"
        : "先完成当前诊断题"
      : loadingQuestions
        ? "正在准备诊断题目"
        : "先开始一次学习体检";
  const focusDescription = hasResult
    ? "报告会先告诉你当前掌握情况，再拆出薄弱知识点和高频错因，方便你直接进入下一步练习。"
    : current
      ? "诊断测评不追求做很多题，而是用少量高价值题快速定位问题，所以每一题都值得认真完成。"
      : loadingQuestions
        ? "系统正在按当前学科和年级生成诊断题，完成后会自动进入答题流程。"
        : "选择学科与年级后即可开始，完成后会自动生成掌握分析和学习计划入口。";
  const actionTitle = hasResult
    ? "先读报告，再决定下一步"
    : current
      ? "现在只做这一题"
      : "准备好就开始";
  const actionDescription = hasResult
    ? "建议先看知识点掌握和错因分布，再进入学习计划或练习，把诊断结果变成真正的提升。"
    : current
      ? "先完成作答并记录错因，比跳着看题更能帮助系统判断你的真实薄弱点。"
      : "开始前不用过度设置，先完成一次完整诊断，比反复调整配置更有价值。";

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可开始诊断测评并生成学习计划。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>诊断测评</h2>
          <div className="section-sub">快速定位知识点薄弱项，生成学习计划。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">学习体检</span>
          <span className="chip">{SUBJECT_LABELS[subject] ?? subject}</span>
          <span className="chip">{grade} 年级</span>
        </div>
      </div>

      {pageError ? (
        <StatePanel title="本次操作存在异常" description={pageError} tone="error" compact />
      ) : null}

      <div className="diagnostic-top-grid">
        <div className="workflow-spotlight-card diagnostic-focus-card">
          <div className="diagnostic-focus-kicker">现在最重要</div>
          <div className="diagnostic-focus-title">{focusTitle}</div>
          <p className="diagnostic-focus-description">{focusDescription}</p>
          <div className="workflow-summary-grid">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">测评范围</div>
              <div className="workflow-summary-value">{SUBJECT_LABELS[subject] ?? subject}</div>
              <div className="workflow-summary-helper">{grade} 年级</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">作答进度</div>
              <div className="workflow-summary-value">
                {hasQuestions ? `${answeredCount}/${questions.length}` : "0"}
              </div>
              <div className="workflow-summary-helper">
                {current ? `当前第 ${index + 1} 题` : hasResult ? "报告已生成" : "尚未开始"}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">当前状态</div>
              <div className="workflow-summary-value">
                {hasResult ? `${result?.accuracy ?? 0}%` : current ? "进行中" : loadingQuestions ? "生成中" : "待开始"}
              </div>
              <div className="workflow-summary-helper">
                {hasResult
                  ? `答对 ${result?.correct ?? 0}/${result?.total ?? 0}`
                  : current
                    ? "完成后可直接看诊断报告"
                    : "开始后会进入连续答题"}
              </div>
            </div>
          </div>
        </div>

        <div className="workflow-spotlight-card diagnostic-action-card">
          <div className="diagnostic-action-title">{actionTitle}</div>
          <p className="diagnostic-action-description">{actionDescription}</p>
          <div className="workflow-step-line">
            建议顺序：先开始诊断并完成全部题目，再看报告，最后进入学习计划或智能练习，不要在中间来回切换页面。
          </div>
          <div className="cta-row" style={{ marginTop: 14 }}>
            {!current && !hasResult ? (
              <button className="button primary" type="button" onClick={startDiagnostic} disabled={busy}>
                {loadingQuestions ? "生成题目中..." : "开始诊断"}
              </button>
            ) : current ? (
              <a className="button primary" href="#diagnostic-question">
                继续当前题
              </a>
            ) : (
              <a className="button primary" href="#diagnostic-report">
                查看诊断报告
              </a>
            )}

            {hasResult ? (
              <button className="button secondary" type="button" onClick={startDiagnostic} disabled={busy}>
                {loadingQuestions ? "生成题目中..." : "重新诊断"}
              </button>
            ) : (
              <a className="button secondary" href="#diagnostic-setup">
                查看测评设置
              </a>
            )}

            {hasResult ? (
              <Link className="button ghost" href="/plan">
                打开学习计划
              </Link>
            ) : (
              <Link className="button ghost" href="/practice?mode=adaptive">
                先去智能练习
              </Link>
            )}
          </div>
        </div>
      </div>

      <details className="workflow-collapsible" id="diagnostic-setup" open={setupOpen}>
        <summary>
          <span>测评设置与说明</span>
          <span className="chip">{SUBJECT_LABELS[subject] ?? subject}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <Card title="测评准备" tag="配置">
            <div className="feature-card">
              <EduIcon name="book" />
              <p>选择学科与年级后开始诊断，系统会用一组高价值题快速判断你的薄弱点。</p>
            </div>
            <div className="workflow-step-line" style={{ marginTop: 12 }}>
              推荐顺序：完成全部诊断题 → 查看知识点掌握与错因分布 → 再进入学习计划或练习。
            </div>
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <label>
                <div className="section-title">学科</div>
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  {SUBJECT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="section-title">年级</div>
                <select
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  {GRADE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="cta-row" style={{ marginTop: 12 }}>
              <button className="button primary" type="button" onClick={startDiagnostic} disabled={busy}>
                {loadingQuestions ? "生成题目中..." : "开始诊断"}
              </button>
            </div>
          </Card>
        </div>
      </details>

      {current ? (
        <Card title={`第 ${index + 1} 题`} tag="答题">
          <div id="diagnostic-question" />
          <div className="pill-list" style={{ marginBottom: 10 }}>
            <span className="pill">
              进度 {index + 1}/{questions.length}
            </span>
            <span className="pill">学科 {SUBJECT_LABELS[subject] ?? subject}</span>
            <span className="pill">年级 {grade}</span>
          </div>
          <MathText as="p" text={current.stem} />
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {current.options.map((option) => (
              <label className="card" key={option} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name={current.id}
                  value={option}
                  checked={answers[current.id] === option}
                  onChange={() =>
                    setAnswers((prev) => ({ ...prev, [current.id]: option }))
                  }
                  style={{ marginRight: 8 }}
                />
                <MathText text={option} />
              </label>
            ))}
          </div>
          <label style={{ display: "block", marginTop: 12 }}>
            <div className="section-title">错因（可选）</div>
            <select
              value={reasons[current.id] ?? ""}
              onChange={(event) =>
                setReasons((prev) => ({ ...prev, [current.id]: event.target.value }))
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="">未选择</option>
              {reasonOptions.map((reason) => (
                <option value={reason} key={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <div className="cta-row">
            <button
              className="button secondary"
              disabled={index === 0 || busy}
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
            >
              上一题
            </button>
            {index < questions.length - 1 ? (
              <button
                className="button primary"
                onClick={() => setIndex((prev) => prev + 1)}
                disabled={busy}
              >
                下一题
              </button>
            ) : (
              <button className="button primary" onClick={submitDiagnostic} disabled={busy}>
                {submitting ? "提交中..." : "提交诊断"}
              </button>
            )}
          </div>
        </Card>
      ) : null}

      {result ? (
        <Card title="诊断结果" tag="报告">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>生成掌握度分布与错因总结。</p>
          </div>
          <div id="diagnostic-report" ref={reportRef}>
            <div className="workflow-summary-grid" style={{ marginTop: 12 }}>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">正确率</div>
                <div className="workflow-summary-value">{result.accuracy}%</div>
                <div className="workflow-summary-helper">共 {result.total} 题</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">答对题数</div>
                <div className="workflow-summary-value">{result.correct}</div>
                <div className="workflow-summary-helper">可作为后续练习基线</div>
              </div>
              <div className="workflow-summary-card">
                <div className="workflow-summary-label">后续动作</div>
                <div className="workflow-summary-value">
                  {result.breakdown?.length ? `${result.breakdown.length} 项` : "已生成"}
                </div>
                <div className="workflow-summary-helper">建议先看薄弱知识点，再进入学习计划</div>
              </div>
            </div>

            {result.breakdown?.length ? (
              <details className="workflow-collapsible" style={{ marginTop: 12 }} open>
                <summary>
                  <span>知识点掌握分布</span>
                  <span className="chip">{result.breakdown.length} 项</span>
                </summary>
                <div className="workflow-collapsible-body">
                  <div className="grid" style={{ gap: 8 }}>
                    {result.breakdown.map((item) => (
                      <div className="card" key={item.knowledgePointId}>
                        <div className="section-title">{item.title}</div>
                        <p>
                          正确 {item.correct}/{item.total}，正确率 {item.accuracy}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}

            {result.wrongReasons?.length ? (
              <details className="workflow-collapsible" style={{ marginTop: 12 }}>
                <summary>
                  <span>错因分布</span>
                  <span className="chip">{result.wrongReasons.length} 类</span>
                </summary>
                <div className="workflow-collapsible-body">
                  <div className="grid" style={{ gap: 8 }}>
                    {result.wrongReasons.map((item) => (
                      <div className="workflow-step-line" key={item.reason}>
                        {item.reason}：{item.count} 次
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </div>
          <div className="cta-row">
            <button className="button secondary" onClick={() => window.print()} disabled={busy}>
              导出 PDF
            </button>
            <button className="button secondary" onClick={exportImage} disabled={busy}>
              导出图片
            </button>
            <Link className="button secondary" href="/plan">
              查看学习计划
            </Link>
            <Link className="button ghost" href="/practice?mode=adaptive">
              进入智能练习
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
