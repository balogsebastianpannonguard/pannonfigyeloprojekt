"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Törlés-gomb megerősítéssel; egy `<form action>` belsejébe kerül. */
export function ConfirmButton({ message, children, size = "md" }: { message: string; children: ReactNode; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={buttonClass("danger", size)}
    >
      {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : children}
    </button>
  );
}
