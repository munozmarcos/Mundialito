"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const audioSrc = "/audio/no-payne-no-gain.mp3";

export function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("mundialito-music-enabled") === "true";
    setEnabled(saved);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.75;
    if (enabled) {
      audio.play().catch(() => {
        setEnabled(false);
        window.localStorage.setItem("mundialito-music-enabled", "false");
      });
    } else {
      audio.pause();
    }
  }, [enabled]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem("mundialito-music-enabled", String(next));
    window.dispatchEvent(new CustomEvent("mundialito:mute", { detail: { muted: !next } }));
  }

  return (
    <>
      <button
        aria-label={enabled ? "Mutear musica" : "Activar musica"}
        className="btn secondary header-icon-btn min-h-9 px-3"
        onClick={toggle}
        title={enabled ? "Mutear musica" : "Activar musica"}
        type="button"
      >
        {enabled ? <Volume2 className="header-action-icon header-action-icon-large" /> : <VolumeX className="header-action-icon header-action-icon-large" />}
      </button>
      <audio ref={audioRef} loop preload="auto" src={audioSrc} />
    </>
  );
}
