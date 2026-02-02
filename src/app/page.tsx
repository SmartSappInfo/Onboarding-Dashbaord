'use client';

import Header from '@/components/header';
import Footer from '@/components/footer';
import AppDownloadSection from '@/components/app-download-section';
import HelpSection from '@/components/help-section';
import SetupProfileSection from '@/components/setup-profile-section';
import TestimonialsSection from '@/components/testimonials-section';
import WelcomeSection from '@/components/welcome-section';

export default function Home() {
  const helpVideos = [
    'https://youtu.be/4zchas6SKtE',
    'https://youtu.be/1p5ICDnyzjk',
    'https://youtu.be/XuixxYGw02g',
    'https://youtu.be/qlK8TVipyDs',
    'https://youtu.be/akt0jFWqqPs',
    'https://youtu.be/XmP7rNPSRDc',
    'https://youtu.be/ORUNmDdXMZQ',
    'https://youtu.be/BNJ8jAw3MRE',
    'https://youtu.be/Ft7ViVtzX3U',
  ];

  return (
    <>
      <Header />
      <main className="flex-grow">
        <WelcomeSection />

        <AppDownloadSection />
        
        <SetupProfileSection />

        <HelpSection helpVideos={helpVideos} />

        <TestimonialsSection />
      </main>
      <Footer />
    </>
  );
}
