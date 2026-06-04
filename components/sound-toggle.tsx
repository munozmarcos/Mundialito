"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const videoId = "rPrRa-EehAQ";
const chorusStart = 78;
const chorusEnd = 112;

function youtubeCommand(command: string, args: unknown[] = []) {
  return JSON.stringify({ event: "command", func: command, args });
}

export function SoundToggle() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setEnabled(window.localStorage.getItem("mundialito-music-enabled") === "true");
  }, []);

  function send(command: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(youtubeCommand(command, args), "https://www.youtube.com");
  }

  function playChorus() {
    send("seekTo", [chorusStart, true]);
    send("unMute");
    send("playVideo");
  }

  useEffect(() => {
    if (!ready) return;
    if (enabled) playChorus();
    else {
      send("mute");
      send("pauseVideo");
    }
  }, [enabled, ready]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem("mundialito-music-enabled", String(next));
    window.dispatchEvent(new CustomEvent("mundialito:mute", { detail: { muted: !next } }));
  }

  return (
    <>
      <button
        aria-label={enabled ? "Mutear música" : "Activar música"}
        className="btn secondary header-icon-btn min-h-9 px-3"
        onClick={toggle}
        title={enabled ? "Mutear música" : "Activar música"}
        type="button"
      >
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      {origin && (
        <iframe
          allow="autoplay; encrypted-media"
          aria-hidden="true"
          className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
          onLoad={() => setReady(true)}
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1&loop=1&playlist=${videoId}&start=${chorusStart}&end=${chorusEnd}&controls=0&disablekb=1`}
          tabIndex={-1}
          title="Música Mundialito"
        />
      )}
    </>
  );
}
