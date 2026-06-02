"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const videoId = "rPrRa-EehAQ";

function youtubeCommand(command: "playVideo" | "pauseVideo" | "mute" | "unMute") {
  return JSON.stringify({ event: "command", func: command, args: [] });
}

export function SoundToggle() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setEnabled(window.localStorage.getItem("mundialito-music-enabled") === "true");
  }, []);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(youtubeCommand(enabled ? "unMute" : "mute"), "https://www.youtube.com");
    iframeRef.current.contentWindow.postMessage(youtubeCommand(enabled ? "playVideo" : "pauseVideo"), "https://www.youtube.com");
  }, [enabled]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem("mundialito-music-enabled", String(next));
    for (const audio of Array.from(document.querySelectorAll("audio"))) {
      audio.muted = !next;
    }
    window.dispatchEvent(new CustomEvent("mundialito:mute", { detail: { muted: !next } }));
  }

  return (
    <>
      <button
        aria-label={enabled ? "Mutear musica" : "Activar musica"}
        className="btn secondary min-h-9 px-3"
        onClick={toggle}
        title={enabled ? "Mutear musica" : "Activar musica"}
        type="button"
      >
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      {origin && (
        <iframe
          allow="autoplay; encrypted-media"
          aria-hidden="true"
          className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1&loop=1&playlist=${videoId}&controls=0&disablekb=1`}
          tabIndex={-1}
          title="Musica Mundialito"
        />
      )}
    </>
  );
}
