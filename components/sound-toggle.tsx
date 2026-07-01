"use client";

import { Music2, X } from "lucide-react";
import { useState } from "react";

const spotifyEmbedUrl = "https://open.spotify.com/embed/track/40qwbrvCXsiOPh9xOupCMp?utm_source=generator&theme=0";

export function SoundToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={open ? "Cerrar musica oficial" : "Abrir musica oficial"}
        className="btn secondary header-icon-btn min-h-9 px-3"
        onClick={() => setOpen((current) => !current)}
        title="DNA"
        type="button"
      >
        {open ? <X className="header-action-icon header-action-icon-large" /> : <Music2 className="header-action-icon header-action-icon-large" />}
      </button>

      {open && (
        <div className="fixed right-3 top-24 z-[90] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-line bg-slate-950 shadow-2xl shadow-black/45">
          <iframe
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="block h-[152px] w-full border-0"
            loading="lazy"
            src={spotifyEmbedUrl}
            title="DNA - musica oficial"
          />
        </div>
      )}
    </>
  );
}
