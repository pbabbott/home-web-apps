'use client';
import WelcomeSection from './WelcomeSection/WelcomeSection';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import LandingSection from './LandingSection/LandingSection';
import LandingSectionContextProvider from './LandingSection/LandingSection.Context';
import AboutMeSection from './AboutMeSection/AboutMeSection';
import HomeContextProvider from './Home.Context';

export default function Home() {
  return (
    <HomeContextProvider>
      <div>
        <StickyHeader />

        <LandingSectionContextProvider>
          <LandingSection />
        </LandingSectionContextProvider>
        <WelcomeSection />
        <AboutMeSection />
      </div>
    </HomeContextProvider>
  );
}
