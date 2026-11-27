/**
 * Az ügyféllista („Mind” munkalap) oszlopainak leírása – kliensen és szerveren is használható, tiszta függvények.
 * Az importszkript (scripts/import-clients.mjs) ugyanezt az összegzést számolja; ha itt változik, ott is kell.
 */

export type Mark = "piros" | "sarga";
export type CellValue = string | number | null;
export type ColumnLike = { col: string; label: string; value: CellValue; mark?: Mark; raw?: CellValue };

/**
 * A lista végén lévő két jelölőnégyzet (alapból mindkettő üres). A felirat itt egy helyen átírható;
 * a kulcs (`p1`, `p2`) az adatbázisban marad, így átnevezéskor a meglévő pipák megmaradnak.
 */
export const CLIENT_CHECKS = [
  { key: "p1", label: "1. pipa" },
  { key: "p2", label: "2. pipa" },
] as const;
export type CheckKey = (typeof CLIENT_CHECKS)[number]["key"];

/** Forintos oszlopok. */
export const MONEY_COLS = new Set(["K", "S", "T", "U", "Y"]);
/** Darabszám-oszlopok. */
export const COUNT_COLS = new Set(["L", "M"]);
/** Minden számként tárolt oszlop (szerkesztéskor számmá alakítjuk). */
export const NUMBER_COLS = new Set([...MONEY_COLS, ...COUNT_COLS, "W"]);
/** Hosszabb szövegek: szerkesztéskor többsoros mező, a táblázatban levágva. */
export const LONG_COLS = new Set(["J", "Q", "R", "X", "Z", "N", "H"]);

/** Az adatlap és az előnézet témái (oszlopbetűk). A fel nem sorolt oszlopok az „Egyéb” részbe kerülnek. */
export const SECTIONS: { title: string; icon: "building" | "contract" | "radar" | "phone" | "money" | "note"; cols: string[] }[] = [
  { title: "Alapadatok", icon: "building", cols: ["A", "B", "C", "D", "E", "F", "G", "H"] },
  { title: "Szerződés és számlázás", icon: "contract", cols: ["I", "J", "K", "AA"] },
  { title: "Objektumok és felügyelet", icon: "radar", cols: ["L", "M", "N", "Q", "R"] },
  { title: "Kapcsolattartás", icon: "phone", cols: ["O", "P"] },
  { title: "Fizetési helyzet", icon: "money", cols: ["S", "T", "U", "V", "W", "X", "Y"] },
  { title: "Megjegyzés", icon: "note", cols: ["Z"] },
];

const ft = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });

/** Egy cella szöveges alakja (a táblázathoz és a naplóhoz). */
export function cellString(col: string, value: CellValue) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && MONEY_COLS.has(col)) return `${ft.format(value)} Ft`;
  if (typeof value === "number" && COUNT_COLS.has(col)) return `${value} db`;
  if (typeof value === "number" && col === "W") return `${value} nap`;
  return String(value);
}

/** Szerkesztett érték értelmezése: számoszlopnál szám (szóközök, „Ft” nélkül), máshol szöveg; üres → null. */
export function parseCell(col: string, input: string): { value: CellValue } | { error: string } {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (text === "") return { value: null };
  if (NUMBER_COLS.has(col)) {
    const normalized = text.replace(/\s|ft|db|nap/gi, "").replace(",", ".");
    const number = Number(normalized);
    if (!Number.isFinite(number)) return { error: "számot kell megadni" };
    return { value: number };
  }
  return { value: text };
}

/** Az azonosítólista elemei: vessző mentén, a megjegyzések (pl. „(tűzjelző)”) az elemen maradnak. */
export const idList = (value: CellValue) =>
  value === null || value === undefined || value === ""
    ? []
    : String(value)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

export function computeSummary(key: string, cols: ColumnLike[]) {
  const value = (col: string) => cols.find((c) => c.col === col)?.value;
  const text = (col: string) => {
    const v = value(col);
    return v === null || v === undefined ? "" : String(v).trim();
  };
  const name = text("C") || key;
  const summary = {
    name,
    status: text("A"),
    zip: text("E"),
    city: text("F"),
    street: text("G"),
    freq: text("I"),
    fee: typeof value("K") === "number" ? (value("K") as number) : null,
    ids: idList(value("N") ?? null),
    phone: text("P"),
    contract: text("AA"),
    debt: typeof value("S") === "number" ? (value("S") as number) : 0,
    marks: cols.filter((c) => c.mark).length,
    note: text("Z"),
  };
  const search = [name, key, ...["B", "D", "E", "F", "G", "H", "N", "O", "P", "Q", "R", "Z"].map(text)].join(" ").toLowerCase();
  return { summary, search };
}
