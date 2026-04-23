"use client";

import { useEffect } from "react";

function syncAllDetailsState() {
  if (typeof document === "undefined") {
    return;
  }
  document.querySelectorAll("details").forEach((details) => {
    const summary = details.querySelector(":scope > summary");
    if (!summary) {
      return;
    }
    summary.setAttribute("aria-expanded", details.open ? "true" : "false");
  });
}

export default function DetailsAriaSync() {
  useEffect(() => {
    syncAllDetailsState();
    if (typeof document === "undefined") {
      return;
    }

    const handleToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) {
        return;
      }
      const summary = details.querySelector(":scope > summary");
      if (summary) {
        summary.setAttribute("aria-expanded", details.open ? "true" : "false");
      }
    };

    document.addEventListener("toggle", handleToggle, true);
    const observer = new MutationObserver(() => {
      syncAllDetailsState();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("toggle", handleToggle, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
