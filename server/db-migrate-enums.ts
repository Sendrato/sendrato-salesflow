/**
 * Pre-migration script to handle PostgreSQL enum additions.
 * Drizzle-kit cannot reliably ALTER TYPE ... ADD VALUE for existing enums,
 * so we run these manually before drizzle-kit generate/migrate.
 */
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
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
