"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { formatShortDate } from "@/lib/dates";
import { DAY, longText, text, type FormState } from "@/lib/form";
import { writeLog, type Change } from "@/lib/log";
import { TASK_PRIORITY, TASK_STATUS, isPriority, isStatus, pageName, type TaskStatus } from "@/lib/meta";
import { requireUser } from "@/lib/session";
import { clientName, getClient } from "@/lib/clients";
import { notifyTask } from "@/lib/task-mail";
import { users } from "@/lib/users";
import { commentsCol, getNote, getTask, notesCol, oid, postsCol, tasksCol, type TaskDocument } from "@/lib/workspace";

const quote = (value: string) => `„${value}”`;

/** Mindenki ugyanazt látja: egy módosítás után minden közös oldal frissül. */
function refreshAll() {
  revalidatePath("/", "layout");
}

/**
 * E-mail a feladat két érintettjének (aki adta és aki kapta) a válasz elküldése után, hogy a küldés ne lassítsa a felületet.
 * Az eredmény (kinek ment el, kinek nem) a naplóba kerül.
 */
function notifyAfter(kind: "assigned" | "comment", task: TaskDocument, actor: Awaited<ReturnType<typeof requireUser>>, comment?: string) {
  after(async () => {
    const { sent, failed } = await notifyTask({ kind, task, actor, comment });
    if (!sent.length && !failed.length) return;
    await writeLog(actor, {
      kind: kind === "comment" ? "comment" : "task",
      action: kind === "comment" ? "comment.notify" : "task.notify",
      text: `e-mail értesítés a(z) ${quote(task.title)} feladat ${kind === "comment" ? "új hozzászólásáról" : "kiadásáról"}${sent.length ? ` – elküldve: ${sent.join(", ")}` : ""}${failed.length ? ` – nem sikerült: ${failed.join(", ")}` : ""}`,
      target: { type: "task", id: String(task._id), label: task.title },
    });
  });
}

async function assignee(raw: string) {
  const id = oid(raw);
  if (!id) return { id: undefined, name: "senki" };
  const user = await (await users()).findOne({ _id: id, disabledAt: { $exists: false } }, { projection: { name: 1 } });
  return user ? { id: user._id, name: user.name } : null;
}

/* ---------- Oldalmegnyitás ---------- */

/** A kliens minden oldalváltáskor jelzi, melyik oldalt nyitotta meg a felhasználó. */
export async function trackView(path: string) {
  if (typeof path !== "string" || !/^\/[\w\-/?=&%.]{0,200}$/.test(path)) return;
  const user = await requireUser();
  const [pathname, search = ""] = path.split("?");
  // Ügyféloldalaknál a naplóba az ügyfél neve is bekerül (ki melyik ügyfelet nézte meg).
  const clientPage = pathname.match(/^\/ugyfelek\/([0-9a-f]{24})(\/szerkesztes)?$/i);
  const previewId = pathname === "/ugyfelek" ? new URLSearchParams(search).get("elonezet") : null;
  const clientId = clientPage?.[1] ?? (previewId && /^[0-9a-f]{24}$/i.test(previewId) ? previewId : null);
  if (clientId) {
    const client = await getClient(clientId);
    if (client) {
      const name = clientName(client);
      const what = clientPage?.[2] ? "szerkesztésre nyitotta meg" : clientPage ? "megnyitotta az adatlapját:" : "megnézte az előnézetét:";
      await writeLog(user, {
        kind: "view",
        action: clientPage?.[2] ? "client.edit.open" : clientPage ? "client.view" : "client.preview",
        text: clientPage?.[2] ? `szerkesztésre nyitotta meg a(z) „${name}” ügyfél adatlapját` : `${what} „${name}”`,
        target: { type: "client", id: clientId, label: name },
        path,
      });
      return;
    }
  }
  await writeLog(user, { kind: "view", action: "page.view", text: `megnyitotta ${pageName(pathname)}`, path });
}

/* ---------- Feladatok ---------- */

