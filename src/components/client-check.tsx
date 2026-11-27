"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setClientCheck } from "@/lib/client-actions";

/** Jelölőnégyzet a lista sorának végén: azonnal átvált, a háttérben ment és naplóz; hiba esetén visszaáll. */
export function ClientCheck({ id, which, label, name, checked, by }: { id: string; which: string; label: string; name: string; checked: boolean; by?: string }) {
  const [shown, setShown] = useOptimistic(checked);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const title = error || (by ? `${label}: ${checked ? "bepipálta" : "kivette"} ${by}` : label);
  return (
    <label title={title} className="grid size-8 cursor-pointer place-items-center rounded-lg transition hover:bg-white/8">
      <input
        type="checkbox"
        checked={shown}
        aria-label={`${label} – ${name}`}
        onChange={(event) => {
          const next = event.target.checked;
          setError("");
          startTransition(async () => {
            setShown(next);
            const result = await setClientCheck(id, which, next).catch(() => ({ error: "Nem sikerült menteni, próbáld újra." }));
            if (result.error) setError(result.error);
          });
        }}
        className={`size-[1.05rem] cursor-pointer accent-gold ${error ? "outline-2 outline-red-400" : ""}`}
      />
    </label>
  );
}
