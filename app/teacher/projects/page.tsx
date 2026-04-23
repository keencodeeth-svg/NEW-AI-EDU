"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

type ProjectTask = {
  id: string;
  subject: string;
  title: string;
  description: string;
  submissionCount: number;
};

type Project = {
  id: string;
  title: string;
  description: string;
  subjects: string[];
  featured: boolean;
  tasks: ProjectTask[];
};

export default function TeacherProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [topic, setTopic] = useState("");
  const [subjects, setSubjects] = useState("科学, 语文, 美术");
  const [loading, setLoading] = useState(false);

  async function loadProjects() {
    const payload = await requestJson<{ data?: Project[] }>("/api/projects", {
      cache: "no-store"
    });
    setProjects(payload.data ?? []);
  }

  useEffect(() => {
    void loadProjects().catch(() => {
      // Keep empty state on load failure.
    });
  }, []);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>项目式学习</h2>
          <div className="section-sub">用 AI 先生成跨学科项目骨架，再让学生分阶段提交，老师按过程进行展示与点评。</div>
        </div>
        <span className="chip">PBL</span>
      </div>

      <Card title="创建项目" tag="Create">
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="例如：设计一座节能校园"
            style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
          />
          <input
            value={subjects}
            onChange={(event) => setSubjects(event.target.value)}
            placeholder="学科用逗号分隔"
            style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
          />
          <div className="cta-row">
            <button
              className="button primary"
              type="button"
              disabled={!topic.trim() || loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await requestJson("/api/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      topic,
                      subjects: subjects
                        .split(/[，,]/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                      generateWithAi: true
                    })
                  });
                  setTopic("");
                  await loadProjects();
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "生成中..." : "AI 生成项目骨架"}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gap: 12 }}>
        {projects.map((project) => (
          <Card key={project.id} title={project.title} tag={project.featured ? "展示中" : "项目"}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "var(--ink-1)" }}>{project.description}</div>
              <div className="pill-list">
                {project.subjects.map((item) => (
                  <span className="pill" key={item}>
                    {item}
                  </span>
                ))}
              </div>
              {project.tasks.map((task) => (
                <div key={task.id} className="card" style={{ display: "grid", gap: 6 }}>
                  <div className="badge">
                    {task.subject} · {task.title}
                  </div>
                  <div style={{ color: "var(--ink-1)" }}>{task.description}</div>
                  <div className="pill-list">
                    <span className="pill">提交数 {task.submissionCount}</span>
                  </div>
                </div>
              ))}
              <div className="cta-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={async () => {
                    await requestJson("/api/projects", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId: project.id, featured: !project.featured })
                    });
                    await loadProjects();
                  }}
                >
                  {project.featured ? "取消展示" : "设为展示项目"}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
