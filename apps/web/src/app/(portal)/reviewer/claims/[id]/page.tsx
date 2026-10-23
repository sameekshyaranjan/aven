'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type {
  AiJobStatusView,
  AuditEntry,
  DocumentData,
  InformationRequest,
  ReviewAction,
  ReviewerClaim,
} from '@aven/contracts';
import { PdfViewer } from '@/components/reviewer/pdf-viewer';
import { Button } from '@/components/ui/button';
import {
  createInformationRequest,
  createReviewAction,
  getAudit,
  getAiJobStatus,
  getInformationRequests,
  getReviewActions,
  getReviewerClaim,
  listDocuments,
} from '@/lib/api';
import { readToken } from '@/lib/session';

const tabs = [
  'Summary',
  'Documents',
  'Facts',
  'Actions',
  'Requests',
  'Timeline',
  'Findings',
  'Policy',
  'Decision',
] as const;
type RequestItem = { prompt: string; reason: string; alternatives: string };
const blankItem = (): RequestItem => ({ prompt: '', reason: '', alternatives: '' });

export default function ReviewerClaimPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof tabs)[number]>('Summary');
  const [documentLink, setDocumentLink] = useState<{ id?: string; page: number }>({ page: 1 });
  const [claim, setClaim] = useState<ReviewerClaim | null>(null);
  const [aiJob, setAiJob] = useState<AiJobStatusView | null>(null);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [requests, setRequests] = useState<InformationRequest[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [kind, setKind] = useState<'NOTE' | 'CONFIRM' | 'FLAG'>('NOTE');
  const [fieldKey, setFieldKey] = useState('');
  const [actionText, setActionText] = useState('');
  const [items, setItems] = useState<RequestItem[]>([blankItem()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const token = readToken();
    if (!token) return;
    const [caseData, files, actionData, requestData, auditData, jobData] = await Promise.all([
      getReviewerClaim(token, id),
      listDocuments(token, id),
      getReviewActions(token, id),
      getInformationRequests(token, id),
      getAudit(token, id),
      getAiJobStatus(token, id),
    ]);
    setClaim(caseData);
    setDocuments(files);
    setActions(actionData);
    setRequests(requestData);
    setAudit(auditData);
    setAiJob(jobData);
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('tab') === 'documents') {
      setTab('Documents');
      setDocumentLink({
        id: query.get('documentId') ?? undefined,
        page: Math.max(1, Number(query.get('page')) || 1),
      });
    }
    load().catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Could not load claim.'),
    );
    const timer = window.setInterval(() => {
      const token = readToken();
      if (token)
        getAiJobStatus(token, id)
          .then(setAiJob)
          .catch(() => setError('Could not refresh AI status.'));
    }, 20000);
    return () => window.clearInterval(timer);
  }, [id]);

  async function saveAction() {
    const token = readToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await createReviewAction(token, id, {
        kind,
        text: actionText,
        ...(kind === 'CONFIRM' ? { fieldKey } : {}),
      });
      setActionText('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save action.');
    } finally {
      setBusy(false);
    }
  }

  async function publishRequest() {
    const token = readToken();
    if (!token || !claim) return;
    setBusy(true);
    setError('');
    try {
      await createInformationRequest(token, id, {
        expectedVersion: claim.version,
        items: items.map((item) => ({
          prompt: item.prompt,
          reason: item.reason,
          acceptedAlternatives: item.alternatives
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        })),
      });
      setItems([blankItem()]);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/reviewer" className="text-sm text-primary underline">
        Back to queue
      </Link>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!claim && !error && <p role="status">Loading case...</p>}
      {claim && (
        <>
          <header>
            <p className="text-sm text-primary">Reviewer case</p>
            <h1 className="text-2xl font-semibold">
              {claim.memberName} · {claim.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {claim.hospitalName} · {claim.status.replaceAll('_', ' ')}
            </p>
          </header>
          <section
            className="rounded-xl border border-border bg-card p-4 text-sm"
            aria-live="polite"
          >
            <h2 className="font-semibold">AI analysis status</h2>
            {!aiJob ? (
              <p>No analysis job recorded for this claim.</p>
            ) : (
              <p>
                {aiJob.status.replaceAll('_', ' ')} · Stage: {aiJob.stage ?? 'Waiting'} · Attempt{' '}
                {aiJob.attempt}/{aiJob.maxAttempts}
                {aiJob.retryAvailable ? ' · Retry available' : ''}
                {aiJob.degraded ? ' · Needs reviewer attention' : ''}
                {aiJob.errorCode ? ` · ${aiJob.errorCode.replaceAll('_', ' ')}` : ''}
              </p>
            )}
          </section>
          <nav aria-label="Case sections" className="flex flex-wrap gap-2">
            {tabs.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTab(name)}
                aria-current={tab === name ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm ${tab === name ? 'bg-primary text-white' : 'border border-border bg-card'}`}
              >
                {name}
              </button>
            ))}
          </nav>
          <section className="rounded-xl border border-border bg-card p-5">
            {tab === 'Summary' && (
              <div className="space-y-2 text-sm">
                <h2 className="text-lg font-semibold">Case summary</h2>
                <p>Policy product: {claim.policyName}</p>
                <p>
                  Claim revision: {claim.revision} · Record version: {claim.version}
                </p>
                <p>
                  Original receipt:{' '}
                  {claim.originalReceiptAt
                    ? new Date(claim.originalReceiptAt).toLocaleString()
                    : 'Not submitted'}
                </p>
                {claim.emergencyReason && (
                  <p>Emergency submission reason: {claim.emergencyReason}</p>
                )}
                {claim.missingAtSubmission.length > 0 && (
                  <p>Missing at submission: {claim.missingAtSubmission.join(', ')}</p>
                )}
                <p className="text-muted-foreground">
                  Receipt target deadline is not configured in this demo.
                </p>
              </div>
            )}
            {tab === 'Documents' && (
              <PdfViewer
                claimId={id}
                documents={documents}
                initialDocumentId={documentLink.id}
                initialPage={documentLink.page}
              />
            )}
            {tab === 'Facts' && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Claim facts</h2>
                <p className="text-sm text-muted-foreground">
                  Source: hospital e-form. Hospital submitted: yes. No AI-extracted facts exist yet.
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(claim.intake).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <dt className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</dt>
                      <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
                      <dd className="text-xs text-muted-foreground">
                        Revision {claim.revision}
                        {claim.revisions.some(
                          (revision) =>
                            revision.intake[key as keyof typeof revision.intake] !== value,
                        )
                          ? ' · differs from an earlier revision'
                          : ''}
                        {actions.some(
                          (action) => action.kind === 'CONFIRM' && action.fieldKey === key,
                        )
                          ? ' · reviewer confirmed'
                          : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {tab === 'Actions' && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Manual review actions</h2>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Action type"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                    className="rounded border p-2"
                  >
                    {['NOTE', 'CONFIRM', 'FLAG'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  {kind === 'CONFIRM' && (
                    <select
                      aria-label="Field to confirm"
                      value={fieldKey}
                      onChange={(e) => setFieldKey(e.target.value)}
                      className="rounded border p-2"
                    >
                      <option value="">Choose field</option>
                      {Object.keys(claim.intake).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <textarea
                  aria-label="Review action"
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  rows={3}
                  className="w-full rounded border p-2"
                />
                <Button type="button" disabled={busy || !actionText.trim()} onClick={saveAction}>
                  Save action
                </Button>
                <ul className="space-y-2">
                  {actions.map((action) => (
                    <li key={action.id} className="border-t pt-2 text-sm">
                      <strong>{action.kind}</strong> {action.fieldKey ?? ''} · {action.actorName} ·{' '}
                      {new Date(action.createdAt).toLocaleString()}
                      <p>{action.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tab === 'Requests' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Information requests</h2>
                {requests.map((request) => (
                  <div key={request.id} className="rounded border p-3 text-sm">
                    <p className="font-semibold">
                      {request.status.replaceAll('_', ' ')} ·{' '}
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                    <ul className="list-inside list-disc">
                      {request.items.map((item, index) => (
                        <li key={index}>
                          {item.prompt} — {item.reason}
                          {item.acceptedAlternatives.length
                            ? ` (alternatives: ${item.acceptedAlternatives.join(', ')})`
                            : ''}
                        </li>
                      ))}
                    </ul>
                    {request.response && (
                      <div className="mt-2 space-y-1">
                        <p className="font-semibold">
                          Hospital response received (not yet assessed)
                        </p>
                        {request.response.answers.map((answer) => (
                          <p key={answer.itemIndex}>
                            Item {answer.itemIndex + 1}: {answer.text}
                          </p>
                        ))}
                        {request.response.documentIds.map((documentId) => (
                          <button
                            key={documentId}
                            type="button"
                            className="block text-primary underline"
                            onClick={() => {
                              setDocumentLink({ id: documentId, page: 1 });
                              setTab('Documents');
                            }}
                          >
                            Open attached PDF {documentId.slice(0, 8)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!requests.some((request) => request.status === 'OPEN') &&
                  ['SUBMITTED', 'READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(claim.status) && (
                    <div className="space-y-3 border-t pt-3">
                      <h3 className="font-semibold">Ask for information</h3>
                      {items.map((item, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-3">
                          <input
                            aria-label={`Item ${index + 1} request`}
                            placeholder="What is needed?"
                            value={item.prompt}
                            onChange={(e) =>
                              setItems(
                                items.map((old, i) =>
                                  i === index ? { ...old, prompt: e.target.value } : old,
                                ),
                              )
                            }
                            className="rounded border p-2"
                          />
                          <input
                            aria-label={`Item ${index + 1} reason`}
                            placeholder="Why is it needed?"
                            value={item.reason}
                            onChange={(e) =>
                              setItems(
                                items.map((old, i) =>
                                  i === index ? { ...old, reason: e.target.value } : old,
                                ),
                              )
                            }
                            className="rounded border p-2"
                          />
                          <input
                            aria-label={`Item ${index + 1} alternatives`}
                            placeholder="Accepted alternatives, comma separated"
                            value={item.alternatives}
                            onChange={(e) =>
                              setItems(
                                items.map((old, i) =>
                                  i === index ? { ...old, alternatives: e.target.value } : old,
                                ),
                              )
                            }
                            className="rounded border p-2"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={items.length >= 10}
                          onClick={() => setItems([...items, blankItem()])}
                        >
                          Add item
                        </Button>
                        <Button type="button" disabled={busy} onClick={publishRequest}>
                          Publish request
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            )}
            {tab === 'Timeline' && (
              <div>
                <h2 className="text-lg font-semibold">Audit timeline</h2>
                <ol className="mt-3 space-y-2 text-sm">
                  {audit.map((entry) => (
                    <li key={`${entry.kind}-${entry.id}`}>
                      {new Date(entry.createdAt).toLocaleString()} · {entry.title}
                      {entry.actorName ? ` · ${entry.actorName}` : ''}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {tab === 'Findings' && (
              <p className="text-sm text-muted-foreground">
                AI findings arrive in later stages. Manual flags are under Actions.
              </p>
            )}
            {tab === 'Policy' && (
              <p className="text-sm text-muted-foreground">
                Policy product: {claim.policyName}. Clause evidence and RAG arrive in later stages.
              </p>
            )}
            {tab === 'Decision' && (
              <p className="text-sm text-muted-foreground">
                Human decision controls and published letters arrive in later stages. No claim can
                be approved or refused from this page yet.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
