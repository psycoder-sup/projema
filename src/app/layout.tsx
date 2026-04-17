import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from '@/lib/query-client';

export const metadata: Metadata = {
  title: 'Sprint Todo Management',
  description: 'Team sprint and todo management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
