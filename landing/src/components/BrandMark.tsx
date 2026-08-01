// Simple brand mark for the landing. Mirrors the app BrandMark direction
// without sharing any code between the two surfaces.
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-3 text-brand-text no-underline"
      aria-label="فست انگلیش پادکست — صفحهٔ اصلی"
    >
      <span
        aria-hidden
        className="grid place-items-center rounded-xl text-white font-extrabold"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.42,
          background: 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)',
        }}
      >
        FE
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold">فست انگلیش</span>
        <span className="block text-xs text-brand-muted font-medium">پادکست یادگیری انگلیسی</span>
      </span>
    </a>
  );
}