export async function createTask(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = text(formData, "title", 160);
  const description = longText(formData, "description", 4000);
  const status = text(formData, "status");
  const priority = text(formData, "priority");
  const due = text(formData, "due");
  if (title.length < 2) return { error: "Adj meg legalább 2 karakteres címet." };
  if (!isStatus(status) || !isPriority(priority)) return { error: "Érvénytelen állapot vagy prioritás." };
  if (due && !DAY.test(due)) return { error: "Érvénytelen határidő." };
  const person = await assignee(text(formData, "assigneeId"));
  if (!person) return { error: "A kiválasztott felelős nem található." };

  const now = new Date();
  const _id = new ObjectId();
  const created: TaskDocument = {
    _id,
    title,
    ...(description && { description }),
    status,
    priority,
    ...(person.id && { assigneeId: person.id }),
    ...(due && { due }),
    order: -now.getTime(),
    createdBy: user.oid,
    createdAt: now,
    updatedAt: now,
    updatedBy: user.oid,
    ...(status === "kesz" && { doneAt: now }),
  };
  await (await tasksCol()).insertOne(created);
  const extras = [TASK_STATUS[status], `prioritás: ${TASK_PRIORITY[priority]}`, person.id ? `felelős: ${person.name}` : "", due ? `határidő: ${formatShortDate(due)}` : ""]
    .filter(Boolean)
    .join(", ");
  await writeLog(user, {
    kind: "task",
    action: "task.create",
    text: `létrehozta a(z) ${quote(title)} feladatot (${extras})`,
    target: { type: "task", id: String(_id), label: title },
  });
  if (created.assigneeId) notifyAfter("assigned", created, user);
  refreshAll();
  return { ok: true, message: "A feladat felkerült a táblára." };
}

export async function updateTask(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const task = await getTask(text(formData, "id"));
  if (!task) return { error: "A feladat nem található (lehet, hogy közben törölték)." };
  const title = text(formData, "title", 160);
  const description = longText(formData, "description", 4000);
  const status = text(formData, "status");
  const priority = text(formData, "priority");
  const due = text(formData, "due");
  if (title.length < 2) return { error: "Adj meg legalább 2 karakteres címet." };
  if (!isStatus(status) || !isPriority(priority)) return { error: "Érvénytelen állapot vagy prioritás." };
  if (due && !DAY.test(due)) return { error: "Érvénytelen határidő." };
  const person = await assignee(text(formData, "assigneeId"));
  if (!person) return { error: "A kiválasztott felelős nem található." };

  const before = await describeAssignee(task.assigneeId);
  const changes: Change[] = [];
  if (task.title !== title) changes.push({ field: "Cím", from: task.title, to: title });
  if ((task.description ?? "") !== description) changes.push({ field: "Leírás", from: task.description ?? "", to: description });
  if (task.status !== status) changes.push({ field: "Állapot", from: TASK_STATUS[task.status], to: TASK_STATUS[status] });
  if (task.priority !== priority) changes.push({ field: "Prioritás", from: TASK_PRIORITY[task.priority], to: TASK_PRIORITY[priority] });
  if (String(task.assigneeId ?? "") !== String(person.id ?? "")) changes.push({ field: "Felelős", from: before, to: person.name });
  if ((task.due ?? "") !== due) changes.push({ field: "Határidő", from: task.due ?? "nincs", to: due || "nincs" });
  if (!changes.length) return { ok: true, message: "Nem volt változás." };

  const now = new Date();
  await (await tasksCol()).updateOne(
    { _id: task._id },
    {
      $set: {
        title,
        description,
        status,
        priority,
        due,
        updatedAt: now,
        updatedBy: user.oid,
        ...(status === "kesz" && task.status !== "kesz" && { doneAt: now }),
        ...(person.id ? { assigneeId: person.id } : {}),
      },
      ...(person.id ? {} : { $unset: { assigneeId: "" } }),
    },
  );
  await writeLog(user, {
    kind: "task",
    action: "task.update",
    text: `módosította a(z) ${quote(title)} feladatot: ${changes.map((change) => change.field.toLowerCase()).join(", ")}`,
    target: { type: "task", id: String(task._id), label: title },
    changes,
  });
  // Új felelős: ő (és a feladat kiadója) értesítést kap.
  if (person.id && String(task.assigneeId ?? "") !== String(person.id)) {
    notifyAfter("assigned", { ...task, title, description, status, priority, due, assigneeId: person.id }, user);
  }
  refreshAll();
  return { ok: true, message: "Mentve." };
}

