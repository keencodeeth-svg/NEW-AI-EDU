"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useFilesPage } from "./useFilesPage";

export default function FilesPage() {
  const {
    loading,
    classes,
    authRequired,
    pageError,
    loadBootstrap,
    lastLoadedAtLabel,
    classId,
    loadFiles,
    filesLoading,
    submitting,
    updateClassId,
    role,
    handleUpload,
    resourceType,
    updateResourceType,
    folder,
    updateFolder,
    title,
    updateTitle,
    linkUrl,
    updateLinkUrl,
    fileInputRef,
    error,
    message,
    files,
    groupedFiles
  } = useFilesPage();

  if (loading && !classes.length && !authRequired) {
    return <StatePanel title="课程文件中心加载中" description="正在同步账号身份、班级列表和课程资料。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录后查看课程文件"
        description="登录后即可查看你有权限访问的课程资料；教师登录后还可上传文件与添加链接。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !classes.length) {
    return (
      <StatePanel
        title="课程文件中心加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void loadBootstrap()}>
            重试
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程文件中心</h2>
          <div className="section-sub">统一管理课程资料、课件与链接。</div>
        </div>
        <span className="chip">{lastLoadedAtLabel ? `更新于 ${lastLoadedAtLabel}` : "文件"}</span>
      </div>

      {pageError ? (
        <StatePanel
          title="本次资料刷新存在异常"
          description={pageError}
          tone="error"
          compact
          action={
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                if (classId) {
                  void loadFiles(classId).catch(() => undefined);
                  return;
                }
                void loadBootstrap();
              }}
              disabled={loading || filesLoading || submitting}
            >
              {classId ? "重试资料加载" : "重试页面加载"}
            </button>
          }
        />
      ) : null}

      <Card title="班级选择" tag="课程">
        {classes.length ? (
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={classId}
              onChange={(event) => updateClassId(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>暂无班级。</p>
        )}
      </Card>

      {role === "teacher" ? (
        <Card title="上传资料 / 添加链接" tag="教师">
          <div className="feature-card">
            <EduIcon name="book" />
            <p>支持上传 PDF/图片，或添加外部链接。</p>
          </div>
          {classes.length === 0 ? (
            <p>暂无可上传资料的班级，请先创建或加入班级。</p>
          ) : (
            <form onSubmit={handleUpload} style={{ display: "grid", gap: 12 }}>
              <label>
                <div className="section-title">资料类型</div>
                <select
                  value={resourceType}
                  onChange={(event) => updateResourceType(event.target.value as "file" | "link")}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="file">上传文件</option>
                  <option value="link">添加链接</option>
                </select>
              </label>
              <label>
                <div className="section-title">文件夹（可选）</div>
                <input
                  value={folder}
                  onChange={(event) => updateFolder(event.target.value)}
                  placeholder="如：第一单元/课件"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <label>
                <div className="section-title">标题</div>
                <input
                  value={title}
                  onChange={(event) => updateTitle(event.target.value)}
                  placeholder="如：分数单元讲义"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              {resourceType === "link" ? (
                <label>
                  <div className="section-title">链接地址</div>
                  <input
                    value={linkUrl}
                    onChange={(event) => updateLinkUrl(event.target.value)}
                    placeholder="https://..."
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  />
                </label>
              ) : (
                <label>
                  <div className="section-title">选择文件</div>
                  <input ref={fileInputRef} id="fileInput" type="file" multiple />
                </label>
              )}
              {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
              {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
              <button className="button primary" type="submit" disabled={submitting || !classId}>
                {submitting ? "提交中..." : resourceType === "link" ? "保存链接" : "上传文件"}
              </button>
            </form>
          )}
        </Card>
      ) : null}

      <Card title="资料列表" tag="资源">
        {filesLoading && !files.length ? (
          <StatePanel title="资料加载中" description="正在同步当前班级的文件与链接资源。" tone="loading" />
        ) : files.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {Object.entries(groupedFiles).map(([folderName, items]) => (
              <div key={folderName} className="card">
                <div className="section-title">{folderName}</div>
                <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                  {items.map((item) => (
                    <div key={item.id} className="card">
                      <div className="section-title">{item.title}</div>
                      <div className="section-sub">
                        {new Date(item.createdAt).toLocaleDateString("zh-CN")} ·{" "}
                        {item.resourceType === "link" ? "链接" : item.mimeType ?? "文件"}
                      </div>
                      {item.resourceType === "link" && item.linkUrl ? (
                        <a href={item.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          打开链接
                        </a>
                      ) : item.contentBase64 && item.mimeType ? (
                        <a
                          href={`data:${item.mimeType};base64,${item.contentBase64}`}
                          download={item.fileName ?? item.title}
                          style={{ fontSize: 13 }}
                        >
                          下载文件
                        </a>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>无可用资源</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : pageError && classId ? (
          <StatePanel
            title="资料列表暂时不可用"
            description={pageError}
            tone="error"
            action={
              <button
                className="button secondary"
                type="button"
                onClick={() => void loadFiles(classId).catch(() => undefined)}
                disabled={filesLoading || submitting}
              >
                重新加载
              </button>
            }
          />
        ) : classId ? (
          <p>暂无资料。</p>
        ) : (
          <p>暂无可查看的班级资料。</p>
        )}
      </Card>
    </div>
  );
}
