import "server-only";
import { clientLetterFields, type ClientDocument } from "@/lib/clients";
import { generateContract, generateLetter } from "@/lib/doc-generate";
import { getDocument } from "@/lib/documents";

export const CLIENT_DOCS = {
  "ertesito-level": { label: "Értesítő levél" },
  szerzodes: { label: "Távfelügyeleti szolgáltatási szerződés" },
} as const;
export type ClientDocKey = keyof typeof CLIENT_DOCS;
export const isClientDocKey = (key: unknown): key is ClientDocKey => typeof key === "string" && key in CLIENT_DOCS;

/** Az ügyfél adataival kitöltött dokumentum (.docx). */
export async function buildClientDocument(client: ClientDocument, key: ClientDocKey) {
  const template = await getDocument(key);
  if (!template) return null;
  const fields = clientLetterFields(client);
  // Az értesítő levélre a 2026-19/… iktatószám, a szerződésre a T.SZ.SZ. (2027/1/…) iktatószám kerül.
  const filing = key === "ertesito-level" ? fields.filing : fields.contractFiling;
  const source = Buffer.from(template.data.buffer);
  const file = key === "ertesito-level" ? await generateLetter(source, fields) : await generateContract(source, fields.contractFiling);
  const fileName = `${filing.replaceAll("/", "_")} ${CLIENT_DOCS[key].label} – ${fields.name}`.replace(/[\\/:*?"<>|]/g, "-");
  return { file, filing, fields, fileName };
}
