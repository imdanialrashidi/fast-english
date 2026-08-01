import { SiteLayout } from '../layouts/SiteLayout';
import { BenefitsSection } from '../sections/BenefitsSection';
import { CefrSection } from '../sections/CefrSection';
import { FaqSection } from '../sections/FaqSection';
import { FinalCta } from '../sections/FinalCta';
import { Hero } from '../sections/Hero';
import { HowItWorks } from '../sections/HowItWorks';
import { InstallSection } from '../sections/InstallSection';
import { SampleLesson } from '../sections/SampleLesson';

export function HomePage() {
  return (
    <SiteLayout>
      <Hero />
      <HowItWorks />
      <BenefitsSection />
      <CefrSection />
      <SampleLesson />
      <InstallSection />
      <FaqSection />
      <FinalCta />
    </SiteLayout>
  );
}
