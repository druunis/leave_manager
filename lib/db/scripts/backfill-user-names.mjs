import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Idempotent backfill: split the legacy single `name` column into
// `first_name` / `last_name` for any user row that hasn't been populated yet.
// First whitespace-delimited token becomes the first name, the remainder the
// surname; a single-token name goes entirely into the first name.
const result = await pool.query(`
  UPDATE users
  SET
    first_name = split_part(btrim(name), ' ', 1),
    last_name = btrim(
      substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 1)
    )
  WHERE btrim(coalesce(first_name, '')) = ''
    AND btrim(coalesce(name, '')) <> '';
`);

console.log(`Backfilled first/last name for ${result.rowCount} user(s).`);

await pool.end();
