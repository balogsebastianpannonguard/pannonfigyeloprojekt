import type { Metadata } from "next";
import { Suspense } from "react";
import { History, LogOut, ShieldCheck } from "lucide-react";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton, buttonClass } from "@/components/ui";
import { logoutEverywhere } from "@/lib/auth-actions";
import { formatStamp } from "@/lib/dates";
import { listLog } from "@/lib/log";
import { countActiveSessions, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Fiókom" };

export default function AccountPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Fiókom" title="Belépések" accent="és biztonság.">
        Itt látod a saját belépéseidet. Elfelejtett jelszó esetén szólj annak, aki meghívott: az Elosztóból küld visszaállító linket.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  const [sessions, logins] = await Promise.all([countActiveSessions(user.oid), listLog({ userId: user.id, kind: "auth" }, { limit: 20 })]);
  const now = new Date();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Panel title="Fiók" icon={ShieldCheck}>
        <dl className="space-y-3 text-sm">
          {[
            ["Név", user.name],
            ["E-mail", user.email],
            ["Meghívta", user.invitedBy],
            ["Csatlakozott", formatStamp(user.createdAt)],
            ["Aktív munkamenetek", String(sessions)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-white/50">{label}</dt>
              <dd className="truncate text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <form action={logoutEverywhere} className="mt-5">
          <button type="submit" className={buttonClass("secondary")}>
            <LogOut size={16} aria-hidden /> Kijelentkezés minden eszközön
          </button>
        </form>
      </Panel>
      <Panel title="Saját belépéseim" icon={History}>
        <ul className="divide-y divide-white/6">
          {logins.rows.map((entry) => (
            <LogRow key={String(entry._id)} entry={entry} now={now} detailed />
          ))}
        </ul>
      </Panel>
    </div>
  );
}
