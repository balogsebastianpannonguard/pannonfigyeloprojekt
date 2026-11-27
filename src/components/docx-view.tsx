"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

/** Egy .docx kirajzolása a böngészőben (docx-preview). A letöltött fájl a pontos Word-dokumentum; ez csak megtekintés. */
export function DocxView({ url }: { url: string }) {
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [response, { renderAsync }] = await Promise.all([fetch(url, { cache: "no-store" }), import("docx-preview")]);
        if (!response.ok) throw new Error((await response.text()) || String(response.status));
        const blob = await response.blob();
        if (cancelled || !body.current) return;
        body.current.innerHTML = "";
        await renderAsync(blob, body.current, undefined, { className: "docx", inWrapper: true, ignoreLastRenderedPageBreak: true, experimental: true });
        if (!cancelled) setState("ready");
      } catch (error) {
        if (!cancelled) {
          setMessage((error as Error).message);
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="relative min-h-full">
      {state !== "ready" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-900/70">
          {state === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={18} aria-hidden className="animate-spin" /> Dokumentum készítése…
            </span>
          ) : (
            <span className="max-w-md">Nem sikerült elkészíteni a dokumentumot. {message}</span>
          )}
        </div>
      )}
      <div ref={body} className="pg-docx text-black" />
    </div>
  );
}
