import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, History } from "lucide-react";
import { LogRow } from "@/components/log-row";
import { PageTitle } from "@/components/page-title";
import { Empty, Input, Label, Panel, Select, Skeleton, buttonClass } from "@/components/ui";
import { LOG_KINDS, listLog, type LogQuery } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { listPeople } from "@/lib/users";

export const metadata: Metadata = { title: "Napló" };

const PAGE_SIZE = 100;

export default function LogPage({ searchParams }: PageProps<"/naplo">) {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Napló" title="Ki, mikor," accent="mit csinált.">
        Minden belépés, oldalmegnyitás és módosítás – a módosított mezők régi és új értékével, eszközzel és IP-címmel. A naplót senki nem
        törölheti vagy írhatja át.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

async function Log({ searchParams }: Pick<PageProps<"/naplo">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const query: LogQuery = {
    userId: one(params.szemely),
    kind: one(params.tipus),
    q: one(params.q).slice(0, 80),
    day: one(params.nap),
    views: one(params.megnyitasok) !== "nem",
  };
  const page = Math.max(1, Math.min(1000, Number(one(params.oldal)) || 1));
  const [{ rows, total }, people] = await Promise.all([listLog(query, { limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), listPeople()]);
  const now = new Date();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (overrides: Record<string, string>) => {
    const search = new URLSearchParams();
    const merged = { szemely: query.userId ?? "", tipus: query.kind ?? "", q: query.q ?? "", nap: query.day ?? "", megnyitasok: query.views ? "" : "nem", ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    return search.size ? `?${search}` : "?";
  };

  return (
    <div className="space-y-6">
      <Panel title="Szűrés" icon={Filter}>
        <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_10rem_auto] lg:items-end">
          <Label label="Személy">
            <select name="szemely" defaultValue={query.userId} className="pg-field pg-input h-11 w-full rounded-xl px-3 text-white [&>option]:bg-ink-900">
              <option value="">Mindenki</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Label>
          <Label label="Típus">
            <Select name="tipus" defaultValue={query.kind}>
              <option value="">Minden esemény</option>
              {Object.entries(LOG_KINDS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Keresés">
            <Input name="q" defaultValue={query.q} placeholder="Feladat, név, szöveg…" />
          </Label>
          <Label label="Nap">
            <Input name="nap" type="date" defaultValue={query.day} className="[color-scheme:dark]" />
          </Label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
            <button type="submit" className={buttonClass("primary")}>
              Szűrés
            </button>
            <Link href="/naplo" className={buttonClass("ghost")}>
              Törlés
            </Link>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/65 sm:col-span-2 lg:col-span-5">
            <input type="checkbox" name="megnyitasok" value="nem" defaultChecked={!query.views} className="size-4 accent-gold" />
            Oldalmegnyitások elrejtése (csak a műveletek és belépések)
          </label>
        </form>
      </Panel>

      <Panel
        title={`${total.toLocaleString("hu-HU")} bejegyzés`}
        icon={History}
        action={
          <a href={`/naplo/export${link({})}`} className={buttonClass("secondary", "sm")}>
            <Download size={15} aria-hidden /> Exportálás (CSV)
          </a>
        }
      >
        {rows.length === 0 ? (
          <Empty icon={History} title="Nincs találat" text="Próbálj más szűrést." />
        ) : (
          <ul className="divide-y divide-white/6">
            {rows.map((entry) => (
              <LogRow key={String(entry._id)} entry={entry} now={now} detailed />
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Lapozás" className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4 text-sm">
            {page > 1 ? (
              <Link href={link({ oldal: String(page - 1) })} className={buttonClass("ghost", "sm")}>
                <ChevronLeft size={15} aria-hidden /> Újabbak
              </Link>
            ) : (
              <span />
            )}
            <span className="text-white/50">
              {page}. / {pages} oldal
            </span>
            {page < pages ? (
              <Link href={link({ oldal: String(page + 1) })} className={buttonClass("ghost", "sm")}>
                Régebbiek <ChevronRight size={15} aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Panel>
    </div>
  );
}
