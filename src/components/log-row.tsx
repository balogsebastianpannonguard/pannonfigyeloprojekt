import Link from "next/link";
import { Building2, Eye, KanbanSquare, KeyRound, MessageSquareText, MessagesSquare, NotebookPen, Download, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { formatAgo, formatStamp } from "@/lib/dates";
import type { LogEntry, LogKind } from "@/lib/log";

const ICONS: Record<LogKind, { icon: LucideIcon; tone: string }> = {
  auth: { icon: KeyRound, tone: "bg-iris/18 text-mist" },
  view: { icon: Eye, tone: "bg-white/6 text-white/50" },
  task: { icon: KanbanSquare, tone: "bg-gold/14 text-gold" },
  comment: { icon: MessageSquareText, tone: "bg-gold/10 text-gold-bright" },
  post: { icon: MessagesSquare, tone: "bg-iris/18 text-iris-bright" },
  note: { icon: NotebookPen, tone: "bg-emerald-400/12 text-emerald-200" },
  client: { icon: Building2, tone: "bg-gold/14 text-gold" },
  export: { icon: Download, tone: "bg-white/8 text-white/70" },
};

function targetHref(target?: LogEntry["target"]) {
  if (!target) return undefined;
  if (target.type === "task") return `/feladatok/${target.id}`;
  if (target.type === "note") return `/jegyzetek/${target.id}`;
  if (target.type === "post") return "/uzenofal";
  if (target.type === "client") return target.id ? `/ugyfelek/${target.id}` : "/ugyfelek";
  return undefined;
}

/** Egy naplóbejegyzés: ki, mit, mikor – a módosított mezők régi és új értékével, IP-vel és eszközzel. */
export function LogRow({ entry, now, detailed = false }: { entry: LogEntry; now: Date; detailed?: boolean }) {
  const { icon: Icon, tone } = ICONS[entry.kind] ?? ICONS.view;
  const href = targetHref(entry.target);
  return (
    <li className="flex gap-3 py-3">
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon size={15} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">
          <span className="inline-flex items-center gap-1.5 align-middle">
            <Avatar name={entry.userName} size={20} />
            <span className="font-semibold text-white">{entry.userName}</span>
          </span>{" "}
          <span className="text-white/70">{entry.text}</span>
          {href && (
            <>
              {" "}
              <Link href={href} className="text-gold underline-offset-4 hover:underline">
                megnyitás
              </Link>
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          <time dateTime={entry.at.toISOString()} title={formatStamp(entry.at)}>
            {formatAgo(entry.at, now)}
          </time>
          {detailed && (
            <>
              {" · "}
              {entry.device} · IP {entry.ip}
            </>
          )}
        </p>
        {entry.changes && entry.changes.length > 0 && (
          <details className="group mt-2">
            <summary className="cursor-pointer text-xs font-medium text-gold/80 select-none hover:text-gold">
              Változások ({entry.changes.length})
            </summary>
            <dl className="mt-2 space-y-2 rounded-xl border border-white/8 bg-white/3 p-3 text-xs">
              {entry.changes.map((change, index) => (
                <div key={index} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
                  <dt className="font-semibold text-white/60">{change.field}</dt>
                  <dd className="min-w-0 space-y-1">
                    <p className="whitespace-pre-wrap text-red-200/80 line-through decoration-red-300/40 [overflow-wrap:anywhere]">{change.from || "(üres)"}</p>
                    <p className="whitespace-pre-wrap text-emerald-200 [overflow-wrap:anywhere]">{change.to || "(üres)"}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}
