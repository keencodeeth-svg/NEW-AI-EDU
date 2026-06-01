"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import { DEFAULT_TTS_VOICES, getTTSVoices } from "@/lib/audio/constants";
import type { TTSProviderId } from "@/lib/audio/types";
import type { ImageProviderId } from "@/lib/media/types";
import type { TeacherDigitalHumanProfile } from "@/lib/classroom-integration";

type ServerProvidersPayload = {
  success?: boolean;
  tts?: Record<string, { baseUrl?: string }>;
  image?: Record<string, { baseUrl?: string }>;
};

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
} as const;

const defaultSampleScript =
  "同学们好，今天这节课我们会先抓住核心概念，再通过一到两个例题把方法走通。";

export default function TeacherDigitalHumanCard() {
  const [profile, setProfile] = useState<TeacherDigitalHumanProfile | null>(null);
  const [configuredTtsProviders, setConfiguredTtsProviders] = useState<TTSProviderId[]>([]);
  const [configuredImageProviders, setConfiguredImageProviders] = useState<ImageProviderId[]>([]);
  const [blockedByAuth, setBlockedByAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setBlockedByAuth(false);
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const mePayload = (await meResponse.json().catch(() => null)) as
          | { user?: { role?: string | null } | null }
          | null;
        const currentRole = mePayload?.user?.role ?? null;

        if (!meResponse.ok || !mePayload?.user || (currentRole !== "teacher" && currentRole !== "admin")) {
          if (!cancelled) {
            setBlockedByAuth(true);
            setProfile(null);
            setConfiguredTtsProviders([]);
            setConfiguredImageProviders([]);
          }
          return;
        }

        const [profileResponse, providersResponse] = await Promise.all([
          fetch("/api/teacher/digital-human", { cache: "no-store" }),
          fetch("/api/server-providers", { cache: "no-store" }),
        ]);

        const profilePayload = (await profileResponse.json().catch(() => null)) as
          | { data?: TeacherDigitalHumanProfile; success?: boolean; error?: string }
          | null;
        const providersPayload = (await providersResponse.json().catch(() => null)) as
          | ServerProvidersPayload
          | null;

        if (cancelled) return;

        if (!profileResponse.ok || !profilePayload?.data) {
          throw new Error(profilePayload?.error || "教师数字人配置加载失败");
        }

        const nextTtsProviders = Object.keys(providersPayload?.tts ?? {}).filter(
          (item) => item !== "browser-native-tts",
        ) as TTSProviderId[];
        const nextImageProviders = Object.keys(
          providersPayload?.image ?? {},
        ) as ImageProviderId[];

        const nextProfile = {
          ...profilePayload.data,
          sampleScript: profilePayload.data.sampleScript || defaultSampleScript,
          voiceProviderId:
            profilePayload.data.voiceProviderId ||
            nextTtsProviders[0] ||
            profilePayload.data.voiceProviderId,
          imageProviderId:
            profilePayload.data.imageProviderId ||
            nextImageProviders[0] ||
            profilePayload.data.imageProviderId,
        };

        if (nextProfile.voiceProviderId && !nextProfile.voiceId) {
          nextProfile.voiceId = DEFAULT_TTS_VOICES[nextProfile.voiceProviderId];
        }

        setProfile(nextProfile);
        setConfiguredTtsProviders(nextTtsProviders);
        setConfiguredImageProviders(nextImageProviders);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "教师数字人配置加载失败");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const availableVoices = useMemo(() => {
    if (!profile?.voiceProviderId) return [];
    return getTTSVoices(profile.voiceProviderId);
  }, [profile?.voiceProviderId]);

  const readinessItems = useMemo(() => {
    if (!profile) return [];

    return [
      {
        label: "动漫画像",
        ready: Boolean(profile.portraitUrl),
        detail: profile.portraitUrl ? "已生成课堂主视觉" : "建议先生成老师动漫立绘",
      },
      {
        label: "教师音色",
        ready: Boolean(configuredTtsProviders.length > 0 && profile.voiceProviderId && profile.voiceId),
        detail:
          configuredTtsProviders.length === 0
            ? "后台暂未托管语音服务，课堂会先回退为浏览器朗读，暂不支持专属音色导出。"
            : profile.voiceLabel || profile.voiceId
              ? `当前音色：${profile.voiceLabel || profile.voiceId}`
              : "建议试听并保存专属音色",
      },
      {
        label: "课堂人设",
        ready: Boolean(profile.introduction?.trim()),
        detail: profile.introduction?.trim()
          ? "已配置讲述风格与教师身份"
          : "建议补充课堂人设，提升生成稳定性",
      },
      {
        label: "课堂可用",
        ready: Boolean(profile.displayName.trim()),
        detail: "教师工具页发起的互动课堂会自动带入当前数字人",
      },
    ];
  }, [configuredTtsProviders.length, profile]);

  const readinessCount = readinessItems.filter((item) => item.ready).length;

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/teacher/digital-human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: TeacherDigitalHumanProfile; error?: string }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "教师数字人保存失败");
      }
      setProfile(payload.data);
      setMessage("教师数字人配置已保存，后续课堂会优先使用该画像与音色。");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "教师数字人保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePortrait() {
    if (!profile) return;
    const providerId = profile.imageProviderId || configuredImageProviders[0];
    if (!providerId) {
      setError("后台还没有配置可用的图像生成服务。");
      return;
    }

    setGeneratingPortrait(true);
    setMessage(null);
    setError(null);

    try {
      const portraitPrompt =
        profile.portraitPrompt?.trim() ||
        `${profile.displayName}，二次元动漫教师立绘，干净背景，温和专业，适合课堂品牌形象。`;

      const response = await fetch("/api/generate/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-image-provider": providerId,
        },
        body: JSON.stringify({
          prompt: portraitPrompt,
          aspectRatio: "1:1",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; result?: { url?: string; base64?: string }; error?: string }
        | null;

      if (!response.ok || !payload?.success || !payload.result) {
        throw new Error(payload?.error || "数字人画像生成失败");
      }

      const portraitUrl = payload.result.url
        ? payload.result.url
        : payload.result.base64
          ? `data:image/png;base64,${payload.result.base64}`
          : "";

      if (!portraitUrl) {
        throw new Error("图像服务没有返回可用的画像地址");
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              portraitPrompt,
              portraitUrl,
              imageProviderId: providerId,
            }
          : prev,
      );
      setMessage("动漫画像已生成，可以继续试听音色并保存。");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "数字人画像生成失败");
    } finally {
      setGeneratingPortrait(false);
    }
  }

  async function handlePreviewVoice() {
    if (!profile) return;
    const providerId = profile.voiceProviderId || configuredTtsProviders[0];
    const voiceId = profile.voiceId || (providerId ? DEFAULT_TTS_VOICES[providerId] : undefined);

    if (!providerId || !voiceId) {
      setError("后台还没有配置可用的语音合成服务。");
      return;
    }

    setPreviewingVoice(true);
    setMessage(null);
    setError(null);

    try {
      const sampleScript = profile.sampleScript?.trim() || defaultSampleScript;
      const response = await fetch("/api/generate/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleScript,
          audioId: `preview-${Date.now()}`,
          ttsProviderId: providerId,
          ttsVoice: voiceId,
          ttsSpeed: 1,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; base64?: string; format?: string; error?: string }
        | null;

      if (!response.ok || !payload?.success || !payload.base64 || !payload.format) {
        throw new Error(payload?.error || "音色试听失败");
      }

      const binary = atob(payload.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const blob = new Blob([bytes], { type: `audio/${payload.format}` });
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioUrlRef.current = URL.createObjectURL(blob);
      const audio = new Audio(audioUrlRef.current);
      await audio.play();

      const voiceLabel =
        availableVoices.find((item) => item.id === voiceId)?.name ||
        profile.voiceLabel ||
        voiceId;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              voiceProviderId: providerId,
              voiceId,
              voiceLabel,
              sampleScript,
            }
          : prev,
      );
      setMessage("已开始播放音色试听，如满意可直接保存为教师数字人。");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "音色试听失败");
    } finally {
      setPreviewingVoice(false);
    }
  }

  if (loading) {
    return (
      <Card title="教师数字人" tag="数字人">
        <div>教师数字人加载中...</div>
      </Card>
    );
  }

  if (blockedByAuth) {
    return null;
  }

  if (!profile) {
    return (
      <Card title="教师数字人" tag="数字人">
        <div>当前无法加载教师数字人配置。</div>
      </Card>
    );
  }

  return (
    <Card title="教师数字人" tag="数字人">
      <div className="grid" style={{ gap: 14 }}>
        <div style={{ fontSize: 14, lineHeight: 1.7 }}>
          教师可以直接生成自己的动漫画像和音色，后续从当前工作台发起的课堂会优先沿用这套数字人形象。
          API Key 由后台统一托管，教师端只需要选择想要的效果。
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">课堂接入状态</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
              当前已完成 {readinessCount} / {readinessItems.length} 项课堂接入准备。配置越完整，互动课堂里老师的形象、语气和讲述风格就越稳定。
            </div>
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              {readinessItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid var(--stroke)",
                    borderRadius: 12,
                    padding: "8px 10px",
                    background: item.ready ? "rgba(16,185,129,0.08)" : "rgba(148,163,184,0.08)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {item.label} · {item.ready ? "已就绪" : "待完善"}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.6 }}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">课堂中会自动使用</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
              保存后，这套数字人会自动进入老师发起的航科互动课堂，用于班级授课、自主巩固课堂和导出资源中的教师身份表达。
            </div>
            <div className="badge-row" style={{ marginTop: 10 }}>
              <span className="badge">全班观看主讲老师</span>
              <span className="badge">学生自学辅导老师</span>
              <span className="badge">课堂导出语音身份</span>
              <span className="badge">教师工作台统一复用</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr)",
            alignItems: "start",
          }}
        >
          <div className="card" style={{ padding: 12 }}>
            <div className="section-title">数字人预览</div>
            <div
              style={{
                marginTop: 10,
                aspectRatio: "1 / 1",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid var(--stroke)",
                background:
                  "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(251,191,36,0.16))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {profile.portraitUrl ? (
                <img
                  src={profile.portraitUrl}
                  alt={profile.displayName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ padding: 16, textAlign: "center", color: "var(--ink-1)" }}>
                  生成后会在这里显示动漫教师画像
                </div>
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>
              当前音色：{profile.voiceLabel || profile.voiceId || "未设置"}
            </div>
          </div>

          <div className="grid" style={{ gap: 12 }}>
            <label>
              <div className="section-title">数字人名称</div>
              <input
                value={profile.displayName}
                onChange={(event) =>
                  setProfile((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                }
                placeholder="例如：李老师"
                style={fieldStyle}
              />
            </label>
            <label>
              <div className="section-title">教师头衔</div>
              <input
                value={profile.title || ""}
                onChange={(event) =>
                  setProfile((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                placeholder="例如：数学教师 / 班主任"
                style={fieldStyle}
              />
            </label>
            <label>
              <div className="section-title">课堂人设说明</div>
              <textarea
                rows={3}
                value={profile.introduction || ""}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, introduction: event.target.value } : prev,
                  )
                }
                placeholder="例如：讲解节奏清楚，喜欢先拆方法再做例题，课堂语言亲切但专业。"
                style={fieldStyle}
              />
            </label>
            <label>
              <div className="section-title">动漫画像提示词</div>
              <textarea
                rows={3}
                value={profile.portraitPrompt || ""}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, portraitPrompt: event.target.value } : prev,
                  )
                }
                placeholder="例如：温和专业的中学数学女教师，二次元动漫立绘，浅色背景，佩戴校徽。"
                style={fieldStyle}
              />
            </label>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <label>
                <div className="section-title">画像服务</div>
                <select
                  value={profile.imageProviderId || ""}
                  onChange={(event) =>
                    setProfile((prev) =>
                      prev
                        ? { ...prev, imageProviderId: event.target.value as ImageProviderId }
                        : prev,
                    )
                  }
                  style={fieldStyle}
                >
                  {configuredImageProviders.length ? null : <option value="">未配置</option>}
                  {configuredImageProviders.map((providerId) => (
                    <option key={providerId} value={providerId}>
                      {providerId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="section-title">音色服务</div>
                <select
                  value={profile.voiceProviderId || ""}
                  onChange={(event) => {
                    const nextProviderId = event.target.value as TTSProviderId;
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            voiceProviderId: nextProviderId,
                            voiceId: DEFAULT_TTS_VOICES[nextProviderId],
                          }
                        : prev,
                    );
                  }}
                  style={fieldStyle}
                >
                  {configuredTtsProviders.length ? null : <option value="">未配置</option>}
                  {configuredTtsProviders.map((providerId) => (
                    <option key={providerId} value={providerId}>
                      {providerId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="section-title">教师音色</div>
                <select
                  value={profile.voiceId || ""}
                  onChange={(event) =>
                    setProfile((prev) => (prev ? { ...prev, voiceId: event.target.value } : prev))
                  }
                  style={fieldStyle}
                >
                  {availableVoices.length ? null : <option value="">暂无可选音色</option>}
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <div className="section-title">音色试听文案</div>
              <textarea
                rows={2}
                value={profile.sampleScript || defaultSampleScript}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, sampleScript: event.target.value } : prev,
                  )
                }
                placeholder={defaultSampleScript}
                style={fieldStyle}
              />
            </label>
          </div>
        </div>

        <div className="cta-row">
          <button
            className="button secondary"
            type="button"
            onClick={() => void handleGeneratePortrait()}
            disabled={generatingPortrait}
          >
            {generatingPortrait ? "生成画像中..." : "生成动漫画像"}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => void handlePreviewVoice()}
            disabled={previewingVoice}
          >
            {previewingVoice ? "试听中..." : "试听教师音色"}
          </button>
          <button
            className="button primary"
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存数字人配置"}
          </button>
        </div>

        {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
        {error ? <div className="status-note error">{error}</div> : null}
      </div>
    </Card>
  );
}
