import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
try {
  const migration = await readFile(
    new URL("../supabase/migrations/001_daily.sql", import.meta.url),
    "utf8",
  );
  const krillionMigration = await readFile(
    new URL("../supabase/migrations/002_krillion.sql", import.meta.url),
    "utf8",
  );
  const ownerMigration = await readFile(
    new URL("../supabase/migrations/003_owner_signup.sql", import.meta.url),
    "utf8",
  );
  const test = (
    await readFile(new URL("../tests/database.sql", import.meta.url), "utf8")
  )
    .replace(/^\\set.*$/gm, "")
    .replace(
      /^\\ir.*$/gm,
      () => migration + "\n" + krillionMigration + "\n" + ownerMigration,
    );
  await db.exec(test);
  console.log(
    "Database checks passed: permissions, invitations, duplicate submissions, edits, cutoff, simultaneous daily ratings, singleton, catch-up, idempotency.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
