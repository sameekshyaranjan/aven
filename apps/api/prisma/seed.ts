/**
 * Aven Database Seed — Stage 020
 *
 * Inserts fictional demo organizations and users for local development.
 * All identities are synthetic. No real patient, hospital, or insurer data.
 *
 * Design decisions:
 *  - Fixed UUIDs: every re-run produces the same IDs so foreign keys,
 *    JWT fixtures, and future seeds never break.
 *  - Idempotent upsert (upsert with update: {}): safe to run multiple
 *    times; existing rows are left unchanged, missing rows are created.
 *  - Standalone PrismaClient: does NOT import from src/db/prisma.ts
 *    because that module pulls in env.ts which requires JWT_SECRET and
 *    other runtime env vars that are not needed during seeding.
 *  - dotenv loaded manually so DATABASE_URL is available without the
 *    full application config validation chain.
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the apps/api directory (one level up from prisma/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Stable UUIDs — hardcoded so every environment gets identical primary keys.
// These are safe to commit: they are fictional identifiers, not secrets.
// ---------------------------------------------------------------------------

const IDS = {
  // Organizations (stored as Hospital rows — isInsurer flag differentiates)
  MERIDIAN: 'a1000000-0000-4000-8000-000000000001',   // fictional insurer org
  CITY_CARE: 'a2000000-0000-4000-8000-000000000002',  // fictional hospital 1
  METRO_GENERAL: 'a3000000-0000-4000-8000-000000000003', // fictional hospital 2

  // Users
  ADMIN_USER: 'b1000000-0000-4000-8000-000000000001',
  REVIEWER_1: 'b2000000-0000-4000-8000-000000000002',
  REVIEWER_2: 'b3000000-0000-4000-8000-000000000003',
  DESK_CITY_CARE: 'b4000000-0000-4000-8000-000000000004',
  DESK_METRO: 'b5000000-0000-4000-8000-000000000005',
  PATIENT_1: 'b6000000-0000-4000-8000-000000000006',
} as const;

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

/**
 * Organizations.
 *
 * Meridian Health Assurance is the fictional insurer. It is modeled as a
 * Hospital row with slug "meridian-health-assurance" so that insurer
 * reviewer users can have a consistent hospitalId anchor without requiring
 * a separate Organization table (which arrives in a later stage).
 *
 * City Care Hospital and Metro General are fictional network hospitals.
 */
const organizations = [
  {
    id: IDS.MERIDIAN,
    name: 'Meridian Health Assurance',
    slug: 'meridian-health-assurance',
    rohiniId: null,             // insurers are not in the ROHINI hospital registry
    city: 'Mumbai',
    state: 'Maharashtra',
    isActive: true,
  },
  {
    id: IDS.CITY_CARE,
    name: 'City Care Hospital',
    slug: 'city-care-hospital',
    rohiniId: 'ROHINI-CC-10001', // fictional ROHINI network ID
    city: 'Mumbai',
    state: 'Maharashtra',
    isActive: true,
  },
  {
    id: IDS.METRO_GENERAL,
    name: 'Metro General Hospital',
    slug: 'metro-general-hospital',
    rohiniId: 'ROHINI-MG-10002', // fictional ROHINI network ID
    city: 'Pune',
    state: 'Maharashtra',
    isActive: true,
  },
] as const;

/**
 * Demo users.
 *
 * One account per role so every portal can be demonstrated end-to-end.
 * Passwords are deliberately absent — Stage 024 (demo login) will issue
 * JWTs by account ID selection, not password verification.
 *
 * hospitalId assignments:
 *  - ADMIN / INSURER_REVIEWER → Meridian (they work for the insurer)
 *  - HOSPITAL_DESK            → their specific network hospital
 *  - PATIENT                  → null (patients are not staff of any hospital)
 */
const users = [
  {
    id: IDS.ADMIN_USER,
    email: 'admin@meridian-demo.aven',
    name: 'Priya Sharma',
    role: UserRole.ADMIN,
    hospitalId: IDS.MERIDIAN,
    isActive: true,
  },
  {
    id: IDS.REVIEWER_1,
    email: 'reviewer.arjun@meridian-demo.aven',
    name: 'Arjun Mehta',
    role: UserRole.INSURER_REVIEWER,
    hospitalId: IDS.MERIDIAN,
    isActive: true,
  },
  {
    id: IDS.REVIEWER_2,
    email: 'reviewer.kavya@meridian-demo.aven',
    name: 'Kavya Nair',
    role: UserRole.INSURER_REVIEWER,
    hospitalId: IDS.MERIDIAN,
    isActive: true,
  },
  {
    id: IDS.DESK_CITY_CARE,
    email: 'desk@citycare-demo.aven',
    name: 'Rohan Desai',
    role: UserRole.HOSPITAL_DESK,
    hospitalId: IDS.CITY_CARE,
    isActive: true,
  },
  {
    id: IDS.DESK_METRO,
    email: 'desk@metrogeneral-demo.aven',
    name: 'Sneha Kulkarni',
    role: UserRole.HOSPITAL_DESK,
    hospitalId: IDS.METRO_GENERAL,
    isActive: true,
  },
  {
    id: IDS.PATIENT_1,
    email: 'patient.arun@demo.aven',
    name: 'Arun Verma',
    role: UserRole.PATIENT,
    hospitalId: null,
    isActive: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🌱 Aven seed starting...\n');

  // --- Upsert organizations (hospitals + insurer org) ---
  console.log('📋 Upserting organizations...');

  for (const org of organizations) {
    await prisma.hospital.upsert({
      where: { id: org.id },
      update: {},  // no-op if row already exists — preserves any manual edits
      create: org,
    });
    console.log(`   ✔ ${org.name} (${org.slug})`);
  }

  // --- Upsert users ---
  console.log('\n👤 Upserting users...');

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},  // no-op if row already exists
      create: user,
    });
    console.log(`   ✔ ${user.name} <${user.email}> [${user.role}]`);
  }

  // --- Summary ---
  const hospitalCount = await prisma.hospital.count();
  const userCount = await prisma.user.count();

  console.log('\n✅ Seed complete.');
  console.log(`   Hospitals / orgs in DB : ${hospitalCount}`);
  console.log(`   Users in DB            : ${userCount}`);
  console.log('\nDemo accounts:');
  console.log('   ADMIN           → admin@meridian-demo.aven');
  console.log('   INSURER_REVIEWER → reviewer.arjun@meridian-demo.aven');
  console.log('   INSURER_REVIEWER → reviewer.kavya@meridian-demo.aven');
  console.log('   HOSPITAL_DESK   → desk@citycare-demo.aven    (City Care Hospital)');
  console.log('   HOSPITAL_DESK   → desk@metrogeneral-demo.aven (Metro General)');
  console.log('   PATIENT         → patient.arun@demo.aven\n');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
