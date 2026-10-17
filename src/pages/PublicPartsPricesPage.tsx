import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';
import { PublishedPartsPrices } from '@/components/pricing/PublishedPartsPrices';
import '@/parts-prices-print.css';

export default function PublicPartsPricesPage() {
  return <div className="parts-prices-public min-h-screen bg-slate-950 text-white print:bg-white print:text-slate-900">
    <header className="border-b border-emerald-900 bg-emerald-950 print:hidden"><nav aria-label="Public prices navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4"><Link to="/inventory" className="flex items-center gap-2 rounded-xl text-sm font-semibold text-emerald-100 hover:text-white"><ArrowLeft className="h-4 w-4"/>Vehicle inventory</Link><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-200"><Wrench className="h-4 w-4"/>Yard price guide</span></nav></header>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 print:p-0"><PublishedPartsPrices/></main>
  </div>;
}
