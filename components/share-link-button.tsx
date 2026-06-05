"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

type ShareLinkButtonProps = {
  url: string;
  text: string;
};

export function ShareLinkButton({ url, text }: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const nav = typeof window !== "undefined" ? window.navigator : null;
    if (nav?.share) {
      await nav.share({ title: "Mundialito 2026", text, url });
      return;
    }

    await nav?.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="btn secondary min-h-9 px-3" onClick={share} type="button">
      <Share2 className="h-4 w-4" />
      {copied ? "Copiado" : "Compartir"}
    </button>
  );
}
