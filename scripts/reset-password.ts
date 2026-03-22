/**
 * Reset a user's password by email address.
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <email> <new-password>
 *
 * Example:
 *   npx tsx scripts/reset-password.ts arjen@sendrato.com MyNewPassword123
 *
 * Requires DATABASE_URL env var to be set.
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

async function main() {
  const [email, newPassword] = process.argv.slice(2);

  if (!email || !newPassword) {
    console.error(
      "Usage: npx tsx scripts/reset-password.ts <email> <new-password>"
    );
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    const { rows } = await pool.query(
      "SELECT id, email, role FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const user = rows[0];
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.query(
      'UPDATE users SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2',
      [hash, user.id]
    );

    console.log(
      `Password reset successfully for ${user.email} (role: ${user.role})`
    );
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
