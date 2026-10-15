import { AccountListDataSchema, type AccountListData } from '@aven/contracts';
import { prisma } from '../../db/prisma';

/**
 * Staff accounts deliberately exposed by the public demo account picker.
 *
 * An explicit allowlist keeps future database users private by default.
 * Patient authentication belongs to the advanced release and is therefore
 * intentionally absent from this Stage 023 list.
 */
export const DEMO_STAFF_ACCOUNT_IDS = [
  'b1000000-0000-4000-8000-000000000001', // Admin — Priya Sharma
  'b2000000-0000-4000-8000-000000000002', // Reviewer — Arjun Mehta
  'b3000000-0000-4000-8000-000000000003', // Reviewer — Kavya Nair
  'b4000000-0000-4000-8000-000000000004', // City Care desk — Rohan Desai
  'b5000000-0000-4000-8000-000000000005', // Metro General desk — Sneha Kulkarni
] as const;

const demoStaffAccountIdSet = new Set<string>(DEMO_STAFF_ACCOUNT_IDS);

export function isDemoStaffAccountId(accountId: string): boolean {
  return demoStaffAccountIdSet.has(accountId);
}

/**
 * Returns the safe public projection used by the demo login account picker.
 * Email addresses, active flags, timestamps, and all other database fields
 * are deliberately excluded from the Prisma select and response contract.
 */
export async function listDemoAccounts(): Promise<AccountListData> {
  const users = await prisma.user.findMany({
    where: {
      id: { in: [...DEMO_STAFF_ACCOUNT_IDS] },
      isActive: true,
      hospital: { is: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      role: true,
      hospital: {
        select: {
          name: true,
        },
      },
    },
  });

  const positionById = new Map<string, number>(
    DEMO_STAFF_ACCOUNT_IDS.map((accountId, index) => [accountId, index]),
  );

  const accounts = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      hospitalName: user.hospital?.name ?? null,
    }))
    .sort(
      (left, right) =>
        (positionById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (positionById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );

  return AccountListDataSchema.parse({ accounts });
}
