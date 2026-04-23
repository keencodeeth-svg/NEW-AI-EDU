"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

type Submission = {
  content: string;
  aiFeedback?: string | null;
  score?: number | null;
};

type ProjectTask = {
  id: string;
  subject: string;
  title: string;
  description: string;
  latestSubmission?: Submission | null;
};

type Project = {
  id: string;
  title: string;
  description: string;
  subjects: string[];
  featured: boolean;
  tasks: ProjectTask[];
};

export default function StudentProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  async function loadProjects() {
    const payload = await requestJson<{ data?: Project[] }>("/api/projects", {
      cache: "no-store"
    });
    setProjects(payload.data ?? []);
  }

  useEffect(() => {
    void loadProjects().catch(() => {
      // Keep empty state if project list fails.
    });
  }, []);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>项目式学习空间</h2>
          <div className="section-sub">把综合任务拆成阶段提交，每一步都会收到 AI 的过程性反馈，而不是只等最后打分。</div>
        </div>
        <span className="chip">自主探究</span>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        {projects.map((project) => (
          <Card key={project.id} title={project.title} tag={project.featured ? "展示项目" : "进行中"}>
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
                <div key={task.id} className="card" style={{ display: "grid", gap: 10 }}>
                  <div className="badge">
                    {task.subject} · {task.title}
                  </div>
                  <div style={{ color: "var(--ink-1)" }}>{task.description}</div>
                  <textarea
                    rows={4}
                    value={drafts[task.id] ?? task.latestSubmission?.content ?? ""}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [task.id]: event.target.value
                      }))
                    }
                    placeholder="写下你这一阶段的思路、方案、调研结果或作品说明"
                    style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
                  />
                  <div className="cta-row">
                    <button
                      className="button primary"
                      type="button"
                      disabled={!String(drafts[task.id] ?? task.latestSubmission?.content ?? "").trim() || savingTaskId === task.id}
                      onClick={async () => {
                        setSavingTaskId(task.id);
                        try {
                          await requestJson(`/api/projects/${project.id}/submit`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              taskId: task.id,
                              content: String(drafts[task.id] ?? task.latestSubmission?.content ?? "")
                            })
                          });
                          await loadProjects();
                        } finally {
                          setSavingTaskId(null);
                        }
                      }}
                    >
                      {savingTaskId === task.id ? "提交中..." : "提交这一阶段成果"}
                    </button>
                  </div>
                  {task.latestSubmission?.aiFeedback ? (
                    <div className="status-note info">{task.latestSubmission.aiFeedback}</div>
                  ) : null}
                  {typeof task.latestSubmission?.score === "number" ? (
                    <div className="pill-list">
                      <span className="pill">过程得分 {task.latestSubmission.score}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
