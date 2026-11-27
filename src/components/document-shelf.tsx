"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, LoaderCircle, X } from "lucide-react";
import { buttonClass } from "@/components/ui";

export type ShelfDocument = { slug: string; title: string; description: string; fileName: string; size: number; hasPdf: boolean };

const fileUrl = (slug: string, download = false) => `/ugyfel-dokumentumok/fajl/${encodeURIComponent(slug)}${download ? "?letoltes=1" : ""}`;

/** A dokumentumsablonok kártyái; kattintásra a Word-fájl előnézete nyílik meg (az eredeti formázással), onnan le is tölthető. */
export function DocumentShelf({ documents }: { documents: ShelfDocument[] }) {
  const [open, setOpen] = useState<ShelfDocument | null>(null);
  if (!documents.length) return null;
  return (
    <>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:w-[34rem] lg:grid-cols-1 xl:w-[40rem] xl:grid-cols-2">
        {documents.map((document) => (
          <li key={document.slug}>
            <button
              type="button"
              onClick={() => setOpen(document)}
              className="pg-card group flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition hover:ring-1 hover:ring-gold/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold ring-1 ring-gold/25 ring-inset">
                <FileText size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug font-semibold group-hover:text-gold">{document.title}</span>
                {document.description && <span className="mt-0.5 block text-xs text-white/50">{document.description}</span>}
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold/90">
                  <Eye size={13} aria-hidden /> Előnézet
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <Preview key={open.slug} document={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Preview({ document, onClose }: { document: ShelfDocument; onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(document.hasPdf ? "ready" : "loading");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (document.hasPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const [response, { renderAsync }] = await Promise.all([fetch(fileUrl(document.slug), { cache: "no-store" }), import("docx-preview")]);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (cancelled || !body.current) return;
        body.current.innerHTML = "";
        await renderAsync(blob, body.current, undefined, { className: "docx", inWrapper: true, ignoreLastRenderedPageBreak: true, experimental: true });
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document.slug, document.hasPdf]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${document.title} – előnézet`}>
      <button type="button" aria-label="Előnézet bezárása" onClick={onClose} className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
      <div className="pg-rise absolute inset-3 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-2xl [animation-duration:0.3s] sm:inset-6 lg:inset-x-[max(1.5rem,calc(50vw-34rem))]">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-5 py-3.5">
          <FileText size={18} aria-hidden className="text-gold" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{document.title}</h2>
            <p className="truncate text-xs text-white/45">
              {document.fileName} · {Math.round(document.size / 1024)} kB
            </p>
          </div>
          <a href={fileUrl(document.slug, true)} className={buttonClass("primary", "sm")}>
            <Download size={15} aria-hidden /> Letöltés (.docx)
          </a>
          <button type="button" onClick={onClose} aria-label="Bezárás" className="grid size-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/8 hover:text-white">
            <X size={19} aria-hidden />
          </button>
        </header>
        <div className="relative flex-1 overflow-auto bg-[#e9e9ec] [scrollbar-width:thin]">
          {state !== "ready" && (
            <div className="absolute inset-0 grid place-items-center text-sm text-ink-900/70">
              {state === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle size={18} aria-hidden className="animate-spin" /> Előnézet betöltése…
                </span>
              ) : (
                <span>Az előnézet nem tölthető be. A Letöltés gombbal megnyithatod Wordben.</span>
              )}
            </div>
          )}
          {document.hasPdf ? (
            <iframe src={`${fileUrl(document.slug)}?pdf=1#view=FitH`} title={`${document.title} – előnézet`} className="absolute inset-0 size-full border-0" />
          ) : (
            <div ref={body} className="pg-docx text-black" />
          )}
        </div>
      </div>
    </div>
  );
}
