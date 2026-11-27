import "server-only";
import type { Binary, ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Dokumentumsablonok (Word). A fájlok az adatbázisban vannak (a repó nyilvános, oda nem kerülhetnek),
 * és csak bejelentkezve, naplózva tölthetők le. Feltöltés: scripts/upload-document.mjs.
 */
export type DocumentFile = {
  _id: ObjectId;
  /** Az URL-ben használt rövid név, pl. `szerzodes`. */
  slug: string;
  title: string;
  description: string;
  fileName: string;
  contentType: string;
  size: number;
  data: Binary;
  /** Sorrend a felületen. */
  order: number;
  uploadedAt: Date;
};

export const documentsCol = async () => (await getDb()).collection<DocumentFile>("documents");

/** A listához: minden, kivéve magát a fájlt. */
export async function listDocuments() {
  return (await documentsCol()).find({}, { projection: { data: 0 } }).sort({ order: 1, title: 1 }).toArray();
}

export async function getDocument(slug: string) {
  return (await documentsCol()).findOne({ slug: String(slug).slice(0, 60) });
}
