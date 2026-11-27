/**
 * Feladat-értesítő levelek a Pannon Figyelő projekt (PannonGuard Komplex) arculatával: sötét fejléc arany kiemeléssel,
 * fehér törzs, hivatalos (magázó) hangnem. Minden levelet a projekt gazdája küld ki a saját nevében; a levélben
 * mindig látszik, ki kinek szól („Bali Emese → Török Krisztián”).
 * Függőség nélküli tiszta függvény, hogy szkriptből is használható legyen (node --experimental-strip-types).
 */
export type TaskMail = {
  kind: "assigned" | "comment";
  /** Akinek a levél szól. */
  recipientName: string;
  /** Aki a műveletet végezte (feladatot adott / hozzászólt). */
  actorName: string;
  /** A levélben a „Kinek” oldal: akinek a feladat/hozzászólás szól (egy vagy több név). */
  toNames: string[];
  taskTitle: string;
  description?: string;
  status: string;
  priority: string;
  due?: string;
  comment?: string;
  link: string;
  /** A levél kiküldője és aláírója. */
  senderName: string;
  logoCid: string;
};

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const names = (list: string[]) => (list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} és ${list[list.length - 1]}`);

export function buildTaskMail(mail: TaskMail) {
  const self = mail.recipientName === mail.actorName;
  const toMe = mail.toNames.includes(mail.recipientName);
  const others = mail.toNames.filter((name) => name !== mail.recipientName);
  const toText = names(mail.toNames.map((name) => (name === mail.recipientName ? "Ön" : name)));

  let headline: string;
  let lead: string;
  let ask: string;
  if (mail.kind === "assigned") {
    headline = self ? "Feladatot adott ki" : "Új feladatot kapott";
    lead = self
      ? `Tájékoztatjuk, hogy Ön új feladatot adott <strong>${esc(names(mail.toNames))}</strong> részére a Pannon Figyelő projekt felületén. A feladatról ${esc(names(mail.toNames))} is értesítést kapott.`
      : `Tájékoztatjuk, hogy <strong>${esc(mail.actorName)}</strong> új feladatot adott Önnek a Pannon Figyelő projekt felületén, és azt kéri, hogy végezze el az alábbi feladatot${mail.due ? ` <strong>${esc(mail.due)}</strong>-ig` : ""}.`;
    ask = self ? "A feladat állapotát a projekt felületén követheti nyomon." : "Kérjük, amint ideje engedi, szíveskedjen megtekinteni a feladatot, és megkezdeni a végrehajtását.";
  } else {
    headline = self ? "Hozzászólását továbbítottuk" : "Új hozzászólás érkezett";
    lead = self
      ? `Tájékoztatjuk, hogy az alábbi feladathoz írt hozzászólását továbbítottuk <strong>${esc(toText)}</strong> részére.`
      : `Tájékoztatjuk, hogy <strong>${esc(mail.actorName)}</strong> hozzászólást írt ${toMe ? "Önnek" : `<strong>${esc(toText)}</strong> részére`} az alábbi feladathoz${toMe && others.length ? ` (a hozzászólást ${esc(names(others))} is megkapta)` : ""}.`;
    ask = self ? "A válaszokról ugyanígy értesítést kap." : "Kérjük, amint ideje engedi, szíveskedjen megtekinteni, és szükség esetén válaszolni rá a feladatnál.";
  }
  const subject = mail.kind === "assigned" ? `${self ? "Kiadott feladat" : "Új feladat"}: „${mail.taskTitle}” – ${mail.actorName} → ${names(mail.toNames)}` : `Új hozzászólás: „${mail.taskTitle}” – ${mail.actorName} → ${names(mail.toNames)}`;
  const meta = [["Állapot", mail.status], ["Prioritás", mail.priority], ...(mail.due ? [["Határidő", mail.due]] : [])] as [string, string][];
  const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const message = mail.kind === "comment" ? mail.comment : mail.description;

  const text = [
    `Kedves ${mail.recipientName}!`,
    "",
    plain(lead),
    "",
    `Kitől: ${mail.actorName}  →  Kinek: ${toText}`,
    `Feladat: ${mail.taskTitle}`,
    meta.map(([label, value]) => `${label}: ${value}`).join(" · "),
    ...(message ? ["", mail.kind === "comment" ? `${mail.actorName} hozzászólása:` : "A feladat leírása:", ...message.split("\n").map((line) => `> ${line}`)] : []),
    "",
    ask,
    `A feladat megnyitása: ${mail.link}`,
    "",
    "Köszönjük együttműködését!",
    "",
    "Tisztelettel:",
    mail.senderName,
    "PannonGuard · Pannon Figyelő projekt",
  ].join("\n");

  const pill = (label: string, name: string, accent: boolean) =>
    `<td valign="top" style="padding:12px 14px;border-radius:12px;background:${accent ? "#0b1120" : "#ffffff"};border:1px solid ${accent ? "#0b1120" : "#ece3cc"};">
