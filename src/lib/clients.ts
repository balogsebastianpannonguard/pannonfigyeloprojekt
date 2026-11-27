import "server-only";
import type { Filter, ObjectId, Sort } from "mongodb";
import type { CheckKey, ColumnLike } from "@/lib/client-fields";
import { getDb } from "@/lib/mongodb";
import { oid } from "@/lib/workspace";

/**
 * Az ügyféllistából (Excel) importált ügyfél. Az oszlopok szó szerint, a fejlécükkel és az Excel-beli
 * kiemelésükkel (piros betű / sárga háttér) együtt tárolódnak, így a felület a teljes sort meg tudja mutatni.
 * Ha az import javított egy értéket (pl. összeragadt objektumazonosítók), az eredeti a `raw` mezőben marad.
 */
export type ClientColumn = ColumnLike;

/** A táblázathoz előre kiszámolt mezők (az importszkript tölti ki). */
export type ClientSummary = {
  name: string;
  status: string;
  zip: string;
  city: string;
  street: string;
  freq: string;
  fee: number | null;
  ids: string[];
  phone: string;
  contract: string;
  debt: number;
  marks: number;
  note: string;
};

export type ClientDocument = {
  _id: ObjectId;
  /** Vevőkód (Laci listája) – az import egyedi kulcsa. */
  key: string;
  status: string;
  order: number;
  /** Saját sorszám (1, 2, 3…), az Excel-sortól független; a szerkesztőben átírható. */
  seq: number;
  cols: ClientColumn[];
  summary: ClientSummary;
  /** Kisbetűs keresőszöveg (név, vevőkód, cím, azonosítók, telefon, megjegyzés). */
  search: string;
  source: { file: string; sheet: string; row: number; importedAt: Date };
  /** Iktatószám sorszáma (a kiírt alak: `2026-19/<n>`). Egyszer kiadva nem változik, akkor sem, ha a sorszám igen. */
  filingNo?: number;
  /** A lista végén lévő jelölőnégyzetek; ami nincs itt, az üres. Nem számít szerkesztésnek (az import nem nyúl hozzá). */
  checks?: Partial<Record<CheckKey, { on: boolean; at: Date; by: ObjectId }>>;
  /** Utolsó szerkesztés a felületen. */
  updatedAt?: Date;
  updatedBy?: ObjectId;
};

export const clientsCol = async () => (await getDb()).collection<ClientDocument>("clients");

export async function getClient(id: string) {
  const key = oid(id);
  return key ? (await clientsCol()).findOne({ _id: key }) : null;
}

/** A táblázat rendezhető oszlopai → adatbázismező. */
export const CLIENT_SORTS = {
  sor: "seq",
  nev: "summary.name",
  statusz: "status",
  telepules: "summary.city",
  szamlazas: "summary.freq",
  dij: "summary.fee",
  szerzodes: "summary.contract",
  tartozas: "summary.debt",
} as const;
export type ClientSort = keyof typeof CLIENT_SORTS;

