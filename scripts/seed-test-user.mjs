// Helyi teszthez: tesztfelhasználó + hozzá tartozó (ál)meghívó a TESZT adatbázisba.
// Csak akkor fut, ha a MONGODB_DB és az INVITES_DB is "_teszt" végű – élő adatbázist nem érinthet.
import { randomBytes, scrypt } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

const { MONGODB_URI, MONGODB_DB, INVITES_DB } = process.env;
if (!MONGODB_DB?.endsWith("_teszt") || !INVITES_DB?.endsWith("_teszt")) {
  console.error("Csak _teszt végű adatbázisra futtatható.");
  process.exit(1);
}
const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error('Használat: npm run seed:test -- email "Vezetéknév Keresztnév" jelszó');
  process.exit(1);
}
const salt = randomBytes(16);
const key = await new Promise((ok, fail) => scrypt(password, salt, 32, { N: 2 ** 16, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (e, k) => (e ? fail(e) : ok(k))));
const client = await new MongoClient(MONGODB_URI).connect();
const invitationId = new ObjectId();
await client.db(INVITES_DB).collection("invitations").insertOne({ _id: invitationId, email, role: "Pannon Figyelő projekt", invitedBy: "Teszt", registeredAt: new Date(), name });
await client.db(MONGODB_DB).collection("users").updateOne(
  { email },
  { $set: { name, passwordHash: ["scrypt", 65536, 8, 1, salt.toString("hex"), key.toString("hex")].join(":"), invitationId, invitedBy: "Teszt", createdAt: new Date() } },
  { upsert: true },
);
await client.close();
console.log("Kész:", email);
