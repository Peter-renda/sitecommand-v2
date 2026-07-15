type UnderConstructionNoticeProps = {
  title: string;
};

export default function UnderConstructionNotice({ title }: UnderConstructionNoticeProps) {
  return (
    <main className="min-h-[60vh] px-6 py-10">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
        <span className="mb-4 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          {title}
        </span>
        <h1 className="font-display text-3xl font-semibold text-[color:var(--ink)] md:text-4xl">
          This page is still under construction.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
          Please check back for updates.
        </p>
      </div>
    </main>
  );
}
