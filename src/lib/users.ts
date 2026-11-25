import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Ebben az alrendszerben mindenki egyenrangú: aki az Elosztóból meghívót kapott, ugyanazt a közös munkateret látja,
 * és ugyanazokat a műveleteket végezheti. Minden lépés a közös naplóba kerül.
 */
export type UserDocument = {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  /** Az Elosztó meghívója (a hozzáférés visszavonását onnan olvassuk). */
  invitationId: ObjectId;
  invitedBy: string;
  createdAt: Date;
  lastLoginAt?: Date;
  /** Utolsó aktivitás (oldalmegnyitás vagy művelet). */
  lastSeenAt?: Date;
  disabledAt?: Date;
};

export const users = async () => (await getDb()).collection<UserDocument>("users");

export async function findUserById(id: ObjectId) {
  return (await users()).findOne({ _id: id });
}

export async function findUserByEmail(email: string) {
  return (await users()).findOne({ email: email.toLowerCase() });
}

export type Person = { id: string; name: string; email: string };

/** A csapat névsora (a felelős-választókhoz és a szűrőkhöz). */
export async function listPeople(): Promise<Person[]> {
  const rows = await (await users())
    .find({ disabledAt: { $exists: false } }, { projection: { name: 1, email: 1 } })
    .sort({ name: 1 })
    .toArray();
  return rows.map((row) => ({ id: String(row._id), name: row.name, email: row.email }));
}
