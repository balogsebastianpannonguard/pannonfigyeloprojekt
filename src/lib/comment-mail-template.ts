/**
 * Értesítő levél új feladat-hozzászólásról – a Pannon Figyelő projekt (PannonGuard Komplex) arculatával:
 * sötét fejléc arany kiemeléssel, fehér törzs, hivatalos (magázó) hangnem.
 * Függőség nélküli tiszta függvény, hogy szkriptből is használható legyen (node --experimental-strip-types).
 */
export type CommentMail = {
  recipientName: string;
  /** Miért kapja: ő hozta létre a feladatot, vagy ő a felelőse. */
  reason: "creator" | "assignee";
  authorName: string;
  taskTitle: string;
  status: string;
  priority: string;
  due?: string;
  comment: string;
  link: string;
  /** A levél logójának cid-je (a mellékletben). */
  logoCid: string;
};

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function buildCommentMail(mail: CommentMail) {
  const whose = mail.reason === "creator" ? "az Ön által létrehozott" : "az Önhöz rendelt";
  const subject = `Új hozzászólás: „${mail.taskTitle}”`;
  const meta = [
    ["Állapot", mail.status],
    ["Prioritás", mail.priority],
    ...(mail.due ? [["Határidő", mail.due]] : []),
  ] as [string, string][];

  const text = [
    `Kedves ${mail.recipientName}!`,
    "",
    `Tájékoztatjuk, hogy ${whose} „${mail.taskTitle}” feladathoz ${mail.authorName} új hozzászólást írt a Pannon Figyelő projekt felületén:`,
    "",
    ...mail.comment.split("\n").map((line) => `> ${line}`),
    "",
    meta.map(([label, value]) => `${label}: ${value}`).join(" · "),
    "",
    "Kérjük, amint ideje engedi, szíveskedjen megtekinteni, és szükség esetén válaszolni rá.",
    `A feladat megnyitása: ${mail.link}`,
    "",
    "Köszönjük együttműködését!",
    "",
    "Tisztelettel:",
    mail.authorName,
    "PannonGuard · Pannon Figyelő projekt",
  ].join("\n");

  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef0f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(mail.authorName)} új hozzászólást írt a(z) „${esc(mail.taskTitle)}” feladathoz.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f4;"><tr><td align="center" style="padding:32px 14px;">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;">
<tr><td style="background:#0b1120;background-image:linear-gradient(160deg,#1c1a14 0%,#0b1120 55%,#060912 100%);border-radius:22px 22px 0 0;padding:36px 34px 28px;text-align:center;">
<img src="cid:${mail.logoCid}" width="64" alt="PannonGuard" style="display:block;margin:0 auto 16px;width:64px;height:auto;border:0;">
<div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#e8b84e;">PannonGuard · Pannon Figyelő projekt</div>
<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
<div style="font:400 27px/1.25 Georgia,'Times New Roman',serif;color:#ffffff;">Új hozzászólás érkezett</div>
<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
<div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#aab3c5;">egy Önt érintő feladathoz</div></td></tr>
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background-color:#e8b84e;background-image:linear-gradient(90deg,#fbe7b0,#e8b84e 45%,#a8b8e0);">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:32px 34px 8px;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:#1b2232;">
<p style="margin:0 0 16px;">Kedves <strong>${esc(mail.recipientName)}</strong>!</p>
<p style="margin:0 0 20px;">Tájékoztatjuk, hogy ${whose} feladathoz <strong>${esc(mail.authorName)}</strong> új hozzászólást írt a Pannon Figyelő projekt felületén.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ece3cc;background:#fbf8f0;border-radius:16px;margin:0 0 22px;"><tr><td style="padding:18px 20px;">
<div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#a07a24;">Feladat</div>
<div style="margin-top:8px;font:600 19px/1.35 Georgia,'Times New Roman',serif;color:#0b1120;">${esc(mail.taskTitle)}</div>
<div style="margin-top:10px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#5a6274;">${meta.map(([label, value]) => `${esc(label)}: <strong style="color:#2a3142;">${esc(value)}</strong>`).join(" &nbsp;·&nbsp; ")}</div>
</td></tr></table>
<div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#7a8194;margin:0 0 10px;">${esc(mail.authorName)} hozzászólása</div>
<div style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #e8b84e;background:#f5f6f9;border-radius:0 12px 12px 0;color:#2a3142;font:400 15px/1.65 Arial,Helvetica,sans-serif;">${esc(mail.comment).replace(/\n/g, "<br>")}</div>
<p style="margin:0 0 22px;">Kérjük, amint ideje engedi, szíveskedjen megtekinteni, és szükség esetén válaszolni rá.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background-color:#e8b84e;background-image:linear-gradient(135deg,#fbe7b0,#e8b84e);border-radius:12px;"><a href="${esc(mail.link)}" style="display:inline-block;padding:15px 30px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#060912;text-decoration:none;">Feladat megnyitása</a></td></tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#5a6274;">Ha a gomb nem működik, másolja be ezt a címet a böngészőbe:</p>
<p style="margin:0 0 26px;font:400 12px/1.5 Menlo,Consolas,monospace;color:#5a6274;word-break:break-all;">${esc(mail.link)}</p>
<p style="margin:0 0 4px;">Köszönjük együttműködését!</p>
<p style="margin:0 0 26px;">Tisztelettel:<br><strong>${esc(mail.authorName)}</strong><br><span style="color:#5a6274;">PannonGuard · Pannon Figyelő projekt</span></p>
</td></tr>
<tr><td style="background:#f7f5ef;border-radius:0 0 22px 22px;padding:18px 34px;border-top:1px solid #ece3cc;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6b7180;">PannonGuard Biztonsági Szolgáltató Zrt. · Automatikus értesítés a PannonGuard Komplex rendszer Pannon Figyelő projekt moduljából. A levélre válaszolva közvetlenül ${esc(mail.authorName)} kapja meg az üzenetét.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}
