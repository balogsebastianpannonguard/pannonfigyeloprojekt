/** Kliensen és szerveren is használt felirat-táblák. */

export const TASK_STATUS = {
  teendo: "Teendő",
  folyamatban: "Folyamatban",
  ellenorzes: "Ellenőrzésre vár",
  kesz: "Kész",
} as const;
export type TaskStatus = keyof typeof TASK_STATUS;
export const STATUS_ORDER = Object.keys(TASK_STATUS) as TaskStatus[];

export const TASK_PRIORITY = {
  alacsony: "Alacsony",
  normal: "Normál",
  magas: "Magas",
  surgos: "Sürgős",
} as const;
export type TaskPriority = keyof typeof TASK_PRIORITY;

export const isStatus = (value: string): value is TaskStatus => value in TASK_STATUS;
export const isPriority = (value: string): value is TaskPriority => value in TASK_PRIORITY;

/** Az oldalak neve a naplóban („megnyitotta a Feladatok oldalt”). */
export function pageName(path: string) {
  if (path === "/") return "az Áttekintést";
  if (path === "/feladatok") return "a Feladatok táblát";
  if (path.startsWith("/feladatok/")) return "egy feladat adatlapját";
  if (path === "/uzenofal") return "az Üzenőfalat";
  if (path === "/jegyzetek") return "a Jegyzeteket";
  if (path.startsWith("/jegyzetek/")) return "egy jegyzetet";
  if (path.startsWith("/naplo")) return "a Naplót";
  if (path === "/csapat") return "a Csapat oldalt";
  if (path === "/fiok") return "a Fiókom oldalt";
  return path;
}
