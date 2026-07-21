import type { Metadata } from 'next';
import '@abbottland/fui-components/globals.css';
import './globals.css';
import ProxyNavigationFixer from '@/components/ProxyNavigationFixer/ProxyNavigationFixer';
import DebugModal from '@/components/DebugModal/DebugModal';
import AnimationsContextProvider from '@/context/Animations.Context';
import ReaderPreferencesProvider from '@/context/ReaderPreferences.Context';
import BlogPostStatsProvider from '@/context/BlogPostStats.Context';
import ReaderToolsDrawer from '@/components/ReaderToolsDrawer/ReaderToolsDrawer';

export const metadata: Metadata = {
  title: 'Abbottland.io',
  description: 'A Blog Sharing Technical Insights on Software Engineering',
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
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
        <script
          defer
          src="/api/analytics-loader"
          data-website-id="55d4789d-aa6d-4191-80aa-d78639c379c4"
          data-host-url="https://analytics.abbottland.io"
        />
        <ProxyNavigationFixer />
        <AnimationsContextProvider>
          <ReaderPreferencesProvider>
            <BlogPostStatsProvider>
              {children}
              <ReaderToolsDrawer />
              <DebugModal />
            </BlogPostStatsProvider>
          </ReaderPreferencesProvider>
        </AnimationsContextProvider>
      </body>
    </html>
  );
}
