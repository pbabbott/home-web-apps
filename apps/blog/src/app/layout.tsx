import type { Metadata } from 'next';
import '@abbottland/fui-components/globals.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Abbottland.io',
  description: 'A Blog Sharing Technical Insights on Software Engineering',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <title>Abbottland.io</title>
      <body className="antialiased bg-neutral-800">{children}</body>
    </html>
  );
}
