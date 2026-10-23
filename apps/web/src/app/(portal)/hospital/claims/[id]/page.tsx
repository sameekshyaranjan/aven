'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type {
  AuditEntry,
  ClaimCompleteness,
  DocumentData,
  HospitalClaim,
  InformationRequest,
} from '@aven/contracts';
import { ClaimForm, fieldLabel } from '@/components/hospital/claim-form';
import { Documents } from '@/components/hospital/documents';
import { RequestResponse } from '@/components/hospital/request-response';
import { Button } from '@/components/ui/button';
import {
  getAudit,
  getClaim,
  getCompleteness,
  getInformationRequests,
  listDocuments,
  submitClaim,
} from '@/lib/api';
import { readToken } from '@/lib/session';

export default function ClaimDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [claim, setClaim] = useState<HospitalClaim | null>(null);
  const [check, setCheck] = useState<ClaimCompleteness | null>(null);
  const [timeline, setTimeline] = useState<AuditEntry[]>([]);
  const [requests, setRequests] = useState<InformationRequest[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const token = readToken();
    if (!token) return;
    const current = await getClaim(token, id);
    setClaim(current);
    const [events, completeness, requestData, files] = await Promise.all([
      getAudit(token, id),
      current.status === 'DRAFT' ? getCompleteness(token, id) : Promise.resolve(null),
      getInformationRequests(token, id),
      listDocuments(token, id),
    ]);
    setTimeline(events);
    setCheck(completeness);
    setRequests(requestData);
    setDocuments(files);
  }
  useEffect(() => {
    refresh().catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Could not load claim.'),
    );
  }, [id]);

  async function submit() {
    const token = readToken();
    if (!token || !claim) return;
    setBusy(true);
    setError('');
    try {
      await submitClaim(token, id, claim.version, check?.complete ? undefined : emergencyReason);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit claim.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/hospital" className="text-sm text-primary underline">
        Back to claims
      </Link>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!claim && !error && <p role="status">Loading claim...</p>}
      {claim && (
        <>
          <header className="rounded-xl border border-border bg-card p-5">
            <h1 className="text-2xl font-semibold">Claim {claim.id.slice(0, 8)}</h1>
            <p className="mt-2 text-sm">
              Status: <strong>{claim.status.replaceAll('_', ' ')}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Original receipt:{' '}
              {claim.originalReceiptAt
                ? new Date(claim.originalReceiptAt).toLocaleString()
                : 'Not submitted yet'}
            </p>
          </header>
          {claim.status === 'DRAFT' ? (
            <>
              <ClaimForm
                key={claim.revision}
                claim={claim}
                onSaved={() => refresh().catch(() => setError('Could not refresh claim.'))}
              />
              <section className="space-y-3 rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold">Before submission</h2>
                {check && (
                  <>
                    <p className="text-sm">
                      {check.complete
                        ? 'All required form fields are complete.'
                        : `${check.missingFields.length} required field(s) missing.`}
                    </p>
                    {check.missingFields.length > 0 && (
                      <ul className="list-inside list-disc text-sm">
                        {check.missingFields.map((field) => (
                          <li key={field}>{fieldLabel(field)}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-muted-foreground">
                      A written estimate can be attached below. This form currently still needs its
                      estimated amount entered for a normal submission.
                    </p>
                    {!check.complete && check.canSubmitAsEmergency && (
                      <label className="block text-sm">
                        Emergency reason
                        <textarea
                          value={emergencyReason}
                          onChange={(event) => setEmergencyReason(event.target.value)}
                          maxLength={500}
                          className="mt-1 block w-full rounded border p-2"
                        />
                      </label>
                    )}
                    <Button
                      type="button"
                      disabled={
                        busy ||
                        (!check.complete && !(check.canSubmitAsEmergency && emergencyReason.trim()))
                      }
                      onClick={submit}
                    >
                      {busy ? 'Submitting...' : 'Submit claim'}
                    </Button>
                  </>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Submitted information</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(claim.intake).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
                    <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <Documents
            claimId={id}
            canUpload={[
              'DRAFT',
              'SUBMITTED',
              'ANALYSING',
              'NEEDS_INFORMATION',
              'READY_FOR_REVIEW',
              'UNDER_REVIEW',
            ].includes(claim.status)}
            onUploaded={() => refresh().catch(() => setError('Could not refresh claim.'))}
          />
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Information requests</h2>
            {requests.length === 0 && (
              <p className="text-sm text-muted-foreground">No requests published.</p>
            )}
            {requests.map((request) => (
              <RequestResponse
                key={request.id}
                claimId={id}
                version={claim.version}
                request={request}
                documents={documents}
                onSent={() => refresh().catch(() => setError('Could not refresh claim.'))}
              />
            ))}
            <p className="mt-3 text-sm text-muted-foreground">
              Published decision letters are not available yet.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Claim timeline</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {timeline.map((event) => (
                <li key={event.id}>
                  {new Date(event.createdAt).toLocaleString()} · {event.title}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
