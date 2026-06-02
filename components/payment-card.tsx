import { PaymentButton } from "@/components/payment-button";

const paymentUrl = "https://mpago.la/2kV7LPV";
const paymentAlias = "MunozMarcosMP";
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(paymentUrl)}`;

export function PaymentCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-sky-200 bg-sky-50 p-4 ${compact ? "" : "grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center"}`}>
      <div>
        <div className="inline-flex items-center rounded-full bg-[#00b1ea] px-3 py-1 text-sm font-black text-white">Mercado Pago</div>
        <h2 className="mt-3 text-xl font-black">Entrada del Mundialito</h2>
        <p className="mt-2 text-sm font-semibold text-ink/70">Alias: <span className="font-black text-grass">{paymentAlias}</span></p>
        <PaymentButton />
      </div>
      {!compact && (
        <div className="rounded-lg bg-white p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="QR de pago Mercado Pago" className="h-36 w-36" src={qrUrl} />
        </div>
      )}
    </div>
  );
}
