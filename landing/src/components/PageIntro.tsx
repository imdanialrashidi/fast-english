// Consistent heading block for inner landing pages: one H1 + lead text.
export function PageIntro({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mx-auto max-w-3xl pt-10 sm:pt-14 pb-2 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-[1.2] tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-base sm:text-lg text-muted leading-relaxed">{lead}</p>
    </div>
  );
}
