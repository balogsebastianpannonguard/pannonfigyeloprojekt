// Word-sablon feltöltése az adatbázisba (a repó nyilvános, a fájl nem kerülhet bele).
//
//   node --env-file=.env.local scripts/upload-document.mjs <fájl.docx> <slug> "<cím>" "<leírás>" [sorrend]
//
// Éles adatbázisba csak akkor ír, ha IMPORT_CONFIRM pontosan a MONGODB_DB nevével egyezik.
// Ugyanazzal a sluggal újrafuttatva lecseréli a fájlt; a csere a közös naplóba kerül.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Binary, MongoClient, ObjectId } from "mongodb";

const { MONGODB_URI, MONGODB_DB, IMPORT_CONFIRM } = process.env;
const [file, slug, title, description = "", order = "0"] = process.argv.slice(2);
if (!file || !slug || !title) throw new Error('Használat: upload-document.mjs <fájl.docx> <slug> "<cím>" "<leírás>" [sorrend]');
if (!/^[a-z0-9-]{1,60}$/.test(slug)) throw new Error("A slug csak kisbetű, szám és kötőjel lehet.");
if (!MONGODB_DB.endsWith("_teszt") && IMPORT_CONFIRM !== MONGODB_DB) {
  console.error(`Éles adatbázis (${MONGODB_DB}): futtasd IMPORT_CONFIRM=${MONGODB_DB} beállítással.`);
  process.exit(1);
}
const data = readFileSync(file);
const fileName = basename(file);
const client = await new MongoClient(MONGODB_URI).connect();
const db = client.db(MONGODB_DB);
await db.collection("documents").createIndex({ slug: 1 }, { unique: true });
const now = new Date();
const result = await db.collection("documents").updateOne(
  { slug },
  {
    $set: {
      title,
      description,
      fileName,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: data.length,
      data: new Binary(data),
      order: Number(order) || 0,
      uploadedAt: now,
    },
    $setOnInsert: { _id: new ObjectId() },
  },
  { upsert: true },
);
await db.collection("log").insertOne({
  _id: new ObjectId(),
  at: now,
  kind: "export",
  action: "document.upload",
  text: `${result.upsertedCount ? "feltöltötte" : "lecserélte"} a(z) „${title}” dokumentumot (${fileName})`,
  userName: "Adatimport",
  email: "",
  target: { type: "document", id: slug, label: title },
  ip: "helyi import",
  device: "importszkript",
});
await client.close();
console.log(`Kész: ${title} (${fileName}, ${data.length} bájt) → ${MONGODB_DB}`);
