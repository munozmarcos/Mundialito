"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function HomePrimaryAction() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setLoggedIn(Boolean(data.user));
        setPaid(Boolean(data.user?.paid));
      })
      .catch(() => {
        setLoggedIn(false);
        setPaid(false);
      });
  }, []);

  const pendingPayment = loggedIn && !paid;

  return (
    <Link
      className={`btn ${pendingPayment ? "border-red-500/35 bg-red-500/15 text-red-200 hover:bg-red-500/20" : ""}`}
      href={loggedIn ? "/mi-prode" : "/login"}
    >
      {pendingPayment && <LockKeyhole className="h-4 w-4" />}
      Pronósticos
    </Link>
  );
}
