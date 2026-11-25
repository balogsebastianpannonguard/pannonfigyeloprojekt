import { formatStamp } from "@/lib/dates";
import { LOG_KINDS, listLog, writeLog } from "@/lib/log";
import { requireUser } from "@/lib/session";

const cell = (value: string) => `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

/** A szűrt napló letöltése CSV-ben (Excelben is megnyitható). Maga a letöltés is naplózódik. */
export async function GET(request: Request) {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const query = {
    userId: params.get("szemely") ?? "",
    kind: params.get("tipus") ?? "",
    q: (params.get("q") ?? "").slice(0, 80),
    day: params.get("nap") ?? "",
    views: params.get("megnyitasok") !== "nem",
  };
  const { rows } = await listLog(query, { limit: 20_000 });
  const header = ["Időpont", "Személy", "E-mail", "Típus", "Esemény", "Változások", "Eszköz", "IP-cím"];
  const lines = rows.map((entry) =>
    [
      formatStamp(entry.at),
      entry.userName,
      entry.email,
      LOG_KINDS[entry.kind] ?? entry.kind,
      entry.text,
      (entry.changes ?? []).map((change) => `${change.field}: ${change.from} → ${change.to}`).join(" | "),
      entry.device,
      entry.ip,
    ]
      .map(cell)
      .join(";"),
  );
  await writeLog(user, { kind: "export", action: "log.export", text: `letöltötte a naplót (${rows.length} bejegyzés)` });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pannon-figyelo-naplo-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
