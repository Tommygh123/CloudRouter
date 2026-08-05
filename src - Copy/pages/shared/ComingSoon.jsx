import { useLocation } from 'react-router-dom';

export default function ComingSoon() {
  const location = useLocation();

  const title = location.pathname
    .replace('/', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-600 p-8 text-white shadow-2xl">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
          CloudRouter Module
        </p>
        <h1 className="mt-3 text-3xl font-bold">{title}</h1>
        <p className="mt-4 leading-7 text-indigo-100">
          This module is connected to the owner navigation and will
          be implemented in the next development phase.
        </p>
      </div>
    </section>
  );
}
