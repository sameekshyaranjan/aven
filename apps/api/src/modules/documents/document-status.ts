import type { DocumentProcessingStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ValidationError } from '../../errors/app-error';

const next: Partial<Record<DocumentProcessingStatus, DocumentProcessingStatus[]>> = {
  UPLOADED: ['VALIDATING', 'FAILED'],
  VALIDATING: ['READY', 'UNREADABLE', 'FAILED'],
  READY: ['ANALYSING', 'UNREADABLE'],
  ANALYSING: ['ANALYSED', 'UNREADABLE', 'FAILED'],
  UNREADABLE: ['VALIDATING'],
  FAILED: ['VALIDATING'],
};

/** API-owned processing update for future extraction jobs. It never changes claim eligibility. */
export async function setDocumentProcessingStatus(
  versionId: string,
  from: DocumentProcessingStatus,
  to: DocumentProcessingStatus,
) {
  if (!next[from]?.includes(to))
    throw new ValidationError('Invalid document processing transition.');
  const result = await prisma.documentVersion.updateMany({
    where: { id: versionId, processingStatus: from },
    data: { processingStatus: to },
  });
  if (result.count !== 1) throw new ValidationError('Document processing state has changed.');
}
