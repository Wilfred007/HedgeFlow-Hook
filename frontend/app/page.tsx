'use client';

import { useState, useEffect } from 'react';
import { LoadingScreen }        from '@/components/landing/LoadingScreen';
import { LenisProvider }        from '@/components/landing/LenisProvider';
import { CustomCursor }         from '@/components/landing/CustomCursor';
import { LandingNav }           from '@/components/landing/LandingNav';
import { HeroSection }          from '@/components/landing/HeroSection';
import { StatsSection }         from '@/components/landing/StatsSection';
import { FeaturesSection }      from '@/components/landing/FeaturesSection';
import { HowItWorksSection }    from '@/components/landing/HowItWorksSection';
import { RiskModesSection }     from '@/components/landing/RiskModesSection';
import { FooterSection }        from '@/components/landing/FooterSection';

export default function LandingPage() {
  const [loaderDone, setLoaderDone] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  // Lock scroll until loader fully exits
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // When onComplete fires the curtain starts splitting — make page visible
  // The loader unmounts itself ~1s later after the split finishes
  const handleLoaderComplete = () => {
    setLoaderDone(true);
    // Remove loader from DOM after the curtain animation finishes
    setTimeout(() => setShowLoader(false), 1200);
    // Re-enable scroll after loader is gone
    setTimeout(() => { document.body.style.overflow = ''; }, 1100);
  };

  return (
    <>
      <CustomCursor />

      {showLoader && <LoadingScreen onComplete={handleLoaderComplete} />}

      <LenisProvider>
        <div
          style={{
            background: '#030310',
            color: '#ffffff',
            fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
            overflowX: 'hidden',
            // Visible as soon as onComplete fires so curtain reveals real page
            visibility: loaderDone ? 'visible' : 'hidden',
          }}
        >
          <LandingNav />
          <HeroSection />
          <StatsSection />
          <FeaturesSection />
          <HowItWorksSection />
          <RiskModesSection />
          <FooterSection />
        </div>
      </LenisProvider>
    </>
  );
}
