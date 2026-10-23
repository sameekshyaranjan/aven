'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { NotificationData } from '@aven/contracts';
import { getNotifications, readNotification } from '@/lib/api';
import { readToken } from '@/lib/session';

export function Notifications({ home }: { home: string }) {
  const [items, setItems] = useState<NotificationData[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      const token = readToken();
      if (!token) return;
      try {
        const result = await getNotifications(token);
        if (active) setItems(result);
      } catch {
        /* keep the last visible list */
      }
    }
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const unread = items.filter((item) => !item.readAt).length;
  async function markRead(id: string) {
    const token = readToken();
    if (!token) return;
    try {
      setItems(await readNotification(token, id));
    } catch {
      /* next poll retries */
    }
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="rounded border border-border px-3 py-2 text-sm"
      >
        Alerts {unread > 0 ? `(${unread})` : ''}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold">Notifications</p>
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing new.</p>}
          <ul className="max-h-72 space-y-2 overflow-auto">
            {items.map((item) => (
              <li key={item.id} className="border-t pt-2 text-sm">
                <Link
                  href={`${home}/claims/${item.claimId}`}
                  onClick={() => markRead(item.id)}
                  className={item.readAt ? 'text-muted-foreground' : 'font-semibold text-primary'}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