<div style="font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:${accent ? "#e8b84e" : "#a07a24"};">${label}</div>
<div style="margin-top:6px;font:700 15px/1.3 Arial,Helvetica,sans-serif;color:${accent ? "#ffffff" : "#0b1120"};">${esc(name)}</div></td>`;

  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef0f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(mail.actorName)} → ${esc(toText)}: ${esc(mail.taskTitle)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f4;"><tr><td align="center" style="padding:32px 14px;">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;">
<tr><td style="background:#0b1120;background-image:linear-gradient(160deg,#1c1a14 0%,#0b1120 55%,#060912 100%);border-radius:22px 22px 0 0;padding:36px 34px 28px;text-align:center;">
<img src="cid:${mail.logoCid}" width="64" alt="PannonGuard" style="display:block;margin:0 auto 16px;width:64px;height:auto;border:0;">
<div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#e8b84e;">PannonGuard · Pannon Figyelő projekt</div>
<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
<div style="font:400 27px/1.25 Georgia,'Times New Roman',serif;color:#ffffff;">${esc(headline)}</div></td></tr>
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background-color:#e8b84e;background-image:linear-gradient(90deg,#fbe7b0,#e8b84e 45%,#a8b8e0);">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:32px 34px 8px;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:#1b2232;">
<p style="margin:0 0 16px;">Kedves <strong>${esc(mail.recipientName)}</strong>!</p>
<p style="margin:0 0 22px;">${lead}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
${pill("Kitől", mail.actorName === mail.recipientName ? `${mail.actorName} (Ön)` : mail.actorName, false)}
<td width="44" align="center" style="font:700 22px/1 Arial,Helvetica,sans-serif;color:#e8b84e;">&rarr;</td>
${pill("Kinek", names(mail.toNames.map((name) => (name === mail.recipientName ? `${name} (Ön)` : name))), true)}
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ece3cc;background:#fbf8f0;border-radius:16px;margin:0 0 22px;"><tr><td style="padding:18px 20px;">
<div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#a07a24;">Feladat</div>
<div style="margin-top:8px;font:600 19px/1.35 Georgia,'Times New Roman',serif;color:#0b1120;">${esc(mail.taskTitle)}</div>
<div style="margin-top:10px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#5a6274;">${meta.map(([label, value]) => `${esc(label)}: <strong style="color:#2a3142;">${esc(value)}</strong>`).join(" &nbsp;·&nbsp; ")}</div>
</td></tr></table>
${
  message
    ? `<div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#7a8194;margin:0 0 10px;">${mail.kind === "comment" ? `${esc(mail.actorName)} hozzászólása` : "A feladat leírása"}</div>
<div style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #e8b84e;background:#f5f6f9;border-radius:0 12px 12px 0;color:#2a3142;font:400 15px/1.65 Arial,Helvetica,sans-serif;">${esc(message).replace(/\n/g, "<br>")}</div>`
    : ""
}
<p style="margin:0 0 22px;">${esc(ask)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background-color:#e8b84e;background-image:linear-gradient(135deg,#fbe7b0,#e8b84e);border-radius:12px;"><a href="${esc(mail.link)}" style="display:inline-block;padding:15px 30px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#060912;text-decoration:none;">Feladat megnyitása</a></td></tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#5a6274;">Ha a gomb nem működik, másolja be ezt a címet a böngészőbe:</p>
<p style="margin:0 0 26px;font:400 12px/1.5 Menlo,Consolas,monospace;color:#5a6274;word-break:break-all;">${esc(mail.link)}</p>
<p style="margin:0 0 4px;">Köszönjük együttműködését!</p>
<p style="margin:0 0 26px;">Tisztelettel:<br><strong>${esc(mail.senderName)}</strong><br><span style="color:#5a6274;">PannonGuard · Pannon Figyelő projekt</span></p>
</td></tr>
<tr><td style="background:#f7f5ef;border-radius:0 0 22px 22px;padding:18px 34px;border-top:1px solid #ece3cc;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6b7180;">PannonGuard Biztonsági Szolgáltató Zrt. · Értesítés a PannonGuard Komplex rendszer Pannon Figyelő projekt moduljából. A feladat résztvevői: ${esc(names([...new Set([mail.actorName, ...mail.toNames])]))}.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}
