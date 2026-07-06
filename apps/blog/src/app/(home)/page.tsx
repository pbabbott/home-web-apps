'use client';
import WelcomeSection from './WelcomeSection/WelcomeSection';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import PageScrollLayout from '@/components/PageScrollLayout/PageScrollLayout';
import LandingSection from './LandingSection/LandingSection';
import LandingSectionContextProvider from './LandingSection/LandingSection.Context';
import AboutMeSection from './AboutMeSection/AboutMeSection';
import PromiseSection from './PromiseSection/PromiseSection';
import BuiltWithSection from './BuiltWithSection/BuiltWithSection';
import Footer from '@/components/Footer/Footer';
import HomeContextProvider from './Home.Context';

export default function Home() {
  return (
    <HomeContextProvider>
      <div>
        <StickyHeader />
        <PageScrollLayout>
          <LandingSectionContextProvider>
            <LandingSection />
          </LandingSectionContextProvider>
          <WelcomeSection />
          <PromiseSection />
          <BuiltWithSection />
          <AboutMeSection />
          <Footer />
        </PageScrollLayout>
      </div>
    </HomeContextProvider>
  );
}
