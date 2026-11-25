import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlarmClock, CircleCheckBig, History, KanbanSquare, ListChecks, Pin, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { DueLabel, PriorityPill } from "@/components/task-bits";
import { Empty, LinkButton, Panel, Skeleton, Stat } from "@/components/ui";
import { addDays, dayKey, formatAgo, greeting } from "@/lib/dates";
import { listLog } from "@/lib/log";
import { STATUS_ORDER, TASK_STATUS } from "@/lib/meta";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import { listPosts, listTasks, nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Áttekintés" };

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-20" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

async function Overview() {
  const user = await requireUser();
  const now = new Date();
  const today = dayKey(now);
  const [tasks, names, activity, posts, team] = await Promise.all([
    listTasks(),
    nameMap(),
    listLog({ views: false }, { limit: 12 }),
    listPosts(3),
    (await users()).find({ disabledAt: { $exists: false } }, { projection: { name: 1, lastSeenAt: 1 } }).sort({ lastSeenAt: -1 }).toArray(),
  ]);

  const open = tasks.filter((task) => task.status !== "kesz");
  const late = open.filter((task) => task.due && task.due < today);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const doneThisWeek = tasks.filter((task) => task.status === "kesz" && task.doneAt && task.doneAt > weekAgo);
  const mine = open.filter((task) => String(task.assigneeId) === user.id).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const upcoming = open.filter((task) => task.due && task.due <= addDays(today, 7)).sort((a, b) => a.due!.localeCompare(b.due!));
  const pinned = posts.filter((post) => post.pinned);
  const onlineSince = new Date(now.getTime() - 5 * 60_000);
  const total = tasks.length || 1;

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Pannon Figyelő projekt" title={`${greeting(now)},`} accent={`${user.firstName}!`}>
        Ez a közös projekttér: mindenki ugyanazt a táblát, üzenőfalat és jegyzeteket látja, és minden lépés a naplóba kerül.
      </PageTitle>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Nyitott feladat" value={open.length} icon={KanbanSquare} tone="text-gold" />
        <Stat label="Lejárt határidő" value={late.length} icon={AlarmClock} tone={late.length ? "text-red-300" : "text-white"} />
        <Stat label="Kész az elmúlt 7 napban" value={doneThisWeek.length} icon={CircleCheckBig} tone="text-emerald-300" />
        <Stat
          label="Csapattag"
          value={team.length}
          icon={UsersRound}
          tone="text-mist"
          hint={`${team.filter((member) => member.lastSeenAt && member.lastSeenAt > onlineSince).length} most aktív`}
        />
      </section>

      <Panel title="Hol tart a projekt?" icon={ListChecks}>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/6">
          {STATUS_ORDER.map((status, index) => {
            const count = tasks.filter((task) => task.status === status).length;
            return count ? (
              <span
                key={status}
                title={`${TASK_STATUS[status]}: ${count}`}
                style={{ width: `${(count / total) * 100}%`, animationDelay: `${index * 0.1}s` }}
                className={`pg-grow h-full ${["bg-white/25", "bg-iris", "bg-gold", "bg-emerald-400"][index]}`}
              />
            ) : null;
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/60">
          {STATUS_ORDER.map((status, index) => (
            <li key={status} className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${["bg-white/25", "bg-iris", "bg-gold", "bg-emerald-400"][index]}`} />
              {TASK_STATUS[status]}: <span className="font-semibold text-white tabular-nums">{tasks.filter((task) => task.status === status).length}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Friss események" icon={History} action={<LinkButton href="/naplo" variant="ghost" size="sm">Teljes napló</LinkButton>}>
          {activity.rows.length === 0 ? (
            <p className="text-sm text-white/50">Még nem történt semmi. Hozd létre az első feladatot!</p>
          ) : (
            <ul className="divide-y divide-white/6">
              {activity.rows.map((entry) => (
                <LogRow key={String(entry._id)} entry={entry} now={now} />
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          {pinned.length > 0 && (
            <Panel title="Kitűzve" icon={Pin}>
              <ul className="space-y-3">
                {pinned.map((post) => (
                  <li key={String(post._id)} className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
                    <p className="line-clamp-4 text-sm whitespace-pre-wrap text-white/85">{post.body}</p>
                    <p className="mt-2 text-xs text-white/45">
                      {names.get(String(post.authorId)) ?? "?"} · {formatAgo(post.createdAt, now)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Rád vár" icon={ListChecks}>
            {mine.length === 0 ? (
              <p className="text-sm text-white/50">Nincs rád osztott nyitott feladat.</p>
            ) : (
              <TaskList tasks={mine} today={today} />
            )}
          </Panel>

          <Panel title="Határidők (7 nap)" icon={AlarmClock}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-white/50">A következő héten nincs esedékes feladat.</p>
            ) : (
              <TaskList tasks={upcoming} today={today} names={names} />
            )}
          </Panel>

          <Panel title="Csapat" icon={UsersRound}>
            {team.length === 0 ? (
              <Empty icon={UsersRound} title="Még csak te vagy itt" />
            ) : (
              <ul className="space-y-2.5">
                {team.slice(0, 8).map((member) => {
                  const online = member.lastSeenAt && member.lastSeenAt > onlineSince;
                  return (
                    <li key={String(member._id)} className="flex items-center gap-3 text-sm">
                      <span className="relative">
                        <Avatar name={member.name} size={30} />
                        {online && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-900" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{member.name}</span>
                      <span className="text-xs text-white/40">{online ? "most aktív" : member.lastSeenAt ? formatAgo(member.lastSeenAt, now) : "még nem járt itt"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  today,
  names,
}: {
  tasks: Awaited<ReturnType<typeof listTasks>>;
  today: string;
  names?: Map<string, string>;
}) {
  return (
    <ul className="space-y-2">
      {tasks.slice(0, 6).map((task) => (
        <li key={String(task._id)}>
          <Link href={`/feladatok/${task._id}`} className="pg-card block rounded-xl p-3">
            <p className="truncate text-sm font-semibold">{task.title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              <PriorityPill priority={task.priority} />
              <DueLabel due={task.due} today={today} />
              {names && task.assigneeId && <span className="text-xs text-white/45">{names.get(String(task.assigneeId))}</span>}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
