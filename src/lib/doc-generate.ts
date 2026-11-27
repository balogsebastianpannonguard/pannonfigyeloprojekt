import "server-only";
import JSZip from "jszip";
import { TNR_WIDTHS } from "@/lib/tnr-widths";

/**
 * Ügyfélre szabott dokumentumok a feltöltött Word-sablonokból. A sablonhoz semmi máshoz nem nyúlunk, csak a kitöltendő
 * mezőkhöz – a formázás (betű, méret, félkövér, bekezdés-térközök) a sablon saját beállítása marad.
 * Ha a sablon szerkezete nem az, amire számítunk, hibát dobunk, és nem készül félig kitöltött dokumentum.
 */

export type LetterData = {
  /** Iktatószám, pl. „2026-19/1”. */
  filing: string;
  /** Ügyfélazonosító/szerződésszám sor, pl. „3240, 5885 / SZE1874/1”. */
  idLine: string;
  name: string;
  /** Cím részei: „irányítószám település”, „utca házszám” – vesszővel egy sorba kerülnek (hosszú címnél a Word tördeli). */
  addressLines: string[];
};

export class TemplateError extends Error {}

const TWIPS_PER_PT = 20;
/** A szövegtükör szélessége (A4, 2,5 cm-es margók): 9072 twip. */
const TEXT_WIDTH = 9072;

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Szöveg szélessége twipben, Times New Roman betűvel (félkövér vagy normál), adott méretben (félpontban, mint a Word `w:sz`). */
export function textWidth(text: string, { bold = true, halfPoints = 24 } = {}) {
  const table = TNR_WIDTHS[bold ? "bold" : "regular"];
  let units = 0;
  for (const ch of text) units += table[ch] ?? 556;
  return Math.ceil((units / 1000) * (halfPoints / 2) * TWIPS_PER_PT);
}

