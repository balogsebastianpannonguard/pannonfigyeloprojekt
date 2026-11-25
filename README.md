# Pannon Figyelő projekt

Közös projekttér a PannonGuard Komplexben. **Mindenki, akit az Elosztóból meghívnak, ugyanazt látja**: egy közös feladattáblát, üzenőfalat és jegyzeteket. Nincs külön admin- vagy tagnézet, nincs projektenkénti jogosultság. A belépés e-mail-címmel és jelszóval történik, **hitelesítő alkalmazás (TOTP) nincs**.

## Napló

Minden lépés a `log` gyűjteménybe kerül: ki, mikor, mit csinált, melyik eszközről és IP-címről.

- **Fiók:** regisztráció, belépés, sikertelen belépés, zárolás, kijelentkezés, jelszócsere.
- **Oldalmegnyitás:** minden oldalváltás (`src/components/live.tsx` → `trackView`).
- **Műveletek:** feladat létrehozása, módosítása (a mezők régi és új értékével), áthelyezése és törlése; hozzászólás; üzenet, kitűzés; jegyzet létrehozása, szerkesztése (régi és új tartalommal) és törlése; naplóexport.

A Napló oldalon személy, típus, nap és szöveg szerint lehet szűrni, és CSV-be exportálni. A naplóban a felületről semmi nem törölhető vagy módosítható. A feladatoknak és a jegyzeteknek saját „Előzmények” paneljük is van.

A közös nézetek 20 másodpercenként maguktól frissülnek, ha a fül látható és épp senki nem gépel.

## Kapcsolat az Elosztóval

Az Elosztóban a **Pannon Figyelő projekt** munkakörre küldött meghívó linkje ide mutat (`/regisztracio?token=…`, az Elosztó `FIGYELOPROJEKT_URL` változója). A hozzáférést az Elosztó vonja vissza, és a jelszó-visszaállító linket is az küldi (`/jelszo-visszaallitas?token=…`).

## Környezeti változók

| Változó | Leírás |
| --- | --- |
| `MONGODB_URI` | MongoDB kapcsolat (közös fürt) |
| `MONGODB_DB` | Saját adatbázis (`pannonguard_figyeloprojekt`) |
| `INVITES_DB` | Az Elosztó adatbázisa (`pannonguard_eloszto`) |

## Fejlesztés

```bash
npm install
npm run dev   # http://localhost:3010
```

Helyi teszthez **külön teszt-adatbázist** használj: `MONGODB_DB` és `INVITES_DB` is `_teszt` végű legyen. Ekkor a `npm run seed:test -- email "Vezetéknév Keresztnév" jelszó` létrehoz egy tesztfelhasználót (élő adatbázison nem fut le).
