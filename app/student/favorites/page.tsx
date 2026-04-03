"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { buildLearningModeLabel } from "@/lib/classroom-integration";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useStudentSelfStudyArtifacts } from "@/lib/hooks/use-student-self-study-artifacts";
import {
  buildStudentSelfStudyArtifactDetail,
  formatStudentSelfStudyArtifactTime
} from "@/lib/student-self-study-artifacts";
import StudentFavoritesFiltersCard from "./_components/StudentFavoritesFiltersCard";
import StudentFavoritesHeader from "./_components/StudentFavoritesHeader";
import StudentFavoritesList from "./_components/StudentFavoritesList";
import StudentFavoritesOverviewSection from "./_components/StudentFavoritesOverviewSection";
import { useStudentFavoritesPageView } from "./useStudentFavoritesPageView";

export default function StudentFavoritesPage() {
  const favoritesPage = useStudentFavoritesPageView();
  const classroomArtifacts = useStudentSelfStudyArtifacts();
  const favoriteArtifacts = classroomArtifacts.artifacts.slice(0, 3);
  const savedFavoriteCount = classroomArtifacts.artifacts.filter((item) => item.savedToFavoritesAt).length;

  if (favoritesPage.loading && !favoritesPage.authRequired && !favoritesPage.hasFavoritesData) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载题目收藏夹"
        description="正在同步你的收藏题、标签和复习备注，请稍等。"
      />
    );
  }

  if (favoritesPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看收藏夹"
        description="登录学生账号后，才能查看和整理你的个人题目收藏记录。"
      />
    );
  }

  if (favoritesPage.pageError && !favoritesPage.hasFavoritesData) {
    return (
      <StatePanel
        tone="error"
        title="收藏夹加载失败"
        description={favoritesPage.pageError}
        action={
          <button className="button secondary" type="button" onClick={favoritesPage.reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <StudentFavoritesHeader {...favoritesPage.headerProps} />

      {favoritesPage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${favoritesPage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={favoritesPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {favoritesPage.actionError ? <div className="status-note error">{favoritesPage.actionError}</div> : null}
      {favoritesPage.actionMessage ? <div className="status-note success">{favoritesPage.actionMessage}</div> : null}

      <StudentFavoritesOverviewSection {...favoritesPage.overviewProps} />

      <Card title="互动课堂灵感收藏" tag="航科互动课堂">
        {favoriteArtifacts.length ? (
          <div className="grid" style={{ gap: 12 }}>
            <p>
              最近 {favoriteArtifacts.length} 节学生自学互动课堂已经同步到收藏视角，其中 {savedFavoriteCount} 节已被你标记为值得反复回看的课堂灵感。
            </p>
            {favoriteArtifacts.map((artifact) => {
              const subjectLabel = artifact.subject
                ? SUBJECT_LABELS[artifact.subject] ?? artifact.subject
                : "综合";
              const savedToFavorites = Boolean(artifact.savedToFavoritesAt);

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
                      <span className="chip">{savedToFavorites ? "已收藏" : "待收藏"}</span>
                    </div>
                  </div>
                  <p style={{ marginTop: 10 }}>
                    这节课目前有 {artifact.sceneCount} 个课堂场景，最近更新于 {formatStudentSelfStudyArtifactTime(artifact.updatedAt)}。
                  </p>
                  <div className="cta-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                    {!savedToFavorites ? (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          classroomArtifacts.markSaved(artifact.stageId, "favorites");
                        }}
                      >
                        标记为课堂灵感
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
            <p>还没有来自互动课堂的灵感记录。完成一节兴趣培养、预习或回看课堂后，可以把值得反复回看的思路留在这里。</p>
            <div className="cta-row no-margin" style={{ flexWrap: "wrap" }}>
              <Link className="button secondary" href="/student/interactive-classroom">
                去生成一节互动课堂
              </Link>
            </div>
          </div>
        )}
      </Card>

      <StudentFavoritesFiltersCard {...favoritesPage.filtersProps} />

      <StudentFavoritesList {...favoritesPage.listProps} />
    </div>
  );
}
