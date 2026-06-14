import type { Metadata } from 'next';
import '@abbottland/fui-components/globals.css';
import './globals.css';
import ProxyNavigationFixer from '@/components/ProxyNavigationFixer/ProxyNavigationFixer';

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
      <body className="antialiased bg-neutral-800">
        <ProxyNavigationFixer />
        {children}
      </body>
    </html>
  );
}
