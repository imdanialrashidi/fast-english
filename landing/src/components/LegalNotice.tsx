// landing/src/components/LegalNotice.tsx
// Visible banner marking legal copy that still requires owner/legal
// review before the site may be published to Production. The
// `data-legal-status="needs-review"` attribute is asserted by tests so
// this cannot silently ship.
import { LEGAL_REVIEW_TEXT } from '../content/siteContent';

export function LegalNotice() {
  return (
    <div
      role="note"
      data-legal-status="needs-review"
      className="rounded-2xl border px-4 py-4 text-sm leading-relaxed"
      style={{
        borderColor: 'var(--color-warning)',
        background: 'var(--color-warning-container)',
        color: 'var(--color-warning)',
      }}
    >
      <p className="font-bold">{LEGAL_REVIEW_TEXT}</p>
      <p className="mt-1">
        این متن پیش‌نویس است و هنوز از سوی مالک محصول یا مشاور حقوقی بررسی و تأیید نشده است. موارد
        مشخص‌نشده با عبارت «به‌زودی» علامت خورده‌اند. تا زمان تأیید، این صفحه نباید به‌عنوان متن رسمی
        منتشر شود.
      </p>
    </div>
  );
}
