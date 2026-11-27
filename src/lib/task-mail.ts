import "server-only";
import type { ObjectId } from "mongodb";
import { buildCommentMail } from "@/lib/comment-mail-template";
import { formatShortDate } from "@/lib/dates";
import { MAIL_LOGO_BASE64 } from "@/lib/mail-logo";
import { mailAvailable, sendMail } from "@/lib/mail";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/meta";
import { users } from "@/lib/users";
import type { TaskDocument } from "@/lib/workspace";

/** Az alkalmazás nyilvános címe a levélben szereplő linkekhez. */
export function appBaseUrl() {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3010";
}

/**
 * Új hozzászólásnál e-mail a feladat létrehozójának és felelősének – kivéve annak, aki a hozzászólást írta.
 * Visszaadja, kinek ment el és kinek nem (a naplóhoz).
 */
export async function notifyComment({ task, author, comment }: { task: TaskDocument; author: { oid: ObjectId; name: string; email: string }; comment: string }) {
  if (!mailAvailable()) return { sent: [] as string[], failed: [] as string[] };
  const reasons = new Map<string, "creator" | "assignee">();
  if (task.assigneeId) reasons.set(String(task.assigneeId), "assignee");
  reasons.set(String(task.createdBy), "creator");
  reasons.delete(String(author.oid));
  if (!reasons.size) return { sent: [], failed: [] };

  const recipients = await (await users())
    .find({ _id: { $in: [task.createdBy, task.assigneeId].filter((id): id is ObjectId => Boolean(id) && reasons.has(String(id))) }, disabledAt: { $exists: false } }, { projection: { name: 1, email: 1 } })
    .toArray();
  const sent: string[] = [];
  const failed: string[] = [];
  for (const recipient of recipients) {
    const { subject, text, html } = buildCommentMail({
      recipientName: recipient.name,
      reason: reasons.get(String(recipient._id)) ?? "creator",
      authorName: author.name,
      taskTitle: task.title,
      status: TASK_STATUS[task.status] ?? task.status,
      priority: TASK_PRIORITY[task.priority] ?? task.priority,
      due: task.due ? formatShortDate(task.due) : undefined,
      comment,
      link: `${appBaseUrl()}/feladatok/${task._id}`,
      logoCid: "pannonguard-logo",
    });
    const error = await sendMail({
      to: [recipient.email],
      replyTo: author.email,
      subject,
      text,
      html,
      attachments: [{ filename: "pannonguard.png", content: Buffer.from(MAIL_LOGO_BASE64, "base64"), contentType: "image/png", cid: "pannonguard-logo" }],
    });
    (error ? failed : sent).push(recipient.name);
  }
  return { sent, failed };
}
