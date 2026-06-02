import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeroProps = {
  badge?: string;
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  children?: ReactNode;
};

export function PageHero({ badge, title, subtitle, icon: Icon, children }: PageHeroProps) {
  return (
    <section className="panel overflow-hidden">
      <div className="page-hero-grid p-6 sm:p-7">
        <div className="min-w-0">
          {badge && <span className="badge">{badge}</span>}
          <div className="mt-3 flex items-center gap-3">
            {Icon && (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-mint text-grass">
                <Icon className="h-6 w-6" />
              </div>
            )}
            <h1 className="text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
          </div>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink/68 sm:text-base">{subtitle}</p>
        </div>
        {children && <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">{children}</div>}
      </div>
    </section>
  );
}
