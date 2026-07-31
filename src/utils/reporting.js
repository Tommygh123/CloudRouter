export function startOfDay(date = new Date()) { const d=new Date(date); d.setHours(0,0,0,0); return d; }
export function endOfDay(date = new Date()) { const d=new Date(date); d.setHours(23,59,59,999); return d; }
export function toInputDate(date){ const d=new Date(date); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

export function periodRange(period, fromDate, toDate) {
  const now=new Date(); let from=startOfDay(now); let to=endOfDay(now);
  if(period==='yesterday'){ const d=new Date(now); d.setDate(d.getDate()-1); from=startOfDay(d); to=endOfDay(d); }
  else if(period==='this_week'){ const d=new Date(now); const diff=(d.getDay()+6)%7; d.setDate(d.getDate()-diff); from=startOfDay(d); }
  else if(period==='last_7_days'){ const d=new Date(now); d.setDate(d.getDate()-6); from=startOfDay(d); }
  else if(period==='this_month'){ from=new Date(now.getFullYear(),now.getMonth(),1); }
  else if(period==='last_month'){ from=new Date(now.getFullYear(),now.getMonth()-1,1); to=endOfDay(new Date(now.getFullYear(),now.getMonth(),0)); }
  else if(period==='this_quarter'){ const q=Math.floor(now.getMonth()/3)*3; from=new Date(now.getFullYear(),q,1); }
  else if(period==='this_year'){ from=new Date(now.getFullYear(),0,1); }
  else if(period==='custom'){ from=fromDate?startOfDay(new Date(`${fromDate}T00:00:00`)):null; to=toDate?endOfDay(new Date(`${toDate}T00:00:00`)):null; }
  else if(period==='all'){ return {from:null,to:null}; }
  return {from,to};
}

export function rowDate(row, keys=['created_at']) { for(const key of keys){ if(row?.[key]){ const d=new Date(row[key]); if(!Number.isNaN(d.getTime())) return d; } } return null; }
export function withinRange(row, range, keys=['created_at']) { if(!range?.from&&!range?.to) return true; const d=rowDate(row,keys); if(!d) return false; if(range.from&&d<range.from)return false; if(range.to&&d>range.to)return false; return true; }
export function money(value,currency='GHS'){ return `${currency} ${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
export function downloadText(filename,text,type='text/plain;charset=utf-8'){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url); }
