/**
 * Aven Database Seed — through Stage 036
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
  MERIDIAN: 'a1000000-0000-4000-8000-000000000001', // fictional insurer org
  CITY_CARE: 'a2000000-0000-4000-8000-000000000002', // fictional hospital 1
  METRO_GENERAL: 'a3000000-0000-4000-8000-000000000003', // fictional hospital 2

  // Users
  ADMIN_USER: 'b1000000-0000-4000-8000-000000000001',
  REVIEWER_1: 'b2000000-0000-4000-8000-000000000002',
  REVIEWER_2: 'b3000000-0000-4000-8000-000000000003',
  DESK_CITY_CARE: 'b4000000-0000-4000-8000-000000000004',
  DESK_METRO: 'b5000000-0000-4000-8000-000000000005',
  PATIENT_1: 'b6000000-0000-4000-8000-000000000006',

  // Supported policy products
  CARE_ADVANCED_PRODUCT: 'c1000000-0000-4000-8000-000000000001',
  CARE_ADVANTAGE_PRODUCT: 'c1000000-0000-4000-8000-000000000002',
  CARE_SUPREME_PRODUCT: 'c1000000-0000-4000-8000-000000000003',
  SENIOR_HEALTH_ADVANTAGE_PRODUCT: 'c1000000-0000-4000-8000-000000000004',
  SPECIAL_CARE_PRODUCT: 'c1000000-0000-4000-8000-000000000005',
  ULTIMATE_CARE_PRODUCT: 'c1000000-0000-4000-8000-000000000006',

  // Supported policy versions
  CARE_ADVANCED_V1: 'c2000000-0000-4000-8000-000000000001',
  CARE_ADVANTAGE_V1: 'c2000000-0000-4000-8000-000000000002',
  CARE_SUPREME_V1: 'c2000000-0000-4000-8000-000000000003',
  SENIOR_HEALTH_ADVANTAGE_V1: 'c2000000-0000-4000-8000-000000000004',
  SPECIAL_CARE_V1: 'c2000000-0000-4000-8000-000000000005',
  ULTIMATE_CARE_V1: 'c2000000-0000-4000-8000-000000000006',
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
    rohiniId: null, // insurers are not in the ROHINI hospital registry
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

/**
 * Supported product names from the supplied T&C documents.
 * The filename dates are not treated as policy-validity dates. PDF text,
 * clauses, addons and embeddings are deferred to private RAG ingestion.
 */
const policyCatalog = [
  {
    productId: IDS.CARE_ADVANCED_PRODUCT,
    versionId: IDS.CARE_ADVANCED_V1,
    code: 'CARE_ADVANCED',
    name: 'Care Advanced',
  },
  {
    productId: IDS.CARE_ADVANTAGE_PRODUCT,
    versionId: IDS.CARE_ADVANTAGE_V1,
    code: 'CARE_ADVANTAGE',
    name: 'Care Advantage',
  },
  {
    productId: IDS.CARE_SUPREME_PRODUCT,
    versionId: IDS.CARE_SUPREME_V1,
    code: 'CARE_SUPREME',
    name: 'Care Supreme',
  },
  {
    productId: IDS.SENIOR_HEALTH_ADVANTAGE_PRODUCT,
    versionId: IDS.SENIOR_HEALTH_ADVANTAGE_V1,
    code: 'SENIOR_HEALTH_ADVANTAGE',
    name: 'Senior Health Advantage',
  },
  {
    productId: IDS.SPECIAL_CARE_PRODUCT,
    versionId: IDS.SPECIAL_CARE_V1,
    code: 'SPECIAL_CARE',
    name: 'Special Care',
  },
  {
    productId: IDS.ULTIMATE_CARE_PRODUCT,
    versionId: IDS.ULTIMATE_CARE_V1,
    code: 'ULTIMATE_CARE',
    name: 'Ultimate Care',
  },
] as const;

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.info('🌱 Aven seed starting...\n');

  // --- Upsert organizations (hospitals + insurer org) ---
  console.info('📋 Upserting organizations...');

  for (const org of organizations) {
    await prisma.hospital.upsert({
      where: { id: org.id },
      update: {}, // no-op if row already exists — preserves any manual edits
      create: org,
    });
    console.info(`   ✔ ${org.name} (${org.slug})`);
  }

  // --- Upsert users ---
  console.info('\n👤 Upserting users...');

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {}, // no-op if row already exists
      create: user,
    });
    console.info(`   ✔ ${user.name} <${user.email}> [${user.role}]`);
  }

  // --- Upsert policy catalog metadata ---
  console.info('\n📚 Upserting supported policy catalog...');

  for (const policy of policyCatalog) {
    await prisma.policyProduct.upsert({
      where: { id: policy.productId },
      update: {},
      create: {
        id: policy.productId,
        insurerId: IDS.MERIDIAN,
        code: policy.code,
        name: policy.name,
      },
    });

    // PolicyVersion rows are immutable, so create only when missing instead
    // of issuing an upsert update that could activate the mutation trigger.
    const existingVersion = await prisma.policyVersion.findUnique({
      where: { id: policy.versionId },
      select: { id: true },
    });

    if (!existingVersion) {
      await prisma.policyVersion.create({
        data: {
          id: policy.versionId,
          policyProductId: policy.productId,
          versionNumber: 1,
        },
      });
    }

    console.info(`   ✔ ${policy.name} v1`);
  }

  // --- Summary ---
  const hospitalCount = await prisma.hospital.count();
  const userCount = await prisma.user.count();
  const policyProductCount = await prisma.policyProduct.count();
  const policyVersionCount = await prisma.policyVersion.count();

  console.info('\n✅ Seed complete.');
  console.info(`   Hospitals / orgs in DB : ${hospitalCount}`);
  console.info(`   Users in DB            : ${userCount}`);
  console.info(`   Policy products        : ${policyProductCount}`);
  console.info(`   Policy versions        : ${policyVersionCount}`);
  console.info('\nDemo accounts:');
  console.info('   ADMIN           → admin@meridian-demo.aven');
  console.info('   INSURER_REVIEWER → reviewer.arjun@meridian-demo.aven');
  console.info('   INSURER_REVIEWER → reviewer.kavya@meridian-demo.aven');
  console.info('   HOSPITAL_DESK   → desk@citycare-demo.aven    (City Care Hospital)');
  console.info('   HOSPITAL_DESK   → desk@metrogeneral-demo.aven (Metro General)');
  console.info('   PATIENT         → patient.arun@demo.aven\n');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
