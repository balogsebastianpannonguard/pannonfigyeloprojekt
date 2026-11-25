"use client";

import { useActionState } from "react";
import { LoaderCircle, Plus, Save, Send } from "lucide-react";
import { Feedback, Input, Label, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { addComment, createNote, createPost, updateNote } from "@/lib/actions";
import type { FormState } from "@/lib/form";

function Spinner({ pending, icon }: { pending: boolean; icon: React.ReactNode }) {
  return pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : icon;
}

export function CommentForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addComment, {});
  const { ref, onSubmit } = useKeepForm(action, state, { resetOnOk: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea name="body" required maxLength={4000} rows={3} placeholder="Írj hozzászólást…" aria-label="Hozzászólás" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          <Spinner pending={pending} icon={<Send size={15} aria-hidden />} /> Küldés
        </button>
        <Feedback error={state.error} />
      </div>
    </form>
  );
}

export function PostForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createPost, {});
  const { ref, onSubmit } = useKeepForm(action, state, { resetOnOk: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <Textarea name="body" required minLength={2} maxLength={4000} rows={3} placeholder="Mit kell tudnia a csapatnak?" aria-label="Új üzenet" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          <Spinner pending={pending} icon={<Send size={16} aria-hidden />} /> Közzététel
        </button>
        <Feedback error={state.error} />
      </div>
    </form>
  );
}

export function NewNoteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createNote, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Label label="Új jegyzet címe" className="min-w-0 flex-1">
        <Input name="title" required minLength={2} maxLength={160} placeholder="pl. Ügyfélmegbeszélés – november" />
      </Label>
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        <Spinner pending={pending} icon={<Plus size={17} aria-hidden />} /> Létrehozás
      </button>
      <Feedback error={state.error} />
    </form>
  );
}

export function NoteEditor({ id, title, body }: { id: string; title: string; body: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateNote, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Label label="Cím">
        <Input name="title" required minLength={2} maxLength={160} defaultValue={title} />
      </Label>
      <Label label="Tartalom">
        <Textarea name="body" maxLength={50_000} rows={16} defaultValue={body} className="min-h-80 font-mono text-sm" />
      </Label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          <Spinner pending={pending} icon={<Save size={17} aria-hidden />} /> Mentés
        </button>
        <Feedback error={state.error} message={state.message} />
      </div>
    </form>
  );
}
