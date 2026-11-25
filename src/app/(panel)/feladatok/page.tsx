import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageSquareText } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PageTitle } from "@/components/page-title";
import { DueLabel, PriorityPill } from "@/components/task-bits";
import { MoveButtons, NewTaskForm } from "@/components/task-forms";
import { Skeleton } from "@/components/ui";
import { dayKey } from "@/lib/dates";
import { STATUS_ORDER, TASK_STATUS } from "@/lib/meta";
import { requireUser } from "@/lib/session";
import { listPeople } from "@/lib/users";
import { commentCounts, listTasks, nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Feladatok" };

const COLUMN_TONE = ["bg-white/40", "bg-iris", "bg-gold", "bg-emerald-400"];

export default function TasksPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Feladatok" title="A közös" accent="feladattábla.">
        Bárki felvehet, szerkeszthet és áthelyezhet feladatot – minden változás a feladat előzményeiben és a naplóban is látszik.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <Board />
      </Suspense>
    </div>
  );
}

async function Board() {
  await requireUser();
  const [tasks, people, names, comments] = await Promise.all([listTasks(), listPeople(), nameMap(), commentCounts()]);
  const today = dayKey(new Date());

  return (
    <div className="space-y-6">
      <NewTaskForm people={people} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status, column) => {
          const items = tasks.filter((task) => task.status === status);
          return (
            <section key={status} className="pg-panel flex min-h-48 flex-col rounded-3xl p-3">
              <h2 className="flex items-center gap-2 px-2 pt-1 pb-3 text-sm font-semibold">
                <span className={`size-2.5 rounded-full ${COLUMN_TONE[column]}`} />
                {TASK_STATUS[status]}
                <span className="ml-auto rounded-full bg-white/6 px-2 py-0.5 text-xs text-white/60 tabular-nums">{items.length}</span>
              </h2>
              <ul className="flex flex-1 flex-col gap-2">
                {items.length === 0 && <li className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-white/35">Üres</li>}
                {items.map((task, index) => {
                  const assignee = task.assigneeId ? names.get(String(task.assigneeId)) : undefined;
                  const count = comments.get(String(task._id)) ?? 0;
                  return (
                    <li key={String(task._id)} className="pg-card pg-rise rounded-2xl p-3" style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}>
                      <Link href={`/feladatok/${task._id}`} className="block text-sm leading-snug font-semibold [overflow-wrap:anywhere] hover:text-gold">
                        {task.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <PriorityPill priority={task.priority} />
                        <DueLabel due={task.due} today={today} done={task.status === "kesz"} />
                      </div>
                      <div className="mt-2.5 flex items-center gap-2 border-t border-white/6 pt-2">
                        {assignee ? <Avatar name={assignee} size={22} /> : <span className="text-xs text-white/35">Nincs felelős</span>}
                        {count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-white/45">
                            <MessageSquareText size={12} aria-hidden /> {count}
                          </span>
                        )}
                        <span className="ml-auto">
                          <MoveButtons id={String(task._id)} status={task.status} />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
