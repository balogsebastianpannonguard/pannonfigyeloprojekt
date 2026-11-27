import "server-only";
import type { ObjectId } from "mongodb";
import { formatShortDate } from "@/lib/dates";
import { MAIL_LOGO_BASE64 } from "@/lib/mail-logo";
import { mailAvailable, sendMail } from "@/lib/mail";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/meta";
import { buildTaskMail } from "@/lib/task-mail-template";
import { users } from "@/lib/users";
import type { TaskDocument } from "@/lib/workspace";

/** Az alkalmazás nyilvános címe a levélben szereplő linkekhez. */
export function appBaseUrl() {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3010";
}

/** Minden értesítést a projekt gazdája küld ki, a saját postafiókjából és nevében. */
const senderName = () => process.env.EMAIL_SIGNATURE_NAME || "Balog Sebastian Máté";

type Actor = { oid: ObjectId; name: string };
type Person = { _id: ObjectId; name: string; email: string };

/**
 * Értesítés a feladat két érintettjének – aki a feladatot adta (létrehozó) és aki kapta (felelős) –, mindkettőjüknek
 * a saját szemszögéből megírva („Bali Emese → Török Krisztián”). Visszaadja, kinek ment el és kinek nem (a naplóhoz).
 */
export async function notifyTask({ kind, task, actor, comment }: { kind: "assigned" | "comment"; task: TaskDocument; actor: Actor; comment?: string }) {
  if (!mailAvailable()) return { sent: [] as string[], failed: [] as string[] };
  const ids = [task.createdBy, task.assigneeId, actor.oid].filter((id): id is ObjectId => Boolean(id));
  const people = new Map(
    (await (await users()).find({ _id: { $in: ids } }, { projection: { name: 1, email: 1, disabledAt: 1 } }).toArray()).map((u) => [String(u._id), u]),
  );
  const creator = people.get(String(task.createdBy));
  const assignee = task.assigneeId ? people.get(String(task.assigneeId)) : undefined;
  const parties = [creator, assignee].filter((p, i, all): p is NonNullable<typeof p> => Boolean(p) && all.findIndex((q) => q && p && String(q._id) === String(p._id)) === i);

  // Akinek szól: feladatadásnál a felelős; hozzászólásnál a másik fél (ha harmadik ember szól hozzá, mindkettő).
  const toList = kind === "assigned" ? (assignee ? [assignee] : []) : parties.filter((p) => String(p._id) !== String(actor.oid));
  if (!toList.length) return { sent: [], failed: [] };
  const recipients: Person[] = parties.filter((p) => !("disabledAt" in p && p.disabledAt));

  const sent: string[] = [];
  const failed: string[] = [];
  for (const recipient of recipients) {
    const { subject, text, html } = buildTaskMail({
      kind,
      recipientName: recipient.name,
      actorName: actor.name,
      toNames: toList.map((p) => p.name),
      taskTitle: task.title,
      description: task.description,
      status: TASK_STATUS[task.status] ?? task.status,
      priority: TASK_PRIORITY[task.priority] ?? task.priority,
      due: task.due ? formatShortDate(task.due) : undefined,
      comment,
      link: `${appBaseUrl()}/feladatok/${task._id}`,
      senderName: senderName(),
      logoCid: "pannonguard-logo",
    });
    const error = await sendMail({
      to: [recipient.email],
      subject,
      text,
      html,
      attachments: [{ filename: "pannonguard.png", content: Buffer.from(MAIL_LOGO_BASE64, "base64"), contentType: "image/png", cid: "pannonguard-logo" }],
    });
    (error ? failed : sent).push(recipient.name);
  }
  return { sent, failed };
}
