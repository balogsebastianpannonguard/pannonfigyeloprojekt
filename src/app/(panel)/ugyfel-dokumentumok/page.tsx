import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Empty, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ügyfél-dokumentumok" };

export default function ClientDocumentsPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Ügyfél-dokumentumok" title="Ügyfél" accent="dokumentumok.">
        Az ügyfelekhez tartozó dokumentumok helye.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ComingSoon />
      </Suspense>
    </div>
  );
}

async function ComingSoon() {
  await requireUser();
  return <Empty icon={FileText} title="Készülőben" text="Ez az oldal hamarosan elkészül." />;
}
