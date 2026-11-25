"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackView } from "@/lib/actions";

const REFRESH_MS = 20_000;

/**
 * A közös nézet élő tartása és az oldalmegnyitások naplózása:
 * - minden oldalváltást elküld a naplóba (ki melyik oldalt nyitotta meg);
 * - látható fülön 20 másodpercenként frissíti az adatokat, így mindenki ugyanazt látja.
 *   Ha a felhasználó épp gépel egy mezőbe, a frissítés kimarad.
 */
export function Live() {
  return (
    <Suspense fallback={null}>
      <LiveInner />
    </Suspense>
  );
}

function LiveInner() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const last = useRef("");

  useEffect(() => {
    const path = search ? `${pathname}?${search}` : pathname;
    if (last.current === path) return;
    last.current = path;
    void trackView(path).catch(() => undefined);
  }, [pathname, search]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const active = document.activeElement;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
