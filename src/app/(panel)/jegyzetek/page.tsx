import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotebookPen, Plus } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { NewNoteForm } from "@/components/text-forms";
import { Empty, Panel, Skeleton } from "@/components/ui";
import { formatAgo } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { listNotes, nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Jegyzetek" };

export default function NotesPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Jegyzetek" title="Közös" accent="tudástár.">
        Emlékeztetők, megbeszélések, ügyféladatok, ötletek. Bárki szerkesztheti őket; minden mentés régi és új tartalma a naplóban marad.
      </PageTitle>
      <Panel title="Új jegyzet" icon={Plus}>
        <NewNoteForm />
      </Panel>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Notes />
      </Suspense>
    </div>
  );
}

async function Notes() {
  await requireUser();
  const [notes, names] = await Promise.all([listNotes(), nameMap()]);
  const now = new Date();
  if (notes.length === 0) return <Empty icon={NotebookPen} title="Még nincs jegyzet" text="Hozd létre az elsőt a fenti mezővel." />;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note, index) => (
        <li key={String(note._id)} className="pg-rise" style={{ animationDelay: `${Math.min(index, 9) * 0.04}s` }}>
          <Link href={`/jegyzetek/${note._id}`} className="pg-card flex h-full flex-col rounded-3xl p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-gold/12 text-gold">
              <NotebookPen size={18} aria-hidden />
            </span>
            <p className="mt-4 font-display text-lg font-semibold [overflow-wrap:anywhere]">{note.title}</p>
            <p className="mt-1 line-clamp-3 flex-1 text-sm whitespace-pre-wrap text-white/55">{note.body || "Üres jegyzet"}</p>
            <p className="mt-4 text-xs text-white/40">
              {names.get(String(note.updatedBy)) ?? "?"} · {formatAgo(note.updatedAt, now)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
