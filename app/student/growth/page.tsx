"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { buildLearningModeLabel } from "@/lib/classroom-integration";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useStudentSelfStudyArtifacts } from "@/lib/hooks/use-student-self-study-artifacts";
import {
  buildStudentSelfStudyArtifactDetail,
  formatStudentSelfStudyArtifactTime
} from "@/lib/student-self-study-artifacts";
import { useStudentGrowthPage } from "./useStudentGrowthPage";

export default function StudentGrowthPage() {
  const growthPage = useStudentGrowthPage();
  const classroomArtifacts = useStudentSelfStudyArtifacts();
  const latestArtifacts = classroomArtifacts.artifacts.slice(0, 3);
  const savedGrowthCount = classroomArtifacts.artifacts.filter((item) => item.savedToGrowthAt).length;

  if (growthPage.loading && !growthPage.data && !growthPage.authRequired) {
    return (
      <StatePanel title="成长档案加载中" description="正在汇总练习轨迹、学科掌握度与薄弱点。" tone="loading" />
    );
  }

  if (growthPage.authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看学习轨迹、学科掌握度与薄弱点分析。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (growthPage.pageError && !growthPage.data) {
    return (
      <StatePanel
        title="成长档案加载失败"
        description={growthPage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void growthPage.loadGrowth()}>
            重试
          </button>
        }
      />
    );
  }

  if (!growthPage.data) {
    return (
      <StatePanel
        title="成长档案暂时不可用"
        description="当前未能同步成长分析数据，请稍后再试。"
        tone="empty"
        action={
          <button className="button secondary" type="button" onClick={() => void growthPage.loadGrowth()}>
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
          <h2>成长档案</h2>
          <div className="section-sub">学习轨迹、学科掌握度与薄弱点。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">成长分析</span>
          <button
            className="button secondary"
            type="button"
            onClick={() => void growthPage.loadGrowth("refresh")}
            disabled={growthPage.loading || growthPage.refreshing}
          >
            {growthPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {growthPage.pageError ? (
        <StatePanel title="本次刷新存在异常" description={growthPage.pageError} tone="error" compact />
      ) : null}

      <Card title="互动课堂学习资产" tag="航科互动课堂">
        {latestArtifacts.length ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="feature-card">
              <EduIcon name="book" />
              <p>
                最近 {latestArtifacts.length} 节学生自学互动课堂已经同步到成长视角，其中 {savedGrowthCount} 节已明确沉淀为成长档案记录。
              </p>
            </div>
            {latestArtifacts.map((artifact) => {
              const subjectLabel = artifact.subject
                ? SUBJECT_LABELS[artifact.subject] ?? artifact.subject
                : "综合";
              const savedToGrowth = Boolean(artifact.savedToGrowthAt);

              return (
                <div className="card" key={artifact.stageId}>
                  <div className="cta-row no-margin" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div className="section-title">{artifact.topic || artifact.stageName}</div>
                      <p>{buildStudentSelfStudyArtifactDetail(artifact)}</p>
                    </div>
                    <div className="cta-row no-margin" style={{ flexWrap: "wrap", gap: 8 }}>
                      <span className="chip">{buildLearningModeLabel(artifact.learningMode)}</span>
                      <span className="chip">{subjectLabel}</span>
                      <span className="chip">{savedToGrowth ? "已沉淀" : "待沉淀"}</span>
                    </div>
                  </div>
                  <p style={{ marginTop: 10 }}>
                    已生成 {artifact.sceneCount} 个课堂场景，最近更新于 {formatStudentSelfStudyArtifactTime(artifact.updatedAt)}。
                  </p>
                  <div className="cta-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                    {!savedToGrowth ? (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          classroomArtifacts.markSaved(artifact.stageId, "growth");
                        }}
                      >
                        加入成长档案
                      </button>
                    ) : null}
                    <Link className="button secondary" href={artifact.stageHref}>
                      回到互动课堂
                    </Link>
                    <Link
                      className="button secondary"
                      href={artifact.followUpHref || artifact.studentLaunchHref}
                    >
                      {artifact.followUpMode
                        ? `切到${buildLearningModeLabel(artifact.followUpMode)}`
                        : "继续下一模式"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            <p>还没有同步到互动课堂成果。完成一节预习、巩固、兴趣培养或课堂回看后，这里会自动出现最近的学习资产。</p>
            <div className="cta-row no-margin" style={{ flexWrap: "wrap" }}>
              <Link className="button secondary" href="/student/interactive-classroom">
                去生成一节互动课堂
              </Link>
            </div>
          </div>
        )}
      </Card>

      <Card title="学习路径总览" tag="总览">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>练习量、正确率与近 7 天表现。</p>
        </div>
        <div className="grid grid-3">
          <div className="card">
            <div className="section-title">总练习题量</div>
            <p>{growthPage.data.summary.totalAttempts} 题</p>
          </div>
          <div className="card">
            <div className="section-title">总体正确率</div>
            <p>{growthPage.data.summary.accuracy}%</p>
          </div>
          <div className="card">
            <div className="section-title">近 7 天正确率</div>
            <p>{growthPage.data.summary.last7Accuracy}%</p>
          </div>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="section-title">近 7 天练习</div>
            <p>{growthPage.data.summary.last7Total} 题</p>
          </div>
          <div className="card">
            <div className="section-title">已完成作业</div>
            <p>{growthPage.data.summary.assignmentsCompleted} 份</p>
          </div>
        </div>
      </Card>

      <Card title="学科掌握度" tag="学科">
        {growthPage.data.subjects.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {growthPage.data.subjects.map((item) => (
              <div className="card" key={item.subject}>
                <div className="section-title">{SUBJECT_LABELS[item.subject] ?? item.subject}</div>
                <p>正确率 {item.accuracy}%</p>
                <p>练习 {item.total} 题</p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无练习数据。</p>
        )}
      </Card>

      <Card title="薄弱知识点" tag="薄弱">
        {growthPage.data.weakPoints.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {growthPage.data.weakPoints.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <p>
                  {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </p>
                <p>正确率 {item.ratio}% · 练习 {item.total} 次</p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无薄弱点记录。</p>
        )}
      </Card>
    </div>
  );
}
