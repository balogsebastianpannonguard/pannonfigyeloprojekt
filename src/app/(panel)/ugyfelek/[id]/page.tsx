import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Banknote, Building2, CircleCheck, FileSignature, FileSpreadsheet, MessageSquareWarning, PhoneCall, Radar, Rows3, type LucideIcon } from "lucide-react";
import { ClientField } from "@/components/client-bits";
import { PageTitle } from "@/components/page-title";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { clientName, getClient, type ClientColumn } from "@/lib/clients";
import { formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfél" };

/** Az Excel oszlopai témák szerint (a „Mind” munkalap oszlopbetűi). A fel nem sorolt oszlopok az „Egyéb” részbe kerülnek. */
const SECTIONS: { title: string; icon: LucideIcon; cols: string[] }[] = [
  { title: "Alapadatok", icon: Building2, cols: ["A", "B", "C", "D", "E", "F", "G", "H"] },
  { title: "Szerződés és számlázás", icon: FileSignature, cols: ["I", "J", "K", "AA"] },
  { title: "Objektumok és felügyelet", icon: Radar, cols: ["L", "M", "N", "Q", "R"] },
  { title: "Kapcsolattartás", icon: PhoneCall, cols: ["O", "P"] },
  { title: "Fizetési helyzet", icon: Banknote, cols: ["S", "T", "U", "V", "W", "X", "Y"] },
  { title: "Megjegyzés", icon: MessageSquareWarning, cols: ["Z"] },
];

export default function ClientPage({ params }: PageProps<"/ugyfelek/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Client params={params} />
    </Suspense>
  );
}

async function Client({ params }: Pick<PageProps<"/ugyfelek/[id]">, "params">) {
  await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const byCol = new Map(client.cols.map((column) => [column.col, column]));
  const listed = new Set(SECTIONS.flatMap((section) => section.cols));
  const rest = client.cols.filter((column) => !listed.has(column.col));
  const note = byCol.get("Z")?.value;
  const marked = client.cols.filter((column) => column.mark).length;

  return (
    <div className="space-y-8">
      <Link href="/ugyfelek" className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Vissza az ügyfelekhez
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle eyebrow={`Ügyfél · ${client.key}`} title={clientName(client)}>
          Az Excel-sor minden adata, oszlopról oszlopra. Ami a táblázatban pirossal vagy sárgával ki volt emelve, itt is úgy látszik.
        </PageTitle>
        <Pill tone="ok" icon={CircleCheck}>
          {client.status}
        </Pill>
      </div>

      {note ? (
        <div className="flex gap-3 rounded-2xl border border-gold/25 bg-gold/8 p-4 text-sm">
          <MessageSquareWarning size={19} aria-hidden className="mt-0.5 shrink-0 text-gold" />
          <p className={byCol.get("Z")?.mark === "piros" ? "font-medium text-red-200" : "text-gold-bright"}>{String(note)}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {SECTIONS.map((section) => {
          const columns = section.cols.map((col) => byCol.get(col)).filter((column): column is ClientColumn => Boolean(column));
          if (!columns.length) return null;
          return (
            <Panel key={section.title} title={section.title} icon={section.icon} className={section.title === "Megjegyzés" ? "lg:col-span-2" : ""}>
              <dl className="space-y-1">
                {columns.map((column) => (
                  <ClientField key={column.col} column={column} />
                ))}
              </dl>
            </Panel>
          );
        })}
        {rest.length > 0 && (
          <Panel title="Egyéb" icon={Rows3} className="lg:col-span-2">
            <dl className="space-y-1">
              {rest.map((column) => (
                <ClientField key={column.col} column={column} />
              ))}
            </dl>
          </Panel>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-white/40">
        <FileSpreadsheet size={14} aria-hidden className="text-gold/70" />
        {client.source.file} · „{client.source.sheet}” munkalap, {client.source.row}. sor · {client.cols.length} oszlop
        {marked > 0 && ` · ${marked} kiemelt mező`} · importálva {formatStamp(client.source.importedAt)}
      </p>
    </div>
  );
}