export type ClientQuery = {
  q?: string;
  freq?: string;
  contract?: string;
  status?: string;
  marked?: boolean;
  /** Jelölőnégyzet-szűrő, pl. `{ key: "p1", on: true }`. */
  check?: { key: CheckKey; on: boolean };
  sort?: ClientSort;
  desc?: boolean;
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listClientRows(query: ClientQuery, { limit = 50, skip = 0 } = {}) {
  const collection = await clientsCol();
  const filter: Filter<ClientDocument> = {};
  if (query.q) {
    // Minden szónak szerepelnie kell (sorrendtől függetlenül).
    const words = query.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    if (words.length) filter.$and = words.map((word) => ({ search: { $regex: escape(word) } }));
  }
  if (query.freq) filter["summary.freq"] = query.freq;
  if (query.contract) filter["summary.contract"] = query.contract;
  if (query.status) filter.status = query.status;
  if (query.marked) filter["summary.marks"] = { $gt: 0 };
  if (query.check) filter[`checks.${query.check.key}.on`] = query.check.on ? true : { $ne: true };
  const field = CLIENT_SORTS[query.sort ?? "sor"] ?? "order";
  const sort: Sort = { [field]: query.desc ? -1 : 1, seq: 1 };

  const [rows, total, freqs, contracts, statuses] = await Promise.all([
    collection
      .find(filter, { projection: { key: 1, order: 1, seq: 1, summary: 1, cols: 1, checks: 1, "source.row": 1 } })
      .collation({ locale: "hu", numericOrdering: true })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
    collection.distinct("summary.freq"),
    collection.distinct("summary.contract"),
    collection.distinct("status"),
  ]);
  const clean = (values: unknown[]) => values.filter((value): value is string => typeof value === "string" && value !== "").sort((a, b) => a.localeCompare(b, "hu"));
  return { rows, total, options: { freqs: clean(freqs), contracts: clean(contracts), statuses: clean(statuses) } };
}

/** Összesítő a lista fölé (a teljes listára, szűrés nélkül). */
export async function clientStats() {
  const [stats] = await (await clientsCol())
    .aggregate<{ total: number; ok: number; fee: number; debtors: number; debt: number; marked: number; p1: number; p2: number }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          ok: { $sum: { $cond: [{ $eq: ["$status", "RENDBEN"] }, 1, 0] } },
          fee: { $sum: { $ifNull: ["$summary.fee", 0] } },
          debtors: { $sum: { $cond: [{ $gt: ["$summary.debt", 0] }, 1, 0] } },
          debt: { $sum: { $ifNull: ["$summary.debt", 0] } },
          marked: { $sum: { $cond: [{ $gt: ["$summary.marks", 0] }, 1, 0] } },
          p1: { $sum: { $cond: [{ $eq: ["$checks.p1.on", true] }, 1, 0] } },
          p2: { $sum: { $cond: [{ $eq: ["$checks.p2.on", true] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  return stats ?? { total: 0, ok: 0, fee: 0, debtors: 0, debt: 0, marked: 0, p1: 0, p2: 0 };
}

/** Az ügyfél-dokumentumok táblázatához: minden ügyfél a saját sorszám szerint, csak a szükséges mezőkkel. */
export async function listClientBasics() {
  await assignFilingNumbers();
  return (await clientsCol())
    .find({}, { projection: { key: 1, seq: 1, filingNo: 1, summary: 1, "cols.col": 1, "cols.value": 1 } })
    .sort({ seq: 1 })
    .limit(5000)
    .toArray();
}

/** Az iktatószám kiírt alakja. */
export const FILING_PREFIX = "2026-19/";
export const filingNumber = (n?: number) => (n ? `${FILING_PREFIX}${n}` : "");

/**
 * Akinek még nincs iktatószáma, a saját sorszám sorrendjében megkapja a következő szabadot (az első ügyfél 2026-19/1).
 * Feltételes írás: ha két kérés egyszerre futna, egy ügyfél akkor sem kap két számot.
 */
async function assignFilingNumbers() {
  const collection = await clientsCol();
  const missing = await collection.find({ filingNo: { $exists: false } }, { projection: { _id: 1 } }).sort({ seq: 1 }).toArray();
  if (!missing.length) return;
  let next = ((await collection.find({ filingNo: { $exists: true } }, { projection: { filingNo: 1 } }).sort({ filingNo: -1 }).limit(1).next())?.filingNo ?? 0) + 1;
  for (const { _id } of missing) {
    const result = await collection.updateOne({ _id, filingNo: { $exists: false } }, { $set: { filingNo: next } });
    if (result.modifiedCount) next += 1;
  }
}

/** Szerződésszámok a „Szerződések” (J) oszlopból: „SZE2604/1 – Féléves – …; PG24/000169 – …” → ["SZE2604/1", "PG24/000169"]. */
export function contractNumbers(cols: Pick<ClientColumn, "col" | "value">[]) {
  const value = cols.find((column) => column.col === "J")?.value;
  if (value === null || value === undefined || value === "") return [];
  return String(value)
    .split(";")
    .map((part) => part.split(/\s+[–-]\s+/)[0].trim())
    .filter(Boolean);
}

export async function clientSource() {
  return (await clientsCol()).findOne({}, { projection: { source: 1 }, sort: { "source.importedAt": -1 } });
}

/** A megjelenítendő név: hivatalos név, ha nincs, a vevőkód. */
export const clientName = (client: Pick<ClientDocument, "cols" | "key">) => {
  const value = client.cols.find((column) => column.col === "C")?.value;
  return value ? String(value) : client.key;
};
