"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import WrongBookHistoryCard from "./_components/WrongBookHistoryCard";
import WrongBookReviewQueueCard from "./_components/WrongBookReviewQueueCard";
import WrongBookTaskGeneratorCard from "./_components/WrongBookTaskGeneratorCard";
import WrongBookTasksCard from "./_components/WrongBookTasksCard";
import { useWrongBookPage } from "./useWrongBookPage";

export default function WrongBookPage() {
  const wrongBookPage = useWrongBookPage();
  const dueTodayCount = wrongBookPage.reviewQueue?.summary?.dueToday ?? 0;
  const overdueReviewCount = wrongBookPage.reviewQueue?.summary?.overdue ?? 0;
  const upcomingReviewCount = wrongBookPage.reviewQueue?.summary?.upcoming ?? 0;
  const pendingTaskCount = wrongBookPage.summary?.pending ?? 0;
  const overdueTaskCount = wrongBookPage.summary?.overdue ?? 0;
  const dueSoonTaskCount = wrongBookPage.summary?.dueSoon ?? 0;
  const completedTaskCount = wrongBookPage.summary?.completed ?? 0;
  const wrongItemCount = wrongBookPage.list.length;
  const firstTodayReview = wrongBookPage.reviewQueue?.today?.[0] ?? null;
  const nextTask = wrongBookPage.tasks.find((task) => task.status === "pending") ?? wrongBookPage.tasks[0] ?? null;
  const showReviewQueuePrimary = dueTodayCount > 0 || overdueReviewCount > 0;
  const showTasksPrimary = pendingTaskCount > 0 || overdueTaskCount > 0 || dueSoonTaskCount > 0;
  const showGeneratorPanel =
    wrongItemCount > 0 || wrongBookPage.taskGeneratorErrors.length > 0 || Boolean(wrongBookPage.taskGeneratorMessage);

  const focusTitle = showReviewQueuePrimary
    ? firstTodayReview
      ? "先完成今天的统一复练"
      : "今天先清空到期复练"
    : showTasksPrimary
      ? nextTask
        ? "先处理待订正任务"
        : "先安排订正闭环"
      : wrongItemCount > 0
        ? "把高价值错题排进计划"
        : "当前没有错题压力";
  const focusDescription = showReviewQueuePrimary
    ? `今天有 ${dueTodayCount} 题到期复练${overdueReviewCount ? `，其中 ${overdueReviewCount} 题已逾期` : ""}，建议先做今日队列，再回头看订正任务。`
    : showTasksPrimary
      ? `当前还有 ${pendingTaskCount} 项待订正任务${overdueTaskCount ? `，其中 ${overdueTaskCount} 项已逾期` : ""}，优先把最近要到期的内容处理掉。`
      : wrongItemCount > 0
        ? "错题本里已经沉淀了可复盘内容，可以挑选高优先级错题生成一轮新的订正任务。"
        : "当前错题本、订正任务和复练队列都比较干净，继续保持练习节奏就好。";

  const primaryAction = showReviewQueuePrimary
    ? { href: "#wrong-book-review-queue", label: "开始今日复练" }
    : showTasksPrimary
      ? { href: "#wrong-book-tasks", label: "查看订正任务" }
      : showGeneratorPanel
        ? { href: "#wrong-book-generator", label: "生成订正任务" }
        : { href: "/practice", label: "继续去练习" };
  const secondaryAction = showReviewQueuePrimary
    ? showTasksPrimary
      ? { href: "#wrong-book-tasks", label: "查看订正任务" }
      : showGeneratorPanel
        ? { href: "#wrong-book-generator", label: "安排后续任务" }
        : { href: "#wrong-book-history", label: "查看错题历史" }
    : showTasksPrimary
      ? showGeneratorPanel
        ? { href: "#wrong-book-generator", label: "补充新任务" }
        : { href: "#wrong-book-history", label: "查看错题历史" }
      : wrongItemCount > 0
        ? { href: "#wrong-book-history", label: "查看错题历史" }
        : { href: "/practice?mode=review", label: "进入错题复练" };

  if (wrongBookPage.loading && !wrongBookPage.hasContent && !wrongBookPage.authRequired) {
    return <StatePanel title="错题闭环加载中" description="正在同步错题本、订正任务和今日复练队列。" tone="loading" />;
  }

  if (wrongBookPage.authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看错题本、订正任务与统一复练队列。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (wrongBookPage.pageError && !wrongBookPage.hasContent) {
    return (
      <StatePanel
        title="错题闭环加载失败"
        description={wrongBookPage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void wrongBookPage.load()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>错题与订正</h2>
          <div className="section-sub">错题复盘 + 间隔复练 + 订正计划。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">错题闭环</span>
          {wrongBookPage.lastLoadedAtLabel ? <span className="chip">更新于 {wrongBookPage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={() => void wrongBookPage.load("refresh")} disabled={wrongBookPage.loading || wrongBookPage.refreshing || wrongBookPage.actionBusy}>
            {wrongBookPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {wrongBookPage.pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新同步失败：${wrongBookPage.pageError}`}
          tone="error"
          compact
        />
      ) : null}

      {wrongBookPage.actionError ? <div className="status-note error">{wrongBookPage.actionError}</div> : null}
      {wrongBookPage.actionMessage ? <div className="status-note success">{wrongBookPage.actionMessage}</div> : null}

      <div className="wrong-book-top-grid">
        <div className="workflow-spotlight-card wrong-book-focus-card">
          <div className="wrong-book-focus-kicker">今天先做什么</div>
          <div className="wrong-book-focus-title">{focusTitle}</div>
          <p className="wrong-book-focus-description">{focusDescription}</p>
          <div className="workflow-summary-grid">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">今日复练</div>
              <div className="workflow-summary-value">{dueTodayCount}</div>
              <div className="workflow-summary-helper">
                逾期 {overdueReviewCount} 题 · 后续排队 {upcomingReviewCount} 题
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">订正任务</div>
              <div className="workflow-summary-value">{pendingTaskCount}</div>
              <div className="workflow-summary-helper">
                逾期 {overdueTaskCount} 项 · 2 天内到期 {dueSoonTaskCount} 项
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">错题沉淀</div>
              <div className="workflow-summary-value">{wrongItemCount}</div>
              <div className="workflow-summary-helper">已完成订正 {completedTaskCount} 项</div>
            </div>
          </div>
        </div>

        <div className="workflow-spotlight-card wrong-book-action-card">
          <div className="wrong-book-action-title">{primaryAction.label}</div>
          <p className="wrong-book-action-description">
            {showReviewQueuePrimary
              ? "先完成今天该做的，再安排后续订正，学生更容易形成稳定的复练节奏。"
              : showTasksPrimary
                ? "先把最近要到期的订正清掉，再回头补新的任务，学习压力会更可控。"
                : wrongItemCount > 0
                  ? "错题不是越多越好，优先挑最关键的题进入计划，闭环效率更高。"
                  : "当前闭环压力不高，可以直接回到练习或预习。"}
          </p>
          <div className="workflow-step-line">
            建议顺序：今日复练优先，其次处理订正任务，最后再补录新任务和查看历史沉淀。
          </div>
          <div className="cta-row" style={{ marginTop: 14 }}>
            {primaryAction.href.startsWith("/") ? (
              <Link className="button primary" href={primaryAction.href}>
                {primaryAction.label}
              </Link>
            ) : (
              <a className="button primary" href={primaryAction.href}>
                {primaryAction.label}
              </a>
            )}
            {secondaryAction.href.startsWith("/") ? (
              <Link className="button ghost" href={secondaryAction.href}>
                {secondaryAction.label}
              </Link>
            ) : (
              <a className="button ghost" href={secondaryAction.href}>
                {secondaryAction.label}
              </a>
            )}
            <Link className="button secondary" href="/practice?mode=review">
              进入练习
            </Link>
          </div>
        </div>
      </div>

      {showReviewQueuePrimary ? (
        <div id="wrong-book-review-queue">
          <WrongBookReviewQueueCard
            reviewQueue={wrongBookPage.reviewQueue}
            reviewAnswers={wrongBookPage.reviewAnswers}
            reviewSubmitting={wrongBookPage.reviewSubmitting}
            reviewMessages={wrongBookPage.reviewMessages}
            onReviewAnswerChange={wrongBookPage.handleReviewAnswerChange}
            onSubmitReview={wrongBookPage.submitReview}
          />
        </div>
      ) : null}

      {showTasksPrimary ? (
        <div id="wrong-book-tasks">
          <WrongBookTasksCard
            summary={wrongBookPage.summary}
            tasks={wrongBookPage.tasks}
            completingTaskIds={wrongBookPage.completingTaskIds}
            onCompleteTask={wrongBookPage.handleComplete}
          />
        </div>
      ) : null}

      {!showReviewQueuePrimary && wrongBookPage.reviewQueue ? (
        <details className="workflow-collapsible">
          <summary>
            <span>统一复练队列与排期</span>
            <span className="chip">{dueTodayCount + upcomingReviewCount} 题</span>
          </summary>
          <div className="workflow-collapsible-body">
            <div id="wrong-book-review-queue">
              <WrongBookReviewQueueCard
                reviewQueue={wrongBookPage.reviewQueue}
                reviewAnswers={wrongBookPage.reviewAnswers}
                reviewSubmitting={wrongBookPage.reviewSubmitting}
                reviewMessages={wrongBookPage.reviewMessages}
                onReviewAnswerChange={wrongBookPage.handleReviewAnswerChange}
                onSubmitReview={wrongBookPage.submitReview}
              />
            </div>
          </div>
        </details>
      ) : null}

      {!showTasksPrimary && (wrongBookPage.summary || wrongBookPage.tasks.length) ? (
        <details className="workflow-collapsible">
          <summary>
            <span>订正任务面板</span>
            <span className="chip">{pendingTaskCount + completedTaskCount} 项</span>
          </summary>
          <div className="workflow-collapsible-body">
            <div id="wrong-book-tasks">
              <WrongBookTasksCard
                summary={wrongBookPage.summary}
                tasks={wrongBookPage.tasks}
                completingTaskIds={wrongBookPage.completingTaskIds}
                onCompleteTask={wrongBookPage.handleComplete}
              />
            </div>
          </div>
        </details>
      ) : null}

      {showGeneratorPanel ? (
        <details className="workflow-collapsible" id="wrong-book-generator" open={!showReviewQueuePrimary && !showTasksPrimary}>
          <summary>
            <span>从错题生成订正任务</span>
            <span className="chip">{wrongItemCount} 道错题</span>
          </summary>
          <div className="workflow-collapsible-body">
            <WrongBookTaskGeneratorCard
              dueDate={wrongBookPage.dueDate}
              list={wrongBookPage.list}
              selected={wrongBookPage.selected}
              message={wrongBookPage.taskGeneratorMessage}
              errors={wrongBookPage.taskGeneratorErrors}
              submitting={wrongBookPage.creatingTasks}
              onDueDateChange={wrongBookPage.updateDueDate}
              onToggleSelect={wrongBookPage.toggleSelect}
              onCreateTasks={wrongBookPage.handleCreateTasks}
            />
          </div>
        </details>
      ) : null}

      <details className="workflow-collapsible" id="wrong-book-history">
        <summary>
          <span>错题本与历史沉淀</span>
          <span className="chip">{wrongItemCount} 条记录</span>
        </summary>
        <div className="workflow-collapsible-body">
          <WrongBookHistoryCard list={wrongBookPage.list} />
        </div>
      </details>
    </div>
  );
}
