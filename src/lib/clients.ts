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

export async function clientSource() {
  return (await clientsCol()).findOne({}, { projection: { source: 1 }, sort: { "source.importedAt": -1 } });
}

/** A megjelenítendő név: hivatalos név, ha nincs, a vevőkód. */
export const clientName = (client: Pick<ClientDocument, "cols" | "key">) => {
  const value = client.cols.find((column) => column.col === "C")?.value;
  return value ? String(value) : client.key;
};
