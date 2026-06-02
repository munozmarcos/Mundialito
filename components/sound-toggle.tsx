"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("mundialito-muted") === "true";
    setMuted(saved);
    for (const audio of Array.from(document.querySelectorAll("audio"))) {
      audio.muted = saved;
    }
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    window.localStorage.setItem("mundialito-muted", String(next));
    for (const audio of Array.from(document.querySelectorAll("audio"))) {
      audio.muted = next;
    }
    window.dispatchEvent(new CustomEvent("mundialito:mute", { detail: { muted: next } }));
  }

  return (
    <button
      aria-label={muted ? "Activar musica" : "Mutear musica"}
      className="btn secondary min-h-9 px-3"
      onClick={toggle}
      title={muted ? "Activar musica" : "Mutear musica"}
      type="button"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
