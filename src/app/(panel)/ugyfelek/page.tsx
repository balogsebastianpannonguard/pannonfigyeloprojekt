import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, ChevronLeft, ChevronRight, ExternalLink, FileSpreadsheet, History, PencilLine, Search, X } from "lucide-react";
import { ClickableRow } from "@/components/clickable-row";
import { ClientSections } from "@/components/client-sections";
import { TableCell } from "@/components/client-bits";
import { CloseOnEscape } from "@/components/close-on-escape";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { Empty, Input, Label, Pill, Select, Skeleton, buttonClass } from "@/components/ui";
import { LONG_COLS } from "@/lib/client-fields";
import { CLIENT_SORTS, clientName, clientSource, getClient, listClientRows, type ClientQuery, type ClientSort } from "@/lib/clients";
import { formatAgo, formatStamp } from "@/lib/dates";
import { listLog } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Ügyfelek" };

const PAGE_SIZE = 50;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** A táblázat oszlopai az Excel sorrendjében; a név (C) és a vevőkód (B) a rögzített első oszlopban van. */
const TABLE_COLS = ["A", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA"];
/** Melyik oszlop szerint lehet rendezni. */
const SORT_BY_COL: Record<string, ClientSort> = { A: "statusz", F: "telepules", I: "szamlazas", K: "dij", S: "tartozas", AA: "szerzodes" };

export default function ClientsPage({ searchParams }: PageProps<"/ugyfelek">) {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Ügyfelek" title="Átnézett" accent="ügyfelek.">
        Az ügyféllista minden oszlopa, ahogy az Excelben – a kiemelt cellák ugyanúgy sárga háttérrel vagy piros betűvel. Kattints egy sorra az előnézethez;
        onnan szerkesztheted is. Minden megnyitás és módosítás naplózva van.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <Clients searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Clients({ searchParams }: Pick<PageProps<"/ugyfelek">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const sortParam = one(params.rendezes);
  const query: ClientQuery = {
    q: one(params.q).slice(0, 80),
    freq: one(params.szamlazas),
    contract: one(params.szerzodes),
    status: one(params.statusz),
    marked: one(params.kiemelt) === "igen",
    sort: sortParam in CLIENT_SORTS ? (sortParam as ClientSort) : "sor",
    desc: one(params.irany) === "le",
  };
  const page = Math.max(1, Math.min(1000, Number(one(params.oldal)) || 1));
  const previewId = one(params.elonezet);
  const [{ rows, total, options }, latest] = await Promise.all([listClientRows(query, { limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), clientSource()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q || query.freq || query.contract || query.status || query.marked);
  const labels = new Map((rows[0]?.cols ?? []).map((column) => [column.col, column.label]));

  const link = (overrides: Record<string, string>) => {
    const search = new URLSearchParams();
    const merged: Record<string, string> = {
      q: query.q ?? "",
      szamlazas: query.freq ?? "",
      szerzodes: query.contract ?? "",
      statusz: query.status ?? "",
      kiemelt: query.marked ? "igen" : "",
      rendezes: query.sort === "sor" ? "" : (query.sort ?? ""),
      irany: query.desc ? "le" : "",
      oldal: page > 1 ? String(page) : "",
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    return `/ugyfelek${search.size ? `?${search}` : ""}`;
  };

  const header = ({ label, sort, className = "" }: { label: string; sort?: ClientSort; className?: string }, key?: string) => {
    if (!sort) {
      return (
        <th key={key} scope="col" className={`px-3 py-3 font-semibold whitespace-nowrap ${className}`}>
          {label}
        </th>
      );
    }
    const active = query.sort === sort;
    const Icon = active ? (query.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th key={key} scope="col" className={`px-3 py-3 font-semibold ${className}`} aria-sort={active ? (query.desc ? "descending" : "ascending") : undefined}>
        <Link
          href={link({ rendezes: sort === "sor" ? "" : sort, irany: active && !query.desc ? "le" : "", oldal: "", elonezet: "" })}
          className={`inline-flex items-center gap-1 whitespace-nowrap transition hover:text-white ${active ? "text-gold" : ""}`}
        >
          {label}
          <Icon size={13} aria-hidden className={active ? "" : "opacity-40"} />
        </Link>
      </th>
    );
  };

  return (
    <div className="space-y-5">
      {latest && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-white/50">
          <FileSpreadsheet size={16} aria-hidden className="text-gold" />
          Forrás: <span className="text-white/75">{latest.source.file}</span> · „{latest.source.sheet}” munkalap · utolsó import {formatStamp(latest.source.importedAt)}
        </p>
      )}

      <form method="get" className="pg-panel grid gap-4 rounded-3xl p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto] lg:items-end">
        <Label label="Keresés">
          <Input name="q" defaultValue={query.q} placeholder="Név, vevőkód, cím, azonosító, telefon…" />
        </Label>
        <Label label="Számlázás">
          <Select name="szamlazas" defaultValue={query.freq}>
            <option value="">Mind</option>
            {options.freqs.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Label>
        <Label label="Van-e szerződés?">
          <Select name="szerzodes" defaultValue={query.contract}>
            <option value="">Mind</option>
            {options.contracts.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Label>
        <Label label="Státusz">
          <Select name="statusz" defaultValue={query.status}>
            <option value="">Mind</option>
            {options.statuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
          {query.sort !== "sor" && <input type="hidden" name="rendezes" value={query.sort} />}
          {query.desc && <input type="hidden" name="irany" value="le" />}
          <button type="submit" className={buttonClass("primary")}>
            <Search size={16} aria-hidden /> Szűrés
          </button>
          {filtered && (
            <Link href="/ugyfelek" className={buttonClass("ghost")}>
              Törlés
            </Link>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-white/65 sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="kiemelt" value="igen" defaultChecked={query.marked} className="size-4 accent-gold" />
          Csak azok, akiknél az Excelben van kiemelt (piros vagy sárga) cella
        </label>
      </form>

      {rows.length === 0 ? (
        <Empty icon={Building2} title={filtered ? "Nincs találat" : "Még nincs ügyfél"} text={filtered ? "Próbálj más keresést vagy szűrést." : "Az ügyfelek az Excel-listából kerülnek ide."} />
      ) : (
        <section className="pg-panel overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/8 px-5 py-3 text-sm">
            <p className="font-semibold">
              {total.toLocaleString("hu-HU")} ügyfél
              {filtered && <span className="font-normal text-white/50"> a szűrésnek megfelelően</span>}
            </p>
            <p className="flex flex-wrap items-center gap-4 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-yellow-300/25 ring-1 ring-yellow-300/40" /> sárga az Excelben
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold text-red-300">Aa</span> piros az Excelben
              </span>
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}. sor · görgesd oldalra a többi oszlophoz
              </span>
            </p>
          </div>
          <div className="max-h-[75vh] overflow-auto [scrollbar-width:thin]">
            <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-20 bg-ink-900 text-xs text-white/55 [&_th]:border-b [&_th]:border-white/10">
                <tr>
                  {header({ label: "Sor", sort: "sor", className: "sticky left-0 z-30 w-14 bg-ink-900" })}
                  {header({ label: "Ügyfél", sort: "nev", className: "sticky left-14 z-30 min-w-64 bg-ink-900 shadow-[1px_0_0_rgb(255_255_255/0.08)]" })}
                  {TABLE_COLS.map((col) => header({ label: labels.get(col) ?? col, sort: SORT_BY_COL[col] }, col))}
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-white/6">
                {rows.map((row) => {
                  const byCol = new Map(row.cols.map((column) => [column.col, column]));
                  const id = String(row._id);
                  const active = previewId === id;
                  return (
                    <ClickableRow key={id} href={link({ elonezet: id })} active={active}>
                      <td className={`sticky left-0 z-10 px-3 py-2.5 align-top text-xs text-white/40 tabular-nums ${active ? "bg-[#1a1d26]" : "bg-ink-900 group-hover:bg-[#15171f]"}`}>{row.seq}.</td>
                      <td className={`sticky left-14 z-10 min-w-64 px-3 py-2.5 align-top shadow-[1px_0_0_rgb(255_255_255/0.08)] ${active ? "bg-[#1a1d26]" : "bg-ink-900 group-hover:bg-[#15171f]"}`}>
                        <Link href={link({ elonezet: id })} scroll={false} className="block max-w-64 font-semibold [overflow-wrap:anywhere] group-hover:text-gold">
                          {row.summary.name}
                        </Link>
                        <span className="mt-0.5 block text-xs text-white/45">{row.key}</span>
                      </td>
                      {TABLE_COLS.map((col) => (
                        <TableCell key={col} column={byCol.get(col)} wide={LONG_COLS.has(col)} />
                      ))}
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Lapozás" className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-3 text-sm">
              {page > 1 ? (
                <Link href={link({ oldal: String(page - 1), elonezet: "" })} className={buttonClass("ghost", "sm")}>
                  <ChevronLeft size={15} aria-hidden /> Előző
                </Link>
              ) : (
                <span />
              )}
              <span className="text-white/50">
                {page}. / {pages} oldal
              </span>
              {page < pages ? (
                <Link href={link({ oldal: String(page + 1), elonezet: "" })} className={buttonClass("ghost", "sm")}>
                  Következő <ChevronRight size={15} aria-hidden />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}

      {previewId && <Preview id={previewId} closeHref={link({ elonezet: "" })} />}
    </div>
  );
}

/** Előnézet jobb oldali panelben: az ügyfél minden adata, gyors szerkesztés- és adatlap-gombbal, a legutóbbi eseményekkel. */
async function Preview({ id, closeHref }: { id: string; closeHref: string }) {
  const client = await getClient(id);
  if (!client) return null;
  const [names, history] = await Promise.all([nameMap(), listLog({ targetId: id }, { limit: 6 })]);
  const now = new Date();
  const name = clientName(client);
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`${name} – előnézet`}>
      <CloseOnEscape href={closeHref} />
      <Link href={closeHref} scroll={false} aria-label="Előnézet bezárása" className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
      <aside className="pg-rise absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-white/10 bg-ink-900 shadow-2xl [animation-duration:0.35s]">
        <header className="border-b border-white/8 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Előnézet · {client.seq}. ügyfél</p>
              <h2 className="mt-1 font-display text-2xl leading-tight font-semibold [overflow-wrap:anywhere]">{name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/50">
                {client.key}
                {client.status && <Pill tone={client.status === "RENDBEN" ? "ok" : "error"}>{client.status}</Pill>}
              </p>
            </div>
            <Link href={closeHref} scroll={false} aria-label="Bezárás" className="grid size-10 shrink-0 place-items-center rounded-xl text-white/60 transition hover:bg-white/8 hover:text-white">
              <X size={20} aria-hidden />
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/ugyfelek/${id}/szerkesztes`} className={buttonClass("primary", "sm")}>
              <PencilLine size={15} aria-hidden /> Szerkesztés
            </Link>
            <Link href={`/ugyfelek/${id}`} className={buttonClass("secondary", "sm")}>
              <ExternalLink size={15} aria-hidden /> Teljes adatlap
            </Link>
          </div>
          {client.updatedAt && (
            <p className="mt-3 text-xs text-white/45">
              Utoljára szerkesztette {names.get(String(client.updatedBy)) ?? "?"}, {formatAgo(client.updatedAt, now)}
            </p>
          )}
        </header>
        <div className="flex-1 overflow-y-auto p-5 [scrollbar-width:thin] sm:p-6">
          <ClientSections cols={client.cols} compact />
          {history.rows.length > 0 && (
            <section className="mt-8">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                <History size={14} aria-hidden /> Legutóbbi események
              </h3>
              <ul className="divide-y divide-white/6">
                {history.rows.map((entry) => (
                  <LogRow key={String(entry._id)} entry={entry} now={now} />
                ))}
              </ul>
              <Link href={`/ugyfelek/${id}`} className="mt-2 inline-block text-sm text-gold underline-offset-4 hover:underline">
                Összes esemény az adatlapon →
              </Link>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
