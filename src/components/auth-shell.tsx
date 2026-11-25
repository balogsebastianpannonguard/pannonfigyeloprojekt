import type { ReactNode } from "react";
import { History, KanbanSquare, MessagesSquare, Radar } from "lucide-react";
import { Backdrop, Brand } from "@/components/brand";

const FEATURES = [
  { icon: KanbanSquare, title: "Közös feladattábla", text: "Teendők, felelősök, határidők – mindenki ugyanazt látja." },
  { icon: MessagesSquare, title: "Üzenőfal és jegyzetek", text: "Döntések, egyeztetések és anyagok egy helyen." },
  { icon: History, title: "Teljes napló", text: "Ki, mikor, mit nyitott meg és mit módosított – visszakereshetően." },
];

/** A belépés, a regisztráció és a jelszó-visszaállítás közös kerete. */
export function AuthShell({
  eyebrow,
  title,
  accent,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh overflow-x-clip lg:grid-cols-[minmax(0,32rem)_1fr]">
      <Backdrop />

      <section className="pg-rise relative z-10 flex flex-col justify-center border-white/8 bg-ink-900/80 px-6 py-12 backdrop-blur-xl sm:px-12 lg:border-r">
        <Brand size="lg" />
        <p className="mt-14 text-xs font-semibold tracking-[0.22em] text-gold uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight">
          {title}
          <br />
          <span className="pg-accent-text">{accent}</span>
        </h1>
        <div className="mt-4 mb-9 text-white/60">{intro}</div>
        {children}
      </section>

      <aside className="relative hidden items-center justify-center p-12 lg:flex">
        <div className="w-full max-w-md space-y-4">
          <div className="pg-panel flex items-center gap-4 rounded-3xl p-6">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold">
              <Radar size={24} aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Egy közös tér</p>
              <p className="text-sm text-white/55">Aki meghívót kapott, ugyanazt a projektet látja – nincs rejtett nézet, nincs külön lista.</p>
            </div>
          </div>
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="pg-card pg-rise flex items-center gap-4 rounded-2xl p-5" style={{ animationDelay: `${0.15 + index * 0.1}s` }}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-iris/20 text-mist">
                <Icon size={19} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-white/55">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