const RUN = /<w:r(?=[\s>])[^>]*>[\s\S]*?<\/w:r>/g;
const PARAGRAPH = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const runText = (run: string) => [...run.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
const paragraphText = (paragraph: string) => [...paragraph.matchAll(RUN)].map((m) => runText(m[0])).join("");
const runProps = (run: string) => run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
const makeRun = (rPr: string, text: string) => `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
const withSize = (rPr: string, halfPoints: number) =>
  rPr.replace(/<w:sz w:val="\d+"\/>/, `<w:sz w:val="${halfPoints}"/>`).replace(/<w:szCs w:val="\d+"\/>/, `<w:szCs w:val="${halfPoints}"/>`);
const halfPointsOf = (rPr: string) => Number(rPr.match(/<w:sz w:val="(\d+)"\/>/)?.[1] ?? 24);

/** A pontsoros „Iktatószám:………” helyére a szám kerül (ugyanabban a futásban, ugyanazzal a formázással); az utána álló pont(ok) törlődnek. */
function fillFiling(paragraph: string, filing: string) {
  const runs = [...paragraph.matchAll(RUN)].map((m) => m[0]);
  const index = runs.findIndex((run) => /Iktatószám:\s*[….]+\s*$/.test(runText(run)));
  if (index < 0) throw new TemplateError("Nem található az „Iktatószám:……” mező.");
  const target = runs[index];
  const filled = target.replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/, (_match, text: string) => `<w:t xml:space="preserve">${escapeXml(text.replace(/Iktatószám:\s*[….]+\s*$/, `Iktatószám: ${filing}`))}</w:t>`);
  let result = paragraph.replace(target, () => filled);
  // A pontsor folytatása külön futásban (pl. egy záró „.”).
  for (const run of runs.slice(index + 1)) {
    if (/^[….]+$/.test(runText(run)) && !run.includes("<w:tab/>")) result = result.replace(run, () => "");
    else break;
  }
  return result;
}

/** Bekezdés behúzása függő behúzással: az első sor a `start` twipnél, a többi sor a `start + label` twipnél (a címke utáni értékhez igazítva). */
function setHangingIndent(paragraph: string, start: number, label: number) {
  const ind = `<w:ind w:left="${start + label}" w:hanging="${label}"/>`;
  if (/<w:ind\s[^>]*\/>/.test(paragraph.slice(0, paragraph.indexOf("</w:pPr>")))) return paragraph.replace(/<w:ind\s[^>]*\/>/, () => ind);
  if (/<w:spacing\s[^>]*\/>/.test(paragraph)) return paragraph.replace(/(<w:spacing\s[^>]*\/>)/, (m) => `${m}${ind}`);
  return paragraph.replace("<w:pPr>", () => `<w:pPr>${ind}`);
}

/** Egy „Címke:” bekezdés mérete: hol kezdődik a sor (twip), a címke előtti szóközök szélessége és a címke formázása. */
function measureLabeled(paragraph: string, label: string) {
  const runs = [...paragraph.matchAll(RUN)].map((m) => m[0]);
  const labelRun = runs.find((run) => runText(run).trim() === label);
  if (!labelRun) throw new TemplateError(`Nem található a(z) „${label}” mező.`);
  const rPr = runProps(labelRun);
  const before = paragraph.slice(0, paragraph.indexOf(labelRun));
  // A címke a sablonban tabulátorokkal (alapértelmezett 708 twipes lépés) és/vagy bal behúzással van a jobb oldali oszlopban.
  const tabs = (before.match(/<w:tab\/>/g) ?? []).length;
  const leftIndent = Number(paragraph.match(/<w:ind\s[^>]*w:left="(\d+)"/)?.[1] ?? 0);
  const start = leftIndent + tabs * 708;
  const prefix = [...before.matchAll(RUN)].map((m) => runText(m[0])).join("");
  const labelSize = halfPointsOf(rPr);
  const prefixWidth = textWidth(prefix, { halfPoints: labelSize });
  const valueStart = start + textWidth(`${prefix}${label} `, { halfPoints: labelSize });
  return { labelRun, rPr, before, start, prefixWidth, firstWidth: TEXT_WIDTH - valueStart, otherWidth: TEXT_WIDTH - start - prefixWidth };
}

/** Hány sorba tördelődik a szöveg (szóhatáron, mint a Word), ha az első sor `first`, a többi `other` twip széles. 2% ráhagyással. */
function lineCount(text: string, first: number, other: number, halfPoints: number) {
  let lines = 1;
  let current = "";
  let width = first;
  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, { halfPoints }) * 1.02 <= width) current = candidate;
    else {
      lines += 1;
      current = word;
      width = other;
    }
  }
  return lines;
}

/**
 * „Címke:” után az érték, a címke formázásával (adott betűmérettel). A címke helye nem változik; a tabulátorokat
 * ugyanoda mutató bal behúzássá alakítjuk, a következő sor pedig a címkék oszlopában kezdődik (függő behúzás).
 */
function fillLabeled(paragraph: string, label: string, value: string, halfPoints: number) {
  const m = measureLabeled(paragraph, label);
  let result = paragraph.replace(m.before, () => m.before.replace(/<w:tab\/>/g, ""));
  const valueRun = makeRun(withSize(m.rPr, halfPoints), ` ${value}`);
  result = result.replace(m.labelRun, () => `${m.labelRun}${valueRun}`);
  return setHangingIndent(result, m.start, m.prefixWidth);
}

/** Az értesítő levél fejléce: iktatószám, ügyfélazonosító/szerződésszám, ügyfél neve, címe. */
export async function generateLetter(template: Buffer, data: LetterData) {
  const zip = await JSZip.loadAsync(template);
  const file = zip.file("word/document.xml");
  if (!file) throw new TemplateError("A sablon nem Word-dokumentum.");
  const xml = await file.async("string");
  const paragraphs = [...xml.matchAll(PARAGRAPH)];
  const find = (test: (text: string) => boolean, from = 0) => paragraphs.findIndex((m, i) => i >= from && test(paragraphText(m[0])));

  const head = find((text) => text.startsWith("Ügyfélazonosító/szerződésszám:") && text.includes("Iktatószám:"));
  if (head < 0) throw new TemplateError("Nem található az „Ügyfélazonosító/szerződésszám: … Iktatószám:” sor.");
  const idRow = head + 1;
  if (!paragraphs[idRow] || paragraphText(paragraphs[idRow][0]).trim() !== "") throw new TemplateError("Az azonosító sor alatt nincs üres sor.");
  const nameRow = find((text) => text.trim() === "Ügyfél neve:", idRow);
  const addressRow = find((text) => text.trim() === "Címe:", nameRow);
  if (nameRow < 0 || addressRow < 0) throw new TemplateError("Nem található az „Ügyfél neve:” vagy a „Címe:” mező.");

  const replacements = new Map<number, string>();
  const headXml = paragraphs[head][0];
  replacements.set(head, fillFiling(headXml, data.filing));

  // Ügyfélazonosító/szerződésszám: a címke alatti (eddig üres) sorba, a címke formázásával; ha nem férne ki egy sorba, kisebb betűvel.
  const idXml = paragraphs[idRow][0];
  const labelRun = [...headXml.matchAll(RUN)].map((m) => m[0]).find((run) => runText(run).startsWith("Ügyfélazonosító/szerződésszám:"))!;
  let rPr = runProps(labelRun);
  let size = halfPointsOf(rPr);
  while (size > 16 && textWidth(data.idLine, { halfPoints: size }) > TEXT_WIDTH) size -= 1;
  if (size !== halfPointsOf(rPr)) rPr = withSize(rPr, size);
  if (!idXml.includes("</w:pPr>")) throw new TemplateError("Az azonosító sor formázása hiányzik.");
  const pPrEnd = idXml.indexOf("</w:pPr>") + "</w:pPr>".length;
  replacements.set(idRow, `${idXml.slice(0, pPrEnd)}${data.idLine ? makeRun(rPr, data.idLine) : ""}</w:p>`);

  // Név és cím: a levél pontosan egy oldal, ezért a fejléc nem lehet magasabb a sablonénál. Egy plusz sort (hosszú név
  // vagy cím) a cím alatti üres sor elhagyása ellensúlyoz; ha ennél több kellene, a két érték betűmérete kisebb (min. 9 pt).
  const nameXml = paragraphs[nameRow][0];
  const addressXml = paragraphs[addressRow][0];
  const spacer = paragraphs[addressRow + 1]?.[0];
  const canAbsorb = Boolean(spacer && paragraphText(spacer).trim() === "" && !spacer.includes("<w:br"));
  const address = data.addressLines.filter(Boolean).join(", ");
  const nameBox = measureLabeled(nameXml, "Ügyfél neve:");
  const addressBox = measureLabeled(addressXml, "Címe:");
  const baseSize = halfPointsOf(nameBox.rPr);
  let valueSize = baseSize;
  let extra = 0;
  for (; valueSize >= 18; valueSize -= 1) {
    extra = lineCount(data.name, nameBox.firstWidth, nameBox.otherWidth, valueSize) - 1 + (lineCount(address, addressBox.firstWidth, addressBox.otherWidth, valueSize) - 1);
    if (extra <= (canAbsorb ? 1 : 0)) break;
  }
  if (valueSize < 18) throw new TemplateError("Az ügyfél neve és címe 9 pontos betűvel sem fér el a levél fejlécében.");
  replacements.set(nameRow, fillLabeled(nameXml, "Ügyfél neve:", data.name, valueSize));
  replacements.set(addressRow, fillLabeled(addressXml, "Címe:", address, valueSize));
  if (extra === 1 && spacer) replacements.set(addressRow + 1, "");

  // Csere pozíció szerint (hátulról előre, hogy a korábbi pozíciók érvényesek maradjanak).
  let out = xml;
  for (const index of [...replacements.keys()].sort((x, y) => y - x)) {
    const match = paragraphs[index];
    out = out.slice(0, match.index) + replacements.get(index)! + out.slice(match.index! + match[0].length);
  }
  zip.file("word/document.xml", out, { createFolders: false });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/** A szerződés jobb felső „Iktatószám:………” mezője. */
export async function generateContract(template: Buffer, filing: string) {
  const zip = await JSZip.loadAsync(template);
  const file = zip.file("word/document.xml");
  if (!file) throw new TemplateError("A sablon nem Word-dokumentum.");
  const xml = await file.async("string");
  const paragraphs = [...xml.matchAll(PARAGRAPH)].map((m) => m[0]).filter((p) => /Iktatószám:\s*[….]+/.test(paragraphText(p)));
  if (paragraphs.length !== 1) throw new TemplateError("A szerződésben nem található (pontosan egy) „Iktatószám:……” mező.");
  const filled = fillFiling(paragraphs[0], filing);
  zip.file("word/document.xml", xml.replace(paragraphs[0], () => filled), { createFolders: false });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
