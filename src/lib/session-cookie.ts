// A munkamenet-süti neve; külön fájlban, hogy a proxy adatbázis-függőség nélkül is használhassa.
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-pg_figyeloprojekt_session" : "pg_figyeloprojekt_session";
