// Landing section composition. The landing is fully static and contains
// no authentication, payment, or dashboard behavior.
import { CefrSection } from './sections/CefrSection';
import { CtaSection } from './sections/CtaSection';
import { Footer } from './sections/Footer';
import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { SampleLesson } from './sections/SampleLesson';

export function Landing() {
  return (
    <div className="min-h-dvh bg-brand-surface text-brand-text">
      <Header />
      <main id="main-content">
        <Hero />
        <CefrSection />
        <SampleLesson />
        <HowItWorks />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
