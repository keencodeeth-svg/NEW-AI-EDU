"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";

type ProviderVaultPayload = {
  categories: Array<{
    key: string;
    label: string;
    configuredCount: number;
    items: Array<{
      id: string;
      configured: boolean;
      apiKeyPreview?: string;
      baseUrl?: string;
      models?: string[];
      proxy?: string;
      updatedAt?: string;
      updatedBy?: string;
    }>;
  }>;
};

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
} as const;

const CATEGORY_IMPACT_MAP: Record<string, string[]> = {
  providers: ["课堂内容生成", "讲稿与教案生成", "学生自学方案"],
  tts: ["教师数字人音色", "课堂配音与旁白", "课后回看语音"],
  asr: ["语音识别输入", "课堂语音转写", "教师口述录入"],
  pdf: ["教材/讲义解析", "资料导入互动课堂", "PDF 课件理解"],
  image: ["教师数字人画像", "课堂插图与封面", "兴趣培养素材"],
  video: ["课堂动态媒体", "实验/情境演示视频", "资源包视频内容"],
  webSearch: ["联网检索", "热点资料补充", "扩展阅读与兴趣主题拓展"],
};

const CATEGORY_NOTE_MAP: Record<string, string> = {
  providers: "统一决定大模型对话与课堂生成质量，是互动课堂的核心算力入口。",
  tts: "直接影响教师数字人、课堂讲述和导出资源中的语音体验。",
  asr: "影响语音输入、口述录题和语音交互的识别能力。",
  pdf: "用于教材、讲义和参考资料的文档解析与结构提取。",
  image: "用于老师动漫画像、课堂插图和主题化视觉素材生成。",
  video: "用于生成动态演示视频、实验片段和场景化内容。",
  webSearch: "用于联网搜索资料、补充案例和扩展学生兴趣主题。",
};

