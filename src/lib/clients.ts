import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { oid } from "@/lib/workspace";

/**
 * Az ügyféllistából (Excel) importált ügyfél. Az oszlopok szó szerint, a fejlécükkel és az Excel-beli
 * kiemelésükkel (piros betű / sárga háttér) együtt tárolódnak, így a felület a teljes sort meg tudja mutatni.
 */
export type ClientColumn = { col: string; label: string; value: string | number | null; mark?: "piros" | "sarga" };

export type ClientDocument = {
  _id: ObjectId;
  /** Vevőkód (Laci listája) – az import egyedi kulcsa. */
  key: string;
  status: string;
  order: number;
  cols: ClientColumn[];
  source: { file: string; sheet: string; row: number; importedAt: Date };
};

export const clientsCol = async () => (await getDb()).collection<ClientDocument>("clients");

export async function listClients() {
  return (await clientsCol()).find({}).sort({ order: 1 }).toArray();
}

export async function getClient(id: string) {
  const key = oid(id);
  return key ? (await clientsCol()).findOne({ _id: key }) : null;
}

/** Egy oszlop értéke az oszlop betűjele alapján (pl. `C` = Hivatalos név). */
export function cell(client: Pick<ClientDocument, "cols">, col: string) {
  return client.cols.find((column) => column.col === col);
}

export function cellText(client: Pick<ClientDocument, "cols">, col: string) {
  const value = cell(client, col)?.value;
  return value === null || value === undefined || value === "" ? "" : String(value);
}

/** A megjelenítendő név: hivatalos név, ha nincs, a vevőkód. */
export const clientName = (client: Pick<ClientDocument, "cols" | "key">) => cellText(client, "C") || client.key;
