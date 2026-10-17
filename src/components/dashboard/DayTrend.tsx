import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export function DayTrend({ current, previous }: { current: number; previous: number }) {
  const difference = current - previous;
  const Icon = difference > 0 ? ArrowUpRight : difference < 0 ? ArrowDownRight : Minus;
  const label = difference === 0 ? 'Unchanged' : previous === 0 ? 'New activity' : `${Math.abs(difference / previous * 100).toFixed(1)}% ${difference > 0 ? 'higher' : 'lower'}`;
  return <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-sky-300"><Icon className="h-3.5 w-3.5" />{label} vs yesterday</p>;
}
