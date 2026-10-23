'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthenticatedUser } from '@aven/contracts';
import { Button } from '@/components/ui/button';
import { Notifications } from '@/components/notifications';
import { getCurrentUser, homeForRole } from '@/lib/api';
import { clearToken, readToken } from '@/lib/session';

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let active = true;
    const token = readToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    getCurrentUser(token)
      .then((profile) => {
        if (!active) return;
        if (profile.role === 'PATIENT') {
          clearToken();
          router.replace('/login');
          return;
        }
        setUser(profile);
        const home = homeForRole(profile.role);
        if (pathname !== home && !pathname.startsWith(`${home}/`)) router.replace(home);
      })
      .catch(() => {
        if (!active) return;
        clearToken();
        router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  const home = user && homeForRole(user.role);
  if (!home || (pathname !== home && !pathname.startsWith(`${home}/`))) {
    return (
      <p role="status" className="p-8 text-muted-foreground">
        Checking your session…
      </p>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <Link href={home} className="text-xl font-bold text-primary">
              Aven
            </Link>
            <p className="text-xs text-muted-foreground">Synthetic-data demo</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <Notifications home={home} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearToken();
                setUser(null);
                router.replace('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <nav aria-label="Workspace" className="mx-auto max-w-5xl px-5 pt-6">
        <Link href={home} aria-current="page" className="text-sm font-semibold text-primary">
          Home
        </Link>
      </nav>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
