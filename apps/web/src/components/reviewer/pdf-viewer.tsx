'use client';

import { useEffect, useState } from 'react';
import type { DocumentData } from '@aven/contracts';
import { getDownload } from '@/lib/api';
import { readToken } from '@/lib/session';

export function PdfViewer({
  claimId,
  documents,
  initialDocumentId,
  initialPage = 1,
}: {
  claimId: string;
  documents: DocumentData[];
  initialDocumentId?: string;
  initialPage?: number;
}) {
  const [selected, setSelected] = useState(initialDocumentId ?? documents[0]?.id ?? '');
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(100);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const document = documents.find((item) => item.id === selected);
    const token = readToken();
    if (!document || !token) return;
    getDownload(token, claimId, document.id, document.currentVersion)
      .then((target) => {
        setUrl(target.url);
        setError('');
      })
      .catch(() => setError('Could not open the PDF.'));
  }, [claimId, selected, documents]);
  if (!documents.length) return <p>No documents uploaded yet.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <label>
          Document{' '}
          <select
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border p-2"
          >
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.type.replaceAll('_', ' ')} · v{document.currentVersion}
              </option>
            ))}
          </select>
        </label>
        <label>
          Page{' '}
          <input
            type="number"
            min="1"
            value={page}
            onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
            className="ml-2 w-16 rounded border p-2"
          />
        </label>
        <label>
          Zoom{' '}
          <select
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="ml-2 rounded border p-2"
          >
            {[75, 100, 125, 150].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {url && (
        <iframe
          key={`${selected}-${page}-${zoom}`}
          title="Claim PDF"
          src={`${url}#page=${page}&zoom=${zoom}`}
          className="h-[70vh] w-full rounded border border-border"
        />
      )}
      <p className="text-xs text-muted-foreground">
        Page and zoom controls use your browser's PDF viewer.
      </p>
    </div>
  );
}
