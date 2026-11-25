import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, FileSpreadsheet, History, PencilLine } from "lucide-react";
import { ClientSections } from "@/components/client-sections";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { Panel, Pill, Skeleton, buttonClass } from "@/components/ui";
import { clientName, getClient } from "@/lib/clients";
import { formatAgo, formatStamp } from "@/lib/dates";
import { listLog } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Ügyfél" };

export default function ClientPage({ params, searchParams }: PageProps<"/ugyfelek/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Client params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Client({ params, searchParams }: Pick<PageProps<"/ugyfelek/[id]">, "params" | "searchParams">) {
  await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const client = await getClient(id);
  if (!client) notFound();
  const [names, history] = await Promise.all([nameMap(), listLog({ targetId: id }, { limit: 60 })]);
  const now = new Date();
  const saved = typeof query.mentve === "string" ? Number(query.mentve) : 0;

  return (
    <div className="space-y-8">
      <Link href="/ugyfelek" className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Vissza az ügyfelekhez
      </Link>

      {saved > 0 && (
        <p role="status" className="pg-rise flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <CircleCheck size={17} aria-hidden className="text-emerald-300" /> Mentve – {saved} változás került a naplóba.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle eyebrow={`${client.seq}. ügyfél · ${client.key}`} title={clientName(client)}>
          Az Excel-sor minden adata, oszlopról oszlopra; a kiemelt cellák úgy látszanak, ahogy a táblázatban.
        </PageTitle>
        <div className="flex flex-wrap items-center gap-2">
          {client.status && <Pill tone={client.status === "RENDBEN" ? "ok" : "error"}>{client.status}</Pill>}
          <Link href={`/ugyfelek/${id}/szerkesztes`} className={buttonClass("primary")}>
            <PencilLine size={16} aria-hidden /> Szerkesztés
          </Link>
        </div>
      </div>

      <ClientSections cols={client.cols} />

      <Panel title="Előzmények" icon={History} action={<span className="text-xs text-white/45">ki, mikor nézte meg vagy módosította</span>}>
        {history.rows.length === 0 ? (
          <p className="text-sm text-white/50">Még nincs bejegyzés.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {history.rows.map((entry) => (
              <LogRow key={String(entry._id)} entry={entry} now={now} detailed />
            ))}
          </ul>
        )}
      </Panel>

      <p className="flex flex-wrap items-center gap-2 text-xs text-white/40">
        <FileSpreadsheet size={14} aria-hidden className="text-gold/70" />
        {client.source.file} · „{client.source.sheet}” munkalap, {client.source.row}. sor · {client.cols.length} oszlop · importálva {formatStamp(client.source.importedAt)}
        {client.updatedAt && ` · utoljára szerkesztette ${names.get(String(client.updatedBy)) ?? "?"}, ${formatAgo(client.updatedAt, now)}`}
      </p>
    </div>
  );
}
