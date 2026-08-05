import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  return String(value).replaceAll('_', ' ');
}

export default function EntityListPage({ eyebrow = 'CloudRouter', title, description, table, columns, orderBy = 'created_at', emptyText }) {
  const { tenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError('');
    let query = supabase.from(table).select('*').eq('tenant_id', tenantId).limit(250);
    if (orderBy) query = query.order(orderBy, { ascending: false });
    const { data, error: queryError } = await query;
    if (queryError) setError(queryError.message);
    else setRows(data || []);
    setLoading(false);
  }, [tenantId, table, orderBy]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => columns.some((column) => String(row[column.key] ?? '').toLowerCase().includes(term)));
  }, [rows, search, columns]);

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-600">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p></div>
      <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>Refresh</button>
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{rows.length.toLocaleString()} records</p><p className="text-xs text-slate-500">Latest records for the active workspace</p></div><label className="relative"><FiSearch className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm sm:w-72"/></label></div>
      {error && <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{columns.map(c=><th key={c.key} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-slate-500">Loading…</td></tr> : filtered.length === 0 ? <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-slate-500">{emptyText || 'No records found.'}</td></tr> : filtered.map((row)=><tr key={row.id || JSON.stringify(row)} className="hover:bg-slate-50">{columns.map(c=><td key={c.key} className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{c.render ? c.render(row[c.key], row) : displayValue(row[c.key])}</td>)}</tr>)}</tbody></table></div>
    </section>
  </div>;
}
