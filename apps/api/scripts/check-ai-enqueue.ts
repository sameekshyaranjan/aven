/* global process */
/** Smoke test: submit a synthetic draft inside a rollback-only transaction. */
import { strict as assert } from 'node:assert';
import { prisma } from '../src/db/prisma';
import { submitTransition } from '../src/modules/claims/claim-transition';

const rollback = 'ROLLBACK_AI_ENQUEUE_CHECK';
let claimId: string | undefined;

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { role: 'HOSPITAL_DESK' } });
      const member = await tx.member.findFirstOrThrow();
      const actor = { userId: user.id, role: user.role, hospitalId: user.hospitalId };
      const intake = { patientName: 'Synthetic Queue Check' };
      const claim = await tx.claim.create({
        data: {
          hospitalId: user.hospitalId!,
          enrollmentId: member.enrollmentId,
          memberId: member.id,
          revisions: { create: { revisionNumber: 1, intake } },
        },
      });
      claimId = claim.id;
      await submitTransition(tx, claim, actor, intake, [], undefined);
      const job = await tx.aiJob.findFirstOrThrow({
        where: { claimId: claim.id },
        include: { claimRevision: true },
      });
      assert.equal(job.status, 'QUEUED');
      assert.equal(job.attemptGeneration, 0);
      assert.equal(job.claimRevision.revisionNumber, 2);
      assert.equal(job.documentSetHash.length, 64);
      throw new Error(rollback);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollback) throw error;
  }
  assert.equal(await prisma.claim.findUnique({ where: { id: claimId } }), null);
  process.stdout.write('Prisma: submission and queued job share one transaction; rollback verified\n');
}

main().finally(() => prisma.$disconnect());
