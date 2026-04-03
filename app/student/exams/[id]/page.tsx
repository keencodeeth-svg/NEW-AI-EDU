"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import StatePanel from "@/components/StatePanel";
import MathViewControls from "@/components/MathViewControls";
import { SUBJECT_LABELS } from "@/lib/constants";
import ExamAnswerSheetCard from "./_components/ExamAnswerSheetCard";
import ExamOverviewCard from "./_components/ExamOverviewCard";
import ExamResultCard from "./_components/ExamResultCard";
import ExamReviewPackCard from "./_components/ExamReviewPackCard";
import { useStudentExamDetailPage } from "./useStudentExamDetailPage";
import { formatRemain } from "./utils";

export default function StudentExamDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    data,
    result,
    reviewPack,
    reviewPackSummary,
    authRequired,
    pageLoading,
    loadError,
    load,
    submitted,
    hasReviewPackSection,
    firstUnansweredQuestionId,
    answerCount,
    unansweredCount,
    lockedByServer,
    lockedByTime,
    remainingSeconds,
    stageLabel,
    stageCopy,
    actionMessage,
    actionError,
    syncNotice,
    online,
    saving,
    submitting,
    savedAt,
    handleSaveDraft,
    mathView,
    totalScore,
    finalScore,
    finalTotal,
    feedbackTargetId,
    handleSubmit,
    handleAnswerChange,
    resultSectionRef,
    reviewPackLoading,
    reviewPackError,
    loadReviewPack,
    answers,
    lockReason,
    startedAt
  } = useStudentExamDetailPage(params.id);

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看考试详情"
        description="登录后即可继续作答、同步草稿并查看考试复盘。"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageLoading && !data && !loadError) {
    return <StatePanel tone="loading" title="考试详情加载中" description="正在同步题目、作答进度和考试时钟。" />;
  }

  if (loadError && !data) {
    return (
      <StatePanel
        tone="error"
        title="考试详情暂时不可用"
        description={loadError}
        action={
          <div className="cta-row">
            <button className="button secondary" type="button" onClick={() => void load()}>
              重新加载
            </button>
            <Link className="button ghost" href="/student/exams">
              返回考试列表
            </Link>
          </div>
        }
      />
    );
  }

  if (!data) {
    return null;
  }

  const primaryAction = submitted
    ? {
        href: hasReviewPackSection ? "#exam-review-pack" : "#exam-result",
        label: hasReviewPackSection ? "打开考试复盘" : "查看考试结果"
      }
    : firstUnansweredQuestionId
      ? {
          href: `#exam-question-${firstUnansweredQuestionId}`,
          label: answerCount > 0 ? "继续未答题" : "开始作答"
        }
      : {
          href: "#exam-answer-sheet",
          label: "进入作答区"
        };
  const secondaryAction = submitted
    ? {
        href: result?.wrongCount ? "/wrong-book" : "/student/exams",
        label: result?.wrongCount ? "打开今日复练清单" : "返回考试列表"
      }
    : {
        href: "#exam-overview-panel",
        label: "展开考试说明"
      };
  const focusDescription = submitted
    ? reviewPackSummary
      ? `本场考试已经提交，建议先看结果，再用约 ${reviewPackSummary.estimatedMinutes} 分钟完成这轮复盘与修复。`
      : "本场考试已经提交，建议先看结果与错题，再决定是否进入下一轮练习。"
    : lockedByServer || lockedByTime
      ? "当前作答已经锁定，下方仍会保留题目与已保存记录，方便你核对本次考试情况。"
      : remainingSeconds !== null
        ? `当前还有 ${formatRemain(remainingSeconds)} 可用，先完成未答题，再决定是否检查已答内容。`
        : "先完成会做的题，再回头处理不确定题目，会比从头反复纠结更轻松。";

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>{data.exam.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">{stageLabel}</span>
      </div>

      <div className="student-exam-detail-top-grid">
        <div className="workflow-spotlight-card student-exam-focus-card">
          <div className="student-exam-focus-kicker">现在最重要</div>
          <div className="student-exam-focus-title">{stageCopy.title}</div>
          <p className="student-exam-focus-description">{focusDescription}</p>

          {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}
          {actionError ? <div className="status-note error">{actionError}</div> : null}
          {syncNotice ? <div className="status-note info">{syncNotice}</div> : null}

          <div className="workflow-summary-grid">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">作答进度</div>
              <div className="workflow-summary-value">
                {answerCount}/{data.questions.length}
              </div>
              <div className="workflow-summary-helper">未答 {unansweredCount} 题</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">{submitted ? "最终成绩" : "考试时钟"}</div>
              <div className="workflow-summary-value">
                {submitted
                  ? `${finalScore}/${finalTotal}`
                  : remainingSeconds !== null
                    ? formatRemain(remainingSeconds)
                    : "不限时"}
              </div>
              <div className="workflow-summary-helper">
                {submitted
                  ? `总分 ${totalScore} · ${result?.wrongCount ?? reviewPackSummary?.wrongCount ?? 0} 题待复盘`
                  : remainingSeconds !== null
                    ? `剩余 ${formatRemain(remainingSeconds)}`
                    : data.exam.durationMinutes
                      ? `${data.exam.durationMinutes} 分钟作答`
                      : "开始后持续开放"}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">{submitted ? "学习闭环" : "同步状态"}</div>
              <div className="workflow-summary-value">{submitted ? "结果已生成" : online ? "在线" : "离线"}</div>
              <div className="workflow-summary-helper">
                {submitted
                  ? reviewPackSummary
                    ? `复盘约 ${reviewPackSummary.estimatedMinutes} 分钟`
                    : "可先看结果，再进入练习"
                  : saving
                    ? "正在自动保存"
                    : savedAt
                      ? `最近保存 ${new Date(savedAt).toLocaleTimeString("zh-CN")}`
                      : "尚未保存"}
              </div>
            </div>
          </div>
        </div>

        <div className="student-exam-side-rail">
          <div className="workflow-spotlight-card student-exam-action-card">
            <div className="student-exam-action-title">{primaryAction.label}</div>
            <p className="student-exam-action-description">{stageCopy.description}</p>
            <div className="workflow-step-line">
              {submitted
                ? "建议顺序：先看结果，再打开复盘包，最后进入错题复练或下一轮自主测评。"
                : "建议顺序：先补未答题，再检查高风险题，最后保存或提交，避免把注意力耗在非关键内容上。"}
            </div>
            <div className="cta-row exam-inline-actions" style={{ marginTop: 14 }}>
              <a className="button primary" href={primaryAction.href}>
                {primaryAction.label}
              </a>
              {secondaryAction.href.startsWith("/") ? (
                <Link className="button ghost" href={secondaryAction.href}>
                  {secondaryAction.label}
                </Link>
              ) : (
                <a className="button ghost" href={secondaryAction.href}>
                  {secondaryAction.label}
                </a>
              )}
              {!submitted ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || submitting || lockedByTime || lockedByServer}
                >
                  {saving ? "保存中..." : "保存进度"}
                </button>
              ) : null}
            </div>
          </div>

          <details className="workflow-collapsible">
            <summary>
              <span>阅读与排版工具</span>
              <span className="chip">{Math.round(mathView.fontScale * 100)}%</span>
            </summary>
            <div className="workflow-collapsible-body">
              <MathViewControls
                fontScale={mathView.fontScale}
                lineMode={mathView.lineMode}
                onDecrease={mathView.decreaseFontScale}
                onIncrease={mathView.increaseFontScale}
                onReset={mathView.resetView}
                onLineModeChange={mathView.setLineMode}
              />
            </div>
          </details>
        </div>
      </div>

      {!submitted ? (
        <div id="exam-answer-sheet">
          <ExamAnswerSheetCard
            data={data}
            answers={answers}
            answerCount={answerCount}
            unansweredCount={unansweredCount}
            firstUnansweredQuestionId={firstUnansweredQuestionId}
            submitted={submitted}
            lockedByTime={lockedByTime}
            lockedByServer={lockedByServer}
            submitting={submitting}
            online={online}
            lockReason={lockReason}
            finalScore={finalScore}
            finalTotal={finalTotal}
            queuedReviewCount={result?.queuedReviewCount}
            feedbackTargetId={feedbackTargetId}
            onSubmit={handleSubmit}
            onAnswerChange={handleAnswerChange}
          />
        </div>
      ) : null}

      <details
        className="workflow-collapsible"
        id="exam-overview-panel"
        open={Boolean(lockReason || actionError || actionMessage || syncNotice)}
      >
        <summary>
          <span>考试说明与作答状态</span>
          <span className="chip">{submitted ? "结果已生成" : "按需展开"}</span>
        </summary>
        <div className="workflow-collapsible-body">
          <div id="exam-overview">
            <ExamOverviewCard
              data={data}
              submitted={submitted}
              online={online}
              answerCount={answerCount}
              unansweredCount={unansweredCount}
              totalScore={totalScore}
              remainingSeconds={remainingSeconds}
              startedAt={startedAt}
              saving={saving}
              savedAt={savedAt}
              syncNotice={syncNotice}
              actionMessage={actionMessage}
              actionError={actionError}
              lockReason={lockReason}
              finalScore={finalScore}
              finalTotal={finalTotal}
              submitting={submitting}
              lockedByTime={lockedByTime}
              lockedByServer={lockedByServer}
              stageTitle={stageCopy.title}
              stageDescription={stageCopy.description}
              firstUnansweredQuestionId={firstUnansweredQuestionId}
              feedbackTargetId={feedbackTargetId}
              onSaveDraft={handleSaveDraft}
            />
          </div>
        </div>
      </details>

      {result ? (
        <div id="exam-result" ref={resultSectionRef}>
          <ExamResultCard
            details={result.details ?? []}
            score={result.score}
            total={result.total}
            wrongCount={result.wrongCount}
            queuedReviewCount={result.queuedReviewCount}
            reviewPackSummary={reviewPackSummary}
          />
        </div>
      ) : null}

      {hasReviewPackSection ? (
        <div id="exam-review-pack">
          <ExamReviewPackCard
            reviewPackLoading={reviewPackLoading}
            reviewPack={reviewPack}
            reviewPackSummary={reviewPackSummary}
            reviewPackError={reviewPackError}
            onLoadReviewPack={() => void loadReviewPack()}
          />
        </div>
      ) : null}

      {submitted ? (
        <details className="workflow-collapsible" open>
          <summary>
            <span>查看原始作答记录</span>
            <span className="chip">{data.questions.length} 题</span>
          </summary>
          <div className="workflow-collapsible-body">
            <div id="exam-answer-sheet">
              <ExamAnswerSheetCard
                data={data}
                answers={answers}
                answerCount={answerCount}
                unansweredCount={unansweredCount}
                firstUnansweredQuestionId={firstUnansweredQuestionId}
                submitted={submitted}
                lockedByTime={lockedByTime}
                lockedByServer={lockedByServer}
                submitting={submitting}
                online={online}
                lockReason={lockReason}
                finalScore={finalScore}
                finalTotal={finalTotal}
                queuedReviewCount={result?.queuedReviewCount}
                feedbackTargetId={feedbackTargetId}
                onSubmit={handleSubmit}
                onAnswerChange={handleAnswerChange}
              />
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
