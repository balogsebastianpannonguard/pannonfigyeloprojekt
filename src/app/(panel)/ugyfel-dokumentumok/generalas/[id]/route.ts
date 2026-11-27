import { assignFilingNumbers, clientLetterFields, getClient } from "@/lib/clients";
import { TemplateError, generateContract, generateLetter } from "@/lib/doc-generate";
import { getDocument } from "@/lib/documents";
import { writeLog } from "@/lib/log";
import { requireUser } from "@/lib/session";

const DOCS = {
  "ertesito-level": { label: "Értesítő levél" },
  szerzodes: { label: "Távfelügyeleti szolgáltatási szerződés" },
} as const;
type DocKey = keyof typeof DOCS;

/**
 * Próba generálás: a sablon az adott ügyfél adataival kitöltve, .docx-ként (előnézethez vagy `?letoltes=1`-gyel letöltéshez).
 * Az éles generálás egyelőre zárolva van; minden próba generálás naplózódik.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const search = new URL(request.url).searchParams;
  const key = search.get("dok") as DocKey;
  if (!(key in DOCS)) return new Response("Ismeretlen dokumentum.", { status: 400 });
  const download = search.get("letoltes") === "1";

  let client = await getClient((await params).id);
  if (!client) return new Response("Az ügyfél nem található.", { status: 404 });
  if (!client.filingNo || !client.contractFilingNo) {
    await assignFilingNumbers();
    client = await getClient(String(client._id));
    if (!client?.filingNo || !client.contractFilingNo) return new Response("Az ügyfélnek nincs iktatószáma.", { status: 409 });
  }
  const template = await getDocument(key);
  if (!template) return new Response("A sablon nincs feltöltve.", { status: 404 });

  const fields = clientLetterFields(client);
  // Az értesítő levélre a 2026-19/… iktatószám, a szerződésre a T.SZ.SZ. (2027/1/…) iktatószám kerül.
  const filing = key === "ertesito-level" ? fields.filing : fields.contractFiling;
  let file: Buffer;
  try {
    const source = Buffer.from(template.data.buffer);
    file = key === "ertesito-level" ? await generateLetter(source, fields) : await generateContract(source, fields.contractFiling);
  } catch (error) {
    if (error instanceof TemplateError) return new Response(`A sablon nem tölthető ki: ${error.message}`, { status: 422 });
    throw error;
  }

  await writeLog(user, {
    kind: "export",
    action: download ? "document.generate.download" : "document.generate.preview",
    text: `próba generálás (${download ? "letöltés" : "előnézet"}): ${DOCS[key].label} – „${fields.name}” (iktatószám: ${filing})`,
    target: { type: "client", id: String(client._id), label: fields.name },
  });
  const fileName = `${filing.replaceAll("/", "_")} ${DOCS[key].label} – ${fields.name}.docx`.replace(/[\\/:*?"<>|]/g, "-");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
