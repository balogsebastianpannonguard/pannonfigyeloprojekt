import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, History, MessageSquareText, PencilLine, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ConfirmButton } from "@/components/confirm-button";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { EditTaskForm } from "@/components/task-forms";
import { CommentForm } from "@/components/text-forms";
import { Panel, Skeleton } from "@/components/ui";
import { deleteComment, deleteTask } from "@/lib/actions";
import { formatAgo, formatStamp } from "@/lib/dates";
import { listLog } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { listPeople } from "@/lib/users";
import { getTask, listComments, nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Feladat" };

export default function TaskPage({ params }: PageProps<"/feladatok/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[36rem]" />}>
      <Task params={params} />
    </Suspense>
  );
}

async function Task({ params }: Pick<PageProps<"/feladatok/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();
  const [people, names, comments, history] = await Promise.all([listPeople(), nameMap(), listComments(task._id), listLog({ targetId: String(task._id) }, { limit: 50 })]);
  const now = new Date();

  return (
    <div className="space-y-8">
      <Link href="/feladatok" className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Vissza a táblához
      </Link>
      <PageTitle eyebrow="Feladat" title={task.title}>
        Létrehozta {names.get(String(task.createdBy)) ?? "?"}, {formatStamp(task.createdAt)} · utoljára módosította {names.get(String(task.updatedBy)) ?? "?"},{" "}
        {formatAgo(task.updatedAt, now)}
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Adatok" icon={PencilLine}>
            <EditTaskForm
              people={people}
              values={{
                id: String(task._id),
                title: task.title,
                description: task.description ?? "",
                status: task.status,
                priority: task.priority,
                assigneeId: task.assigneeId ? String(task.assigneeId) : "",
                due: task.due ?? "",
              }}
            />
          </Panel>

          <Panel title={`Hozzászólások (${comments.length})`} icon={MessageSquareText}>
            {comments.length > 0 && (
              <ul className="mb-5 space-y-4">
                {comments.map((comment) => {
                  const author = names.get(String(comment.authorId)) ?? "?";
                  return (
                    <li key={String(comment._id)} className="flex gap-3">
                      <Avatar name={author} size={30} />
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white/4 px-4 py-3">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-semibold">{author}</span>
                          <span className="text-xs text-white/40" title={formatStamp(comment.createdAt)}>
                            {formatAgo(comment.createdAt, now)}
                          </span>
                          {comment.authorId.equals(user.oid) && (
                            <form action={deleteComment} className="ml-auto">
                              <input type="hidden" name="id" value={String(comment._id)} />
                              <button type="submit" className="text-xs text-white/35 transition hover:text-red-300">
                                Törlés
                              </button>
                            </form>
                          )}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-white/80 [overflow-wrap:anywhere]">{comment.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <CommentForm taskId={String(task._id)} />
          </Panel>

          <form action={deleteTask}>
            <input type="hidden" name="id" value={String(task._id)} />
            <ConfirmButton message="Biztosan törlöd ezt a feladatot a hozzászólásaival együtt? A törlés a naplóban megmarad.">
              <Trash2 size={16} aria-hidden /> Feladat törlése
            </ConfirmButton>
          </form>
        </div>

        <Panel title="Előzmények" icon={History}>
          {history.rows.length === 0 ? (
            <p className="text-sm text-white/50">Még nincs bejegyzés.</p>
          ) : (
            <ul className="divide-y divide-white/6">
              {history.rows.map((entry) => (
                <LogRow key={String(entry._id)} entry={entry} now={now} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
