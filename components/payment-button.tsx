"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

export function PaymentButton() {
  const [loading, setLoading] = useState(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);

  async function startPayment() {
    setLoading(true);
    try {
      const response = await fetch("/api/payments/start", { method: "POST" });
      const data = await response.json();
      if (response.status === 401) {
        setShowLoginNotice(true);
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn mt-3" disabled={loading} onClick={startPayment} type="button">
        <ExternalLink className="h-4 w-4" />
        {loading ? "Abriendo..." : "Pagar"}
      </button>
      {showLoginNotice && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="panel max-w-md p-5 shadow-2xl">
            <h2 className="text-2xl font-black">Primero entrá a tu cuenta</h2>
            <p className="mt-2 text-sm font-semibold text-ink/70">
              Así MercadoPago queda asociado a tu apodo y el pozo se actualiza solo cuando el pago se aprueba.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a className="btn" href="/login?next=/ranking&pay=1">Entrar y pagar</a>
              <button className="btn secondary" onClick={() => setShowLoginNotice(false)} type="button">Luego</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
