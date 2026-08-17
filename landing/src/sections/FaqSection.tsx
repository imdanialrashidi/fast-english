import { FAQ_ITEMS } from '../content/siteContent';

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
            پرسش‌های پرتکرار
          </p>
          <h2
            id="faq-title"
            className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
          >
            قبل از شروع، این‌ها را بدانید
          </h2>
        </div>

        <div className="mt-8 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-outline-soft bg-surface px-5 py-1 open:py-4"
            >
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-3 text-base font-bold text-text [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus rounded-lg">
                {item.question}
                <span
                  aria-hidden
                  className="shrink-0 text-accent transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <p className="pb-2 text-sm text-muted leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
