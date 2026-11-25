import type { ReactNode } from "react";
import type { ClientColumn } from "@/lib/clients";

/** Forintos oszlopok (Mind munkalap): éves díj, tartozások. */
const MONEY = new Set(["K", "S", "T", "U", "Y"]);
const COUNT = new Set(["L", "M"]);

const ft = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });

/** Objektumazonosítók külön címkékként; a megjegyzés (pl. „(tűzjelző)”) halványabban az azonosító mellett. */
export function IdChips({ ids, max }: { ids: string[]; max?: number }) {
  if (!ids.length) return <span className="text-white/25">—</span>;
  const shown = max ? ids.slice(0, max) : ids;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((id, index) => {
        const match = id.match(/^(\d{4})\s*(.*)$/);
        return (
          <span
            key={`${id}-${index}`}
            className="inline-flex items-baseline gap-1 rounded-md bg-gold/10 px-1.5 py-0.5 font-mono text-xs text-gold-bright ring-1 ring-gold/20 ring-inset"
          >
            {match ? match[1] : id}
            {match?.[2] && (
              <span className="font-sans text-[0.65rem] text-white/50">
                {match[2]}
              </span>
            )}
          </span>
        );
      })}
      {max && ids.length > max && (
        <span className="self-center text-xs text-white/45">
          +{ids.length - max}
        </span>
      )}
    </span>
  );
}

/** Az Excel-érték olvasható formában; az üres cella „—”. */
export function formatValue(column: ClientColumn): ReactNode {
  const { value, col } = column;
  if (value === null || value === undefined || value === "")
    return <span className="text-white/25">—</span>;
  if (typeof value === "number" && MONEY.has(col))
    return `${ft.format(value)} Ft`;
  if (typeof value === "number" && COUNT.has(col)) return `${value} db`;
  if (typeof value === "number" && col === "W") return `${value} nap`;
  const text = String(value);
  if (col === "N") {
    return (
      <IdChips
        ids={text
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)}
      />
    );
  }
  // Pontosvesszővel felsorolt szerződések, objektumcímek, időszakok: soronként.
  if ((col === "J" || col === "R" || col === "X") && text.includes(";")) {
    return (
      <ul className="space-y-1">
        {text.split(";").map((part, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-gold/60">•</span>
            {part.trim()}
          </li>
        ))}
      </ul>
    );
  }
  // Telefonszám(ok): kattintható.
  if (col === "P") {
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {text.split(/,\s*/).map((phone) => (
          <a
            key={phone}
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="text-gold underline-offset-4 hover:underline"
          >
            {phone}
          </a>
        ))}
      </span>
    );
  }
  if (col === "O" && text.includes("@")) {
    return (
      <a
        href={`mailto:${text}`}
        className="text-gold underline-offset-4 hover:underline"
      >
        {text}
      </a>
    );
  }
  return text;
}

/** Egy mező az Excel-beli kiemeléssel: piros betű vagy sárga háttér, ahogy a táblázatban volt. */
export function ClientField({ column }: { column: ClientColumn }) {
  const marked =
    column.mark === "piros"
      ? "Az Excelben pirossal jelölve"
      : column.mark === "sarga"
        ? "Az Excelben sárgával kiemelve"
        : undefined;
  const corrected =
    column.raw !== undefined &&
    column.raw !== null &&
    String(column.raw) !== String(column.value);
  return (
    <div
      title={marked}
      className={`grid gap-1 rounded-xl px-3 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4 ${
        column.mark === "sarga"
          ? "bg-yellow-300/12 ring-1 ring-yellow-300/35 ring-inset"
          : column.mark === "piros"
            ? "ring-1 ring-red-400/30 ring-inset"
            : ""
      }`}
    >
      <dt className="text-sm text-white/50">
        {column.label}
        <span className="ml-1.5 font-mono text-[0.65rem] text-white/25">
          {column.col}
        </span>
      </dt>
      <dd
        className={`min-w-0 text-sm [overflow-wrap:anywhere] ${column.mark === "piros" ? "font-medium text-red-300" : "text-white/90"}`}
      >
        {formatValue(column)}
        {corrected && (
          <span className="mt-1 block text-[0.7rem] text-white/40">
            Szétválasztva – az Excelben így állt:{" "}
            <span className="font-mono text-white/60">
              {String(column.raw)}
            </span>
          </span>
        )}
      </dd>
    </div>
  );
}

/** Táblázatcella: rövidítve (a teljes szöveg az egér alatt), az Excel-kiemeléssel – sárga háttér, piros betű. */
export function TableCell({
  column,
  wide = false,
}: {
  column?: ClientColumn;
  wide?: boolean;
}) {
  if (!column) return <td className="px-3 py-2.5 text-white/20">—</td>;
  const tone =
    column.mark === "sarga"
      ? "bg-yellow-300/12 shadow-[inset_0_0_0_1px_rgb(253_224_71/0.18)]"
      : "";
  const text =
    column.mark === "piros" ? "font-medium text-red-300" : "text-white/80";
  const empty =
    column.value === null || column.value === undefined || column.value === "";
  const numeric = typeof column.value === "number";
  const title =
    column.mark === "piros"
      ? "Az Excelben pirossal jelölve"
      : column.mark === "sarga"
        ? "Az Excelben sárgával kiemelve"
        : undefined;
  return (
    <td
      title={title}
      className={`px-3 py-2.5 align-top ${tone} ${numeric ? "text-right whitespace-nowrap tabular-nums" : ""}`}
    >
      {empty ? (
        <span className="text-white/20">—</span>
      ) : column.col === "N" ? (
        <IdChips
          ids={String(column.value)
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)}
          max={4}
        />
      ) : (
        <span
          className={`block ${wide ? "w-72" : "max-w-56"} line-clamp-2 [overflow-wrap:anywhere] ${text}`}
          title={numeric ? undefined : String(column.value)}
        >
          {numeric ? formatValue(column) : String(column.value)}
        </span>
      )}
    </td>
  );
}