async function describeAssignee(id?: ObjectId) {
  if (!id) return "senki";
  return (await (await users()).findOne({ _id: id }, { projection: { name: 1 } }))?.name ?? "törölt felhasználó";
}

/** Áthelyezés a táblán (gombbal): állapotváltás, az oszlop tetejére. */
export async function moveTask(id: string, status: string) {
  const user = await requireUser();
  const task = await getTask(id);
  if (!task || !isStatus(status) || task.status === status) return;
  const now = new Date();
  await (await tasksCol()).updateOne(
    { _id: task._id },
    { $set: { status, order: -now.getTime(), updatedAt: now, updatedBy: user.oid, ...(status === "kesz" && { doneAt: now }) } },
  );
  await writeLog(user, {
    kind: "task",
    action: "task.move",
    text: `áthelyezte a(z) ${quote(task.title)} feladatot: ${TASK_STATUS[task.status]} → ${TASK_STATUS[status as TaskStatus]}`,
    target: { type: "task", id: String(task._id), label: task.title },
    changes: [{ field: "Állapot", from: TASK_STATUS[task.status], to: TASK_STATUS[status as TaskStatus] }],
  });
  refreshAll();
}

export async function deleteTask(formData: FormData) {
  const user = await requireUser();
  const task = await getTask(text(formData, "id"));
  if (task) {
    await (await tasksCol()).deleteOne({ _id: task._id });
    await (await commentsCol()).deleteMany({ taskId: task._id });
    await writeLog(user, {
      kind: "task",
      action: "task.delete",
      text: `törölte a(z) ${quote(task.title)} feladatot (${TASK_STATUS[task.status]})`,
      target: { type: "task", id: String(task._id), label: task.title },
    });
    refreshAll();
  }
  redirect("/feladatok");
}

/* ---------- Hozzászólások ---------- */

export async function addComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const task = await getTask(text(formData, "taskId"));
  if (!task) return { error: "A feladat nem található." };
  const body = longText(formData, "body", 4000);
  if (!body) return { error: "Írj valamit a hozzászólásba." };
  await (await commentsCol()).insertOne({ _id: new ObjectId(), taskId: task._id, authorId: user.oid, body, createdAt: new Date() });
  await writeLog(user, {
    kind: "comment",
    action: "comment.create",
    text: `hozzászólt a(z) ${quote(task.title)} feladathoz: ${quote(body.slice(0, 140))}`,
    target: { type: "task", id: String(task._id), label: task.title },
  });
  notifyAfter("comment", task, user, body);
  refreshAll();
  return { ok: true };
}

export async function deleteComment(formData: FormData) {
  const user = await requireUser();
  const id = oid(text(formData, "id"));
  if (!id) return;
  const comment = await (await commentsCol()).findOneAndDelete({ _id: id, authorId: user.oid });
  if (!comment) return;
  const task = await (await tasksCol()).findOne({ _id: comment.taskId }, { projection: { title: 1 } });
  await writeLog(user, {
    kind: "comment",
    action: "comment.delete",
    text: `törölte a hozzászólását a(z) ${quote(task?.title ?? "törölt")} feladatnál: ${quote(comment.body.slice(0, 140))}`,
    target: { type: "task", id: String(comment.taskId), label: task?.title ?? "törölt feladat" },
  });
  refreshAll();
}

/* ---------- Üzenőfal ---------- */

