import { SiteLayout } from '../layouts/SiteLayout';
import { CefrSection } from '../sections/CefrSection';
import { ExperienceSection } from '../sections/ExperienceSection';
import { FaqSection } from '../sections/FaqSection';
import { FinalCta } from '../sections/FinalCta';
import { Hero } from '../sections/Hero';
import { HowItWorks } from '../sections/HowItWorks';
import { InstallSection } from '../sections/InstallSection';
import { PaymentSection } from '../sections/PaymentSection';
import { SampleLesson } from '../sections/SampleLesson';
import { WhyLevelsSection } from '../sections/WhyLevelsSection';

// The conversion narrative, deliberately ordered as a story rather than
// a stack of feature cards:
//   Hero (what/for whom/next action)
//   → why one Episode exists across six levels (the core differentiator)
//   → how the learner starts (activation journey)
//   → the actual Student experience (continue/vocabulary/transcript)
//   → the CEFR ladder
//   → a real sample Episode
//   → honest payment expectations
//   → install/access
//   → common objections (FAQ)
//   → final CTA
export function HomePage() {
  return (
    <SiteLayout>
      <Hero />
      <WhyLevelsSection />
      <HowItWorks />
      <ExperienceSection />
      <CefrSection />
      <SampleLesson />
      <PaymentSection />
      <InstallSection />
      <FaqSection />
      <FinalCta />
    </SiteLayout>
  );
}
