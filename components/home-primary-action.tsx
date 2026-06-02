"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function HomePrimaryAction() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setLoggedIn(Boolean(data.user)))
      .catch(() => setLoggedIn(false));
  }, []);

  return (
    <Link className="btn" href={loggedIn ? "/mi-prode" : "/login"}>
      {loggedIn ? "Ir al Fixture" : "Iniciar sesión"}
    </Link>
  );
}
