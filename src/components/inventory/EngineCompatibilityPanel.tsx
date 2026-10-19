import { useState } from 'react';
import { ExternalLink, Cog, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { matchesInterchangeModel } from '@/services/interchangeService';

export const engineSwapGuides = [
  {
    id: 'holley-trifive-ls', name: 'GM LS engine into a Tri-Five Bel Air',
    applications: [{ make: 'Chevrolet', model: 'Bel Air', startYear: 1955, endYear: 1957 }],
    source: 'Holley chassis-specific LS swap system guide',
    url: 'https://www.holley.com/platform/chevrolet/bel-air/1955-1957/products/engine_swap_parts/ls_swap_systems/',
    qualification: 'Chassis-specific swap system, not a stock replacement. The exact LS engine and transmission combination still needs checking against the chosen kit.',
    changes: ['Use the chassis-specific swap system and check engine/transmission mounts.', 'Compare oil-pan, steering and header clearance.', 'Match wiring, ECU, throttle/pedal, fuel system, cooling and emissions requirements.'],
  },
  {
    id: 'atk-buick-305-upgrade', name: '5.0L/305 to an ATK 5.7L performance build',
    applications: ['Century', 'LeSabre', 'Regal', 'Skylark'].map((model) => ({ make: 'Buick', model, startYear: 1977, endYear: 1987 })),
    source: 'ATK 2016 application guide · Buick page 7 · HP92 / HP92C / HP92M',
    url: 'https://atkvege.com/wp-content/uploads/sites/5/2018/12/engine2016.pdf',
    qualification: 'Only the source-listed 5.0L/305 applications with VIN codes G, H or U. ATK explicitly says applications are not verified and these builds are not legal for pollution-controlled vehicles. A named “Drop-In” build is not confirmation of a complete direct swap.',
    changes: ['Source warns that cooling, exhaust, fuel delivery and ignition may need upgrades.', 'Compare rear-seal design, dipstick, balance, flexplate, mounts and accessory arrangement.', 'Check legal use and emissions requirements before proceeding.'],
  },
];

export function EngineCompatibilityPanel({ make, model, year, target }: { make: string; model: string; year: number; target: string }) {
  const [showSwaps, setShowSwaps] = useState(true);
  const guides = engineSwapGuides.filter((guide) => guide.applications.some((application) => matchesInterchangeModel(make, model, year, application)));
  const research = encodeURIComponent(`${target} engine swap compatibility engine code wiring ECU mounts emissions`);
  return <section className="space-y-4 rounded-2xl border border-cyan-700 bg-cyan-950 p-4 sm:p-5">
    <h3 className="flex items-center gap-2 text-lg font-bold text-white"><Cog className="h-6 w-6 text-cyan-200" />Engine compatibility · two different jobs</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-xl border border-teal-600 bg-teal-900 p-4"><h4 className="font-bold text-teal-100">Replacement / long-block candidates</h4><p className="mt-2 text-sm leading-relaxed text-teal-100">The application cards below connect vehicles listed for the same replacement unit. A long block may require reusing your intake, oil pan, covers, accessories and electronics. No complete plug-and-play engine fitment has been confirmed.</p></article>
      <article className="rounded-xl border border-amber-700 bg-amber-950 p-4"><h4 className="font-bold text-amber-100">Swap requiring changes</h4><p className="mt-2 text-sm leading-relaxed text-amber-100">A different engine or generation needs its own documented installation path. Shared displacement or a shared replacement listing does not establish a swap. Swap guides are separate from yard donor counts.</p></article>
    </div>
    <details className="rounded-xl border border-cyan-700 bg-cyan-900 p-4 text-cyan-100"><summary className="cursor-pointer font-semibold">What to compare before choosing an engine</summary><ul className="mt-3 grid list-disc gap-2 pl-5 text-sm sm:grid-cols-2"><li>Actual engine code / RPO and applicable VIN engine character</li><li>Block and head castings; production date and engine generation</li><li>Crank/cam reluctor, sensors, VVT, AFM/DOD or MDS</li><li>Fuel type, injection, turbo/supercharger and emissions equipment</li><li>ECU, harness, immobilizer, throttle and pedal</li><li>Oil pan, mounts, accessories, flexplate and transmission/drivetrain</li></ul><p className="mt-3 text-xs">These are checks to perform, not automatically verified specifications. Older and imported vehicles may use a different VIN engine-code position.</p></details>
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-bold text-white"><Wrench className="h-4 w-4 text-amber-200" />Documented modification-dependent paths</h4><Button onClick={() => setShowSwaps((value) => !value)} aria-expanded={showSwaps} className="h-9 rounded-xl border border-cyan-600 bg-cyan-800 text-xs text-white hover:bg-cyan-700">{showSwaps ? 'Hide swap paths' : 'Show swap paths'}</Button></div>
    {showSwaps && <div className="space-y-3">
      {!guides.length && <p className="rounded-xl border border-cyan-700 bg-cyan-900 p-3 text-sm text-cyan-100">No imported chassis-specific swap guide for {target} yet. This is a coverage gap—not a finding that a swap cannot be done. Use the research links to check a particular donor engine.</p>}
      {guides.map((guide) => <article key={guide.id} className="space-y-3 rounded-xl border border-amber-700 bg-amber-950 p-4 text-amber-100"><span className="rounded-full border border-amber-500 px-2 py-1 text-[10px] font-bold">MODIFICATION-REQUIRED · UNVERIFIED</span><h5 className="font-bold">{guide.name}</h5><p className="text-sm leading-relaxed">{guide.qualification}</p><ul className="list-disc space-y-1 pl-5 text-sm">{guide.changes.map((change) => <li key={change}>{change}</li>)}</ul><a className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4" href={guide.url} target="_blank" rel="noopener noreferrer">{guide.source}<ExternalLink className="h-3 w-3" /></a><p className="text-xs">Reference reviewed October 19, 2026. No specific yard engine has been verified for this path.</p></article>)}
      <div className="flex flex-wrap gap-2"><a href={`https://www.google.com/search?q=${research}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-600">Research this vehicle's engine swaps ↗</a><a href="https://atkvege.com/wp-content/uploads/sites/5/2018/12/engine2016.pdf" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-cyan-500 bg-cyan-900 px-4 py-3 text-sm font-semibold text-cyan-100">ATK domestic / import engine reference ↗</a></div>
      <p className="text-xs text-cyan-100">The ATK reference is a 2016 catalog with historical engine applications, VIN/casting qualifications and some upgrade warnings. It is not a current, complete 1950–present dataset, and its full PDF is not imported here.</p>
    </div>}
  </section>;
}
