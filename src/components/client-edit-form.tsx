"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Save } from "lucide-react";
import { buttonClass, fieldClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { updateClient } from "@/lib/client-actions";
import { LONG_COLS, NUMBER_COLS } from "@/lib/client-fields";
import type { FormState } from "@/lib/form";

type EditColumn = { col: string; label: string; value: string; mark: string };

const MARKS = [
  { value: "", label: "Nincs" },
  { value: "sarga", label: "Sárga" },
  { value: "piros", label: "Piros" },
];

/** Az ügyfél összes mezőjének szerkesztése, kiemeléssel együtt. A megváltozott mezők jelölve vannak mentés előtt. */
export function ClientEditForm({ id, version, sections, columns }: { id: string; version: string; sections: { title: string; cols: string[] }[]; columns: EditColumn[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateClient, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const byCol = new Map(columns.map((column) => [column.col, column]));
  const [values, setValues] = useState(() => Object.fromEntries(columns.map((column) => [column.col, column.value])));
  const [marks, setMarks] = useState(() => Object.fromEntries(columns.map((column) => [column.col, column.mark])));
  const changed = columns.filter((column) => values[column.col] !== column.value || marks[column.col] !== column.mark).length;

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-6 pb-24">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      {sections.map((section) => (
        <section key={section.title} className="pg-panel rounded-3xl p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">{section.title}</h2>
          <div className="space-y-4">
            {section.cols.map((col) => {
              const column = byCol.get(col)!;
              const dirty = values[col] !== column.value || marks[col] !== column.mark;
              const mark = marks[col];
              const long = LONG_COLS.has(col) || column.value.length > 60;
              const inputClass = `${fieldClass} ${mark === "sarga" ? "!bg-yellow-300/10 !border-yellow-300/40" : ""} ${mark === "piros" ? "!text-red-300 font-medium" : ""}`;
              return (
                <div key={col} className={`grid gap-2 rounded-2xl p-2 sm:grid-cols-[13rem_1fr] sm:gap-4 ${dirty ? "bg-gold/6 ring-1 ring-gold/25" : ""}`}>
                  <label htmlFor={`v_${col}`} className="pt-2 text-sm text-white/60">
                    {column.label}
                    <span className="ml-1.5 font-mono text-[0.65rem] text-white/25">{col}</span>
                    {dirty && <span className="mt-1 block text-[0.7rem] font-semibold text-gold">módosítva</span>}
                  </label>
                  <div className="min-w-0 space-y-2">
                    {long ? (
                      <textarea
                        id={`v_${col}`}
                        name={`v_${col}`}
                        value={values[col]}
                        onChange={(event) => setValues({ ...values, [col]: event.target.value })}
                        rows={Math.min(8, Math.max(2, Math.ceil(values[col].length / 70)))}
                        maxLength={4000}
                        className={`${inputClass} py-2.5 leading-relaxed`}
                      />
                    ) : (
                      <input
                        id={`v_${col}`}
                        name={`v_${col}`}
                        value={values[col]}
                        onChange={(event) => setValues({ ...values, [col]: event.target.value })}
                        inputMode={NUMBER_COLS.has(col) ? "decimal" : undefined}
                        maxLength={1000}
                        className={`${inputClass} h-11`}
                      />
                    )}
                    <fieldset className="flex flex-wrap items-center gap-1.5 text-xs">
                      <legend className="sr-only">{column.label} – kiemelés</legend>
                      <span className="mr-1 text-white/40">Kiemelés:</span>
                      {MARKS.map((option) => (
                        <label
                          key={option.value}
                          className={`cursor-pointer rounded-lg px-2.5 py-1 ring-1 transition ring-inset ${
                            mark === option.value
                              ? option.value === "sarga"
                                ? "bg-yellow-300/20 text-yellow-100 ring-yellow-300/50"
                                : option.value === "piros"
                                  ? "bg-red-500/15 text-red-200 ring-red-400/50"
                                  : "bg-white/10 text-white ring-white/25"
                              : "text-white/50 ring-white/10 hover:text-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`m_${col}`}
                            value={option.value}
                            checked={mark === option.value}
                            onChange={() => setMarks({ ...marks, [col]: option.value })}
                            className="sr-only"
                          />
                          {option.label}
                        </label>
                      ))}
                    </fieldset>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-900/95 backdrop-blur-xl lg:left-[16.5rem]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
          <button type="submit" disabled={pending || changed === 0} className={buttonClass("primary")}>
            {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Save size={17} aria-hidden />}
            Mentés{changed > 0 ? ` (${changed} mező)` : ""}
          </button>
          <Link href={`/ugyfelek/${id}`} className={buttonClass("ghost")}>
            Mégse
          </Link>
          <p role="status" className={`min-w-0 flex-1 text-sm ${state.error ? "text-red-300" : "text-white/50"}`}>
            {state.error ?? state.message ?? (changed === 0 ? "Még nincs változtatás." : "A mentés a régi és az új értékkel együtt naplózódik.")}
          </p>
        </div>
      </div>
    </form>
  );
}
