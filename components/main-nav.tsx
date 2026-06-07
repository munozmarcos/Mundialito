"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = {
  role: "admin" | "participant";
};

const links = [
  { href: "/", label: "Inicio" },
  { href: "/novedades", label: "Novedades" },
  { href: "/mi-prode", label: "Pron\u00f3sticos" },
  { href: "/partidos", label: "Partidos" },
  { href: "/ranking", label: "Ranking" },
  { href: "/pagos", label: "Pagos" },
  { href: "/probar", label: "Simulador" },
  { href: "/reglas", label: "Reglas" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/creditos", label: "Cr\u00e9ditos" }
];

export function MainNav() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));

    const hidden = window.localStorage.getItem("mundialito-menu-hidden") === "true";
    setOpen(!hidden);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.body.classList.toggle("mundialito-sidebar-open", open);
    return () => document.body.classList.remove("mundialito-sidebar-open");
  }, [open, ready]);

  const visibleLinks = user?.role === "admin" ? [...links, { href: "/admin", label: "Admin" }] : links;

  function setMenu(next: boolean) {
    window.localStorage.setItem("mundialito-menu-hidden", String(!next));
    setOpen(next);
  }

  function closeOnMobile() {
    if (window.matchMedia("(max-width: 979px)").matches) setMenu(false);
  }

  return (
    <>
      <button className="btn secondary header-icon-btn min-h-10 px-3" onClick={() => setMenu(!open)} type="button">
        <Menu className="header-action-icon header-action-icon-large" />
        <span className="hidden sm:inline">{"Men\u00fa"}</span>
      </button>

      {open && <button aria-label="Cerrar menú" className="app-sidebar-backdrop" onClick={() => setMenu(false)} type="button" />}
      <aside className={`app-sidebar ${open ? "app-sidebar-open" : "app-sidebar-closed"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Mundialito</span>
            <h2 className="text-2xl font-black">{"Men\u00fa"}</h2>
          </div>
          <button className="btn secondary min-h-10 px-3" onClick={() => setMenu(!open)} type="button">
            {open ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
        </div>
        <div className="nav-tabs grid gap-2 text-base font-bold">
          {visibleLinks.map((link) => (
            <Link href={link.href} key={link.href} onClick={closeOnMobile}>
              {link.label}
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}
