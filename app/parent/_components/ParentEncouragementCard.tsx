"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { requestJson } from "@/lib/client-request";

const TEMPLATES = ["今天你最棒！", "加油，你可以的！", "妈妈/爸爸为你骄傲", "坚持就是胜利"];

export default function ParentEncouragementCard() {
  const [message, setMessage] = useState(TEMPLATES[0]);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <Card title="发送鼓励卡片" tag="即时鼓励">
      <div style={{ display: "grid", gap: 12 }}>
        <div className="pill-list">
          {TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              className={message === template ? "button secondary" : "button ghost"}
              onClick={() => setMessage(template)}
            >
              {template}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          maxLength={50}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="写一句今晚想对孩子说的话"
          style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid var(--stroke)" }}
        />
        <div className="cta-row">
          <button
            className="button primary"
            type="button"
            disabled={!message.trim() || sending}
            onClick={async () => {
              setSending(true);
              try {
                await requestJson("/api/parent/encouragement", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message })
                });
                setSuccessMessage("鼓励卡片已经送到学生端首页。");
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? "发送中..." : "发送鼓励"}
          </button>
        </div>
        {successMessage ? <div className="status-note success">{successMessage}</div> : null}
      </div>
    </Card>
  );
}
