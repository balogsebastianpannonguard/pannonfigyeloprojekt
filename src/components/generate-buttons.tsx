"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, FlaskConical, Lock, X } from "lucide-react";
import { DocxView } from "@/components/docx-view";
import { buttonClass } from "@/components/ui";

const DOCS = [
  { key: "ertesito-level", label: "Értesítő levél" },
  { key: "szerzodes", label: "Szerződés" },
] as const;
type DocKey = (typeof DOCS)[number]["key"];

const url = (id: string, dok: DocKey, download = false) => `/ugyfel-dokumentumok/generalas/${id}?dok=${dok}${download ? "&letoltes=1" : ""}`;

/** Soronként: „Próba generálás” (működik) és „Generálás” (egyelőre zárolva). Mindkettő ugyanazt készítené: az ügyfél saját adataival kitöltött dokumentumokat. */
export function GenerateButtons({ id, name, filing, contractFiling }: { id: string; name: string; filing: string; contractFiling: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass("secondary", "sm")} justify-center whitespace-nowrap`}>
        <FlaskConical size={14} aria-hidden /> Próba generálás
      </button>
      <button
        type="button"
        disabled
        title="Zárolva – az éles generálás még nincs engedélyezve. Addig a Próba generálást használd."
        aria-label={`Generálás (zárolva) – ${name}`}
        className={`${buttonClass("ghost", "sm")} cursor-not-allowed justify-center whitespace-nowrap opacity-50 ring-1 ring-white/10`}
      >
        <Lock size={14} aria-hidden /> Generálás
      </button>
      {/* A táblázat dobozán kívülre (body), hogy az ablak a teljes képernyőt kitöltse. */}
      {open && createPortal(<Preview id={id} name={name} filing={filing} contractFiling={contractFiling} onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}

function Preview({ id, name, filing, contractFiling, onClose }: { id: string; name: string; filing: string; contractFiling: string; onClose: () => void }) {
  const [tab, setTab] = useState<DocKey>("ertesito-level");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Próba generálás – ${name}`}>
      <button type="button" aria-label="Bezárás" onClick={onClose} className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
      <div className="pg-rise absolute inset-3 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-2xl [animation-duration:0.3s] sm:inset-6 lg:inset-x-[max(1.5rem,calc(50vw-34rem))]">
        <header className="border-b border-white/8 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <FlaskConical size={18} aria-hidden className="text-gold" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                Próba generálás · {tab === "ertesito-level" ? `Iktatószám: ${filing}` : `Iktatószám T.SZ.SZ.: ${contractFiling}`}
              </p>
              <h2 className="truncate font-semibold">{name}</h2>
            </div>
            <a href={url(id, tab, true)} className={buttonClass("primary", "sm")}>
              <Download size={15} aria-hidden /> Letöltés (.docx)
            </a>
            <button type="button" onClick={onClose} aria-label="Bezárás" className="grid size-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/8 hover:text-white">
              <X size={19} aria-hidden />
            </button>
          </div>
          <nav aria-label="Dokumentumok" className="mt-3 inline-flex rounded-xl bg-white/5 p-0.5 text-sm ring-1 ring-white/10 ring-inset">
            {DOCS.map((doc) => (
              <button
                key={doc.key}
                type="button"
                onClick={() => setTab(doc.key)}
                aria-pressed={tab === doc.key}
                className={`inline-flex items-center gap-1.5 rounded-[0.6rem] px-3 py-1.5 font-semibold transition ${tab === doc.key ? "bg-gold text-ink-950" : "text-white/60 hover:text-white"}`}
              >
                <FileText size={14} aria-hidden /> {doc.label}
              </button>
            ))}
          </nav>
          <p className="mt-2 text-xs text-white/45">
            Az előnézet a böngésző rajzolata; nyomtatáshoz a letöltött .docx-et nyisd meg Wordben – az a pontos dokumentum.
          </p>
        </header>
        <div className="flex-1 overflow-auto bg-[#e9e9ec] [scrollbar-width:thin]">
          <DocxView key={tab} url={url(id, tab)} />
        </div>
      </div>
    </div>
  );
}
