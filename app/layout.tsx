import "@/app/globals.css";
import { MainNav } from "@/components/main-nav";
import { SessionNav } from "@/components/session-nav";
import { SoundToggle } from "@/components/sound-toggle";
import { MundialitoMark, TournamentRibbon } from "@/components/world-cup-brand";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Mundialito",
  description: "Prode del Mundial 2026 con ranking, alertas y chat IA",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TournamentRibbon />
        <header className="sticky top-0 z-20 border-b border-line bg-white text-ink shadow-lg shadow-sky-950/8">
          <nav className="shell grid min-h-16 gap-3 py-3 xl:grid-cols-[auto_1fr_auto] xl:items-center">
            <div className="flex items-center">
              <Link href="/">
                <MundialitoMark />
              </Link>
            </div>
            <MainNav />
            <div className="flex items-center gap-2 xl:justify-end">
              <SoundToggle />
              <SessionNav />
            </div>
          </nav>
        </header>
        <main className="shell py-8">{children}</main>
      </body>
    </html>
  );
}
