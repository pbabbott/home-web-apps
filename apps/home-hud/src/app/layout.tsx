import type { Metadata } from 'next';
import '@abbottland/fui-components/globals.css';
import './globals.css';
import { Nav } from './components/Nav';

export const metadata: Metadata = {
  title: 'Home HUD',
  description: 'Home HUD App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-800">
        <Nav />
        {children}
      </body>
    </html>
  );
}
