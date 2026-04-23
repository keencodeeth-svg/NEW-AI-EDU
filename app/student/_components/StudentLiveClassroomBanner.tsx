"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";

type LiveSession = {
  id: string;
  title: string;
  currentPrompt: string;
  updatedAt: string;
};

export default function StudentLiveClassroomBanner() {
  const [session, setSession] = useState<LiveSession | null>(null);

  useEffect(() => {
    let mounted = true;
    void requestJson<{ data?: LiveSession[] }>("/api/student/classroom-live")
      .then((payload) => {
        if (mounted) {
          setSession(payload.data?.[0] ?? null);
        }
      })
      .catch(() => {
        // Ignore lightweight banner failures.
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!session) {
    return null;
  }

  return (
    <div className="status-note info" style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{session.title}</div>
      <div>{session.currentPrompt}</div>
      <div>
        <Link className="button secondary" href="/student/interactive-classroom">
          进入互动课堂
        </Link>
      </div>
    </div>
  );
}
