export function Footer() {
  return (
    <footer className="border-t border-brand-divider bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-bold text-brand-text">فست انگلیش پادکست</p>
            <p className="mt-1 text-brand-muted leading-relaxed">
              یادگیری انگلیسی برای فارسی‌زبانان، در شش سطح CEFR.
            </p>
          </div>
          <nav aria-label="پیوندهای محصول" className="space-y-2">
            <a href="#levels" className="block text-brand-muted hover:text-brand-text">
              سطوح
            </a>
            <a href="#sample" className="block text-brand-muted hover:text-brand-text">
              نمونه درس
            </a>
            <a href="#how" className="block text-brand-muted hover:text-brand-text">
              چگونه کار می‌کند
            </a>
          </nav>
          <nav aria-label="پیوندهای حقوقی" className="space-y-2">
            <span className="block text-brand-muted">حریم خصوصی — به‌زودی</span>
            <span className="block text-brand-muted">شرایط استفاده — به‌زودی</span>
            <span className="block text-brand-muted">پشتیبانی — به‌زودی</span>
          </nav>
        </div>
        <p className="mt-8 text-xs text-brand-muted">
          این صفحه صرفاً معرفی محصول است. ثبت‌نام، پرداخت و دسترسی به درس‌ها در داخل اپلیکیشن انجام
          می‌شود.
        </p>
      </div>
    </footer>
  );
}
