"use client";

import { Eye, EyeOff, KeyRound, LogIn, MessageCircle, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type SessionUser = {
  displayName: string;
  phone: string | null;
  paid: boolean;
};

type PasswordInputProps = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

function PasswordInput({ placeholder, value, onChange }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className="field min-h-10 pr-12"
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink/60 hover:bg-white/10 hover:text-ink"
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/mi-prode";
  const payIntent = searchParams.get("pay") === "1";
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  function switchMode(nextMode: "login" | "signup" | "reset") {
    setMode(nextMode);
    setStep("request");
    setCode("");
    setPassword("");
    setMessage("");
  }

  async function loginWithPassword() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/password-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: displayName, password })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo iniciar sesión.");
      return;
    }
    window.location.href = nextPath;
  }

  async function requestCode() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, displayName, phone })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo enviar el código.");
      return;
    }
    setStep("verify");
    setMessage(mode === "reset" ? `Te mandé el código por WhatsApp a ${data.phone}.` : `Alta creada. Te mandé el código por WhatsApp a ${data.phone}.`);
  }

  async function verifyCodeAndSetPassword() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code, password })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Código incorrecto.");
      return;
    }
    window.location.href = nextPath;
  }

  return (
    <section className="mx-auto grid max-w-4xl gap-4">
      <div className="panel overflow-hidden">
        <div className="grid gap-5 p-5 sm:p-7 md:grid-cols-[0.95fr_1.05fr] md:items-center">
          <div className="grid place-items-center rounded-lg bg-field p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Mundialito 2026" className="w-full max-w-[340px] rounded-lg" src="/mundialito-logo.png" />
          </div>

          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-mint text-grass">
                {mode === "login" ? <KeyRound className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
              </span>
              <div>
                <h1 className="text-2xl font-black">{mode === "login" ? "Entrar" : mode === "signup" ? "Pedir alta" : "Recuperar contraseña"}</h1>
                <p className="text-sm font-semibold text-ink/60">Mundialito 2026</p>
              </div>
            </div>

            {user ? (
              <div className="grid gap-3">
                <div className="rounded-lg bg-field p-3 text-sm font-semibold text-ink/70">
                  Ya estás logueado como <strong>{user.displayName}</strong>{user.phone ? ` (${user.phone})` : ""}.
                </div>
                {payIntent ? (
                  <div className="flex flex-wrap gap-2">
                    <a className="btn w-fit" href="/pagos">Ir a pagar</a>
                    <a className="btn secondary w-fit" href="/mi-prode">Luego</a>
                  </div>
                ) : (
                  <a className="btn w-fit" href="/mi-prode">
                    Ir a Pronósticos
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="panel flex flex-wrap gap-2 p-2 shadow-none">
                  <button className={`btn min-h-9 ${mode === "login" ? "" : "secondary"}`} type="button" onClick={() => switchMode("login")}>
                    Ya tengo usuario
                  </button>
                  <button className={`btn min-h-9 ${mode === "signup" ? "" : "secondary"}`} type="button" onClick={() => switchMode("signup")}>
                    Soy nuevo
                  </button>
                  <button className={`btn min-h-9 ${mode === "reset" ? "" : "secondary"}`} type="button" onClick={() => switchMode("reset")}>
                    Recuperar
                  </button>
                </div>
                {payIntent && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-ink/70">
                    Entrá para asociar MercadoPago a tu apodo automáticamente, o pagá luego desde la app.
                    <a className="ml-2 font-black text-grass underline" href="/mi-prode">Lo hago luego</a>
                  </div>
                )}

                {mode === "login" ? (
                  <div className="grid max-w-sm gap-3">
                    <input className="field min-h-10" placeholder="Apodo" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                    <PasswordInput placeholder="Contraseña" value={password} onChange={setPassword} />
                    <button className="btn" disabled={loading} type="button" onClick={loginWithPassword}>
                      <LogIn className="h-4 w-4" />
                      Entrar
                    </button>
                  </div>
                ) : mode === "signup" ? (
                  <div className="grid max-w-sm gap-3">
                    <input className="field min-h-10" placeholder="Apodo" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                    <input className="field min-h-10" inputMode="tel" placeholder="WhatsApp" value={phone} onChange={(event) => setPhone(event.target.value)} />
                    {step === "request" && (
                      <button className="btn" disabled={loading} type="button" onClick={requestCode}>
                        <MessageCircle className="h-4 w-4" />
                        Enviar código
                      </button>
                    )}
                    {step === "verify" && (
                      <>
                        <input className="field min-h-10 text-center text-xl font-black tracking-[0.24em]" inputMode="numeric" maxLength={6} placeholder="CÓDIGO" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
                        <PasswordInput placeholder="Crear contraseña" value={password} onChange={setPassword} />
                        <div className="flex flex-wrap gap-2">
                          <button className="btn" disabled={loading} type="button" onClick={verifyCodeAndSetPassword}>
                            <ShieldCheck className="h-4 w-4" />
                            Crear contraseña
                          </button>
                          <button className="btn secondary" disabled={loading} type="button" onClick={requestCode}>
                            Reenviar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid max-w-sm gap-3">
                    <input className="field min-h-10" inputMode="tel" placeholder="WhatsApp registrado" value={phone} onChange={(event) => setPhone(event.target.value)} />
                    {step === "request" && (
                      <button className="btn" disabled={loading} type="button" onClick={requestCode}>
                        <MessageCircle className="h-4 w-4" />
                        Enviar código
                      </button>
                    )}
                    {step === "verify" && (
                      <>
                        <input className="field min-h-10 text-center text-xl font-black tracking-[0.24em]" inputMode="numeric" maxLength={6} placeholder="CÓDIGO" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
                        <PasswordInput placeholder="Nueva contraseña" value={password} onChange={setPassword} />
                        <div className="flex flex-wrap gap-2">
                          <button className="btn" disabled={loading} type="button" onClick={verifyCodeAndSetPassword}>
                            <ShieldCheck className="h-4 w-4" />
                            Guardar
                          </button>
                          <button className="btn secondary" disabled={loading} type="button" onClick={requestCode}>
                            Reenviar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {message && <p className="rounded-lg bg-field p-3 text-sm font-semibold text-grass">{message}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-4xl"><div className="panel p-6">Cargando...</div></section>}>
      <LoginContent />
    </Suspense>
  );
}
