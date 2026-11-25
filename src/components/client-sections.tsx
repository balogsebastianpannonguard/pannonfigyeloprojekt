import {
  Banknote,
  Building2,
  FileSignature,
  MessageSquareText,
  PhoneCall,
  Radar,
  Rows3,
  type LucideIcon,
} from "lucide-react";
import { ClientField } from "@/components/client-bits";
import { Panel } from "@/components/ui";
import { SECTIONS } from "@/lib/client-fields";
import type { ClientColumn } from "@/lib/clients";

const ICONS: Record<(typeof SECTIONS)[number]["icon"], LucideIcon> = {
  building: Building2,
  contract: FileSignature,
  radar: Radar,
  phone: PhoneCall,
  money: Banknote,
  note: MessageSquareText,
};

/** Az ügyfél összes mezője témák szerint – az adatlap és az előnézet közös része. */
export function ClientSections({
  cols,
  compact = false,
}: {
  cols: ClientColumn[];
  compact?: boolean;
}) {
  const byCol = new Map(cols.map((column) => [column.col, column]));
  const listed = new Set(SECTIONS.flatMap((section) => section.cols));
  const rest = cols.filter((column) => !listed.has(column.col));
  const groups = [
    ...SECTIONS.map((section) => ({
      title: section.title,
      icon: ICONS[section.icon],
      columns: section.cols
        .map((col) => byCol.get(col))
        .filter((column): column is ClientColumn => Boolean(column)),
      full: section.icon === "note",
    })),
    { title: "Egyéb", icon: Rows3, columns: rest, full: true },
  ].filter((group) => group.columns.length);

  const legend = cols.some((column) => column.mark) && (
    <p className="flex flex-wrap items-center gap-4 text-xs text-white/50">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-yellow-300/25 ring-1 ring-yellow-300/40" />{" "}
        sárgával kiemelve az Excelben
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="font-semibold text-red-300">Aa</span> pirossal jelölve
        az Excelben
      </span>
    </p>
  );

  if (compact) {
    return (
      <div className="space-y-6">
        {legend}
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-gold uppercase">
              <group.icon size={14} aria-hidden /> {group.title}
            </h3>
            <dl className="space-y-1">
              {group.columns.map((column) => (
                <ClientField key={column.col} column={column} />
              ))}
            </dl>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {legend}
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <Panel
            key={group.title}
            title={group.title}
            icon={group.icon}
            className={group.full ? "lg:col-span-2" : ""}
          >
            <dl className="space-y-1">
              {group.columns.map((column) => (
                <ClientField key={column.col} column={column} />
              ))}
            </dl>
          </Panel>
        ))}
      </div>
    </div>
  );
}
