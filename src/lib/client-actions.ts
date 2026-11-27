"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CLIENT_CHECKS, cellString, computeSummary, parseCell, type Mark } from "@/lib/client-fields";
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

  // Saját sorszám: ha foglalt, a két ügyfél helyet cserél.
  const collection = await clientsCol();
  const seqInput = String(formData.get("seq") ?? "").trim();
  let seq = client.seq;
  let swapWith: { _id: typeof client._id; name: string } | null = null;
  if (seqInput && Number(seqInput) !== client.seq) {
    const total = await collection.countDocuments();
    const wanted = Number(seqInput);
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > total) {
      problems.push(`Sorszám: 1 és ${total} közötti egész szám lehet`);
    } else {
      seq = wanted;
      const other = await collection.findOne({ seq: wanted, _id: { $ne: client._id } }, { projection: { cols: 1, key: 1 } });
      if (other) swapWith = { _id: other._id, name: clientName(other) };
      changes.unshift({ field: "Sorszám", from: String(client.seq ?? ""), to: swapWith ? `${wanted} (helycsere: „${swapWith.name}” → ${client.seq})` : String(wanted) });
    }
  }

  if (problems.length) return { error: `Nem menthető: ${problems.join("; ")}.` };
  if (!changes.length) return { ok: true, message: "Nem volt változás." };

  const { summary, search } = computeSummary(client.key, cols);
  const now = new Date();
  const updated = await collection.updateOne(
    { _id: client._id, ...(client.updatedAt ? { updatedAt: client.updatedAt } : { updatedAt: { $exists: false } }) },
    { $set: { cols, summary, search, status: summary.status, seq, updatedAt: now, updatedBy: user.oid } },
  );
  if (!updated.modifiedCount) {
    return { error: "Az adatlapot közben valaki más módosította. Töltsd újra az oldalt, és vidd fel újra a változtatásaidat." };
  }

  if (updated.modifiedCount && swapWith) await collection.updateOne({ _id: swapWith._id }, { $set: { seq: client.seq } });

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

/**
 * A lista végén lévő jelölőnégyzet be- vagy kipipálása. Nem érinti az ügyfél adatait (és a szerkesztés
 * ütközésfigyelését sem), de ki mikor pipálta, az a naplóba kerül.
 */
export async function setClientCheck(id: string, key: string, on: boolean): Promise<{ error?: string }> {
  const user = await requireUser();
  const check = CLIENT_CHECKS.find((item) => item.key === key);
  if (!check || typeof on !== "boolean") return { error: "Ismeretlen jelölőnégyzet." };
  const client = await getClient(String(id));
  if (!client) return { error: "Az ügyfél nem található." };
  if (Boolean(client.checks?.[check.key]?.on) === on) return {};

  await (await clientsCol()).updateOne({ _id: client._id }, { $set: { [`checks.${check.key}`]: { on, at: new Date(), by: user.oid } } });
  const name = clientName(client);
  await writeLog(user, {
    kind: "client",
    action: "client.check",
    text: `${on ? "bepipálta" : "kivette a pipát"}: „${check.label}” – „${name}” ügyfél`,
    target: { type: "client", id: String(client._id), label: name },
    changes: [{ field: check.label, from: on ? "üres" : "pipa", to: on ? "pipa" : "üres" }],
  });
  revalidatePath("/ugyfelek");
  return {};
}

const PRINT_DOCS = { "ertesito-level": "Értesítő levél", szerzodes: "Távfelügyeleti szolgáltatási szerződés" } as const;

/** Nyomtatás jelölése (a Nyomtatás gomb hívja): az ügyfél sora zöld lesz. Naplózva. */
export async function markPrinted(id: string, dok: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(dok in PRINT_DOCS)) return { error: "Ismeretlen dokumentum." };
  const client = await getClient(String(id));
  if (!client) return { error: "Az ügyfél nem található." };
  const label = PRINT_DOCS[dok as keyof typeof PRINT_DOCS];
  await (await clientsCol()).updateOne({ _id: client._id }, { $set: { [`printed.${dok}`]: { at: new Date(), by: user.oid, byName: user.name } } });
  const name = clientName(client);
  await writeLog(user, {
    kind: "client",
    action: "client.print",
    text: `kinyomtatta: ${label} – „${name}” ügyfél`,
    target: { type: "client", id: String(client._id), label: name },
  });
  revalidatePath("/ugyfel-dokumentumok");
  return {};
}

/** Nyomtatás jelölésének visszavonása (pl. ha a nyomtatás mégsem történt meg). Naplózva. */
export async function clearPrinted(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const client = await getClient(String(id));
  if (!client) return { error: "Az ügyfél nem található." };
  if (!client.printed || !Object.keys(client.printed).length) return {};
  await (await clientsCol()).updateOne({ _id: client._id }, { $unset: { printed: "" } });
  const name = clientName(client);
  await writeLog(user, {
    kind: "client",
    action: "client.print.undo",
    text: `visszavonta a nyomtatás jelölését – „${name}” ügyfél`,
    target: { type: "client", id: String(client._id), label: name },
  });
  revalidatePath("/ugyfel-dokumentumok");
  return {};
}
