'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ClaimListItem } from '@aven/contracts';
import { listClaims } from '@/lib/api';
import { readToken } from '@/lib/session';

export default function HospitalHome() {
  const [claims, setClaims] = useState<ClaimListItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, drafts: 0, needsInformation: 0 });
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let active = true;
    Promise.all([
      listClaims(token, page, 10),
      listClaims(token, 1, 1, 'DRAFT'),
      listClaims(token, 1, 1, 'NEEDS_INFORMATION'),
    ])
      .then(([recent, drafts, needs]) => {
        if (!active) return;
        setClaims(recent.items);
        setHasNext(recent.pagination.hasNextPage);
        setCounts({
          total: recent.pagination.totalItems,
          drafts: drafts.pagination.totalItems,
          needsInformation: needs.pagination.totalItems,
        });
      })
      .catch(
        (cause: unknown) =>
          active && setError(cause instanceof Error ? cause.message : 'Could not load claims.'),
      );
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Hospital workspace</p>
          <h1 className="text-2xl font-semibold">Claims</h1>
        </div>
        <Link
          href="/hospital/claims/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          New claim
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['All claims', counts.total],
            ['Drafts', counts.drafts],
            ['Needs a response', counts.needsInformation],
          ] as const
        ).map(([label, count]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{count}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Recent claims</h2>
        {claims.length === 0 && (
          <p className="text-sm text-muted-foreground">No claims yet. Create a draft to begin.</p>
        )}
        <ul className="divide-y divide-border">
          {claims.map((claim) => (
            <li key={claim.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <Link
                className="font-semibold text-primary underline"
                href={`/hospital/claims/${claim.id}`}
              >
                Claim {claim.id.slice(0, 8)}
              </Link>
              <span>{claim.status.replaceAll('_', ' ')}</span>
              <time className="text-muted-foreground">
                {new Date(claim.updatedAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-3 text-sm">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page}</span>
          <button type="button" disabled={!hasNext} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
