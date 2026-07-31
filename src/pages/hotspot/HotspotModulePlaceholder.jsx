function HotspotModulePlaceholder({ title, description }) {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          CloudRouter Module
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          {description}
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Route synchronized
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          This page uses your existing authentication, tenant context,
          dashboard layout and route protection. Its complete database-driven
          implementation will be added in its dedicated module package.
        </p>
      </section>
    </div>
  );
}

export default HotspotModulePlaceholder;
