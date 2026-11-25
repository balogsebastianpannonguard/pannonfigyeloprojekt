import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ClientEditForm } from "@/components/client-edit-form";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui";
import { SECTIONS } from "@/lib/client-fields";
import { clientName, getClient } from "@/lib/clients";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfél szerkesztése" };

export default function EditClientPage({ params }: PageProps<"/ugyfelek/[id]/szerkesztes">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/ugyfelek/[id]/szerkesztes">, "params">) {
  await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const listed = new Set(SECTIONS.flatMap((section) => section.cols));
  const sections = [
    ...SECTIONS.map((section) => ({ title: section.title, cols: section.cols.filter((col) => client.cols.some((column) => column.col === col)) })),
    { title: "Egyéb", cols: client.cols.filter((column) => !listed.has(column.col)).map((column) => column.col) },
  ].filter((section) => section.cols.length);

  return (
    <div className="space-y-8">
      <Link href={`/ugyfelek/${id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Vissza az adatlaphoz
      </Link>
      <PageTitle eyebrow={`Szerkesztés · ${client.key}`} title={clientName(client)}>
        Minden mező szerkeszthető, a kiemelés is (nincs / sárga / piros). Mentéskor minden változás a régi és az új értékkel együtt a naplóba kerül.
      </PageTitle>
      <ClientEditForm
        id={id}
        version={(client.updatedAt ?? client.source.importedAt).toISOString()}
        sections={sections}
        columns={client.cols.map((column) => ({ col: column.col, label: column.label, value: column.value === null || column.value === undefined ? "" : String(column.value), mark: column.mark ?? "" }))}
      />
    </div>
  );
}
