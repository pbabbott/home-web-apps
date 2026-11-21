import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Diagram Maker',
  description: 'Diagram Maker App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
