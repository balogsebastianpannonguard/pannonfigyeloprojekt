import { assignFilingNumbers, getClient } from "@/lib/clients";
import { CLIENT_DOCS, buildClientDocument, isClientDocKey } from "@/lib/client-docs";
import { TemplateError } from "@/lib/doc-generate";
import { writeLog } from "@/lib/log";
import { requireUser } from "@/lib/session";

/**
 * Próba generálás: a sablon az adott ügyfél adataival kitöltve.
 *   ?dok=ertesito-level|szerzodes            – .docx (előnézet)
 *   &letoltes=1                              – .docx letöltése
 *   &nyomtatas=1                             – .docx letöltése nyomtatáshoz (Wordből)
 * Az éles generálás egyelőre zárolva van; a letöltés naplózódik.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const search = new URL(request.url).searchParams;
  const key = search.get("dok");
  if (!isClientDocKey(key)) return new Response("Ismeretlen dokumentum.", { status: 400 });
  // A Nyomtatás gomb is letöltés: a kitöltött .docx-et Wordből nyomtatják (a böngésző nem nyomtatja pontosan).
  const forPrint = search.get("nyomtatas") === "1";
  const download = forPrint || search.get("letoltes") === "1";

  let client = await getClient((await params).id);
  if (!client) return new Response("Az ügyfél nem található.", { status: 404 });
  if (!client.filingNo || !client.contractFilingNo) {
    await assignFilingNumbers();
    client = await getClient(String(client._id));
    if (!client?.filingNo || !client.contractFilingNo) return new Response("Az ügyfélnek nincs iktatószáma.", { status: 409 });
  }

  let built: Awaited<ReturnType<typeof buildClientDocument>>;
  try {
    built = await buildClientDocument(client, key);
  } catch (error) {
    if (error instanceof TemplateError) return new Response(`A sablon nem tölthető ki: ${error.message}`, { status: 422 });
    throw error;
  }
  if (!built) return new Response("A sablon nincs feltöltve.", { status: 404 });
  const { fields, filing } = built;
  const target = { type: "client", id: String(client._id), label: fields.name };
  const log = (what: "előnézet" | "letöltés" | "letöltés nyomtatáshoz") =>
    writeLog(user, {
      kind: "export",
      action: what === "előnézet" ? "document.generate.preview" : "document.generate.download",
      text: `próba generálás (${what}): ${CLIENT_DOCS[key].label} – „${fields.name}” (iktatószám: ${filing})`,
      target,
    });

  await log(forPrint ? "letöltés nyomtatáshoz" : download ? "letöltés" : "előnézet");
  return new Response(new Uint8Array(built.file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(`${built.fileName}.docx`)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
