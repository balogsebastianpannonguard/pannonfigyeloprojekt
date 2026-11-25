import type { ReactNode } from "react";
import type { ClientColumn } from "@/lib/clients";

/** Forintos oszlopok (Mind munkalap): éves díj, tartozások. */
const MONEY = new Set(["K", "S", "T", "U", "Y"]);
const COUNT = new Set(["L", "M"]);

const ft = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });

/** Az Excel-érték olvasható formában; az üres cella „—”. */
export function formatValue(column: ClientColumn): ReactNode {
  const { value, col } = column;
  if (value === null || value === undefined || value === "") return <span className="text-white/25">—</span>;
  if (typeof value === "number" && MONEY.has(col)) return `${ft.format(value)} Ft`;
  if (typeof value === "number" && COUNT.has(col)) return `${value} db`;
  if (typeof value === "number" && col === "W") return `${value} nap`;
  const text = String(value);
  // Pontosvesszővel felsorolt szerződések és objektumcímek: soronként.
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
          <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-gold underline-offset-4 hover:underline">
            {phone}
          </a>
        ))}
      </span>
    );
  }
  if (col === "O" && text.includes("@")) {
    return (
      <a href={`mailto:${text}`} className="text-gold underline-offset-4 hover:underline">
        {text}
      </a>
    );
  }
  return text;
}

/** Egy mező az Excel-beli kiemeléssel: piros betű vagy sárga háttér, ahogy a táblázatban volt. */
export function ClientField({ column }: { column: ClientColumn }) {
  const marked = column.mark === "piros" ? "Az Excelben pirossal jelölve" : column.mark === "sarga" ? "Az Excelben sárgával kiemelve" : undefined;
  return (
    <div
      className={`grid gap-1 rounded-xl px-3 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4 ${
        column.mark === "sarga" ? "bg-yellow-300/10 ring-1 ring-yellow-300/30 ring-inset" : column.mark === "piros" ? "bg-red-500/8 ring-1 ring-red-400/25 ring-inset" : ""
      }`}
    >
      <dt className="text-sm text-white/50">
        {column.label}
        <span className="ml-1.5 font-mono text-[0.65rem] text-white/25">{column.col}</span>
      </dt>
      <dd className={`min-w-0 text-sm [overflow-wrap:anywhere] ${column.mark === "piros" ? "font-medium text-red-300" : "text-white/90"}`}>
        {formatValue(column)}
        {marked && <span className={`mt-1 block text-[0.7rem] ${column.mark === "piros" ? "text-red-300/70" : "text-yellow-200/70"}`}>{marked}</span>}
      </dd>
    </div>
  );
}
