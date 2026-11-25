"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cellString, computeSummary, parseCell, type Mark } from "@/lib/client-fields";
import { clientName, clientsCol, getClient, type ClientColumn } from "@/lib/clients";
import type { FormState } from "@/lib/form";
import { writeLog, type Change } from "@/lib/log";
import { requireUser } from "@/lib/session";

const MARK_LABEL: Record<string, string> = { "": "nincs", sarga: "sárga háttér", piros: "piros betű" };

/**
 * Egy ügyfél összes mezőjének mentése. Minden megváltozott mező (és kiemelés) a régi és az új értékkel együtt
 * a naplóba kerül. Ha közben valaki más is mentett, a mentés nem írja felül – újratöltést kér.
 */
export async function updateClient(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const client = await getClient(String(formData.get("id") ?? ""));
  if (!client) return { error: "Az ügyfél nem található." };

  const version = String(formData.get("version") ?? "");
  const current = (client.updatedAt ?? client.source.importedAt).toISOString();
  if (version !== current) {
    return { error: "Az adatlapot közben valaki más módosította. Töltsd újra az oldalt (a módosításai a naplóban látszanak), és vidd fel újra a változtatásaidat." };
  }

  const changes: Change[] = [];
  const problems: string[] = [];
  const cols: ClientColumn[] = client.cols.map((column) => {
    const input = formData.get(`v_${column.col}`);
    const markInput = formData.get(`m_${column.col}`);
    let next: ClientColumn = column;

    if (typeof input === "string") {
      const parsed = parseCell(column.col, input);
      if ("error" in parsed) {
        problems.push(`${column.label}: ${parsed.error}`);
      } else if (String(parsed.value ?? "") !== String(column.value ?? "")) {
        changes.push({ field: column.label, from: cellString(column.col, column.value), to: cellString(column.col, parsed.value) });
        // A kézi szerkesztés után az import eredeti (javítás előtti) értéke már nem releváns.
        const { raw: _raw, ...rest } = column;
        void _raw;
        next = { ...rest, value: parsed.value };
      }
    }
    if (typeof markInput === "string") {
      const mark = markInput === "sarga" || markInput === "piros" ? (markInput as Mark) : undefined;
      if ((column.mark ?? "") !== (mark ?? "")) {
        changes.push({ field: `${column.label} – kiemelés`, from: MARK_LABEL[column.mark ?? ""], to: MARK_LABEL[mark ?? ""] });
        const { mark: _mark, ...rest } = next;
        void _mark;
        next = mark ? { ...rest, mark } : rest;
      }
    }
    return next;
  });

  if (problems.length) return { error: `Nem menthető: ${problems.join("; ")}.` };
  if (!changes.length) return { ok: true, message: "Nem volt változás." };

  const { summary, search } = computeSummary(client.key, cols);
  const now = new Date();
  const updated = await (await clientsCol()).updateOne(
    { _id: client._id, ...(client.updatedAt ? { updatedAt: client.updatedAt } : { updatedAt: { $exists: false } }) },
    { $set: { cols, summary, search, status: summary.status, updatedAt: now, updatedBy: user.oid } },
  );
  if (!updated.modifiedCount) {
    return { error: "Az adatlapot közben valaki más módosította. Töltsd újra az oldalt, és vidd fel újra a változtatásaidat." };
  }

  const name = clientName({ cols, key: client.key });
  await writeLog(user, {
    kind: "client",
    action: "client.update",
    text: `szerkesztette a(z) „${name}” ügyfél adatait: ${changes.map((change) => change.field).join(", ")}`,
    target: { type: "client", id: String(client._id), label: name },
    changes,
  });
  revalidatePath("/", "layout");
  redirect(`/ugyfelek/${client._id}?mentve=${changes.length}`);
}
