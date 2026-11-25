import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, History, NotebookPen, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { NoteEditor } from "@/components/text-forms";
import { Panel, Skeleton } from "@/components/ui";
import { deleteNote } from "@/lib/actions";
import { formatAgo, formatStamp } from "@/lib/dates";
import { listLog } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { getNote, nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Jegyzet" };

export default function NotePage({ params }: PageProps<"/jegyzetek/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[36rem]" />}>
      <Note params={params} />
    </Suspense>
  );
}

async function Note({ params }: Pick<PageProps<"/jegyzetek/[id]">, "params">) {
  await requireUser();
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();
  const [names, history] = await Promise.all([nameMap(), listLog({ targetId: String(note._id) }, { limit: 40 })]);
  const now = new Date();

  return (
    <div className="space-y-8">
      <Link href="/jegyzetek" className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Vissza a jegyzetekhez
      </Link>
      <PageTitle eyebrow="Jegyzet" title={note.title}>
        Létrehozta {names.get(String(note.createdBy)) ?? "?"}, {formatStamp(note.createdAt)} · utoljára szerkesztette {names.get(String(note.updatedBy)) ?? "?"},{" "}
        {formatAgo(note.updatedAt, now)}
      </PageTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Szerkesztés" icon={NotebookPen}>
            <NoteEditor id={String(note._id)} title={note.title} body={note.body} />
          </Panel>
          <form action={deleteNote}>
            <input type="hidden" name="id" value={String(note._id)} />
            <ConfirmButton message="Biztosan törlöd ezt a jegyzetet? Az utolsó tartalma a naplóban megmarad.">
              <Trash2 size={16} aria-hidden /> Jegyzet törlése
            </ConfirmButton>
          </form>
        </div>
        <Panel title="Előzmények" icon={History}>
          <ul className="divide-y divide-white/6">
            {history.rows.map((entry) => (
              <LogRow key={String(entry._id)} entry={entry} now={now} />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
