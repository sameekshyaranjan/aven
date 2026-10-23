'use client';

import { useRouter } from 'next/navigation';
import { ClaimForm } from '@/components/hospital/claim-form';

export default function NewClaimPage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New pre-authorization claim</h1>
      <ClaimForm onSaved={(claim) => router.push(`/hospital/claims/${claim.id}`)} />
    </div>
  );
}
