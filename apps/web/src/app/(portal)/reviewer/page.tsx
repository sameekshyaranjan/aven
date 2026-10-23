'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClaimStatusSchema, type ReviewerQueueItem } from '@aven/contracts';
import { getReviewerHospitals, getReviewerQueue } from '@/lib/api';
import { readToken } from '@/lib/session';

export default function ReviewerHome() {
  const [claims, setClaims] = useState<ReviewerQueueItem[]>([]);
  const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [status, setStatus] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [olderThanHours, setOlderThanHours] = useState('');
  const [actionRequired, setActionRequired] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = readToken();
    if (token)
      getReviewerHospitals(token)
        .then(setHospitals)
        .catch(() => setError('Could not load hospitals.'));
  }, []);
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let active = true;
    getReviewerQueue(token, {
      page,
      status,
      hospitalId,
      olderThanHours: Number(olderThanHours) || undefined,
      actionRequired,
    })
      .then((result) => {
        if (active) {
          setClaims(result.items);
          setPages(result.pagination.totalPages);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load claims.');
      });
    return () => {
      active = false;
    };
  }, [page, status, hospitalId, olderThanHours, actionRequired]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-primary">Insurer workspace</p>
        <h1 className="text-2xl font-semibold">Reviewer queue</h1>
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <label>
          Status{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border p-2"
          >
            <option value="">All</option>
            {ClaimStatusSchema.options
              .filter((value) => value !== 'DRAFT')
              .map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
          </select>
        </label>
        <label>
          Hospital{' '}
          <select
            value={hospitalId}
            onChange={(e) => {
              setHospitalId(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border p-2"
          >
            <option value="">All</option>
            {hospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.id}>
                {hospital.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Received at least{' '}
          <input
            type="number"
            min="1"
            max="8760"
            value={olderThanHours}
            onChange={(e) => {
              setOlderThanHours(e.target.value);
              setPage(1);
            }}
            className="ml-2 w-20 rounded border p-2"
          />{' '}
          hours ago
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={actionRequired}
            onChange={(e) => {
              setActionRequired(e.target.checked);
              setPage(1);
            }}
          />{' '}
          Needs reviewer attention
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Receipt age is shown below. A deadline target has not been configured in this demo.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        {claims.length === 0 && (
          <p className="text-sm text-muted-foreground">No claims match these filters.</p>
        )}
        <ul className="divide-y divide-border">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <Link
                  href={`/reviewer/claims/${claim.id}`}
                  className="font-semibold text-primary underline"
                >
                  {claim.memberName} · {claim.id.slice(0, 8)}
                </Link>
                <p className="text-muted-foreground">{claim.hospitalName}</p>
              </div>
              <span>{claim.status.replaceAll('_', ' ')}</span>
              <span>
                {claim.originalReceiptAt
                  ? `${Math.floor((Date.now() - new Date(claim.originalReceiptAt).getTime()) / 3600000)} hours since receipt`
                  : 'No receipt'}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-3 text-sm">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
