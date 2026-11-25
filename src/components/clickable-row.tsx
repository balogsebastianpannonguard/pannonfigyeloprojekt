"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

/** Táblázatsor, amelyre kattintva (vagy Enterrel) megnyílik az előnézet; a sorban lévő linkek és gombok a saját dolgukat végzik. */
export function ClickableRow({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      tabIndex={0}
      aria-selected={active}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
        router.push(href, { scroll: false });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") router.push(href, { scroll: false });
      }}
      className={`group cursor-pointer transition-colors outline-none hover:bg-gold/5 focus-visible:bg-gold/8 ${active ? "bg-gold/8" : ""}`}
    >
      {children}
    </tr>
  );
}
