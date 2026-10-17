import type { SplitProfile, WeightCapture, WeightPass } from '../types/scrapBuying';

// Fixed-point pounds (6 decimals); deductions/payable pounds round half-up to
// 0.1 lb, and money rounds half-up to cents. No invalid net is zero-clamped.
const ONE = BigInt(1000000);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);

function fixed(value: number, name: string): bigint {
  if (!Number.isFinite(value) || value < 0 || value > 1000000000) {
    throw new Error(`${name} must be finite, non-negative and within supported limits`);
  }
  const [whole, fraction = ''] = value.toFixed(6).split('.');
  return BigInt(whole) * ONE + BigInt(fraction.padEnd(6, '0'));
}

function roundDivide(value: bigint, divisor: bigint): bigint {
  return (value + divisor / BigInt(2)) / divisor;
}

function pounds(value: bigint): number {
  return Number(value) / Number(ONE);
}

export function normalizeWeight(weight: number, unit: 'LBS' | 'KG'): number {
  const value = fixed(weight, 'Weight');
  if (unit !== 'LBS' && unit !== 'KG') throw new Error('Unsupported weight unit');
  // International avoirdupois pound = exactly 0.45359237 kg.
  return pounds(unit === 'LBS' ? value : roundDivide(value * BigInt(100000000), BigInt(45359237)));
}

export function validateScaleReading(weight: number, capacityLbs?: number, resolutionLbs?: number): void {
  const value = fixed(weight, 'Weight');
  if (capacityLbs !== undefined && (capacityLbs <= 0 || value > fixed(capacityLbs, 'Capacity'))) {
    throw new Error('Reading exceeds scale capacity or capacity is invalid');
  }
  if (resolutionLbs !== undefined) {
    const step = fixed(resolutionLbs, 'Resolution');
    if (step === BigInt(0) || value % step !== BigInt(0)) throw new Error('Reading conflicts with scale resolution');
  }
}

export function validatedBreakdown(gross: number, tare: number, deductionPercent: number, ratePerLb: number) {
  const grossFixed = fixed(gross, 'Gross');
  const tareFixed = fixed(tare, 'Tare');
  const percent = fixed(deductionPercent, 'Deduction');
  const rate = fixed(ratePerLb, 'Rate');
  if (tareFixed > grossFixed) throw new Error('Tare cannot exceed gross weight');
  if (deductionPercent > 100) throw new Error('Deduction must be between 0 and 100 percent');
  const net = grossFixed - tareFixed;
  const deductedTenths = roundDivide(net * percent * TEN, HUNDRED * ONE * ONE);
  const deducted = deductedTenths * (ONE / TEN);
  // A rounded deduction can exceed net by <0.05 lb; payable rounds to zero
  // only in that rounding case, never to hide impossible gross/tare input.
  const payableTenths = deducted > net ? BigInt(0) : roundDivide((net - deducted) * TEN, ONE);
  const cents = roundDivide(payableTenths * rate * HUNDRED, TEN * ONE);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Line amount exceeds supported financial precision');
  return {
    grossWeight: pounds(grossFixed), tareWeight: pounds(tareFixed), netWeight: pounds(net),
    deductionPercent, deductionLbs: Number(deductedTenths) / 10,
    billableWeight: Number(payableTenths) / 10, ratePerLb, lineTotal: Number(cents) / 100,
  };
}

export function platformWeights(readingLbs: number, tareLbs: number, readingBasis: 'GROSS' | 'NET', treatment: 'NONE' | 'SCALE_TARE' | 'MANUAL') {
  const reading = fixed(readingLbs, 'Reading');
  const tare = fixed(tareLbs, 'Tare');
  if (treatment === 'NONE' && tare !== BigInt(0)) throw new Error('No-tare capture must have zero tare');
  if (readingBasis === 'NET' && treatment !== 'SCALE_TARE') throw new Error('Net display requires explicit scale-applied tare');
  const gross = readingBasis === 'NET' ? reading + tare : reading;
  if (tare > gross) throw new Error('Tare cannot exceed gross weight');
  return { grossLbs: pounds(gross), tareLbs: pounds(tare), netLbs: pounds(gross - tare) };
}

export function aggregateSplitPass(pass: WeightPass, captures: readonly WeightCapture[], scaleId: string, capacityLbs?: number) {
  const profile = pass.profile;
  if (pass.layout !== 'COMPONENTS' || !profile || profile.scaleId !== scaleId) throw new Error('Split profile is incompatible with this scale/pass');
  const labels = profile.components.map((component) => component.id);
  if (!labels.length || new Set(labels).size !== labels.length || profile.components.some((c) => !c.id.trim() || !c.label.trim())) {
    throw new Error('Split profile requires unique, named component groups');
  }
  const captureMap = new Map(captures.map((capture) => [capture.id, capture]));
  if (captureMap.size !== captures.length) throw new Error('Duplicate capture IDs');
  const used = new Set<string>();
  const components = new Set<string>();
  let total = BigInt(0);
  for (const component of pass.components) {
    if (!labels.includes(component.componentId) || components.has(component.componentId) || used.has(component.captureId)) {
      throw new Error('Duplicate or conflicting split component');
    }
    const capture = captureMap.get(component.captureId);
    if (!capture || capture.scaleId !== scaleId || (!capture.stable && capture.source !== 'MANUAL')) throw new Error('Missing, incompatible or unstable capture');
    if (captures.some((revision) => revision.replacesCaptureId === capture.id)) throw new Error('A superseded capture cannot be included in a total');
    if (normalizeWeight(capture.originalWeight, capture.originalUnit) !== capture.normalizedLbs) throw new Error('Capture normalization conflicts with original reading');
    validateScaleReading(capture.normalizedLbs, capacityLbs);
    used.add(capture.id);
    components.add(component.componentId);
    total += fixed(capture.normalizedLbs, 'Component');
  }
  const complete = components.size === labels.length;
  return { subtotalLbs: pounds(total), complete, reviewed: complete && pass.reviewed, captureIds: [...used] };
}

export function splitCycleNet(loaded: WeightPass, tare: WeightPass, captures: readonly WeightCapture[], scaleId: string, commercial: boolean, capacityLbs?: number) {
  const profile: SplitProfile | undefined = loaded.profile;
  if (loaded.purpose !== 'LOADED' || tare.purpose !== 'TARE' || !profile || !tare.profile ||
    profile.id !== tare.profile.id || profile.version !== tare.profile.version ||
    JSON.stringify(profile) !== JSON.stringify(tare.profile)) throw new Error('Loaded and tare passes require matching compatible profiles');
  const confirmation = profile.suitabilityConfirmation;
  if (commercial && (!confirmation?.confirmedBy.trim() || !confirmation.manufacturerReference.trim() ||
    !confirmation.authorityReference.trim() || !Number.isFinite(Date.parse(confirmation.confirmedAt)) || !profile.operatingInstructions.trim())) {
    throw new Error('Commercial split weighing requires documented suitability confirmation');
  }
  const incoming = aggregateSplitPass(loaded, captures, scaleId, capacityLbs);
  const outgoing = aggregateSplitPass(tare, captures, scaleId, capacityLbs);
  if (!incoming.reviewed || !outgoing.reviewed) throw new Error('Both complete passes must be reviewed');
  if (incoming.captureIds.some((id) => outgoing.captureIds.includes(id))) throw new Error('A capture cannot be reused across passes');
  return validatedBreakdown(incoming.subtotalLbs, outgoing.subtotalLbs, 0, 0).netWeight;
}
