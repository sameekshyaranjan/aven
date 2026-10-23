/* global process */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import contracts from '../dist/index.js';

const { AiJobInputSchema, AiCallbackSchema } = contracts;
const folder = fileURLToPath(new URL('../../../fixtures/synthetic/ai-contracts/', import.meta.url));
const job = JSON.parse(fs.readFileSync(path.join(folder, 'job-input.json'), 'utf8'));
const callback = JSON.parse(fs.readFileSync(path.join(folder, 'callback.json'), 'utf8'));
AiJobInputSchema.parse(job);
AiCallbackSchema.parse(callback);
if (AiCallbackSchema.safeParse({ ...callback, decision: 'APPROVED' }).success) {
  throw new Error('AI callback must not accept a decision field');
}
process.stdout.write('Zod: 2 valid fixtures passed; decision field rejected\n');
