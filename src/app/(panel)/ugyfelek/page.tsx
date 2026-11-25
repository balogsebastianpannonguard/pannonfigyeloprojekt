import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, CircleCheck, FileSpreadsheet, MapPin, Phone, TriangleAlert } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Empty, Pill, Skeleton } from "@/components/ui";
import { cellText, clientName, listClients } from "@/lib/clients";
import { formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfelek" };

const ft = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Ügyfelek" title="Rendben lévő" accent="ügyfelek.">
        Az átnézett ügyféllistából importált ügyfelek, a táblázat soraiban szereplő összes adattal. Kattints egy ügyfélre a teljes adatlaphoz.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Clients />
      </Suspense>
    </div>
  );
}

async function Clients() {
  await requireUser();
  const clients = await listClients();
  if (clients.length === 0) return <Empty icon={Building2} title="Még nincs ügyfél" text="Az ügyfelek az Excel-listából kerülnek ide." />;
  const source = clients[0].source;

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-center gap-2 text-sm text-white/50">
        <FileSpreadsheet size={16} aria-hidden className="text-gold" />
        Forrás: <span className="text-white/75">{source.file}</span> · „{source.sheet}” munkalap · importálva {formatStamp(source.importedAt)} · {clients.length} ügyfél
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {clients.map((client, index) => {
          const marked = client.cols.filter((column) => column.mark);
          const fee = client.cols.find((column) => column.col === "K")?.value;
          const city = [cellText(client, "E"), cellText(client, "F")].filter(Boolean).join(" ");
          const phone = cellText(client, "P");
          return (
            <li key={String(client._id)} className="pg-rise" style={{ animationDelay: `${index * 0.05}s` }}>
              <Link href={`/ugyfelek/${client._id}`} className="pg-card flex h-full flex-col rounded-3xl p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold">
                    <Building2 size={20} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-snug font-semibold [overflow-wrap:anywhere]">{clientName(client)}</p>
                    <p className="text-xs text-white/45">
                      Vevőkód: <span className="text-white/70">{client.key}</span> · Excel {client.source.row}. sor
                    </p>
                  </div>
                  <Pill tone="ok" icon={CircleCheck}>
                    {client.status}
                  </Pill>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white/4 p-3">
                    <dt className="text-xs text-white/45">Számlázás</dt>
                    <dd className="mt-0.5 font-medium">{cellText(client, "I") || "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-white/4 p-3">
                    <dt className="text-xs text-white/45">Éves díj, bruttó</dt>
                    <dd className="mt-0.5 font-medium text-gold tabular-nums">{typeof fee === "number" ? `${ft.format(fee)} Ft` : "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-white/4 p-3">
                    <dt className="text-xs text-white/45">Objektumazonosító</dt>
                    <dd className="mt-0.5 font-medium">{cellText(client, "N") || "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-white/4 p-3">
                    <dt className="text-xs text-white/45">Van-e szerződés?</dt>
                    <dd className="mt-0.5 font-medium">{cellText(client, "AA") || "—"}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-1 flex-col justify-end gap-1.5 text-sm text-white/60">
                  {city && (
                    <p className="flex items-center gap-2">
                      <MapPin size={14} aria-hidden className="shrink-0 text-white/35" /> {city}, {cellText(client, "G")}
                    </p>
                  )}
                  {phone && (
                    <p className="flex items-center gap-2">
                      <Phone size={14} aria-hidden className="shrink-0 text-white/35" /> {phone}
                    </p>
                  )}
                  {marked.length > 0 && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-yellow-200/80">
                      <TriangleAlert size={13} aria-hidden className="shrink-0" /> {marked.length} mező kiemelve az Excelben
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
