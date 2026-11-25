# Biztonság – Pannon Figyelő projekt

- **Hozzáférés:** fiókot csak az Elosztóból küldött, `Pannon Figyelő projekt` munkakörű, érvényes és vissza nem vont meghívóval lehet nyitni (egyszeri beváltás, a token hash-e tárolt). Az Elosztóban visszavont hozzáférést minden kérés ellenőrzi (legfeljebb 30 mp gyorsítótár).
- **Hitelesítés:** scrypt jelszó-hash, nincs második faktor (egyelőre tudatos döntés): legalább 12 karakteres, változatos jelszó kötelező. 8 hibás próbálkozás után 15 perc zárolás.
- **Munkamenet:** 12 órás élettartam, 2 óra tétlenség után lejár; élesben `__Host-` süti; kijelentkezés minden eszközről; jelszócserénél minden munkamenet megszűnik.
- **Jogosultság:** minden belépett tag ugyanazt látja és ugyanazt teheti (közös munkatér). Saját hozzászólást és üzenőfal-bejegyzést csak a szerzője törölhet. Minden szerverművelet a szerveren ellenőrzi a munkamenetet.
- **Napló:** minden belépés, sikertelen belépés, oldalmegnyitás és módosítás IP-címmel és eszközzel; a módosításoknál a régi és új érték is. A felületről a napló nem törölhető.
- **Webes védelem:** CSP, HSTS, clickjacking- és MIME-védelem, noindex.

Teendő: a napló (IP-cím, tevékenység) kezelésének célját és megőrzési idejét rögzíteni (GDPR 30. cikk), és a meghívottakat tájékoztatni a naplózásról.
