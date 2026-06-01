'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import EduIcon from '@/components/EduIcon';
import { SUBJECT_LABELS } from '@/lib/constants';
import { buildLearningModeLabel } from '@/lib/classroom-integration';
import type { StudentSelfStudyMode } from '@/lib/integrations/ai-classroom-launch';
import {
  buildRecentStudentSelfStudyDetail,
  buildRecentStudentSelfStudySummary,
  buildStudentSelfStudyHref,
  formatRecentStudentSelfStudyTime,
  loadRecentStudentSelfStudySession,
  resolveStudentSelfStudyFollowUpMode,
  type RecentStudentSelfStudySession,
} from '@/lib/student-self-study-recent';

type StudentInteractiveClassroomEntryCardProps = {
  weakKnowledgePointTitle?: string | null;
  weakKnowledgePointSubject?: string | null;
  weakPlanCount: number;
};

export default function StudentInteractiveClassroomEntryCard({
  weakKnowledgePointTitle,
  weakKnowledgePointSubject,
  weakPlanCount,
}: StudentInteractiveClassroomEntryCardProps) {
  const [recentSession] = useState<RecentStudentSelfStudySession | null>(loadRecentStudentSelfStudySession);

  const subjectLabel = weakKnowledgePointSubject
    ? (SUBJECT_LABELS[weakKnowledgePointSubject] ?? weakKnowledgePointSubject)
    : null;
  const recommendedMode: StudentSelfStudyMode = weakKnowledgePointTitle
    ? 'subject-reinforcement'
    : 'preview-preparation';
  const recommendedHref = buildStudentSelfStudyHref({
    mode: recommendedMode,
    subject: weakKnowledgePointSubject,
    topic: weakKnowledgePointTitle,
  });
  const recentSummary = useMemo(
    () => (recentSession ? buildRecentStudentSelfStudySummary(recentSession) : null),
    [recentSession],
  );
  const recentDetail = useMemo(
    () => (recentSession ? buildRecentStudentSelfStudyDetail(recentSession) : null),
    [recentSession],
  );
  const recentFollowUpMode = useMemo(
    () => (recentSession ? resolveStudentSelfStudyFollowUpMode(recentSession.mode) : null),
    [recentSession],
  );
  const recentResumeHref = useMemo(
    () =>
      recentSession
        ? buildStudentSelfStudyHref({
            mode: recentSession.mode,
            subject: recentSession.subject,
            topic: recentSession.topic,
            goal: recentSession.learnerGoal,
          })
        : null,
    [recentSession],
  );
  const recentFollowUpHref = useMemo(
    () =>
      recentSession && recentFollowUpMode
        ? buildStudentSelfStudyHref({
            mode: recentFollowUpMode,
            subject: recentSession.subject,
            topic: recentSession.topic,
            goal: recentSession.learnerGoal,
          })
        : null,
    [recentFollowUpMode, recentSession],
  );
  const recommendedModeLabel = buildLearningModeLabel(recommendedMode);
  const recommendedFocusSummary = weakKnowledgePointTitle
    ? `${weakKnowledgePointTitle}${subjectLabel ? ` · ${subjectLabel}` : ''}`
    : '先从当前单元主线进入';
  const recommendedNarrative = weakKnowledgePointTitle
    ? `系统建议先围绕“${weakKnowledgePointTitle}”开启一节${subjectLabel ? `${subjectLabel} ` : ''}${recommendedModeLabel}课堂，把刚暴露出来的薄弱点直接收口。`
    : `如果暂时没有明显弱项，建议先从${recommendedModeLabel}开始，把新课主线、问题清单和后续学习节奏先搭起来。`;
  const modeShortcuts = [
    {
      id: 'preview-preparation',
      label: '开始预习',
      href: buildStudentSelfStudyHref({
        mode: 'preview-preparation',
        subject: weakKnowledgePointSubject,
      }),
    },
    {
      id: 'subject-reinforcement',
      label: '开始巩固',
      href: buildStudentSelfStudyHref({
        mode: 'subject-reinforcement',
        subject: weakKnowledgePointSubject,
        topic: weakKnowledgePointTitle,
      }),
    },
    {
      id: 'interest-cultivation',
      label: '开始探索',
      href: buildStudentSelfStudyHref({
        mode: 'interest-cultivation',
        subject: weakKnowledgePointSubject,
      }),
    },
    {
      id: 'classroom-review',
      label: '开始回看',
      href: buildStudentSelfStudyHref({
        mode: 'classroom-review',
        subject: weakKnowledgePointSubject,
        topic: weakKnowledgePointTitle,
      }),
    },
  ] as const;
  const outputCapabilities = ['数字老师讲解', '即时练习', '课后回看', '导出分享'];

  return (
    <Card title="航科互动课堂" tag="学生自学" bodyClassName="student-classroom-entry-body">
      <div className="student-classroom-entry-grid">
        <div className="student-classroom-entry-main">
          <div className="student-classroom-entry-hero">
            <div className="feature-card" style={{ alignItems: 'flex-start' }}>
              <EduIcon name="board" />
              <div>
                <div className="student-classroom-entry-kicker">直接从当前状态开课</div>
                <div className="student-classroom-entry-title">
                  先用一节{recommendedModeLabel}互动课堂开始
                </div>
                <p className="student-classroom-entry-description">
                  系统会把你的年级、学科、学习目标和画像薄弱点一起带入，默认生成更像真实学习任务的互动课堂，而不是一段普通聊天。
                </p>
              </div>
            </div>

            <div className="student-classroom-entry-highlight-grid">
              <div className="student-classroom-entry-highlight-card">
                <div className="workflow-summary-label">推荐模式</div>
                <div className="student-classroom-entry-highlight-value">{recommendedModeLabel}</div>
                <div className="workflow-summary-helper">
                  {weakKnowledgePointTitle ? '先收口最容易转化为提分。' : '先搭主线，再决定后续巩固或探索。'}
                </div>
              </div>
              <div className="student-classroom-entry-highlight-card">
                <div className="workflow-summary-label">当前焦点</div>
                <div className="student-classroom-entry-highlight-value">{recommendedFocusSummary}</div>
                <div className="workflow-summary-helper">
                  {weakPlanCount ? `当前还有 ${weakPlanCount} 个弱项计划待收口` : '还没有明显弱项时，更适合先从主线进入。'}
                </div>
              </div>
              <div className="student-classroom-entry-highlight-card">
                <div className="workflow-summary-label">课堂能力</div>
                <div className="student-classroom-entry-highlight-value">可跟学 / 可回看 / 可导出</div>
                <div className="workflow-summary-helper">
                  默认支持数字老师讲解、互动追问、阶段练习和课后沉淀。
                </div>
              </div>
            </div>

            <div className="pill-list" style={{ marginTop: 12 }}>
              <span className="pill">课前预习</span>
              <span className="pill">学科巩固</span>
              <span className="pill">兴趣探索</span>
              <span className="pill">课堂回看</span>
            </div>

            <div className="cta-row">
              <Link className="button primary" href={recommendedHref}>
                {`开始${recommendedModeLabel}`}
              </Link>
              <Link className="button secondary" href="/student/interactive-classroom">
                查看全部学习模式
              </Link>
              <Link className="button ghost" href="/student/portrait">
                查看学习画像
              </Link>
            </div>
          </div>

          <details className="workflow-collapsible student-classroom-entry-disclosure">
            <summary>
              <span>切换其他课堂模式</span>
              <span className="chip">4 种模式</span>
            </summary>
            <div className="workflow-collapsible-body">
              <div className="student-classroom-entry-shortcuts">
                {modeShortcuts.map((item) => (
                  <Link key={item.id} className="button ghost" href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </details>
        </div>

        <div className="student-classroom-entry-side">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前更适合怎么开始</div>
            <div className="student-classroom-entry-side-title">先按推荐路径进入</div>
            <div className="workflow-summary-helper">{recommendedNarrative}</div>
          </div>

          {recentSession && recentResumeHref ? (
            <details className="workflow-collapsible student-classroom-entry-disclosure">
              <summary>
                <span>最近一次自主学习</span>
                <span className="chip">{recentSummary}</span>
              </summary>
              <div className="workflow-collapsible-body">
                <div className="student-classroom-entry-recent-panel">
                  <div className="student-classroom-entry-side-title">{recentSummary}</div>
                  <div className="meta-text">
                    {formatRecentStudentSelfStudyTime(recentSession.updatedAt)}
                  </div>
                  <div className="student-classroom-entry-recent-copy">{recentDetail}</div>
                  <div className="cta-row cta-row-tight">
                    <Link className="button secondary" href={recentResumeHref}>
                      继续上次主题
                    </Link>
                    {recentFollowUpMode && recentFollowUpHref ? (
                      <Link className="button ghost" href={recentFollowUpHref}>
                        切到{buildLearningModeLabel(recentFollowUpMode)}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </details>
          ) : null}

          <div className="workflow-summary-card">
            <div className="workflow-summary-label">生成后你会拿到</div>
            <div className="student-classroom-entry-output-grid">
              {outputCapabilities.map((item) => (
                <span key={item} className="pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {!weakKnowledgePointTitle ? (
            <div className="status-note info">
              还没有明显的单点薄弱项时，可以先用兴趣探索或课前预习模式启动，再回到画像页观察变化。
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
