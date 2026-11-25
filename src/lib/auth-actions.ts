"use server";

import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { addEvent, checkInvitationToken, checkResetToken, getAccessState, markLogin, redeemInvitation, redeemResetToken, undoRedeem } from "@/lib/invitations";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { createSession, destroyAllSessions, destroySession, getSession, requireUser } from "@/lib/session";
import { clearAttempts, registerAttempt } from "@/lib/throttle";
import { findUserByEmail, findUserById, users } from "@/lib/users";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const validName = (name: string) => name.length >= 4 && name.length <= 80 && name.includes(" ");
const NAME_ERROR = "Add meg a teljes neved (vezeték- és keresztnév).";

/* ---------- Regisztráció az Elosztó meghívójával ---------- */

export type RegisterState = { error?: string; name?: string };

export async function register(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const token = field(formData, "token");
  const name = field(formData, "name").trim().replace(/\s+/g, " ");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  try {
    const invitation = await checkInvitationToken(token);
    if (invitation.status !== "valid") return { error: "Ez a meghívó már nem érvényes. Kérj újat attól, aki meghívott.", name };
    if (!validName(name)) return { error: NAME_ERROR, name };
    const problem = passwordProblem(password, invitation.email);
    if (problem) return { error: problem, name };
    if (password !== confirm) return { error: "A két jelszó nem egyezik.", name };

    const passwordHash = await hashPassword(password);
    const redeemed = await redeemInvitation(token, name);
    if (!redeemed) return { error: "Ez a meghívó közben érvénytelenné vált.", name };

    let userId: ObjectId;
    try {
      const inserted = await (await users()).insertOne({
        _id: new ObjectId(),
        email: redeemed.email.toLowerCase(),
        name,
        passwordHash,
        invitationId: redeemed._id,
        invitedBy: redeemed.invitedBy,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });
      userId = inserted.insertedId;
    } catch (error) {
      const duplicate = (error as { code?: number }).code === 11000;
      const reclaimed = duplicate ? await reclaimOrphaned(redeemed.email, redeemed._id, redeemed.invitedBy, name, passwordHash) : null;
      if (!reclaimed) {
        await undoRedeem(redeemed._id);
        return { error: duplicate ? "Ezzel az e-mail-címmel már van fiók. Lépj be inkább." : "A regisztráció átmenetileg nem érhető el.", name };
      }
      userId = reclaimed;
    }

    await Promise.all([markLogin(redeemed._id), recordAudit("register", redeemed.email, userId, name)]);
    await recordAudit("login.success", redeemed.email, userId, name);
    await createSession(userId);
  } catch (error) {
    console.error("Regisztrációs hiba:", (error as Error).name);
    return { error: "A regisztráció átmenetileg nem érhető el.", name };
  }
  redirect("/?udv=1");
}

/**
 * Ha a címhez régebbi fiók tartozik, amelynek a meghívóját az Elosztóban törölték (vagy visszavonták),
 * az új, érvényes meghívó beváltása újraindítja a fiókot: új jelszó, tiszta munkamenetek. A napló megmarad.
 */
async function reclaimOrphaned(email: string, invitationId: ObjectId, invitedBy: string, name: string, passwordHash: string) {
  const existing = await findUserByEmail(email);
  if (!existing || existing.invitationId.equals(invitationId)) return null;
  if (!(await getAccessState(existing.invitationId)).revoked) return null;

  const updated = await (await users()).findOneAndUpdate(
    { _id: existing._id, invitationId: existing.invitationId },
    { $set: { name, passwordHash, invitationId, invitedBy, createdAt: new Date(), lastLoginAt: new Date() }, $unset: { disabledAt: "" } },
  );
  if (!updated) return null;
  await destroyAllSessions(existing._id);
  await clearAttempts(`login:${existing.email}`);
  return existing._id;
}

/* ---------- Belépés ---------- */

export type LoginState = { error?: string; email?: string };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = field(formData, "email").trim().toLowerCase().slice(0, 254);
  const password = field(formData, "password");
  const next = field(formData, "next");

  try {
    if (!(await registerAttempt(`login:${email}`))) {
      await recordAudit("login.locked", email);
      return { email, error: "Túl sok próbálkozás. Próbáld újra 15 perc múlva." };
    }
    const user = await findUserByEmail(email);
    const passwordOk = await verifyPassword(password, user?.passwordHash);
    if (!user || !passwordOk) {
      await recordAudit("login.failure", email, user?._id, user?.name);
      return { email, error: "Hibás e-mail-cím vagy jelszó." };
    }
    if (user.disabledAt) return { email, error: "A hozzáférésedet letiltották." };
    if ((await getAccessState(user.invitationId)).revoked) return { email, error: "A hozzáférésedet visszavonták." };
    await markLogin(user.invitationId);
    await clearAttempts(`login:${email}`);
    await (await users()).updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    await recordAudit("login.success", user.email, user._id, user.name);
    await createSession(user._id);
  } catch (error) {
    console.error("Belépési hiba:", (error as Error).name);
    return { email, error: "A belépés átmenetileg nem érhető el." };
  }
  // Csak belső útvonalra irányítunk vissza.
  redirect(/^\/(?!\/)[\w\-./?=&%]{0,200}$/.test(next) ? next : "/");
}

/* ---------- Kijelentkezés ---------- */

export async function logout() {
  const session = await getSession();
  if (session) {
    const user = await findUserById(session.userId);
    if (user) await recordAudit("logout", user.email, user._id, user.name);
  }
  await destroySession();
  redirect("/login?ok=kilepve");
}

export async function logoutEverywhere() {
  const user = await requireUser();
  await recordAudit("logout.all", user.email, user.oid, user.name);
  await destroyAllSessions(user.oid);
  await destroySession();
  redirect("/login?ok=mindenhol");
}

/* ---------- Jelszó-visszaállítás (az Elosztóból küldött link) ---------- */

export type ResetState = { error?: string };

export async function resetPassword(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  try {
    const check = await checkResetToken(token);
    if (check.status !== "valid") return { error: "Ez a link már nem érvényes. Kérj újat." };
    const problem = passwordProblem(password, check.email);
    if (problem) return { error: problem };
    if (password !== confirm) return { error: "A két jelszó nem egyezik." };

    const passwordHash = await hashPassword(password);
    const redeemed = await redeemResetToken(token);
    if (!redeemed) return { error: "Ez a link közben érvénytelenné vált. Kérj újat." };
    const user = await findUserByEmail(redeemed.email);
    if (!user) return { error: "A fiók nem található. Fordulj ahhoz, aki meghívott." };

    await (await users()).updateOne({ _id: user._id }, { $set: { passwordHash } });
    await destroyAllSessions(user._id);
    await clearAttempts(`login:${user.email}`);
    await Promise.all([recordAudit("password.reset", user.email, user._id, user.name), addEvent(redeemed._id, "password.changed", "felhasználó")]);
  } catch (error) {
    console.error("Jelszó-visszaállítási hiba:", (error as Error).name);
    return { error: "A művelet átmenetileg nem érhető el." };
  }
  redirect("/login?ok=jelszocsere");
}
