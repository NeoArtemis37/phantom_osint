// =============================================================================
// PHANTOM — Database Seed Script
// =============================================================================
// Creates the initial admin user so you can log in immediately after a fresh
// Supabase deploy. Safe to re-run (idempotent — skips if user already exists).
//
// Usage:
//   bun run db:seed
//
// Required env vars (must point to the DIRECT connection, not the pooler):
//   DIRECT_URL="postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres"
//
// Override the default admin credentials via env (do NOT leave defaults in prod):
//   SEED_ADMIN_EMAIL (default: admin@phantom.local)
//   SEED_ADMIN_PASSWORD (default: ChangeMe!2024)
//   SEED_ADMIN_NAME (default: PHANTOM Admin)
// =============================================================================

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient({
  // Seed must use the DIRECT url (PgBouncer pooler cannot run inserts reliably)
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
  log: ["warn", "error"],
});

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@phantom.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2024";
  const name = process.env.SEED_ADMIN_NAME ?? "PHANTOM Admin";

  console.log("── PHANTOM seed ──────────────────────────────────────");
  console.log(`  Target DB: ${(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@")}`);

  // 1. Upsert admin user
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`  ✓ Admin user already exists: ${email} (skipping)`);
  } else {
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "admin",
        clearance: "top-secret",
        active: true,
      },
    });
    console.log(`  ✓ Created admin user: ${user.email} (id: ${user.id})`);
    console.log(`    role: ${user.role}  clearance: ${user.clearance}`);
  }

  // 2. (Optional) create a demo analyst user — uncomment to enable
  // const analystEmail = "analyst@phantom.local";
  // if (!(await prisma.user.findUnique({ where: { email: analystEmail } }))) {
  //   await prisma.user.create({
  //     data: {
  //       email: analystEmail,
  //       name: "Demo Analyst",
  //       passwordHash: await hash("Analyst!2024", 12),
  //       role: "analyst",
  //       clearance: "confidential",
  //     },
  //   });
  //   console.log(`  ✓ Created demo analyst: ${analystEmail}`);
  // }

  console.log("── seed complete ─────────────────────────────────────");
  console.log("");
  console.log("  Login credentials (change password after first login):");
  console.log(`    Email:     ${email}`);
  console.log(`    Password:  ${password}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
