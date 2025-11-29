'use client';
import WelcomeSection from './WelcomeSection/WelcomeSection';
import StickyHeader from '../components/StickyHeader';
import LandingSection from './LandingSection/LandingSection';
import LandingSectionContextProvider from './LandingSection/LandingSection.Context';
import AboutMeSection from './AboutMeSection/AboutMeSection';

export default function Home() {
  return (
    <div>
      <StickyHeader />
      <LandingSectionContextProvider>
        <LandingSection />
      </LandingSectionContextProvider>
      <WelcomeSection />
      <AboutMeSection />
    </div>
  );
}
