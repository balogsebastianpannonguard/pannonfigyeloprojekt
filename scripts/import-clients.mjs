// Ügyfelek importja egy előre kinyert JSON-ból (az Excel sorai oszlopról oszlopra, kiemelésekkel).
// A JSON személyes adatokat tartalmaz: NE kerüljön a repóba.
//
//   node --env-file=.env.local scripts/import-clients.mjs <ugyfelek.json>
//
// Éles adatbázisba csak akkor ír, ha IMPORT_CONFIRM pontosan a MONGODB_DB nevével egyezik.
// A vevőkód alapján frissít (upsert), és egy bejegyzést ír a közös naplóba.
import { readFileSync } from "node:fs";
import { MongoClient, ObjectId } from "mongodb";

const { MONGODB_URI, MONGODB_DB, IMPORT_CONFIRM } = process.env;
const file = process.argv[2];
if (!file) throw new Error("Add meg a JSON fájl útvonalát.");
if (!MONGODB_DB.endsWith("_teszt") && IMPORT_CONFIRM !== MONGODB_DB) {
  console.error(`Éles adatbázis (${MONGODB_DB}): futtasd IMPORT_CONFIRM=${MONGODB_DB} beállítással.`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, "utf8"));
const client = await new MongoClient(MONGODB_URI).connect();
const db = client.db(MONGODB_DB);
await db.collection("clients").createIndex({ key: 1 }, { unique: true });
const importedAt = new Date();
const names = [];
for (const row of data.rows) {
  const value = (col) => row.cols.find((c) => c.col === col)?.value;
  const key = String(value("B")).trim();
  await db.collection("clients").updateOne(
    { key },
    {
      $set: { status: String(value("A")), order: row.row, cols: row.cols, source: { file: data.file, sheet: data.sheet, row: row.row, importedAt } },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
  names.push(value("C") || key);
}
await db.collection("log").insertOne({
  _id: new ObjectId(),
  at: importedAt,
  kind: "client",
  action: "client.import",
  text: `importált ${names.length} ügyfelet a(z) „${data.file}” fájl „${data.sheet}” munkalapjáról: ${names.join(", ")}`,
  userName: "Adatimport",
  email: "",
  target: { type: "client", id: "", label: "Ügyfelek" },
  ip: "helyi import",
  device: "importszkript",
});
await client.close();
console.log(`Kész: ${names.length} ügyfél → ${MONGODB_DB}`);
