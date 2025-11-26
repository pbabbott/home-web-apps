'use client';
import WelcomeSection from './WelcomeSection';
import StickyHeader from '../components/StickyHeader';
import LandingSection from './LandingSection/LandingSection';
import LandingSectionContextProvider from './LandingSection/LandingSection.Context';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-800">
      <StickyHeader />
      <LandingSectionContextProvider>
        <LandingSection />
      </LandingSectionContextProvider>
      <WelcomeSection />
    </div>
  );
}
