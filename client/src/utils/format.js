export function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatCurrency(val) {
  if (val == null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

export function formatPct(val) {
  if (val == null) return '-';
  return `${Math.round(val * 100)}%`;
}

export function formatStat(val, propType) {
  if (val == null) return '-';
  const rounded = Math.round(val * 10) / 10;
  const units = {
    passing_yards: 'yds', rushing_yards: 'yds', receiving_yards: 'yds',
    passing_tds: 'TD', rushing_tds: 'TD', receiving_tds: 'TD',
    receptions: 'rec', receiving_targets: 'tgt', interceptions: 'INT',
  };
  return `${rounded}${units[propType] ? ' ' + units[propType] : ''}`;
}

export const STATUS_META = {
  pending:  { label: 'Pending',  color: 'text-gray-400',   bg: 'bg-gray-800/60',    dot: 'bg-gray-500' },
  active:   { label: 'Live',     color: 'text-sky-300',    bg: 'bg-sky-950 border-l-2 border-l-sky-500',  dot: 'bg-sky-400 animate-pulse' },
  winning:  { label: 'Winning',  color: 'text-emerald-400', bg: 'bg-sky-950 border-l-2 border-l-sky-500',  dot: 'bg-emerald-400 animate-pulse' },
  losing:   { label: 'Losing',   color: 'text-red-400',    bg: 'bg-sky-950 border-l-2 border-l-sky-500',  dot: 'bg-red-400 animate-pulse' },
  won:      { label: 'Won',      color: 'text-emerald-300', bg: 'bg-emerald-900/50', dot: 'bg-emerald-300' },
  lost:     { label: 'Lost',     color: 'text-red-400',    bg: 'bg-red-900/40',     dot: 'bg-red-400' },
  push:     { label: 'Push',     color: 'text-blue-400',   bg: 'bg-blue-900/30',    dot: 'bg-blue-400' },
};
