"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, FileText, FlaskConical, LoaderCircle, Lock, Printer, Undo2, X } from "lucide-react";
import { DocxView } from "@/components/docx-view";
import { buttonClass } from "@/components/ui";
import { clearPrinted, markPrinted } from "@/lib/client-actions";

const DOCS = [
  { key: "ertesito-level", label: "Értesítő levél" },
  { key: "szerzodes", label: "Szerződés" },
] as const;
type DocKey = (typeof DOCS)[number]["key"];
/** Kinyomtatott dokumentumok: kulcs → „2026. 11. 27. 10:42 · Név”. */
export type PrintedInfo = Partial<Record<DocKey, string>>;

const docUrl = (id: string, dok: DocKey, mode: "" | "letoltes" | "nyomtatas" = "") => `/ugyfel-dokumentumok/generalas/${id}?dok=${dok}${mode ? `&${mode}=1` : ""}`;

/**
 * Soronként: „Próba generálás” (működik) és „Generálás” (egyelőre zárolva). Mindkettő ugyanazt készítené: az ügyfél
 * saját adataival kitöltött dokumentumokat, letöltéssel és nyomtatással. A kinyomtatott ügyfél sora zöld.
 */
export function GenerateButtons({ id, name, filing, contractFiling, printed }: { id: string; name: string; filing: string; contractFiling: string; printed: PrintedInfo }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const printedDocs = DOCS.filter((doc) => printed[doc.key]);
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
      {printedDocs.length > 0 && (
        <div className="mt-0.5 rounded-lg bg-emerald-400/10 px-2 py-1.5 text-[0.7rem] leading-snug text-emerald-200 ring-1 ring-emerald-400/25 ring-inset">
          <p className="flex items-center gap-1 font-semibold">
            <CheckCircle2 size={12} aria-hidden /> Nyomtatva
          </p>
          {printedDocs.map((doc) => (
            <p key={doc.key} className="text-emerald-100/70" title={printed[doc.key]}>
              {doc.label}: {printed[doc.key]}
            </p>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => window.confirm(`Visszavonod a nyomtatás jelölését? („${name}”)`) && start(async () => void (await clearPrinted(id)))}
            className="mt-0.5 inline-flex items-center gap-1 text-emerald-100/55 underline-offset-2 hover:text-white hover:underline"
          >
            <Undo2 size={11} aria-hidden /> visszavonás
          </button>
        </div>
      )}
      {/* A táblázat dobozán kívülre (body), hogy az ablak a teljes képernyőt kitöltse. */}
      {open &&
        createPortal(<Preview id={id} name={name} filing={filing} contractFiling={contractFiling} printed={printed} onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}

function Preview({ id, name, filing, contractFiling, printed, onClose }: { id: string; name: string; filing: string; contractFiling: string; printed: PrintedInfo; onClose: () => void }) {
  const [tab, setTab] = useState<DocKey>("ertesito-level");
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

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

  /**
   * Nyomtatás: a böngésző a .docx-et nem tudja pontosan (a sablon szerinti helyeken) kinyomtatni, ezért a kitöltött
   * Word-fájl töltődik le, és Wordből nyomtatják – így a borítékablakos fejléc is pontosan a helyére kerül.
   * A gombnyomással az ügyfél sora zöld lesz (visszavonható).
   */
  function print() {
    const link = document.createElement("a");
    link.href = docUrl(id, tab, "nyomtatas");
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
    const label = DOCS.find((doc) => doc.key === tab)!.label;
    start(async () => {
      const result = await markPrinted(id, tab);
      setNotice(result.error ? `Nem sikerült jelölni: ${result.error}` : `${label} letöltve – nyisd meg Wordben, és nyomtasd ki (Ctrl+P). A sor zöld lett.`);
    });
  }

  const filingLabel = tab === "ertesito-level" ? `Iktatószám: ${filing}` : `Iktatószám T.SZ.SZ.: ${contractFiling}`;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Próba generálás – ${name}`}>
      <button type="button" aria-label="Bezárás" onClick={onClose} className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
      <div className="pg-rise absolute inset-3 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-2xl [animation-duration:0.3s] sm:inset-6 lg:inset-x-[max(1.5rem,calc(50vw-34rem))]">
        <header className="border-b border-white/8 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <FlaskConical size={18} aria-hidden className="text-gold" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Próba generálás · {filingLabel}</p>
              <h2 className="truncate font-semibold">{name}</h2>
            </div>
            <button type="button" onClick={print} disabled={pending} title="Letölti a kitöltött Word-fájlt nyomtatáshoz, és zöldre jelöli a sort" className={buttonClass("primary", "sm")}>
              {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Printer size={15} aria-hidden />} Nyomtatás
            </button>
            <a href={docUrl(id, tab, "letoltes")} className={buttonClass("secondary", "sm")}>
              <Download size={15} aria-hidden /> Letöltés (.docx)
            </a>
            <button type="button" onClick={onClose} aria-label="Bezárás" className="grid size-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/8 hover:text-white">
              <X size={19} aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav aria-label="Dokumentumok" className="inline-flex rounded-xl bg-white/5 p-0.5 text-sm ring-1 ring-white/10 ring-inset">
              {DOCS.map((doc) => (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => setTab(doc.key)}
                  aria-pressed={tab === doc.key}
                  className={`inline-flex items-center gap-1.5 rounded-[0.6rem] px-3 py-1.5 font-semibold transition ${tab === doc.key ? "bg-gold text-ink-950" : "text-white/60 hover:text-white"}`}
                >
                  <FileText size={14} aria-hidden /> {doc.label}
                  {printed[doc.key] && <CheckCircle2 size={13} aria-label="kinyomtatva" className={tab === doc.key ? "text-ink-950" : "text-emerald-300"} />}
                </button>
              ))}
            </nav>
            <p role="status" className="text-xs text-white/50">
              {notice ? (
                <span className="font-semibold text-emerald-300">{notice}</span>
              ) : (
                "Nyomtatás: a kitöltött Word-fájl töltődik le – Wordben megnyitva (Ctrl+P) pontosan a sablon szerint kerül papírra."
              )}
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-[#e9e9ec] [scrollbar-width:thin]">
          <DocxView key={tab} url={docUrl(id, tab)} />
        </div>
      </div>
    </div>
  );
}
