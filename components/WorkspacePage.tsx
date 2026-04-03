import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";

export type WorkspaceNoticeItem = {
  id: string;
  tone: "loading" | "empty" | "info" | "error" | "success";
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
};

type WorkspacePageProps = {
  title: string;
  subtitle: string;
  lastLoadedAt?: string | null;
  chips?: ReactNode[];
  actions?: ReactNode;
  notices?: WorkspaceNoticeItem[];
  lead?: ReactNode;
  hideHeader?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function humanizeWorkspaceErrorPart(part: string): string {
  const trimmed = part.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  if (/^service temporarily unavailable$/i.test(trimmed)) {
    return "服务暂时不可用，请稍后重试。";
  }

  if (/^failed to fetch$/i.test(trimmed)) {
    return "服务连接失败，请检查网络或稍后重试。";
  }

  return trimmed
    .replace(/:\s*service temporarily unavailable$/i, "：服务暂时不可用，请稍后重试。")
    .replace(/service temporarily unavailable/gi, "服务暂时不可用")
    .replace(/failed to fetch/gi, "连接服务失败");
}

function renderWorkspaceStateDescription(description: string): ReactNode {
  const parts = description
    .split(/[;\n；]+/)
    .map((part) => humanizeWorkspaceErrorPart(part))
    .filter(Boolean);

  const filteredParts =
    parts.length > 1
      ? parts.filter(
          (part) =>
            part !== "服务暂时不可用，请稍后重试。" &&
            part !== "服务连接失败，请检查网络或稍后重试。",
        )
      : parts;

  if (filteredParts.length <= 1) {
    return humanizeWorkspaceErrorPart(description);
  }

  return (
    <div className="state-panel-list" role="list" aria-label="异常详情">
      {filteredParts.map((part) => (
        <div key={part} className="state-panel-list-item" role="listitem">
          <span className="state-panel-list-dot" aria-hidden="true" />
          <span>{part}</span>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceLoadingState({ title, description }: { title: string; description: string }) {
  return (
    <div className="workspace-state-shell">
      <StatePanel tone="loading" title={title} description={description} />
    </div>
  );
}

export function WorkspaceAuthState({
  title,
  description,
  href = "/login",
  actionLabel = "前往登录"
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="workspace-state-shell">
      <StatePanel
        tone="info"
        title={title}
        description={description}
        action={
          <Link className="button secondary" href={href}>
            {actionLabel}
          </Link>
        }
      />
    </div>
  );
}

export function WorkspaceErrorState({
  title,
  description,
  onRetry,
  retryLabel = "重试"
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="workspace-state-shell">
      <StatePanel
        tone="error"
        title={title}
        description={renderWorkspaceStateDescription(description)}
        action={
          onRetry ? (
            <button className="button secondary" type="button" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

export function WorkspaceEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-state-shell">
      <StatePanel tone="empty" title={title} description={description} action={action} />
    </div>
  );
}

export function WorkspaceNoticeStack({ items }: { items?: WorkspaceNoticeItem[] }) {
  const visibleItems = (items ?? []).filter(Boolean);
  if (!visibleItems.length) return null;

  return (
    <div className="grid" style={{ gap: 10 }}>
      {visibleItems.map((item) => (
        <StatePanel
          key={item.id}
          compact={item.compact ?? true}
          tone={item.tone}
          title={item.title}
          description={item.description}
          action={item.action}
        >
          {item.children}
        </StatePanel>
      ))}
    </div>
  );
}

export function buildStaleDataNotice(error: string, action?: ReactNode): WorkspaceNoticeItem {
  return {
    id: "stale-data",
    tone: "error",
    title: "已展示最近一次成功数据",
    description: `最新刷新失败：${error}`,
    action
  };
}

export function buildSuccessNotice(message: string): WorkspaceNoticeItem {
  return {
    id: "success-message",
    tone: "success",
    title: "最近一次操作已完成",
    description: message
  };
}

export default function WorkspacePage({
  title,
  subtitle,
  lastLoadedAt,
  chips,
  actions,
  notices,
  lead,
  hideHeader = false,
  children,
  className = "grid",
  style
}: WorkspacePageProps) {
  return (
    <div className={className} style={{ gap: 18, ...style }}>
      {lead}
      {!hideHeader ? (
        <div className="section-head workspace-page-head">
          <div className="workspace-page-copy">
            <h2>{title}</h2>
            <div className="section-sub">{subtitle}</div>
          </div>
          <div className="cta-row no-margin workspace-page-actions">
            {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
            {(chips ?? []).map((chip, index) => (
              <span key={`${title}-chip-${index}`} style={{ display: "contents" }}>
                {chip}
              </span>
            ))}
            {actions}
          </div>
        </div>
      ) : null}

      <WorkspaceNoticeStack items={notices} />
      {children}
    </div>
  );
}
