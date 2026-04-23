"use client";

import WorkspacePage, {
  WorkspaceAuthState,
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from "@/components/WorkspacePage";
import WorkspaceHero from "@/components/WorkspaceHero";
import KnowledgeMapGraph from "./_components/KnowledgeMapGraph";
import KnowledgeMapNodeDetail from "./_components/KnowledgeMapNodeDetail";
import { useKnowledgeMapPage } from "./useKnowledgeMapPage";

export default function KnowledgeMapPage() {
  const page = useKnowledgeMapPage();

  if (page.authRequired) {
    return (
      <WorkspaceAuthState
        title="请先登录"
        description="登录学生账号后才能查看知识图谱。"
      />
    );
  }

  if (page.loading && !page.data) {
    return (
      <WorkspaceLoadingState
        title="正在加载知识图谱"
        description="正在汇总知识点与掌握度，请稍等。"
      />
    );
  }

  if (page.error && !page.data) {
    return (
      <WorkspaceErrorState
        title="知识图谱加载失败"
        description={page.error}
        onRetry={page.reload}
      />
    );
  }

  const data = page.data;
  if (!data) return null;

  const nodeCount = data.nodes.length;
  const strongCount = data.nodes.filter((n) => n.masteryLevel === "strong").length;
  const weakCount = data.nodes.filter(
    (n) => n.masteryLevel === "weak" || n.masteryLevel === "locked"
  ).length;

  return (
    <WorkspacePage
      title="知识图谱"
      subtitle="查看知识点之间的关系与掌握度全景"
      lead={
        <WorkspaceHero
          eyebrow="学习地图"
          title="知识图谱"
          description="可视化展示你的知识掌握全景，找到薄弱点和学习路径。"
          stats={[
            {
              label: "知识点总数",
              value: String(nodeCount),
              description: "当前筛选范围内的知识点",
              tone: "sky",
            },
            {
              label: "已掌握",
              value: String(strongCount),
              description: "掌握度 > 85% 的知识点",
              tone: "emerald",
            },
            {
              label: "待加强",
              value: String(weakCount),
              description: "薄弱或未解锁的知识点",
              tone: "amber",
            },
          ]}
          sideLabel="使用指南"
          sideTitle="如何使用知识图谱"
          sideDescription="点击节点查看详情，绿色表示已掌握，黄色发展中，红色薄弱。"
          notes={[
            {
              title: "筛选学科和年级",
              description: "使用上方筛选器缩小范围。",
              tone: "sky",
            },
            {
              title: "点击节点查看详情",
              description: "查看掌握度、趋势和前置知识点。",
              tone: "emerald",
            },
            {
              title: "开始练习",
              description: "从详情面板直接跳转到练习。",
              tone: "amber",
            },
          ]}
        />
      }
      chips={[
        <select
          key="subject"
          className="chip"
          value={page.subjectFilter}
          onChange={(e) => {
            page.setSubjectFilter(e.target.value);
            page.setSelectedNodeId(null);
          }}
          style={{ cursor: "pointer" }}
        >
          <option value="">全部学科</option>
          {data.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>,
        <select
          key="grade"
          className="chip"
          value={page.gradeFilter}
          onChange={(e) => {
            page.setGradeFilter(e.target.value);
            page.setSelectedNodeId(null);
          }}
          style={{ cursor: "pointer" }}
        >
          <option value="">全部年级</option>
          {data.grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>,
      ]}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          height: "calc(100vh - 420px)",
          minHeight: 400,
        }}
      >
        <div
          style={{
            flex: page.selectedNode ? "0 0 70%" : "1 1 100%",
            borderRadius: 12,
            border: "1px solid var(--stroke, #e2e8f0)",
            overflow: "hidden",
            background: "var(--bg-0, #fff)",
          }}
        >
          <KnowledgeMapGraph data={data} onNodeSelect={page.setSelectedNodeId} />
        </div>

        {page.selectedNode ? (
          <div style={{ flex: "0 0 30%", minWidth: 280, overflowY: "auto" }}>
            <KnowledgeMapNodeDetail
              node={page.selectedNode}
              prerequisites={page.selectedNodePrerequisites}
              onClose={() => page.setSelectedNodeId(null)}
            />
          </div>
        ) : null}
      </div>
    </WorkspacePage>
  );
}
