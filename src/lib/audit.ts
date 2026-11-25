import "server-only";
import type { ObjectId } from "mongodb";
import { writeLog } from "@/lib/log";

export type AuditEvent =
  | "register"
  | "login.success"
  | "login.failure"
  | "login.locked"
  | "logout"
  | "logout.all"
  | "password.reset";

const TEXT: Record<AuditEvent, string> = {
  register: "regisztrált és csatlakozott a projekthez",
  "login.success": "belépett",
  "login.failure": "sikertelen belépési kísérlet (hibás jelszó vagy cím)",
  "login.locked": "túl sok belépési kísérlet, ideiglenesen zárolva",
  logout: "kijelentkezett",
  "logout.all": "minden eszközén kijelentkezett",
  "password.reset": "új jelszót állított be",
};

/** A fiókkal kapcsolatos események is a közös naplóba kerülnek. */
export async function recordAudit(event: AuditEvent, email: string, userId?: ObjectId, name?: string) {
  await writeLog({ oid: userId, name: name ?? email, email }, { kind: "auth", action: event, text: TEXT[event] });
}
