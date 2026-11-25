"use client";

import { useActionState, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, Save } from "lucide-react";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { createTask, moveTask, updateTask } from "@/lib/actions";
import type { FormState } from "@/lib/form";
import { STATUS_ORDER, TASK_PRIORITY, TASK_STATUS, type TaskStatus } from "@/lib/meta";
import type { Person } from "@/lib/users";

export type TaskValues = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  assigneeId: string;
  due: string;
};

function TaskFields({ people, values, autoFocus }: { people: Person[]; values?: Partial<TaskValues>; autoFocus?: boolean }) {
  return (
    <>
      <Label label="Feladat címe">
        <Input name="title" required minLength={2} maxLength={160} autoFocus={autoFocus} defaultValue={values?.title} placeholder="Mit kell elvégezni?" />
      </Label>
      <Label label="Részletek" hint="Nem kötelező">
        <Textarea name="description" maxLength={4000} rows={3} defaultValue={values?.description} />
      </Label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Label label="Állapot">
          <Select name="status" defaultValue={values?.status ?? "teendo"}>
            {STATUS_ORDER.map((key) => (
              <option key={key} value={key}>
                {TASK_STATUS[key]}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Prioritás">
          <Select name="priority" defaultValue={values?.priority ?? "normal"}>
            {Object.entries(TASK_PRIORITY).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Felelős">
          <Select name="assigneeId" defaultValue={values?.assigneeId ?? ""}>
            <option value="">Nincs kijelölve</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Határidő">
          <Input name="due" type="date" defaultValue={values?.due} className="[color-scheme:dark]" />
        </Label>
      </div>
    </>
  );
}

/** Új feladat felvétele: összecsukható, hogy a tábla maradjon a főszereplő. */
export function NewTaskForm({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createTask, {});
  const { ref, onSubmit } = useKeepForm(action, state, { resetOnOk: true });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        <Plus size={17} aria-hidden /> Új feladat
      </button>
    );
  }
  return (
    <form ref={ref} onSubmit={onSubmit} className="pg-panel pg-rise w-full space-y-4 rounded-3xl p-5">
      <TaskFields people={people} autoFocus />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Plus size={17} aria-hidden />} Felvétel
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
          Bezárás
        </button>
        <Feedback error={state.error} message={state.message} />
      </div>
    </form>
  );
}

export function EditTaskForm({ people, values }: { people: Person[]; values: TaskValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateTask, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={values.id} />
      <TaskFields people={people} values={values} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Save size={17} aria-hidden />} Mentés
        </button>
        <Feedback error={state.error} message={state.message} />
      </div>
    </form>
  );
}

/** Gyors áthelyezés a szomszédos oszlopba. */
export function MoveButtons({ id, status }: { id: string; status: TaskStatus }) {
  const [pending, start] = useTransition();
  const index = STATUS_ORDER.indexOf(status);
  const previous = STATUS_ORDER[index - 1];
  const next = STATUS_ORDER[index + 1];
  const button = "grid size-7 place-items-center rounded-lg text-white/45 transition hover:bg-white/8 hover:text-white disabled:opacity-30";
  return (
    <span className="flex items-center gap-0.5">
      {pending && <LoaderCircle size={14} aria-hidden className="mr-1 animate-spin text-gold" />}
      <button
        type="button"
        disabled={!previous || pending}
        onClick={() => start(() => moveTask(id, previous))}
        aria-label={previous ? `Áthelyezés ide: ${TASK_STATUS[previous]}` : undefined}
        title={previous ? `← ${TASK_STATUS[previous]}` : undefined}
        className={button}
      >
        <ChevronLeft size={16} aria-hidden />
      </button>
      <button
        type="button"
        disabled={!next || pending}
        onClick={() => start(() => moveTask(id, next))}
        aria-label={next ? `Áthelyezés ide: ${TASK_STATUS[next]}` : undefined}
        title={next ? `${TASK_STATUS[next]} →` : undefined}
        className={button}
      >
        <ChevronRight size={16} aria-hidden />
      </button>
    </span>
  );
}