export default function ProviderVaultPanel() {
  const [payload, setPayload] = useState<ProviderVaultPayload | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("providers");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [models, setModels] = useState("");
  const [proxy, setProxy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai/provider-vault", { cache: "no-store" });
      const nextPayload = (await response.json().catch(() => null)) as
        | { data?: ProviderVaultPayload; error?: string }
        | null;
      if (!response.ok || !nextPayload?.data) {
        throw new Error(nextPayload?.error || "统一 Provider 托管配置加载失败");
      }
      setPayload(nextPayload.data);
      const nextCategory = nextPayload.data.categories[0]?.key || "providers";
      const activeCategory = nextPayload.data.categories.find((item) => item.key === selectedCategory)
        ? selectedCategory
        : nextCategory;
      setSelectedCategory(activeCategory);
      const categoryItems =
        nextPayload.data.categories.find((item) => item.key === activeCategory)?.items ?? [];
      const nextProviderId =
        categoryItems.find((item) => item.id === selectedProviderId)?.id ||
        categoryItems[0]?.id ||
        "";
      setSelectedProviderId(nextProviderId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "统一 Provider 托管配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const category = useMemo(
    () => payload?.categories.find((item) => item.key === selectedCategory) ?? null,
    [payload, selectedCategory],
  );

  const selectedItem = useMemo(
    () => category?.items.find((item) => item.id === selectedProviderId) ?? null,
    [category, selectedProviderId],
  );

  const categoryImpacts = useMemo(
    () => CATEGORY_IMPACT_MAP[selectedCategory] ?? [],
    [selectedCategory],
  );

  const categoryNote = useMemo(
    () => CATEGORY_NOTE_MAP[selectedCategory] ?? "该配置会被对应的教学能力统一复用。",
    [selectedCategory],
  );

  useEffect(() => {
    setApiKey("");
    setBaseUrl(selectedItem?.baseUrl || "");
    setModels(selectedItem?.models?.join(", ") || "");
    setProxy(selectedItem?.proxy || "");
  }, [selectedItem]);

  async function handleSave() {
    if (!selectedCategory || !selectedProviderId) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai/provider-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          providerId: selectedProviderId,
          apiKey,
          baseUrl,
          models: models
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          proxy,
        }),
      });

      const nextPayload = (await response.json().catch(() => null)) as
        | { data?: ProviderVaultPayload; error?: string }
        | null;
      if (!response.ok || !nextPayload?.data) {
        throw new Error(nextPayload?.error || "统一 Provider 托管配置保存失败");
      }

      setPayload(nextPayload.data);
      setMessage("后台统一 Provider 托管配置已更新，课堂、数字人和多媒体能力会立即复用。");
      setApiKey("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "统一 Provider 托管配置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!selectedCategory || !selectedProviderId) return;
    setClearing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai/provider-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          providerId: selectedProviderId,
          clearExisting: true,
        }),
      });

      const nextPayload = (await response.json().catch(() => null)) as
        | { data?: ProviderVaultPayload; error?: string }
        | null;
      if (!response.ok || !nextPayload?.data) {
        throw new Error(nextPayload?.error || "统一 Provider 托管配置清空失败");
      }

      setPayload(nextPayload.data);
      setMessage("当前 Provider 的后台托管配置已清空，对应能力会回退到未配置状态。");
      setApiKey("");
      setBaseUrl("");
      setModels("");
      setProxy("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "统一 Provider 托管配置清空失败");
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <Card title="统一 API Key 托管" tag="后台托管">
        <div>后台统一 Provider 托管配置加载中...</div>
      </Card>
    );
  }

  return (
    <Card title="统一 API Key 托管" tag="后台托管">
      <div className="grid" style={{ gap: 14 }}>
        <div style={{ fontSize: 14, lineHeight: 1.7 }}>
          这里统一维护语言模型、语音、图像、视频和联网检索的服务密钥。教师端不再单独维护 API
          Key，课堂生成、数字人画像和音色试听都会优先走这里的后台托管配置。
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">当前能力范围</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>{categoryNote}</div>
            <div className="badge-row" style={{ marginTop: 10 }}>
              {categoryImpacts.map((item) => (
                <span key={item} className="badge">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">统一托管原则</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
              后台保存后，教师数字人、互动课堂生成、资料解析和导出能力会复用同一份配置。这样可以避免教师端重复填 key，也便于学校统一切换供应商。
            </div>
          </div>
        </div>

        <div className="badge-row">
          {(payload?.categories ?? []).map((item) => (
            <button
              key={item.key}
              className="button ghost"
              type="button"
              onClick={() => {
                setSelectedCategory(item.key);
                setSelectedProviderId(item.items[0]?.id || "");
              }}
              style={{
                borderColor: selectedCategory === item.key ? "var(--brand-strong)" : undefined,
              }}
            >
              {item.label} · {item.configuredCount}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <label>
            <div className="section-title">能力类型</div>
            <select
              value={selectedCategory}
              onChange={(event) => {
                const nextCategory = event.target.value;
                setSelectedCategory(nextCategory);
                const nextItems =
                  payload?.categories.find((item) => item.key === nextCategory)?.items ?? [];
                setSelectedProviderId(nextItems[0]?.id || "");
              }}
              style={fieldStyle}
            >
              {(payload?.categories ?? []).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">Provider</div>
            <select
              value={selectedProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
              style={fieldStyle}
            >
              {(category?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                  {item.configured ? " · 已托管" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <div className="section-title">API Key</div>
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={selectedItem?.apiKeyPreview || "如需覆盖或新增，请输入新的 API Key"}
            style={fieldStyle}
          />
        </label>
        <label>
          <div className="section-title">Base URL</div>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.example.com/v1"
            style={fieldStyle}
          />
        </label>
        <label>
          <div className="section-title">模型白名单（逗号分隔，可选）</div>
          <input
            value={models}
            onChange={(event) => setModels(event.target.value)}
            placeholder="gpt-4.1-mini, gpt-4.1"
            style={fieldStyle}
          />
        </label>
        <label>
          <div className="section-title">代理地址（可选）</div>
          <input
            value={proxy}
            onChange={(event) => setProxy(event.target.value)}
            placeholder="https://proxy.example.com"
            style={fieldStyle}
          />
        </label>

        {selectedItem ? (
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">当前托管状态</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)", lineHeight: 1.7 }}>
              <div>Provider：{selectedItem.id}</div>
              <div>是否托管：{selectedItem.configured ? "已托管" : "未托管"}</div>
              <div>Key 预览：{selectedItem.apiKeyPreview || "暂无"}</div>
              <div>Base URL：{selectedItem.baseUrl || "默认"}</div>
              <div>模型：{selectedItem.models?.join(", ") || "未限制"}</div>
              <div>最近更新：{selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString("zh-CN") : "暂无"}</div>
              <div>更新人：{selectedItem.updatedBy || "系统默认"}</div>
            </div>
          </div>
        ) : null}

        <div className="cta-row">
          <button className="button primary" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "保存中..." : "保存后台托管配置"}
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => void handleClear()}
            disabled={clearing || !selectedItem?.configured}
          >
            {clearing ? "清空中..." : "清空当前托管配置"}
          </button>
          <button className="button secondary" type="button" onClick={() => void load()} disabled={loading}>
            重新加载
          </button>
        </div>

        {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
        {error ? <div className="status-note error">{error}</div> : null}
      </div>
    </Card>
  );
}
