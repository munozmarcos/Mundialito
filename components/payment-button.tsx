"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

export function PaymentButton() {
  const [loading, setLoading] = useState(false);

  async function startPayment() {
    setLoading(true);
    try {
      const response = await fetch("/api/payments/start", { method: "POST" });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn mt-3" disabled={loading} onClick={startPayment} type="button">
      <ExternalLink className="h-4 w-4" />
      {loading ? "Abriendo..." : "Pagar"}
    </button>
  );
}
