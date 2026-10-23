'use client';

import { useState } from 'react';
import type { DocumentData, InformationRequest } from '@aven/contracts';
import { Button } from '@/components/ui/button';
import { respondToInformationRequest } from '@/lib/api';
import { readToken } from '@/lib/session';

export function RequestResponse({
  claimId,
  version,
  request,
  documents,
  onSent,
}: {
  claimId: string;
  version: number;
  request: InformationRequest;
  documents: DocumentData[];
  onSent: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const available = documents.filter((document) =>
    document.versions.some((item) => item.createdAt >= request.createdAt),
  );

  async function send() {
    const token = readToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await respondToInformationRequest(token, claimId, request.id, {
        expectedVersion: version,
        answers: Object.entries(answers)
          .filter(([, text]) => text.trim())
          .map(([index, text]) => ({ itemIndex: Number(index), text })),
        documentIds: selected,
      });
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send response.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-3 text-sm">
      <p className="font-semibold">Request: {request.status.replaceAll('_', ' ')}</p>
      {request.items.map((item, index) => (
        <div key={index} className="space-y-1">
          <p>{item.prompt}</p>
          <p className="text-muted-foreground">
            Why: {item.reason}
            {item.acceptedAlternatives.length
              ? ` · Alternatives: ${item.acceptedAlternatives.join(', ')}`
              : ''}
          </p>
          {request.status === 'OPEN' && (
            <textarea
              aria-label={`Answer item ${index + 1}`}
              value={answers[index] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
              rows={2}
              className="w-full rounded border p-2"
            />
          )}
        </div>
      ))}
      {request.status === 'OPEN' && (
        <>
          <p>Upload any new PDFs above, then select them here.</p>
          {available.map((document) => (
            <label key={document.id} className="flex gap-2">
              <input
                type="checkbox"
                checked={selected.includes(document.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, document.id]
                      : selected.filter((id) => id !== document.id),
                  )
                }
              />{' '}
              {document.type.replaceAll('_', ' ')} · {document.id.slice(0, 8)}
            </label>
          ))}
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <Button
            type="button"
            disabled={
              busy || (!Object.values(answers).some((text) => text.trim()) && selected.length === 0)
            }
            onClick={send}
          >
            {busy ? 'Sending...' : 'Send response'}
          </Button>
        </>
      )}
      {request.response && (
        <div>
          <p>
            Response received. The reviewer will assess it; receipt alone does not mark items
            satisfied.
          </p>
          {request.response.answers.map((answer) => (
            <p key={answer.itemIndex}>
              Item {answer.itemIndex + 1}: {answer.text}
            </p>
          ))}
          <p>{request.response.documentIds.length} document(s) attached.</p>
        </div>
      )}
    </div>
  );
}
