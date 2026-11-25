import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PageTitle } from "@/components/page-title";
import { Empty, Pill, Skeleton } from "@/components/ui";
import { formatAgo, formatStamp } from "@/lib/dates";
import { logCol } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import { tasksCol } from "@/lib/workspace";

export const metadata: Metadata = { title: "Csapat" };

export default function TeamPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Csapat" title="Akik a projekten" accent="dolgoznak.">
        Mindenki, aki az Elosztóból meghívót kapott és regisztrált. Új tagot az Elosztóban, a „Pannon Figyelő projekt” munkakörrel lehet meghívni.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  await requireUser();
  const now = new Date();
  const [members, actionCounts, openTasks] = await Promise.all([
    (await users()).find({}, { projection: { passwordHash: 0 } }).sort({ name: 1 }).toArray(),
    (await logCol())
      .aggregate<{ _id: unknown; actions: number; last?: Date }>([
        { $match: { kind: { $nin: ["view", "auth"] } } },
        { $group: { _id: "$userId", actions: { $sum: 1 }, last: { $max: "$at" } } },
      ])
      .toArray(),
    (await tasksCol()).aggregate<{ _id: unknown; count: number }>([{ $match: { status: { $ne: "kesz" } } }, { $group: { _id: "$assigneeId", count: { $sum: 1 } } }]).toArray(),
  ]);
  const actions = new Map(actionCounts.map((row) => [String(row._id), row]));
  const open = new Map(openTasks.map((row) => [String(row._id), row.count]));
  const onlineSince = new Date(now.getTime() - 5 * 60_000);

  if (members.length === 0) return <Empty icon={UsersRound} title="Még nincs tag" />;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => {
        const id = String(member._id);
        const online = member.lastSeenAt && member.lastSeenAt > onlineSince;
        const stats = actions.get(id);
        return (
          <li key={id} className="pg-panel rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <span className="relative">
                <Avatar name={member.name} size={44} />
                {online && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{member.name}</p>
                <p className="truncate text-xs text-white/50">{member.email}</p>
              </div>
              {member.disabledAt ? <Pill tone="error">Letiltva</Pill> : online ? <Pill tone="ok">Most aktív</Pill> : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/4 p-3">
                <dt className="text-xs text-white/45">Nyitott feladata</dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-gold tabular-nums">{open.get(id) ?? 0}</dd>
              </div>
              <div className="rounded-xl bg-white/4 p-3">
                <dt className="text-xs text-white/45">Műveletei</dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-mist tabular-nums">{stats?.actions ?? 0}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1 text-xs text-white/50">
              <li>Utoljára aktív: {member.lastSeenAt ? formatAgo(member.lastSeenAt, now) : "még nem járt itt"}</li>
              <li>Utolsó belépés: {formatStamp(member.lastLoginAt)}</li>
              <li>
                Csatlakozott: {formatStamp(member.createdAt)} · meghívta: {member.invitedBy}
              </li>
            </ul>
            <Link href={`/naplo?szemely=${id}`} className="mt-4 inline-block text-sm text-gold underline-offset-4 hover:underline">
              Tevékenysége a naplóban →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