export async function createPost(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = longText(formData, "body", 4000);
  if (body.length < 2) return { error: "Írj valamit az üzenetbe." };
  const _id = new ObjectId();
  await (await postsCol()).insertOne({ _id, authorId: user.oid, body, pinned: false, createdAt: new Date() });
  await writeLog(user, { kind: "post", action: "post.create", text: `üzenetet írt az üzenőfalra: ${quote(body.slice(0, 160))}`, target: { type: "post", id: String(_id), label: body.slice(0, 80) } });
  refreshAll();
  return { ok: true };
}

export async function togglePin(formData: FormData) {
  const user = await requireUser();
  const id = oid(text(formData, "id"));
  const post = id ? await (await postsCol()).findOne({ _id: id }) : null;
  if (!post) return;
  await (await postsCol()).updateOne({ _id: post._id }, { $set: { pinned: !post.pinned } });
  await writeLog(user, {
    kind: "post",
    action: post.pinned ? "post.unpin" : "post.pin",
    text: `${post.pinned ? "levette a kitűzésről" : "kitűzte"} az üzenetet: ${quote(post.body.slice(0, 120))}`,
    target: { type: "post", id: String(post._id), label: post.body.slice(0, 80) },
  });
  refreshAll();
}

export async function deletePost(formData: FormData) {
  const user = await requireUser();
  const id = oid(text(formData, "id"));
  if (!id) return;
  const post = await (await postsCol()).findOneAndDelete({ _id: id, authorId: user.oid });
  if (!post) return;
  await writeLog(user, { kind: "post", action: "post.delete", text: `törölte az üzenetét: ${quote(post.body.slice(0, 160))}`, target: { type: "post", id: String(post._id), label: post.body.slice(0, 80) } });
  refreshAll();
}

/* ---------- Jegyzetek ---------- */

export async function createNote(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = text(formData, "title", 160);
  if (title.length < 2) return { error: "Adj címet a jegyzetnek." };
  const now = new Date();
  const _id = new ObjectId();
  await (await notesCol()).insertOne({ _id, title, body: "", createdBy: user.oid, createdAt: now, updatedBy: user.oid, updatedAt: now });
  await writeLog(user, { kind: "note", action: "note.create", text: `létrehozta a(z) ${quote(title)} jegyzetet`, target: { type: "note", id: String(_id), label: title } });
  refreshAll();
  redirect(`/jegyzetek/${_id}`);
}

export async function updateNote(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const note = await getNote(text(formData, "id"));
  if (!note) return { error: "A jegyzet nem található (lehet, hogy közben törölték)." };
  const title = text(formData, "title", 160);
  const body = longText(formData, "body", 50_000);
  if (title.length < 2) return { error: "Adj címet a jegyzetnek." };
  const changes: Change[] = [];
  if (note.title !== title) changes.push({ field: "Cím", from: note.title, to: title });
  if (note.body !== body) changes.push({ field: "Tartalom", from: note.body, to: body });
  if (!changes.length) return { ok: true, message: "Nem volt változás." };
  await (await notesCol()).updateOne({ _id: note._id }, { $set: { title, body, updatedBy: user.oid, updatedAt: new Date() } });
  await writeLog(user, {
    kind: "note",
    action: "note.update",
    text: `szerkesztette a(z) ${quote(title)} jegyzetet: ${changes.map((change) => change.field.toLowerCase()).join(", ")}`,
    target: { type: "note", id: String(note._id), label: title },
    changes,
  });
  refreshAll();
  return { ok: true, message: "Mentve." };
}

export async function deleteNote(formData: FormData) {
  const user = await requireUser();
  const note = await getNote(text(formData, "id"));
  if (note) {
    await (await notesCol()).deleteOne({ _id: note._id });
    await writeLog(user, {
      kind: "note",
      action: "note.delete",
      text: `törölte a(z) ${quote(note.title)} jegyzetet`,
      target: { type: "note", id: String(note._id), label: note.title },
      changes: [{ field: "Utolsó tartalom", from: note.body, to: "" }],
    });
    refreshAll();
  }
  redirect("/jegyzetek");
}
