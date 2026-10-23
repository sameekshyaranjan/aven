import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aven | Pre-authorization demo',
  description: 'A fictional cashless health-insurance pre-authorization demo using synthetic data.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
