import { ShieldCheck } from 'lucide-react';

const checks: Record<string, { scope: string; items: string[] }> = {
  Body: { scope: 'A listed liner, molding or impact absorber is not evidence that a complete door, fender, hood or bumper cover swaps.', items: ['Match front/rear and left/right position, body/cab style, mounting points and trim.', 'Check sensors, camera provisions, brackets and production-date changes.', 'Inspect damage and corrosion; a crash-damaged impact absorber must not be assumed safe to reuse.'] },
  Lights: { scope: 'Headlight set applications do not establish interchange of tail lights, modules or each separate kit component.', items: ['Match driver/passenger side and halogen, HID or LED system.', 'Compare connectors, pinout, leveling, daytime-running lights and control modules.', 'Check housing shape, mounting and trim; inspect lens damage and water intrusion.'] },
  Brakes: { scope: 'A shared pad/rotor kit does not establish caliper, booster or ABS-module interchange. Fitment is not a safety inspection.', items: ['Verify brake/RPO code, rotor diameter/thickness, lug count and caliper/bracket configuration.', 'Match front/rear axle, vehicle load rating and manual/electric parking brake.', 'Have wear, corrosion, minimum thickness and serviceability professionally checked before reuse.'] },
  Cooling: { scope: 'A radiator application does not establish interchange of fans, condensers, hoses or every other cooling-system part.', items: ['Compare engine, transmission, tow package and radiator core dimensions.', 'Match inlet/outlet location, fittings, mounting and fan/shroud clearances.', 'Verify engine-oil/transmission coolers and pressure/leak-test the actual donor part.'] },
  Interior: { scope: 'Handle/bezel applications do not establish interchange of complete door panels, seats, airbag systems or electronic modules.', items: ['Match color, finish, side, front/rear location and body/cab configuration.', 'Compare lock-switch holes, handle linkage, clips and mounting.', 'Verify switch connectors and equipment options; inspect the actual component before pulling.'] },
};

export function PartCompatibilityChecks({ category }: { category: string }) {
  const entry = checks[category];
  if (!entry) return null;
  return <details className="rounded-xl border border-amber-700 bg-amber-950 p-4 text-amber-100"><summary className="cursor-pointer text-sm font-semibold"><ShieldCheck className="mr-2 inline h-4 w-4" />{category} · required compatibility checks</summary><p className="mt-3 text-xs leading-relaxed">{entry.scope}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed">{entry.items.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-3 text-xs font-semibold">These checks are not automatically verified by this lookup. Compare the source Part Details and every vehicle application qualification.</p></details>;
}
