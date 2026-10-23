'use client';

import { useEffect, useState } from 'react';
import { DocumentTypeSchema, type DocumentData } from '@aven/contracts';
import { finalizeUpload, getDownload, initiateUpload, listDocuments, putPdf } from '@/lib/api';
import { readToken } from '@/lib/session';
import { Button } from '@/components/ui/button';

const MAX_BYTES = 10 * 1024 * 1024;

export function Documents({
  claimId,
  canUpload,
  onUploaded,
}: {
  claimId: string;
  canUpload: boolean;
  onUploaded: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);
  const [type, setType] = useState<(typeof DocumentTypeSchema.options)[number]>('CLINICAL_NOTE');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const token = readToken();
    if (token) setDocuments(await listDocuments(token, claimId));
  }
  useEffect(() => {
    refresh().catch(() => setError('Could not load documents.'));
  }, [claimId]);

  async function upload() {
    const token = readToken();
    if (!token || !files?.length) return;
    setBusy(true);
    setError('');
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (file.size > MAX_BYTES || file.size === 0 || !file.name.toLowerCase().endsWith('.pdf'))
          throw new Error(`${file.name}: choose a PDF under 10 MB.`);
        const bytes = await file.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map((part) => part.toString(16).padStart(2, '0'))
          .join('');
        setProgress(`${index + 1}/${files.length}: preparing ${file.name}`);
        const target = await initiateUpload(token, claimId, {
          type,
          sizeBytes: file.size,
          sha256: hash,
        });
        await putPdf(target.uploadUrl, file, target.requiredHeaders, (percent) =>
          setProgress(`${index + 1}/${files.length}: ${percent}%`),
        );
        await finalizeUpload(token, claimId, target.uploadToken);
        await refresh();
        onUploaded();
      }
      setProgress('All files uploaded and validated.');
      setFiles(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(document: DocumentData) {
    const token = readToken();
    if (!token) return;
    try {
      const target = await getDownload(token, claimId, document.id, document.currentVersion);
      window.open(target.url, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open document.');
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Supporting documents</h2>
      {canUpload && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Synthetic PDFs only. Select one document type for the selected files.
          </p>
          <select
            aria-label="Document type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded border p-2"
          >
            {DocumentTypeSchema.options.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <input
            aria-label="PDF files"
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(e) => setFiles(e.target.files)}
            className="block"
          />
          <Button type="button" disabled={busy || !files?.length} onClick={upload}>
            {busy ? 'Uploading...' : 'Upload PDFs'}
          </Button>
          {progress && <p role="status">{progress}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      )}
      <ul className="space-y-2">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm"
          >
            <span>
              {document.type.replaceAll('_', ' ')} · Version {document.currentVersion} ·{' '}
              {document.versions[0]?.processingStatus}
            </span>
            <button
              type="button"
              onClick={() => openDocument(document)}
              className="text-primary underline"
            >
              Open PDF
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
