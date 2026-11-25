import "server-only";
import { headers } from "next/headers";
import { ObjectId, type Filter } from "mongodb";
import { addDays, budapestTime } from "@/lib/dates";
import { getDb } from "@/lib/mongodb";

/**
 * A közös napló: minden belépés, oldalmegnyitás és művelet ide kerül, a végrehajtó nevével, idővel, IP-címmel és
 * eszközzel. A napló csak bővül; a felületen nincs olyan művelet, amely törölne vagy módosítana benne.
 */
export type LogKind = "auth" | "view" | "task" | "comment" | "post" | "note" | "export";

export const LOG_KINDS: Record<LogKind, string> = {
  auth: "Belépés, fiók",
  view: "Oldalmegnyitás",
  task: "Feladat",
  comment: "Hozzászólás",
  post: "Üzenőfal",
  note: "Jegyzet",
  export: "Exportálás",
};

export type Change = { field: string; from: string; to: string };

export type LogEntry = {
  _id: ObjectId;
  at: Date;
  kind: LogKind;
  /** Gépi kód, pl. `task.update`. */
  action: string;
  /** Emberi mondat, pl. „áthelyezte a(z) X feladatot: Teendő → Folyamatban”. */
  text: string;
  userId?: ObjectId;
  userName: string;
  email: string;
  target?: { type: string; id: string; label: string };
  changes?: Change[];
  path?: string;
  ip: string;
  device: string;
};

export const logCol = async () => (await getDb()).collection<LogEntry>("log");

/** Rövid, olvasható eszköznév a böngésző azonosítójából. */
function deviceName(userAgent: string) {
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "ismeretlen rendszer";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "böngésző";
  return `${browser} · ${os}`;
}

export type Actor = { oid?: ObjectId; name: string; email: string };

export async function writeLog(
  actor: Actor,
  entry: { kind: LogKind; action: string; text: string; target?: LogEntry["target"]; changes?: Change[]; path?: string },
) {
  try {
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 64) ?? "ismeretlen";
    const now = new Date();
    await (await logCol()).insertOne({
      _id: new ObjectId(),
      at: now,
      kind: entry.kind,
      action: entry.action,
      text: entry.text.slice(0, 500),
      ...(actor.oid && { userId: actor.oid }),
      userName: actor.name.slice(0, 120),
      email: actor.email.slice(0, 160),
      ...(entry.target && { target: { ...entry.target, label: entry.target.label.slice(0, 200) } }),
      ...(entry.changes?.length && { changes: entry.changes.map((c) => ({ field: c.field, from: c.from.slice(0, 300), to: c.to.slice(0, 300) })) }),
      ...(entry.path && { path: entry.path.slice(0, 300) }),
      ip,
      device: deviceName(requestHeaders.get("user-agent") ?? ""),
    });
    if (actor.oid) {
      void (await getDb()).collection("users").updateOne({ _id: actor.oid }, { $set: { lastSeenAt: now } }).catch(() => undefined);
    }
  } catch (error) {
    // A naplózás hibája nem akaszthat meg egy műveletet sem.
    console.error("Naplózási hiba:", (error as Error).name);
  }
}

export type LogQuery = { userId?: string; kind?: string; q?: string; day?: string; views?: boolean; targetId?: string };

export function logFilter(query: LogQuery): Filter<LogEntry> {
  const filter: Filter<LogEntry> = {};
  if (query.userId && ObjectId.isValid(query.userId)) filter.userId = new ObjectId(query.userId);
  if (query.kind && query.kind in LOG_KINDS) filter.kind = query.kind as LogKind;
  else if (query.views === false) filter.kind = { $ne: "view" };
  if (query.targetId) filter["target.id"] = query.targetId;
  if (query.q) {
    const pattern = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80), "i");
    filter.$or = [{ text: pattern }, { userName: pattern }, { "target.label": pattern }];
  }
  if (query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day)) {
    filter.at = { $gte: budapestTime(query.day, "00:00"), $lt: budapestTime(addDays(query.day, 1), "00:00") };
  }
  return filter;
}

export async function listLog(query: LogQuery, { limit = 100, skip = 0 } = {}) {
  const collection = await logCol();
  const filter = logFilter(query);
  const [rows, total] = await Promise.all([
    collection.find(filter).sort({ at: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);
  return { rows, total };
}
