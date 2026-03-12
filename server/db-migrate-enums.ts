/**
 * Pre-migration script to handle PostgreSQL enum additions.
 * Drizzle-kit cannot reliably ALTER TYPE ... ADD VALUE for existing enums,
 * so we run these manually before drizzle-kit generate/migrate.
 */
import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

// Load .env from the project root (same as drizzle-kit does)
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL not found, skipping enum migration");
    return;
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    // Add new enum values that drizzle-kit cannot handle
    const enumAdditions: { type: string; value: string }[] = [
      { type: "lead_type", value: "event_promotor" },
    ];

    for (const { type, value } of enumAdditions) {
      // Check if the value already exists in the enum
      const check = await pool.query(
        `SELECT 1 FROM pg_enum WHERE enumlabel = $1 AND enumtypid = (SELECT oid FROM pg_type WHERE typname = $2)`,
        [value, type]
      );
      if (check.rows.length === 0) {
        await pool.query(`ALTER TYPE "${type}" ADD VALUE '${value}'`);
        console.log(`Added '${value}' to enum '${type}'`);
      } else {
        console.log(`Enum '${type}' already has '${value}'`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Enum migration failed:", err);
  process.exit(1);
});
