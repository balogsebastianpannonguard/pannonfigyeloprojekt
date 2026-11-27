import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { IdChips } from "@/components/client-bits";
import { PageTitle } from "@/components/page-title";
import { Empty, Skeleton } from "@/components/ui";
import { contractNumbers, listClientBasics } from "@/lib/clients";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfél-dokumentumok" };

export default function ClientDocumentsPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Ügyfél-dokumentumok" title="Ügyfél" accent="dokumentumok.">
        Az Ügyfelek oldalon szereplő ügyfelek, csak a dokumentumokhoz szükséges adatokkal: azonosító, szerződésszám, név és cím. A lista az Ügyfelek oldallal
        együtt frissül.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ClientTable />
      </Suspense>
    </div>
  );
}

async function ClientTable() {
  await requireUser();
  const clients = await listClientBasics();
  if (!clients.length) return <Empty icon={Building2} title="Még nincs ügyfél" text="Az ügyfelek az Ügyfelek oldalról kerülnek ide." />;
  return (
    <section className="pg-panel overflow-hidden rounded-3xl">
      <p className="border-b border-white/8 px-5 py-3 text-sm font-semibold">{clients.length.toLocaleString("hu-HU")} ügyfél</p>
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-ink-900 text-xs text-white/55 [&_th]:border-b [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-3 [&_th]:font-semibold [&_th]:whitespace-nowrap">
            <tr>
              <th scope="col" className="w-12">#</th>
              <th scope="col" className="w-48">Ügyfélazonosító</th>
              <th scope="col" className="w-44">Szerződésszám</th>
              <th scope="col">Ügyfél neve</th>
              <th scope="col">Címe</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-white/6 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&>tr:nth-child(even)]:bg-white/[0.025]">
            {clients.map((client) => {
              const s = client.summary;
              const contracts = contractNumbers(client.cols);
              const address = [s.zip, s.city].filter(Boolean).join(" ") + (s.street ? `, ${s.street}` : "");
              return (
                <tr key={String(client._id)} className="transition-colors hover:bg-gold/5">
                  <td className="text-xs text-white/40 tabular-nums">{client.seq}.</td>
                  <td>
                    <IdChips ids={s.ids} />
                  </td>
                  <td className="font-mono text-xs text-white/85">
                    {contracts.length ? contracts.map((number) => <span key={number} className="block whitespace-nowrap">{number}</span>) : <span className="text-white/20">—</span>}
                  </td>
                  <td>
                    <Link href={`/ugyfelek/${client._id}`} className="font-semibold hover:text-gold">
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-white/80">{address || <span className="text-white/20">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
