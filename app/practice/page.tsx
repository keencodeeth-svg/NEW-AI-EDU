"use client";

import Link from "next/link";
import Card from "@/components/Card";
import MathViewControls from "@/components/MathViewControls";
import StatePanel from "@/components/StatePanel";
import PracticeGuideCard from "./_components/PracticeGuideCard";
import PracticeMobileActionBar from "./_components/PracticeMobileActionBar";
import PracticeQuestionCard from "./_components/PracticeQuestionCard";
import PracticeResultCard from "./_components/PracticeResultCard";
import PracticeSettingsCard from "./_components/PracticeSettingsCard";
import { PracticeVariantAnalysisCard, PracticeVariantTrainingCard } from "./_components/PracticeVariantCards";
import { PRACTICE_MODE_LABELS } from "./config";
import { usePracticePage } from "./usePracticePage";

export default function PracticePage() {
  const {
    subject,
    setSubject,
    grade,
    setGrade,
    knowledgeSearch,
    setKnowledgeSearch,
    knowledgePointId,
    setKnowledgePointId,
    mode,
    question,
    answer,
    setAnswer,
    result,
    challengeCount,
    challengeCorrect,
    timeLeft,
    authRequired,
    error,
    knowledgePointsError,
    questionLoading,
    submitting,
    autoFixing,
    autoFixHint,
    lastLoadedAt,
    mathView,
    showPracticeGuide,
    hidePracticeGuide,
    showPracticeGuideAgain,
    groupedKnowledgePoints,
    filteredKnowledgePointsCount,
    filteredCount,
    selectedKnowledgeTitle,
    canSubmitCurrentQuestion,
    stageTitle,
    stageDescription,
    stageBusy,
    questionCardRef,
    resultCardRef,
    handleModeChange,
    reloadKnowledgePoints,
    loadQuestion,
    applyPracticeQuickFix,
    submitAnswer,
    variantPack,
    variantAnswers,
    setVariantAnswers,
    variantResults,
    setVariantResults,
    loadingVariants,
    favorite,
    favoriteLoading,
    explainMode,
    setExplainMode,
    explainPack,
    explainLoading,
    toggleFavorite,
    editFavoriteTags,
    loadVariants,
    resetChallenge
  } = usePracticePage();
  const modeLabel = PRACTICE_MODE_LABELS[mode] ?? "练习模式";
  const hasQuestion = Boolean(question);
  const hasResult = Boolean(result);
  const hasVariants = Boolean(variantPack?.variants?.length);
  const lastLoadedAtLabel = lastLoadedAt
    ? new Date(lastLoadedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : null;
  const masteryDelta = result?.masteryDelta ?? 0;
  const setupOpen = (!hasQuestion && !hasResult) || Boolean(error || knowledgePointsError || showPracticeGuide);

  const focusStatusValue = hasResult
    ? result?.correct
      ? "已吸收"
      : "待巩固"
    : hasQuestion
      ? canSubmitCurrentQuestion
        ? "可提交"
        : "待选择"
      : "待开始";
  const focusStatusHelper = hasResult
    ? `掌握度 ${result?.masteryScore ?? 0} · 变化 ${masteryDelta >= 0 ? "+" : ""}${masteryDelta}`
    : mode === "timed"
      ? `剩余 ${timeLeft} 秒`
      : mode === "challenge"
        ? `闯关 ${challengeCount}/5 · 正确 ${challengeCorrect}`
        : hasQuestion
          ? "提交后即可获得 AI 讲解与掌握变化"
          : "选择模式与范围后即可开始";
  const actionTitle = hasResult
    ? result?.correct
      ? "保持手感，继续下一题"
      : "先吸收解析，再做迁移"
    : hasQuestion
      ? "先把这题做完"
      : "先准备好这一轮练习";
  const actionDescription = hasResult
    ? result?.correct
      ? "这题已经做稳了，最好的下一步通常是继续下一题，或者做一组变式把能力迁移出去。"
      : "错误题最有学习价值，建议先看讲解，再做变式训练，把这次失分变成真正的掌握。"
    : hasQuestion
      ? "现在只需要专注一道题。先完成选择并提交，系统会自动给你解释、掌握变化和后续巩固建议。"
      : "先选模式和知识点范围，再开始这一轮练习。设置不用一次调很细，先开始更重要。";

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录后开始练习"
        description="登录后即可获取题目、提交答案、查看 AI 讲解和收藏练习。"
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
    <div className="grid math-view-surface practice-page" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>智能练习</h2>
          <div className="section-sub">个性化练习 + AI 讲解 + 变式训练。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{modeLabel}</span>
          <span className="chip">{selectedKnowledgeTitle}</span>
          {lastLoadedAtLabel ? <span className="chip">更新于 {lastLoadedAtLabel}</span> : null}
        </div>
      </div>

      {knowledgePointsError ? (
        <StatePanel
          title="知识点列表同步失败"
          description={knowledgePointsError}
          tone="error"
          compact
          action={
            <button className="button secondary" type="button" onClick={reloadKnowledgePoints}>
              重试
            </button>
          }
        />
      ) : null}

      <div className="practice-workflow-top-grid">
        <div className="workflow-spotlight-card practice-focus-card">
          <div className="practice-focus-kicker">现在最重要</div>
          <div className="practice-focus-title">{stageTitle}</div>
          <p className="practice-focus-description">{stageDescription}</p>
          <div className="workflow-summary-grid">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">学习模式</div>
              <div className="workflow-summary-value practice-summary-text">{modeLabel}</div>
              <div className="workflow-summary-helper">可随时切换，不会影响下一题获取</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">练习范围</div>
              <div className="workflow-summary-value">{filteredKnowledgePointsCount}</div>
              <div className="workflow-summary-helper">{selectedKnowledgeTitle}</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">当前状态</div>
              <div className="workflow-summary-value practice-summary-text">{focusStatusValue}</div>
              <div className="workflow-summary-helper">{focusStatusHelper}</div>
            </div>
          </div>
        </div>

        <div className="workflow-spotlight-card practice-action-card">
          <div className="practice-action-title">{actionTitle}</div>
          <p className="practice-action-description">{actionDescription}</p>
          <div className="workflow-step-line">
            建议顺序：先获取或完成当前题目，再看 AI 讲解，最后再做变式训练巩固，不要把注意力分散在太多面板上。
          </div>
          <div className="cta-row" style={{ marginTop: 14 }}>
            {hasResult ? (
              <button className="button primary" type="button" onClick={loadQuestion} disabled={questionLoading}>
                {questionLoading ? "获取中..." : result?.correct ? "继续下一题" : "再做一题"}
              </button>
            ) : hasQuestion ? (
              <button
                className="button primary"
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmitCurrentQuestion || stageBusy}
              >
                {submitting ? "判题中..." : "提交答案"}
              </button>
            ) : (
              <button className="button primary" type="button" onClick={loadQuestion} disabled={stageBusy}>
                {autoFixing
                  ? "修复中..."
                  : questionLoading
                    ? "获取中..."
                    : mode === "timed"
                      ? "开始限时"
                      : "获取题目"}
              </button>
            )}

            {hasResult ? (
              <button
                className="button secondary"
                type="button"
                onClick={loadVariants}
                disabled={loadingVariants || hasVariants}
              >
                {loadingVariants ? "生成中..." : hasVariants ? "变式已生成" : "做变式训练"}
              </button>
            ) : hasQuestion ? (
              <button className="button secondary" type="button" onClick={loadQuestion} disabled={stageBusy}>
                {questionLoading ? "获取中..." : "换一题"}
              </button>
            ) : (
              <a className="button secondary" href="#practice-setup">
                调整设置
              </a>
            )}

            {!showPracticeGuide && !hasQuestion && !hasResult ? (
              <button className="button ghost" type="button" onClick={showPracticeGuideAgain}>
                显示上手引导
              </button>
            ) : (
              <a className="button ghost" href="#practice-setup">
                {hasResult ? "查看设置与引导" : "查看准备区"}
              </a>
            )}
          </div>
        </div>
      </div>

      <details className="workflow-collapsible" id="practice-setup" open={setupOpen}>
        <summary>
          <span>练习准备与上手引导</span>
          <span className="chip">{modeLabel}</span>
        </summary>
        <div className="workflow-collapsible-body practice-setup-stack">
          <PracticeGuideCard visible={showPracticeGuide} onHide={hidePracticeGuide} onShow={showPracticeGuideAgain} />
          <div id="practice-settings">
            <PracticeSettingsCard
              subject={subject}
              grade={grade}
              mode={mode}
              knowledgeSearch={knowledgeSearch}
              knowledgePointId={knowledgePointId}
              groupedKnowledgePoints={groupedKnowledgePoints}
              filteredKnowledgePointsCount={filteredKnowledgePointsCount}
              filteredCount={filteredCount}
              selectedKnowledgeTitle={selectedKnowledgeTitle}
              error={error}
              autoFixHint={autoFixHint}
              autoFixing={autoFixing}
              questionLoading={questionLoading}
              submitting={submitting}
              questionVisible={Boolean(question)}
              resultVisible={Boolean(result)}
              stageTitle={stageTitle}
              stageDescription={stageDescription}
              timeLeft={timeLeft}
              challengeCount={challengeCount}
              challengeCorrect={challengeCorrect}
              onSubjectChange={setSubject}
              onGradeChange={setGrade}
              onModeChange={handleModeChange}
              onKnowledgeSearchChange={setKnowledgeSearch}
              onKnowledgePointChange={setKnowledgePointId}
              onLoadQuestion={loadQuestion}
              onQuickFix={applyPracticeQuickFix}
            />
          </div>
          <div className="workflow-spotlight-card practice-reading-card">
            <div className="practice-reading-title">阅读与公式显示</div>
            <p className="practice-reading-description">遇到公式多、题干长或想减少视觉负担时，再调整这里就够了。</p>
            <MathViewControls
              fontScale={mathView.fontScale}
              lineMode={mathView.lineMode}
              onDecrease={mathView.decreaseFontScale}
              onIncrease={mathView.increaseFontScale}
              onReset={mathView.resetView}
              onLineModeChange={mathView.setLineMode}
            />
          </div>
        </div>
      </details>

      {question ? (
        <div id="practice-question" ref={questionCardRef}>
          <PracticeQuestionCard
            question={question}
            answer={answer}
            favorite={favorite}
            favoriteLoading={favoriteLoading}
            canSubmit={canSubmitCurrentQuestion}
            questionLoading={questionLoading}
            submitting={submitting}
            onAnswerChange={setAnswer}
            onToggleFavorite={toggleFavorite}
            onEditFavoriteTags={editFavoriteTags}
            onLoadQuestion={loadQuestion}
            onSubmit={submitAnswer}
          />
        </div>
      ) : null}

      {result ? (
        <div id="practice-result" ref={resultCardRef}>
          <PracticeResultCard
            result={result}
            explainMode={explainMode}
            explainPack={explainPack}
            explainLoading={explainLoading}
            loadingVariants={loadingVariants}
            questionLoading={questionLoading}
            hasVariants={Boolean(variantPack?.variants?.length)}
            onExplainModeChange={setExplainMode}
            onLoadVariants={loadVariants}
            onLoadNextQuestion={loadQuestion}
          />
        </div>
      ) : null}

      {variantPack ? (
        <details className="workflow-collapsible" id="practice-variants" open>
          <summary>
            <span>变式训练与迁移巩固</span>
            <span className="chip">{variantPack.variants?.length ? `${variantPack.variants.length} 题` : "已生成"}</span>
          </summary>
          <div className="workflow-collapsible-body">
            <PracticeVariantAnalysisCard variantPack={variantPack} />
            {variantPack.variants?.length ? (
              <PracticeVariantTrainingCard
                variantPack={variantPack}
                variantAnswers={variantAnswers}
                variantResults={variantResults}
                onAnswerChange={(index, value) =>
                  setVariantAnswers((prev) => ({
                    ...prev,
                    [index]: value
                  }))
                }
                onSubmit={(index, selected, correctAnswer) =>
                  setVariantResults((prev) => ({
                    ...prev,
                    [index]: selected === correctAnswer
                  }))
                }
              />
            ) : null}
          </div>
        </details>
      ) : null}

      {mode === "challenge" && challengeCount >= 5 ? (
        <Card title="闯关结果" tag="成果">
          <p className="practice-challenge-result">本次闯关正确 {challengeCorrect} / 5</p>
          <button className="button secondary" type="button" onClick={resetChallenge}>
            再来一次
          </button>
        </Card>
      ) : null}

      <PracticeMobileActionBar
        questionVisible={Boolean(question)}
        resultVisible={Boolean(result)}
        canSubmit={canSubmitCurrentQuestion}
        timedMode={mode === "timed"}
        busy={stageBusy}
        loadingVariants={loadingVariants}
        hasVariants={Boolean(variantPack?.variants?.length)}
        onLoadQuestion={loadQuestion}
        onSubmit={submitAnswer}
        onLoadVariants={loadVariants}
      />
    </div>
  );
}
