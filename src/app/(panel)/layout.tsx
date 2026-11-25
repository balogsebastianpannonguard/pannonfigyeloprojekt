import type { ReactNode } from "react";
import { Suspense } from "react";
import { History } from "lucide-react";
import { Backdrop, Brand } from "@/components/brand";
import { Live } from "@/components/live";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserCard, UserCardSkeleton } from "@/components/user-card";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <Backdrop />
      <Live />

      <aside className="sticky top-0 z-10 hidden h-dvh flex-col border-r border-white/8 bg-ink-900/70 p-5 backdrop-blur-xl print:hidden lg:flex">
        <Brand />
        <div className="-mx-2 mt-8 min-h-0 flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:thin]">
          <SidebarNav />
        </div>

        <div className="space-y-3 border-t border-white/8 pt-4">
          <p className="flex items-center gap-2 px-1 text-xs text-white/45">
            <span className="relative flex size-2">
              <span className="pg-live absolute inset-0 rounded-full bg-gold" />
            </span>
            <History size={13} aria-hidden className="text-gold" /> Minden lépés naplózva
          </p>
          <Suspense fallback={<UserCardSkeleton />}>
            <UserCard />
          </Suspense>
        </div>
      </aside>

      <div className="relative min-w-0">
        <header className="sticky top-0 z-10 border-b border-white/8 bg-ink-900/80 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <Brand />
            <Suspense fallback={<span className="pg-skeleton size-10 rounded-full" />}>
              <UserCard compact />
            </Suspense>
          </div>
          <div className="px-3 pb-2">
            <SidebarNav compact />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 pb-28 sm:px-8 lg:py-12 lg:pb-28">{children}</main>
      </div>
    </div>
  );
}
