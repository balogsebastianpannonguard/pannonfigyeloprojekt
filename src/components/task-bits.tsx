import { CalendarClock, Flag } from "lucide-react";
import { formatShortDate } from "@/lib/dates";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/meta";

const PRIORITY_TONE: Record<TaskPriority, string> = {
  alacsony: "bg-white/6 text-white/55 ring-white/10",
  normal: "bg-iris/15 text-mist ring-iris/25",
  magas: "bg-gold/15 text-gold-bright ring-gold/30",
  surgos: "bg-red-500/15 text-red-200 ring-red-400/30",
};

export function PriorityPill({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ring-1 ring-inset ${PRIORITY_TONE[priority]}`}>
      <Flag size={11} aria-hidden /> {TASK_PRIORITY[priority]}
    </span>
  );
}

/** Határidő-címke: lejárt pirossal, mai arannyal. */
export function DueLabel({ due, today, done }: { due?: string; today: string; done?: boolean }) {
  if (!due) return null;
  const late = !done && due < today;
  const isToday = !done && due === today;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${late ? "font-semibold text-red-300" : isToday ? "font-semibold text-gold" : "text-white/50"}`}>
      <CalendarClock size={12} aria-hidden />
      {late ? "Lejárt: " : isToday ? "Ma: " : ""}
      {formatShortDate(due)}
    </span>
  );
}
