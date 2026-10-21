import { Banknote } from 'lucide-react';

export function PaymentSafeguardsSettings() {
  return <section className="space-y-3 rounded-2xl border border-emerald-700 bg-emerald-950 p-4 sm:p-5">
    <h3 className="flex items-center gap-3 text-lg font-bold text-white"><Banknote className="h-6 w-6 text-emerald-200"/>Payment rules</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-100"><p className="font-bold text-emerald-200">Ferrous / mixed loads</p><p className="mt-1">Cash through $25.00 · Check above $25.00</p></div>
      <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-100"><p className="font-bold text-emerald-200">Non-ferrous-only loads</p><p className="mt-1">Cash through $100.00 · Check above $100.00</p></div>
    </div>
    <p className="text-xs leading-relaxed text-slate-100">The payment method is chosen automatically from the confirmed material categories and total purchase amount. No buying-policy setup, permit reference, seller/day cash limit or drawer-funds minimum blocks payment.</p>
    <p className="text-xs leading-relaxed text-amber-100">These are yard payment rules, not legal-compliance certification. Actual payment confirmation, check numbers and duplicate-payment protections still apply. Intake requirements are separate.</p>
  </section>;
}
