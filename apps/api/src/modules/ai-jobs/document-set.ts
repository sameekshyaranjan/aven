import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

/** Stable fingerprint of the currently selected document versions. */
export async function documentSetHash(tx: Prisma.TransactionClient, claimId: string) {
  const documents = await tx.document.findMany({
    where: { claimId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true, sha256: true } },
    },
  });
  return createHash('sha256')
    .update(
      JSON.stringify(
        documents.map((doc) => [doc.id, doc.versions[0]?.id, doc.versions[0]?.sha256]),
      ),
    )
    .digest('hex');
}
