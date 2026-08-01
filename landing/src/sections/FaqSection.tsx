import { FAQ_ITEMS } from '../content/siteContent';

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="py-12 sm:py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="faq-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            پرسش‌های پرتکرار
          </h2>
        </div>

        <div className="mt-8 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-brand-divider bg-brand-surface p-4"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-base font-bold text-brand-text [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden
                  className="shrink-0 text-brand-primary transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <p className="mt-3 text-sm text-brand-muted leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
