import { FiWifi } from 'react-icons/fi';

export function CloudRouterMark({ compact = false, light = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className={[
        'flex shrink-0 items-center justify-center rounded-xl font-black shadow-sm',
        compact ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm',
        light ? 'bg-white text-blue-700' : 'bg-blue-600 text-white',
      ].join(' ')}>
        <FiWifi className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className={light ? 'font-black text-white' : 'font-black text-slate-900'}>CloudRouter</p>
          <p className={light ? 'text-[10px] text-blue-200' : 'text-[10px] text-slate-500'}>Hotspot Management Platform</p>
        </div>
      )}
    </div>
  );
}

export function TenantLogo({ tenant, size = 'md', className = '' }) {
  const name = tenant?.business_name || tenant?.name || 'Business';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CR';

  const sizeClass = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-16 w-16 text-lg' : 'h-11 w-11 text-sm';

  if (tenant?.logo_url) {
    return (
      <div className={`${sizeClass} ${className} overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm`}>
        <img src={tenant.logo_url} alt={`${name} logo`} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} ${className} flex shrink-0 items-center justify-center rounded-xl bg-blue-600 font-black text-white shadow-sm`}>
      {initials}
    </div>
  );
}
