"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { TeacherDigitalHumanProfile } from "@/lib/classroom-integration";
import {
  buildAiClassroomLaunchPayloadFromTeacherOutline,
  saveAiClassroomLaunchPayload
} from "@/lib/integrations/ai-classroom-launch";
import TeacherDigitalHumanCard from "./_components/TeacherDigitalHumanCard";
import TeacherAiGuideCard from "./_components/TeacherAiGuideCard";
import TeacherOutlineGeneratorPanel from "./_components/TeacherOutlineGeneratorPanel";
import TeacherPaperGeneratorPanel from "./_components/TeacherPaperGeneratorPanel";
import TeacherQuestionCheckPanel from "./_components/TeacherQuestionCheckPanel";
import TeacherReviewPackPanel from "./_components/TeacherReviewPackPanel";
import TeacherInteractiveClassroomDeliveryLedgerCard from "./_components/TeacherInteractiveClassroomDeliveryLedgerCard";
import TeacherWrongReviewPanel from "./_components/TeacherWrongReviewPanel";
import { useTeacherAiToolsPageView } from "./useTeacherAiToolsPageView";

export default function TeacherAiToolsPage() {
  const router = useRouter();
  const aiToolsPage = useTeacherAiToolsPageView();
  const [launchingInteractiveClassroom, setLaunchingInteractiveClassroom] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [digitalHumanSummary, setDigitalHumanSummary] = useState<{
    displayName?: string;
    portraitReady: boolean;
    voiceReady: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDigitalHumanSummary() {
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const mePayload = (await meResponse.json().catch(() => null)) as {
          user?: { role?: string | null } | null;
        } | null;

        const currentRole = mePayload?.user?.role ?? null;
        if (!meResponse.ok || !mePayload?.user || (currentRole !== "teacher" && currentRole !== "admin")) {
          if (!cancelled) {
            setDigitalHumanSummary(null);
          }
          return;
        }

        const response = await fetch("/api/teacher/digital-human", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          data?: TeacherDigitalHumanProfile;
        } | null;

        if (!response.ok || !payload?.data || cancelled) return;
        setDigitalHumanSummary({
          displayName: payload.data.displayName,
          portraitReady: Boolean(payload.data.portraitUrl),
          voiceReady: Boolean(payload.data.voiceProviderId && payload.data.voiceId),
        });
      } catch {
        if (!cancelled) {
          setDigitalHumanSummary(null);
        }
      }
    }

    void loadDigitalHumanSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOutlineClass = useMemo(() => {
    const outlinePanel = aiToolsPage.outlineGeneratorPanelProps;
    return (
      outlinePanel.classes.find((item) => item.id === outlinePanel.outlineForm.classId) ??
      outlinePanel.classes[0] ??
      null
    );
  }, [aiToolsPage.outlineGeneratorPanelProps]);

  const selectedOutlineKnowledgePoints = useMemo(() => {
    const outlinePanel = aiToolsPage.outlineGeneratorPanelProps;
    return outlinePanel.outlinePoints.filter((item) =>
      outlinePanel.outlineForm.knowledgePointIds.includes(item.id),
    );
  }, [aiToolsPage.outlineGeneratorPanelProps]);

  const outlinePanel = aiToolsPage.outlineGeneratorPanelProps;
  const paperPanel = aiToolsPage.paperGeneratorPanelProps;
  const currentTopic = outlinePanel.outlineForm.topic.trim();
  const workflowSummaryItems = [
    {
      label: "当前班级",
      value: selectedOutlineClass?.name ?? "待选择",
      helper: selectedOutlineClass
        ? `${selectedOutlineClass.subject} · ${selectedOutlineClass.grade} 年级`
        : `已接入 ${outlinePanel.classes.length} 个班级`,
    },
    {
      label: "课堂主题",
      value: currentTopic || "待输入",
      helper: currentTopic ? "将作为课堂主线与讲稿主题" : "建议先写本节课的核心任务或主题",
    },
    {
      label: "知识点",
      value: selectedOutlineKnowledgePoints.length ? `${selectedOutlineKnowledgePoints.length} 个` : "待勾选",
      helper: selectedOutlineKnowledgePoints.length
        ? "已进入互动课堂上下文"
        : `当前可选 ${outlinePanel.outlinePoints.length} 个知识点`,
    },
    {
      label: "教师数字人",
      value: digitalHumanSummary?.displayName ?? "待配置",
      helper: digitalHumanSummary
        ? `${digitalHumanSummary.portraitReady ? "画像已就绪" : "画像待完善"} · ${digitalHumanSummary.voiceReady ? "音色已就绪" : "音色待完善"}`
        : "支持动漫画像 + 教师专属声音",
    },
  ];
  const workflowFocusText = selectedOutlineClass
    ? currentTopic
      ? "当前已具备班级与主题，可以直接进入知序课堂生成整班可观看的互动内容。"
      : "班级已就绪，补充课堂主题后即可把当前备课上下文送入知序课堂。"
    : "先选择班级，再确定主题与知识点，首屏就能顺滑进入互动课堂。";
  const workflowReadySteps = [
    selectedOutlineClass ? "班级已锁定" : "等待班级选择",
    currentTopic ? "主题已填写" : "等待主题输入",
    selectedOutlineKnowledgePoints.length ? "知识点已挂载" : "可补充知识点增强课堂结构",
    digitalHumanSummary?.portraitReady || digitalHumanSummary?.voiceReady
      ? "数字人素材可同步带入"
      : "可继续完善数字人画像与声音",
  ];

  const handleLaunchInteractiveClassroom = async () => {
    if (!selectedOutlineClass) return;

    setLaunchingInteractiveClassroom(true);
    setLaunchError(null);
    try {
      const [meResult, studentsResult, digitalHumanResult] = await Promise.allSettled([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch(`/api/teacher/classes/${selectedOutlineClass.id}/students`, { cache: "no-store" }),
        fetch("/api/teacher/digital-human", { cache: "no-store" }),
      ]);

      let teacherProfile:
        | {
            id: string;
            name: string;
            email?: string;
          }
        | undefined;
      let students: Array<{ id: string; name: string; email?: string; grade?: string }> = [];
      let digitalHuman: TeacherDigitalHumanProfile | null = null;

      if (meResult.status === "fulfilled" && meResult.value.ok) {
        const payload = (await meResult.value.json()) as {
          user?: { id: string; name: string; email?: string };
        };
        teacherProfile = payload.user;
      }

      if (studentsResult.status === "fulfilled" && studentsResult.value.ok) {
        const payload = (await studentsResult.value.json()) as {
          data?: Array<{ id: string; name: string; email?: string; grade?: string }>;
        };
        students = payload.data ?? [];
      }

      if (digitalHumanResult.status === "fulfilled" && digitalHumanResult.value.ok) {
        const payload = (await digitalHumanResult.value.json()) as {
          data?: TeacherDigitalHumanProfile;
        };
        digitalHuman = payload.data ?? null;
      }

      const payload = buildAiClassroomLaunchPayloadFromTeacherOutline({
        classItem: selectedOutlineClass,
        topic: aiToolsPage.outlineGeneratorPanelProps.outlineForm.topic,
        knowledgePoints: selectedOutlineKnowledgePoints,
        classroomContext: {
          source: "teacher-tools",
          classId: selectedOutlineClass.id,
          className: selectedOutlineClass.name,
          subject: selectedOutlineClass.subject,
          grade: selectedOutlineClass.grade,
          audienceMode: "whole-class",
          exportFormats: ["pptx", "resource-pack"],
          teacher: teacherProfile
            ? {
                ...teacherProfile,
                subject: selectedOutlineClass.subject,
                title: "授课教师",
                digitalHuman,
              }
            : null,
          students,
        },
      });
      saveAiClassroomLaunchPayload(payload);
      router.push("/ai-classroom");
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "互动课堂启动失败，请稍后重试。");
    } finally {
      setLaunchingInteractiveClassroom(false);
    }
  };

  if (aiToolsPage.authRequired) {
    return (
      <Card title="AI 教学工具">
        <StatePanel
          compact
          tone="info"
          title="请先登录后使用 AI 教学工具"
          description="登录教师账号后即可组卷、生成讲稿、生成讲评包并下发复练。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (aiToolsPage.pageLoading) {
    return (
      <Card title="AI 教学工具">
        <StatePanel
          compact
          tone="loading"
          title="AI 教学工具加载中"
          description="正在同步班级和知识点目录。"
        />
      </Card>
    );
  }

  if (aiToolsPage.pageError) {
    return (
      <Card title="AI 教学工具">
        <StatePanel
          compact
          tone="error"
          title="AI 教学工具加载失败"
          description={aiToolsPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={aiToolsPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/teacher">
                返回教师端
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 教学工具</h2>
          <div className="section-sub">一站式组卷、讲稿、数字人与知序课堂联动。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">教学助手</span>
          {aiToolsPage.lastLoadedAtLabel ? <span className="chip">更新于 {aiToolsPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={aiToolsPage.reload}
            disabled={aiToolsPage.loading || aiToolsPage.refreshing}
          >
            {aiToolsPage.refreshing ? "刷新中..." : aiToolsPage.loading ? "处理中..." : "刷新"}
          </button>
        </div>
      </div>

      {aiToolsPage.bootstrapNotice ? (
        <StatePanel compact tone="error" title="班级数据同步失败" description={aiToolsPage.bootstrapNotice} />
      ) : null}
      {aiToolsPage.knowledgePointsNotice ? (
        <StatePanel compact tone="error" title="知识点目录同步失败" description={aiToolsPage.knowledgePointsNotice} />
      ) : null}

      <Card title="当前教学工作流" tag="摘要">
        <div className="grid" style={{ gap: 14 }}>
          <div className="workflow-summary-grid">
            {workflowSummaryItems.map((item) => (
              <div key={item.label} className="workflow-summary-card">
                <div className="workflow-summary-label">{item.label}</div>
                <div className="workflow-summary-value" style={{ fontSize: item.value.length > 16 ? 20 : undefined }}>
                  {item.value}
                </div>
                <div className="workflow-summary-helper">{item.helper}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ alignItems: "start", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div className="section-title">当前焦点</div>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>{workflowFocusText}</div>
              <div className="workflow-card-meta" style={{ marginTop: 12 }}>
                <span className="pill">知序课堂已融合教师工具流</span>
                <span className="pill">支持全班观看与导出</span>
                <span className="pill">支持学生自主巩固与兴趣学习延展</span>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="section-title">推荐推进顺序</div>
              <div className="grid" style={{ marginTop: 10, gap: 8 }}>
                {workflowReadySteps.map((step) => (
                  <div key={step} className="workflow-step-line">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="知序课堂" tag="学习闭环">
        <div className="grid" style={{ gap: 10 }} data-testid="teacher-ai-tools-classroom-panel">
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            可以把当前教师工具页里的班级、主题、知识点和教师数字人一起送入课堂学习系统，继续完成讲义驱动、多角色、场景化的课堂生成。生成后的课堂同时支持全班观看发布，以及 PPTX / 资源包导出。
          </div>
          <div className="badge-row">
            <span className="badge">真实教师 / 学生角色</span>
            <span className="badge">全班观看发布</span>
            <span className="badge">PPTX / 资源包导出</span>
            {selectedOutlineClass ? (
              <span className="badge">
                当前班级：{selectedOutlineClass.name}
              </span>
            ) : null}
            {aiToolsPage.outlineGeneratorPanelProps.outlineForm.topic.trim() ? (
              <span className="badge">
                当前主题：{aiToolsPage.outlineGeneratorPanelProps.outlineForm.topic.trim()}
              </span>
            ) : null}
            {selectedOutlineKnowledgePoints.length ? (
              <span className="badge">
                知识点：{selectedOutlineKnowledgePoints.length} 个
              </span>
            ) : null}
            {digitalHumanSummary?.displayName ? (
              <span className="badge">
                数字人：{digitalHumanSummary.displayName}
                {digitalHumanSummary.portraitReady ? " · 画像已就绪" : ""}
                {digitalHumanSummary.voiceReady ? " · 音色已就绪" : ""}
              </span>
            ) : (
              <span className="badge">数字人：将自动使用教师默认身份</span>
            )}
          </div>
          <div
            className="card"
            style={{
              padding: 12,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            进入课堂后，会自动兼容真实教务中的授课教师、班级学生与教学主题；如果已配置教师数字人，还会同步带入老师的动漫画像、音色和课堂人设。课堂完成后可直接发布全班观看链接，也能导出给班级回看、教研存档或继续加工成学生自主巩固版本。
          </div>
          <div className="cta-row">
            <button
              className="button primary"
              type="button"
              onClick={() => void handleLaunchInteractiveClassroom()}
              disabled={!selectedOutlineClass || launchingInteractiveClassroom}
              data-testid="teacher-launch-ai-classroom"
            >
              {launchingInteractiveClassroom ? "启动中..." : "带当前班级进入知序课堂"}
            </button>
            <Link className="button ghost" href="/library">
              先从教材资料启动
            </Link>
            <Link className="button ghost" href="/ai-classroom">
              空白启动
            </Link>
          </div>
          {launchError ? <div className="status-note error">{launchError}</div> : null}
        </div>
      </Card>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <TeacherDigitalHumanCard />
        <TeacherOutlineGeneratorPanel {...outlinePanel} />
      </div>

      <TeacherPaperGeneratorPanel {...paperPanel} />

      <details className="workflow-collapsible">
        <summary>
          <span>展开讲评、复练、题目检查与课堂分享记录</span>
          <span className="chip">
            更多工具 {[
              aiToolsPage.reviewPackPanelProps.reviewPackResult ? "讲评包已生成" : null,
              aiToolsPage.wrongReviewPanelProps.wrongResult ? "已生成错题复练" : null,
              aiToolsPage.questionCheckPanelProps.checkResult ? "已完成题目检查" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "按需展开"}
          </span>
        </summary>
        <div className="workflow-collapsible-body">
          <TeacherInteractiveClassroomDeliveryLedgerCard />
          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <TeacherReviewPackPanel {...aiToolsPage.reviewPackPanelProps} />
            <TeacherWrongReviewPanel {...aiToolsPage.wrongReviewPanelProps} />
          </div>
          <TeacherQuestionCheckPanel {...aiToolsPage.questionCheckPanelProps} />
          <TeacherAiGuideCard {...aiToolsPage.guideCardProps} />
        </div>
      </details>
    </div>
  );
}
