"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";

type Encouragement = {
  id: string;
  message: string;
  createdAt: string;
};

export default function StudentEncouragementBanner() {
  const [item, setItem] = useState<Encouragement | null>(null);

  useEffect(() => {
    let mounted = true;
    void requestJson<{ data?: Encouragement | null }>("/api/parent/encouragement?unread=true")
      .then((payload) => {
        if (mounted) {
          setItem(payload.data ?? null);
        }
      })
      .catch(() => {
        // Ignore banner fetch failures on dashboard load.
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!item) {
    return null;
  }

  return (
    <div
      className="status-note success"
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center"
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>来自家长的鼓励</div>
        <div>{item.message}</div>
      </div>
      <button
        className="button ghost"
        type="button"
        onClick={async () => {
          try {
            await requestJson("/api/parent/encouragement", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: item.id })
            });
          } finally {
            setItem(null);
          }
        }}
      >
        已看到
      </button>
    </div>
  );
}
