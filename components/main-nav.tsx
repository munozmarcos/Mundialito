"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = {
  role: "admin" | "participant";
};

const links = [
  { href: "/", label: "Inicio" },
  { href: "/mi-prode", label: "Pronósticos" },
  { href: "/partidos", label: "Partidos" },
  { href: "/ranking", label: "Ranking" },
  { href: "/probar", label: "Simulador" },
  { href: "/reglas", label: "Reglas" },
  { href: "/creditos", label: "Créditos" }
];

export function MainNav() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  return (
    <div className="nav-tabs flex flex-wrap items-center gap-2 text-sm font-bold xl:justify-center">
      {links.map((link) => (
        <Link href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
      {user?.role === "admin" && <Link href="/admin">Admin</Link>}
    </div>
  );
}
