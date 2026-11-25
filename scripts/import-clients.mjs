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

/**
 * Objektumazonosítók (N oszlop). Az azonosítók négyjegyűek; ha az Excel két azonosítót egy számmá olvasztott
 * (pl. „3240.5885” = 3240 és 5885), szétválasztjuk. A tizedes rész végéről az Excel levágja a nullákat, ezért
 * jobbról, az egész részt balról egészítjük ki négy jegyre.
 */
function normalizeIds(value) {
  if (value === null || value === undefined || value === "") return value;
  const text = String(value).trim();
  const glued = text.match(/^(\d{1,4})\.(\d{1,4})$/);
  if (glued) return `${glued[1].padStart(4, "0")}, ${glued[2].padEnd(4, "0")}`;
  if (/^\d{1,4}$/.test(text)) return text.padStart(4, "0");
  return text;
}

/** Objektumcímek (R oszlop): ha két „azonosító: cím” rész pontosvessző nélkül összeragadt, szétválasztjuk. */
function normalizeAddresses(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/,\s*(?=\b\d{4}: )/g, "; ")
    .replace(/([^;,\s])\s*(?=\b\d{4}: )/g, "$1; ")
    .replace(/;\s*;/g, ";");
}

/** Az azonosítólista elemei: vessző mentén, a megjegyzések (pl. „(tűzjelző)”) az elemen maradnak. */
const idList = (value) =>
  value === null || value === undefined || value === ""
    ? []
    : String(value)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

const data = JSON.parse(readFileSync(file, "utf8"));
const client = await new MongoClient(MONGODB_URI).connect();
const db = client.db(MONGODB_DB);
await db.collection("clients").createIndex({ key: 1 }, { unique: true });
const importedAt = new Date();
const names = [];
const fixed = [];
for (const row of data.rows) {
  const cols = row.cols.map((column) => {
    const normalized = column.col === "N" ? normalizeIds(column.value) : column.col === "R" ? normalizeAddresses(column.value) : column.value;
    if (normalized === column.value || String(normalized) === String(column.value)) return column;
    // Csak szóköz-különbség: nem számít javításnak.
    if (String(normalized).trim() === String(column.value).trim()) return { ...column, value: normalized };
    return { ...column, value: normalized, raw: column.value };
  });
  const value = (col) => cols.find((c) => c.col === col)?.value;
  const text = (col) => (value(col) === null || value(col) === undefined ? "" : String(value(col)).trim());
  const key = text("B");
  const name = text("C") || key;
  if (cols.some((c) => "raw" in c)) fixed.push(name);
  const summary = {
    name,
    status: text("A"),
    zip: text("E"),
    city: text("F"),
    street: text("G"),
    freq: text("I"),
    fee: typeof value("K") === "number" ? value("K") : null,
    ids: idList(value("N")),
    phone: text("P"),
    contract: text("AA"),
    debt: typeof value("S") === "number" ? value("S") : 0,
    marks: cols.filter((c) => c.mark).length,
    note: text("Z"),
  };
  const search = [name, key, text("D"), text("E"), text("F"), text("G"), text("H"), text("N"), text("O"), text("P"), text("Q"), text("R"), text("Z")]
    .join(" ")
    .toLowerCase();
  await db.collection("clients").updateOne(
    { key },
    {
      $set: { status: summary.status, order: row.row, cols, summary, search, source: { file: data.file, sheet: data.sheet, row: row.row, importedAt } },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
  names.push(name);
}
const fixNote = fixed.length ? ` Szétválasztott, összeragadt objektumazonosító/cím: ${fixed.join(", ")}.` : "";
await db.collection("log").insertOne({
  _id: new ObjectId(),
  at: importedAt,
  kind: "client",
  action: "client.import",
  text: `importált ${names.length} ügyfelet a(z) „${data.file}” fájl „${data.sheet}” munkalapjáról: ${names.slice(0, 20).join(", ")}${names.length > 20 ? ` és még ${names.length - 20}` : ""}.${fixNote}`,
  userName: "Adatimport",
  email: "",
  target: { type: "client", id: "", label: "Ügyfelek" },
  ip: "helyi import",
  device: "importszkript",
});
await client.close();
console.log(`Kész: ${names.length} ügyfél → ${MONGODB_DB}${fixNote}`);
