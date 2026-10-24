import type { CustomerRow } from './customers';

export interface CustomerDuplicateGroup {
  customers: CustomerRow[];
  reasons: string[];
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function grams(value: string) {
  const padded = `  ${value} `;
  return new Set(Array.from({ length: Math.max(0, padded.length - 2) }, (_, index) => padded.slice(index, index + 3)));
}

function nameSimilarity(left: string, right: string) {
  const a = grams(normalize(left));
  const b = grams(normalize(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return (2 * shared) / (a.size + b.size);
}

export function findCustomerDuplicateGroups(rows: CustomerRow[]): CustomerDuplicateGroup[] {
  const parent = rows.map((_, index) => index);
  const reasons = new Map<string, Set<string>>();
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const candidatePairs = new Set<string>();
  const buckets = new Map<string, number[]>();
  const addBucket = (key: string, index: number) => {
    if (!key) return;
    const bucket = buckets.get(key) ?? [];
    bucket.push(index);
    buckets.set(key, bucket);
  };
  const pair = (first: number, second: number) => {
    const a = Math.min(first, second);
    const b = Math.max(first, second);
    if (a !== b) candidatePairs.add(`${a}:${b}`);
  };

  rows.forEach((row, index) => {
    const id = normalize(row.id_number);
    const phone = (row.phone ?? '').replace(/\D/g, '');
    if (id) addBucket(`id:${id}`, index);
    if (phone) addBucket(`phone:${phone}`, index);
    const name = normalize(row.full_name);
    for (const gram of grams(name)) addBucket(`name:${gram}`, index);
  });

  for (const indexes of buckets.values()) {
    for (let a = 0; a < indexes.length; a++) {
      for (let b = a + 1; b < indexes.length; b++) pair(indexes[a], indexes[b]);
    }
  }

  for (const key of candidatePairs) {
    const [left, right] = key.split(':').map(Number);
    const first = rows[left];
    const second = rows[right];
    const pairReasons = new Set<string>();
    const firstId = normalize(first.id_number);
    if (firstId && firstId === normalize(second.id_number)) pairReasons.add('Same ID number');
    const firstPhone = (first.phone ?? '').replace(/\D/g, '');
    if (firstPhone && firstPhone === (second.phone ?? '').replace(/\D/g, '')) pairReasons.add('Same phone number');
    if (nameSimilarity(first.full_name, second.full_name) >= 0.7) pairReasons.add('Similar name');
    if (!pairReasons.size) continue;
    const rootA = find(left);
    const rootB = find(right);
    if (rootA !== rootB) parent[rootB] = rootA;
    reasons.set(key, pairReasons);
  }

  const components = new Map<number, Set<number>>();
  rows.forEach((_, index) => {
    const root = find(index);
    const component = components.get(root) ?? new Set<number>();
    component.add(index);
    components.set(root, component);
  });

  return [...components.values()].filter(component => component.size > 1).map(component => {
    const indexes = [...component];
    const groupReasons = new Set<string>();
    for (let a = 0; a < indexes.length; a++) {
      for (let b = a + 1; b < indexes.length; b++) {
        const key = `${Math.min(indexes[a], indexes[b])}:${Math.max(indexes[a], indexes[b])}`;
        reasons.get(key)?.forEach(reason => groupReasons.add(reason));
      }
    }
    return { customers: indexes.map(index => rows[index]), reasons: [...groupReasons] };
  });
}
