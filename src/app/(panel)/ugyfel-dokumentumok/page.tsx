import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { IdChips } from "@/components/client-bits";
import { DocumentShelf } from "@/components/document-shelf";
import { GenerateButtons } from "@/components/generate-buttons";
import { PageTitle } from "@/components/page-title";
import { Empty, Skeleton } from "@/components/ui";
import { contractFilingNumber, contractNumbers, filingNumber, listClientBasics } from "@/lib/clients";
import { listDocuments } from "@/lib/documents";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfél-dokumentumok" };

export default function ClientDocumentsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <PageTitle eyebrow="Ügyfél-dokumentumok" title="Ügyfél" accent="dokumentumok.">
          Az Ügyfelek oldalon szereplő ügyfelek, csak a dokumentumokhoz szükséges adatokkal: iktatószámok (értesítő levél, szerződés), azonosító, szerződésszám, név és cím. A lista az Ügyfelek oldallal
          együtt frissül.
        </PageTitle>
        <Suspense fallback={<Skeleton className="h-24 lg:w-[34rem] xl:w-[40rem]" />}>
          <Documents />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ClientTable />
      </Suspense>
    </div>
  );
}

async function Documents() {
  await requireUser();
  const documents = await listDocuments();
  return (
    <DocumentShelf
      documents={documents.map(({ slug, title, description, fileName, size, hasPdf }) => ({ slug, title, description, fileName, size, hasPdf }))}
    />
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
        <table className="w-full min-w-[66rem] table-fixed border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-ink-900 text-xs text-white/55 [&_th]:border-b [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-3 [&_th]:font-semibold [&_th]:whitespace-nowrap">
            <tr>
              <th scope="col" className="w-9">#</th>
              <th scope="col" className="w-28">
                Iktatószám
                <span className="block font-normal text-white/35">értesítő levél</span>
              </th>
              <th scope="col" className="w-32">
                Iktatószám T.SZ.SZ.
                <span className="block font-normal text-white/35">szerződés</span>
              </th>
              <th scope="col" className="w-36">Ügyfélazonosító</th>
              <th scope="col" className="w-28">Szerződésszám</th>
              <th scope="col">Ügyfél neve</th>
              <th scope="col">Címe</th>
              <th scope="col" className="w-[10.5rem]">Dokumentumok</th>
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
                  <td className="font-mono text-xs font-semibold whitespace-nowrap text-gold-bright">{filingNumber(client.filingNo)}</td>
                  <td className="font-mono text-xs font-semibold whitespace-nowrap text-sky-200">{contractFilingNumber(client.contractFilingNo)}</td>
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
                  <td>
                    <GenerateButtons id={String(client._id)} name={s.name} filing={filingNumber(client.filingNo)} contractFiling={contractFilingNumber(client.contractFilingNo)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
