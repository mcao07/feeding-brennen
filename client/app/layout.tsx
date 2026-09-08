import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Feeding Brennen',
  description: 'Track restaurants, visits, and spending.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <header className="border-b border-stone-200 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-3xl px-6 py-5">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">Feeding Brennen</h1>
            <p className="mt-0.5 text-sm text-stone-500">Restaurants, visits, and what they cost.</p>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
