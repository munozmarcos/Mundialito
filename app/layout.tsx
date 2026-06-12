import "@/app/globals.css";
import { MainNav } from "@/components/main-nav";
import { NotificationToasts } from "@/components/notification-toasts";
import { PushNotificationButton } from "@/components/push-notification-button";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { SessionNav } from "@/components/session-nav";
import { SoundToggle } from "@/components/sound-toggle";
import { MundialitoMark, TournamentRibbon } from "@/components/world-cup-brand";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Mundialito",
  description: "Prode del Mundial 2026 con ranking, alertas y chat IA",
  manifest: "/manifest.webmanifest",
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
          <nav className="shell app-header-grid grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:gap-3">
            <div className="flex items-center justify-start">
              <MainNav />
            </div>
            <div className="flex min-w-0 items-center justify-center">
              <Link className="header-brand-link" href="/">
                <MundialitoMark compact />
              </Link>
            </div>
            <div className="header-actions flex items-center justify-end gap-2">
              <PushNotificationButton />
              <SoundToggle />
              <SessionNav />
            </div>
          </nav>
        </header>
        <PushNotificationPrompt />
        <NotificationToasts />
        <main className="shell app-shell-main py-8">{children}</main>
      </body>
    </html>
  );
}
