import { NotificationBody } from "@/components/notification-body";
import { ShareLinkButton } from "@/components/share-link-button";
import { formatArgentinaDateTime } from "@/lib/dates";
import { getLatestNotifications } from "@/lib/notifications";
import { Newspaper, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novedades | Mundialito"
};

export default async function NovedadesPage() {
  const newsItems = await getLatestNotifications(250, { includeExpiredManual: true });

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <span className="badge">Novedades</span>
        <h1 className="mt-3 flex items-center gap-3 text-4xl font-black">
          <Newspaper className="h-8 w-8 text-grass" />
          Noticias del Mundialito
        </h1>
        <p className="mt-2 text-ink/70">
          Avisos del admin, puntos sumados, partidos por cerrar, partidos cerrados y nuevos participantes.
        </p>
      </section>

      <section className="grid gap-4">
        {!newsItems.length ? (
          <article className="panel p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-gold" />
            <h2 className="mt-3 text-2xl font-black">Todavía no hay avisos</h2>
            <p className="mt-1 text-sm font-semibold text-ink/65">Cuando haya movimientos del Mundialito, quedan registrados acá.</p>
          </article>
        ) : (
          newsItems.map((item) => (
            <article className="panel p-5" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-2xl font-black">{item.title}</h2>
                <time className="rounded-full border border-line bg-field px-3 py-1 text-xs font-black text-ink/55" dateTime={item.created_at}>
                  {formatArgentinaDateTime(item.created_at)}
                </time>
              </div>
              <NotificationBody item={item} />
            </article>
          ))
        )}
        <article className="panel overflow-hidden bg-field">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
            <div>
              <h2 className="text-2xl font-black">Video Promocional</h2>
              <p className="mt-1 text-sm font-semibold text-ink/60">La primera invitación del Mundialito 2026.</p>
            </div>
            <ShareLinkButton url="https://youtu.be/5lev6M_P3h8" text="Mira el video promocional del Mundialito 2026" />
          </div>
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/5lev6M_P3h8"
              title="Video Promocional Mundialito"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </article>
      </section>
    </div>
  );
}
