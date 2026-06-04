import { PaymentButton } from "@/components/payment-button";
import { CreditCard, QrCode } from "lucide-react";

const paymentAlias = "MunozMarcosMP";
const appPaymentUrl = "https://mundialito-mu.vercel.app/login?next=/pagos&pay=1";
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appPaymentUrl)}`;

export function PaymentCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`panel text-center ${compact ? "p-4" : "p-5"}`}>
      <div className="mx-auto grid max-w-sm justify-items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-400/12 px-3 py-1 text-xs font-black text-sky-200">
          <CreditCard className="h-4 w-4" />
          Mercado Pago
        </div>

        {!compact && (
          <div className="rounded-xl border border-sky-300/20 bg-white p-2 shadow-[0_12px_34px_rgba(56,189,248,0.16)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="QR de pago Mercado Pago" className="h-32 w-32 rounded-lg sm:h-36 sm:w-36" src={qrUrl} />
          </div>
        )}

        <div className="w-full rounded-lg border border-line bg-field p-3">
          <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-ink/45">
            <QrCode className="h-4 w-4" />
            Alias
          </div>
          <p className="mt-1 text-lg font-black text-grass">{paymentAlias}</p>
        </div>

        <PaymentButton />
      </div>
    </div>
  );
}
