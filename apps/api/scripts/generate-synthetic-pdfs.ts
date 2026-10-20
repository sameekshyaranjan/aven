import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const output = join(process.cwd(), 'fixtures/synthetic');
const cases = [
  [
    'complete-case.pdf',
    'Complete synthetic case',
    'Consultation note, treatment plan and estimate are present.',
  ],
  [
    'missing-document.pdf',
    'Missing document synthetic case',
    'Treatment plan is intentionally absent.',
  ],
  [
    'uncertain-history.pdf',
    'Uncertain history synthetic case',
    'Current diagnosis recorded; prior onset date is unknown.',
  ],
] as const;

async function main() {
  await mkdir(output, { recursive: true });
  for (const [name, title, detail] of cases) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('AVEN DEMO - FICTIONAL DATA ONLY', { x: 50, y: 780, size: 16, font });
    page.drawText(title, { x: 50, y: 730, size: 14, font });
    page.drawText(detail, { x: 50, y: 700, size: 11, font });
    await writeFile(join(output, name), await pdf.save());
  }
  console.info(`Created ${cases.length} synthetic PDFs in ${output}`);
}

void main();
