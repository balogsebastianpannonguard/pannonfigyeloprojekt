import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, ChevronLeft, ChevronRight, FileSpreadsheet, Search, TriangleAlert } from "lucide-react";
import { IdChips } from "@/components/client-bits";
import { PageTitle } from "@/components/page-title";
import { Empty, Input, Label, Select, Skeleton, buttonClass } from "@/components/ui";
import { CLIENT_SORTS, clientSource, listClientRows, type ClientQuery, type ClientSort } from "@/lib/clients";
import { formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfelek" };

const PAGE_SIZE = 50;
const ft = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default function ClientsPage({ searchParams }: PageProps<"/ugyfelek">) {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Ügyfelek" title="Átnézett" accent="ügyfelek.">
        Az ügyféllistából importált ügyfelek. Kereshetsz névre, vevőkódra, címre, objektumazonosítóra vagy telefonszámra; az oszlopfejlécre kattintva
        rendezhetsz. Egy sorra kattintva megnyílik a teljes adatlap.
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
  const [{ rows, total, options }, latest] = await Promise.all([listClientRows(query, { limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), clientSource()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q || query.freq || query.contract || query.status || query.marked);

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
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    return `/ugyfelek${search.size ? `?${search}` : ""}`;
  };

  function SortHeader({ id, label, className = "" }: { id: ClientSort; label: string; className?: string }) {
    const active = query.sort === id;
    const Icon = active ? (query.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th scope="col" className={`px-3 py-3 font-semibold ${className}`} aria-sort={active ? (query.desc ? "descending" : "ascending") : undefined}>
        <Link
          href={link({ rendezes: id === "sor" ? "" : id, irany: active && !query.desc ? "le" : "", oldal: "" })}
          className={`inline-flex items-center gap-1 whitespace-nowrap transition hover:text-white ${active ? "text-gold" : ""}`}
        >
          {label}
          <Icon size={13} aria-hidden className={active ? "" : "opacity-40"} />
        </Link>
      </th>
    );
  }

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
          Csak azok, akiknél az Excelben van kiemelt (piros vagy sárga) mező
        </label>
      </form>

      {rows.length === 0 ? (
        <Empty icon={Building2} title={filtered ? "Nincs találat" : "Még nincs ügyfél"} text={filtered ? "Próbálj más keresést vagy szűrést." : "Az ügyfelek az Excel-listából kerülnek ide."} />
      ) : (
        <section className="pg-panel overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-5 py-3 text-sm">
            <p className="font-semibold">
              {total.toLocaleString("hu-HU")} ügyfél
              {filtered && <span className="font-normal text-white/50"> a szűrésnek megfelelően</span>}
            </p>
            <p className="text-white/45">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}. sor
            </p>
          </div>
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-white/3 text-xs text-white/55">
                <tr>
                  <SortHeader id="sor" label="Sor" className="w-14" />
                  <SortHeader id="nev" label="Ügyfél" />
                  <SortHeader id="telepules" label="Település" />
                  <SortHeader id="szamlazas" label="Számlázás" />
                  <SortHeader id="dij" label="Éves díj" className="text-right" />
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Objektumazonosítók
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Telefon
                  </th>
                  <SortHeader id="szerzodes" label="Szerződés?" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {rows.map((row) => {
                  const s = row.summary;
                  const href = `/ugyfelek/${row._id}`;
                  return (
                    <tr key={String(row._id)} className="group transition-colors hover:bg-gold/5">
                      <td className="px-3 py-3 align-top text-xs text-white/40 tabular-nums">{row.source.row}.</td>
                      <td className="max-w-[18rem] px-3 py-3 align-top">
                        <Link href={href} className="font-semibold [overflow-wrap:anywhere] group-hover:text-gold">
                          {s.name}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-white/45">
                          <span>{row.key}</span>
                          {s.status && <span className={s.status === "RENDBEN" ? "text-emerald-300/80" : "text-red-300/80"}>{s.status}</span>}
                          {s.marks > 0 && (
                            <span className="inline-flex items-center gap-1 text-yellow-200/80" title="Az Excelben kiemelt mezők">
                              <TriangleAlert size={11} aria-hidden /> {s.marks}
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap text-white/75">
                        {s.city || "—"}
                        {s.zip && <span className="block text-xs text-white/40">{s.zip}</span>}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap text-white/75">{s.freq || "—"}</td>
                      <td className="px-3 py-3 text-right align-top whitespace-nowrap text-gold tabular-nums">{s.fee !== null ? `${ft.format(s.fee)} Ft` : "—"}</td>
                      <td className="px-3 py-3 align-top">
                        <IdChips ids={s.ids} max={4} />
                      </td>
                      <td className="px-3 py-3 align-top text-xs whitespace-nowrap text-white/70">
                        {s.phone ? s.phone.split(/,\s*/).map((phone) => <span key={phone} className="block">{phone}</span>) : "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-white/75">{s.contract || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Lapozás" className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-3 text-sm">
              {page > 1 ? (
                <Link href={link({ oldal: String(page - 1) })} className={buttonClass("ghost", "sm")}>
                  <ChevronLeft size={15} aria-hidden /> Előző
                </Link>
              ) : (
                <span />
              )}
              <span className="text-white/50">
                {page}. / {pages} oldal
              </span>
              {page < pages ? (
                <Link href={link({ oldal: String(page + 1) })} className={buttonClass("ghost", "sm")}>
                  Következő <ChevronRight size={15} aria-hidden />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
