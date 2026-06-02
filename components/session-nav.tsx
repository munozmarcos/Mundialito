"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = {
  displayName: string;
  phone: string | null;
};

export function SessionNav() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    window.location.href = "/login";
  }

  if (!user) {
    return (
      <Link className="btn min-h-9 px-3 text-sm shadow-sm" href="/login">
        <LogIn className="h-4 w-4" />
        Iniciar sesión
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm text-ink shadow-sm">
      <UserRound className="h-4 w-4 text-grass" />
      <div className="leading-tight">
        <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-ink/45">Logueado</span>
        <span className="block max-w-[180px] truncate font-bold">{user.displayName}</span>
      </div>
      <button className="btn secondary min-h-8 px-2" onClick={signOut} title="Salir" type="button">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
