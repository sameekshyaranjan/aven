import { ERROR_CODES, PolicyContextSchema, type PolicyContext } from '@aven/contracts';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../errors/app-error';

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Builds the exact policy snapshot linked by an enrollment.
 *
 * The service date checks the customer's coverage period only. It never picks
 * a T&C source by a filename date, and its result never decides claim status.
 */
export async function resolvePolicyContext(
  enrollmentId: string,
  memberId: string,
  serviceDate: string,
): Promise<PolicyContext> {
  const enrollment = await prisma.policyEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      policyNumber: true,
      coverageStart: true,
      coverageEnd: true,
      policyVersion: {
        select: {
          id: true,
          versionNumber: true,
          status: true,
          policyProduct: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      members: {
        where: { id: memberId },
        select: {
          id: true,
          memberCode: true,
          fullName: true,
          dateOfBirth: true,
          relationship: true,
          isPolicyholder: true,
        },
      },
      selectedAddons: {
        select: {
          addonVersion: {
            select: {
              id: true,
              code: true,
              name: true,
              versionNumber: true,
              status: true,
            },
          },
        },
        orderBy: { addonVersion: { code: 'asc' } },
      },
    },
  });

  if (!enrollment) {
    throw new NotFoundError('Policy enrollment was not found.', ERROR_CODES.NOT_FOUND);
  }

  const member = enrollment.members[0];

  if (!member) {
    throw new NotFoundError(
      'The covered member was not found in this policy enrollment.',
      ERROR_CODES.NOT_FOUND,
    );
  }

  const policyVersionId = enrollment.policyVersion.id;
  const addonVersionIds = enrollment.selectedAddons.map(({ addonVersion }) => addonVersion.id);
  const addonScope =
    addonVersionIds.length === 0
      ? { addonVersionId: null }
      : {
          OR: [{ addonVersionId: null }, { addonVersionId: { in: addonVersionIds } }],
        };

  const [compatibilities, clauses, rules] = await prisma.$transaction([
    prisma.policyAddonCompatibility.findMany({
      where: {
        policyVersionId,
        addonVersionId: { in: addonVersionIds },
      },
      select: { addonVersionId: true },
    }),
    prisma.policyClause.findMany({
      where: {
        policyVersionId,
        ...addonScope,
      },
      select: {
        id: true,
        clauseId: true,
        versionNumber: true,
        heading: true,
        text: true,
        pageLabel: true,
        sourceVersion: true,
        addonVersionId: true,
      },
      orderBy: [{ clauseId: 'asc' }, { versionNumber: 'asc' }],
    }),
    prisma.policyRuleVersion.findMany({
      where: {
        policyVersionId,
        ...addonScope,
      },
      select: {
        id: true,
        ruleId: true,
        versionNumber: true,
        ruleType: true,
        parameters: true,
        priority: true,
        addonVersionId: true,
        clauseLinks: {
          select: { policyClauseId: true },
          orderBy: { policyClauseId: 'asc' },
        },
      },
      orderBy: [{ priority: 'desc' }, { ruleId: 'asc' }],
    }),
  ]);

  const compatibleAddonIds = new Set(compatibilities.map(({ addonVersionId }) => addonVersionId));
  const issues: Array<{
    code: 'OUTSIDE_COVERAGE_PERIOD' | 'INCOMPATIBLE_SELECTED_ADDON';
    message: string;
    addonVersionId?: string;
  }> = [];

  const requestedDate = toUtcDate(serviceDate);

  if (requestedDate < enrollment.coverageStart || requestedDate > enrollment.coverageEnd) {
    issues.push({
      code: 'OUTSIDE_COVERAGE_PERIOD',
      message: 'The service date is outside the enrollment coverage period.',
    });
  }

  for (const { addonVersion } of enrollment.selectedAddons) {
    if (!compatibleAddonIds.has(addonVersion.id)) {
      issues.push({
        code: 'INCOMPATIBLE_SELECTED_ADDON',
        message: `Selected add-on ${addonVersion.name} is not configured for this policy version.`,
        addonVersionId: addonVersion.id,
      });
    }
  }

  return PolicyContextSchema.parse({
    resolutionStatus: issues.length === 0 ? 'RESOLVED' : 'REVIEW_REQUIRED',
    serviceDate,
    enrollment: {
      id: enrollment.id,
      policyNumber: enrollment.policyNumber,
      coverageStart: toDateOnly(enrollment.coverageStart),
      coverageEnd: toDateOnly(enrollment.coverageEnd),
    },
    member: {
      ...member,
      dateOfBirth: toDateOnly(member.dateOfBirth),
    },
    policy: {
      productId: enrollment.policyVersion.policyProduct.id,
      productCode: enrollment.policyVersion.policyProduct.code,
      productName: enrollment.policyVersion.policyProduct.name,
      versionId: policyVersionId,
      versionNumber: enrollment.policyVersion.versionNumber,
      status: enrollment.policyVersion.status,
    },
    selectedAddons: enrollment.selectedAddons.map(({ addonVersion }) => ({
      versionId: addonVersion.id,
      code: addonVersion.code,
      name: addonVersion.name,
      versionNumber: addonVersion.versionNumber,
      status: addonVersion.status,
      isCompatible: compatibleAddonIds.has(addonVersion.id),
    })),
    clauses,
    rules: rules.map((rule) => ({
      id: rule.id,
      ruleId: rule.ruleId,
      versionNumber: rule.versionNumber,
      ruleType: rule.ruleType,
      parameters: rule.parameters,
      priority: rule.priority,
      addonVersionId: rule.addonVersionId,
      supportingClauseIds: rule.clauseLinks.map(({ policyClauseId }) => policyClauseId),
    })),
    issues,
  });
}
