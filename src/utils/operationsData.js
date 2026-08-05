export const SUCCESS_PAYMENT_STATUSES = new Set(['paid','success','successful','completed']);
export const ACTIVE_SESSION_STATUSES = new Set(['active','online','authorized']);

export function norm(value){ return String(value ?? '').trim().toLowerCase(); }
export function isPaid(row){ return SUCCESS_PAYMENT_STATUSES.has(norm(row?.payment_status || row?.status)); }
export function orderAmount(row){ return Number(row?.amount ?? row?.price_amount ?? row?.total_amount ?? 0) || 0; }

export function createSiteResolver(devices=[]){
  const routerToSite = new Map(devices.filter(Boolean).map(d=>[d.id,d.site_id || null]));
  return (row) => row?.site_id || routerToSite.get(row?.router_id) || null;
}
export function decorateWithSite(rows=[], devices=[]){
  const resolve = createSiteResolver(devices);
  return rows.map(row=>({...row, resolved_site_id: resolve(row)}));
}
export function customerKey(row){
  return String(row?.customer_phone || row?.phone || row?.customer_email || row?.email || row?.customer_name || row?.name || row?.customer_id || '').trim().toLowerCase();
}
