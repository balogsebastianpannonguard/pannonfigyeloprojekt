import { getDocument } from "@/lib/documents";
import { writeLog } from "@/lib/log";
import { requireUser } from "@/lib/session";

/** Egy dokumentumsablon kiszolgálása: `?letoltes=1` esetén letöltésként, egyébként az előnézetnek. Mindkettő naplózódik. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const document = await getDocument((await params).slug);
  if (!document) return new Response("A dokumentum nem található.", { status: 404 });
  const search = new URL(request.url).searchParams;
  const download = search.get("letoltes") === "1";
  const pdf = !download && search.get("pdf") === "1" && document.pdf;
  await writeLog(user, {
    kind: "export",
    action: download ? "document.download" : "document.preview",
    text: `${download ? "letöltötte" : "megnyitotta az előnézetét"}: „${document.title}” (${document.fileName})`,
    target: { type: "document", id: document.slug, label: document.title },
  });
  const body = pdf ? document.pdf!.buffer : document.data.buffer;
  const fileName = pdf ? document.fileName.replace(/\.docx$/i, ".pdf") : document.fileName;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : document.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
