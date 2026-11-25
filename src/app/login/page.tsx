import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Belépés" };

const NOTICES: Record<string, string> = {
  kilepve: "Sikeresen kijelentkeztél.",
  mindenhol: "Minden eszközön kijelentkeztél.",
  visszavonva: "A hozzáférésedet visszavonták vagy letiltották. Fordulj ahhoz, aki meghívott.",
  jelszocsere: "Az új jelszavad be van állítva. Lépj be vele.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      eyebrow="Belépés"
      title="Egy csapat, egy tábla,"
      accent="minden lépés naplózva."
      intro="Lépj be az e-mail-címeddel és a jelszavaddal. Itt mindenki ugyanazt látja, és minden módosítás nyomon követhető."
    >
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginWithNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // Már belépett felhasználót a kezdőlapra küldünk (a proxy ezt adatbázis nélkül nem tudja eldönteni).
  if (await getSession()) redirect("/");
  const { ok, next } = await searchParams;
  return <LoginForm notice={typeof ok === "string" ? NOTICES[ok] : undefined} next={typeof next === "string" ? next : undefined} />;
}
