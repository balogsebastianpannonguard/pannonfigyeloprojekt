import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { TaskPriority, TaskStatus } from "@/lib/meta";

/** Egyetlen, közös munkatér: minden meghívott ugyanazokat a feladatokat, üzeneteket és jegyzeteket látja. */

export type TaskDocument = {
  _id: ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: ObjectId;
  due?: string;
  /** Rendezési kulcs az oszlopon belül (kisebb = feljebb). */
  order: number;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: ObjectId;
  doneAt?: Date;
};

export type CommentDocument = { _id: ObjectId; taskId: ObjectId; authorId: ObjectId; body: string; createdAt: Date };

export type PostDocument = { _id: ObjectId; authorId: ObjectId; body: string; pinned: boolean; createdAt: Date };

export type NoteDocument = {
  _id: ObjectId;
  title: string;
  body: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedBy: ObjectId;
  updatedAt: Date;
};

const db = getDb;
export const tasksCol = async () => (await db()).collection<TaskDocument>("tasks");
export const commentsCol = async () => (await db()).collection<CommentDocument>("comments");
export const postsCol = async () => (await db()).collection<PostDocument>("posts");
export const notesCol = async () => (await db()).collection<NoteDocument>("notes");

export const oid = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

export async function listTasks() {
  return (await tasksCol()).find({}).sort({ order: 1, createdAt: 1 }).toArray();
}

export async function getTask(id: string) {
  const key = oid(id);
  return key ? (await tasksCol()).findOne({ _id: key }) : null;
}

export async function commentCounts() {
  const rows = await (await commentsCol())
    .aggregate<{ _id: ObjectId; count: number }>([{ $group: { _id: "$taskId", count: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function listComments(taskId: ObjectId) {
  return (await commentsCol()).find({ taskId }).sort({ createdAt: 1 }).toArray();
}

export async function listPosts(limit = 100) {
  return (await postsCol()).find({}).sort({ pinned: -1, createdAt: -1 }).limit(limit).toArray();
}

export async function listNotes() {
  return (await notesCol()).find({}).sort({ updatedAt: -1 }).toArray();
}

export async function getNote(id: string) {
  const key = oid(id);
  return key ? (await notesCol()).findOne({ _id: key }) : null;
}

/** Felhasználó-azonosító → név, a megjelenítéshez (a tiltott fiókok is, hogy a régi bejegyzések nevei megmaradjanak). */
export async function nameMap() {
  const rows = await (await db()).collection<{ _id: ObjectId; name: string }>("users").find({}, { projection: { name: 1 } }).toArray();
  return new Map(rows.map((row) => [String(row._id), row.name]));
}
