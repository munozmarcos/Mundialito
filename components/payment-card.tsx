import { PaymentButton } from "@/components/payment-button";
import { CreditCard, QrCode, Trophy } from "lucide-react";

const paymentAlias = "MunozMarcosMP";
const appPaymentUrl = "https://mundialito-mu.vercel.app/login?next=/pagos&pay=1";
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(appPaymentUrl)}`;

export function PaymentCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`panel overflow-hidden text-center ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-400/12 px-4 py-2 text-sm font-black text-sky-200">
          <CreditCard className="h-4 w-4" />
          Mercado Pago
        </div>

        <div>
          <h2 className="text-2xl font-black sm:text-3xl">Entrada Mundialito</h2>
          <p className="mt-1 text-sm font-bold text-ink/60">$10.000 al pozo y $5.000 al viaje misionero a Ecuador.</p>
        </div>

        {!compact && (
          <div className="rounded-[20px] border border-sky-300/20 bg-white p-3 shadow-[0_18px_50px_rgba(56,189,248,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="QR de pago Mercado Pago" className="h-44 w-44 rounded-xl sm:h-52 sm:w-52" src={qrUrl} />
          </div>
        )}

        <div className="grid w-full gap-3 rounded-lg border border-line bg-field p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-ink/45 sm:justify-start">
              <QrCode className="h-4 w-4" />
              Alias
            </div>
            <p className="mt-1 text-xl font-black text-grass">{paymentAlias}</p>
          </div>
          <PaymentButton />
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-gold">
          <Trophy className="h-4 w-4" />
          Mundialito 2026
        </div>
      </div>
    </div>
  );
}
