import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { ValidationError } from '../../errors/app-error';

export async function validatePdf(
  bytes: Buffer,
  expectedSha256: string,
  expectedSize: number,
): Promise<void> {
  if (bytes.length !== expectedSize)
    throw new ValidationError('Uploaded file size does not match.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== expectedSha256.toLowerCase())
    throw new ValidationError('Uploaded file hash does not match.');
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-')
    throw new ValidationError('The file is not a PDF.');
  try {
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() < 1 || pdf.getPageCount() > 30)
      throw new ValidationError('PDFs must contain 1 to 30 pages.');
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('The PDF is unreadable or encrypted.');
  }
}
