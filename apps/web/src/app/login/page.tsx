'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DemoAccount } from '@aven/contracts';
import { Button } from '@/components/ui/button';
import { getDemoAccounts, homeForRole, login } from '@/lib/api';
import { saveToken } from '@/lib/session';

const roleName = {
  HOSPITAL_DESK: 'Hospital desk',
  INSURER_REVIEWER: 'Insurer reviewer',
  ADMIN: 'Administrator',
  PATIENT: 'Patient',
};

export default function LoginPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getDemoAccounts()
      .then(({ accounts }) => {
        if (active) setAccounts(accounts);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Could not load demo accounts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function enter(account: DemoAccount) {
    setError('');
    setBusyId(account.id);
    try {
      const session = await login(account.id);
      saveToken(session.accessToken);
      router.replace(homeForRole(session.user.role));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login failed.');
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-12">
      <div className="mb-8">
        <p className="mb-3 text-sm font-bold tracking-[0.2em] text-primary uppercase">Aven</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose a demo account</h1>
        <p className="mt-3 text-muted-foreground">
          Explore a fictional pre-authorization workflow. All demo identities and claim files are
          synthetic.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {loading && <p role="status">Loading accounts…</p>}

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-semibold">{account.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {roleName[account.role]} · {account.hospitalName ?? 'No hospital'}
              </p>
            </div>
            <Button type="button" disabled={busyId !== null} onClick={() => enter(account)}>
              {busyId === account.id ? 'Opening…' : 'Enter workspace'}
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        This passwordless login is for the local portfolio demo. No real patient information should
        be entered.
      </p>
    </main>
  );
}
