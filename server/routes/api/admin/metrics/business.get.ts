import { defineHandler } from "nitro";
import { requireAdmin } from "../../../../utils/auth";
import { query } from "../../../../utils/db";

interface AppStateRow {
  key: string;
  value: unknown;
}

interface StateRecord {
  [key: string]: unknown;
}

const CATEGORY_LABELS: Record<string, string> = {
  FERROUS_PILE: "Ferrous",
  NON_FERROUS_BIN: "Non-Ferrous",
  CAR_GRID: "Vehicles",
  PRECIOUS_VAULT: "Precious",
  PROCESSING_ZONE: "Processing",
};

const numberValue = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const stateRecords = (value: unknown): StateRecord[] => (
  Array.isArray(value)
    ? value.filter((item): item is StateRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : []
);

const ticketWeight = (ticket: StateRecord) => {
  if (ticket.ticketType === "CAR_SALVAGE") {
    const carRecord = ticket.carRecord;
    return carRecord && typeof carRecord === "object" && !Array.isArray(carRecord)
      ? numberValue((carRecord as StateRecord).vehicleWeightLbs)
      : 0;
  }

  return stateRecords(ticket.scrapLines).reduce(
    (total, line) => total + numberValue(line.billableWeight),
    0,
  );
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default defineHandler(async (event) => {
  await requireAdmin(event);

  const result = await query<AppStateRow>(
    "SELECT key, value FROM app_state WHERE key = ANY($1::text[])",
    [["mahaffeys_yard_bays", "mahaffeys_tickets", "mahaffeys_shipments"]],
  );
  const state = new Map(result.rows.map((row) => [row.key, row.value]));
  const bays = stateRecords(state.get("mahaffeys_yard_bays"));
  const tickets = stateRecords(state.get("mahaffeys_tickets"));
  const shipments = stateRecords(state.get("mahaffeys_shipments"));

  const categoryTotals = new Map<string, { value: number; weight: number }>();
  let totalValue = 0;
  let totalWeight = 0;
  let totalCapacity = 0;

  for (const bay of bays) {
    const categoryKey = String(bay.categoryType || "OTHER");
    const value = numberValue(bay.estValueUsd);
    const weight = numberValue(bay.currentLbs);
    const capacity = numberValue(bay.capacityLbs);
    const current = categoryTotals.get(categoryKey) || { value: 0, weight: 0 };
    current.value += value;
    current.weight += weight;
    categoryTotals.set(categoryKey, current);
    totalValue += value;
    totalWeight += weight;
    totalCapacity += capacity;
  }

  const today = new Date();
  const firstDay = new Date(today);
  firstDay.setHours(0, 0, 0, 0);
  firstDay.setDate(firstDay.getDate() - 6);

  const dailyMap = new Map<string, { weight: number; tickets: number; payouts: number; revenue: number }>();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + offset);
    dailyMap.set(dateKey(day), { weight: 0, tickets: 0, payouts: 0, revenue: 0 });
  }

  for (const ticket of tickets) {
    if (ticket.status !== "COMPLETED" || typeof ticket.createdAt !== "string") continue;
    const createdAt = new Date(ticket.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt < firstDay) continue;
    const bucket = dailyMap.get(dateKey(createdAt));
    if (!bucket) continue;
    bucket.weight += ticketWeight(ticket);
    bucket.payouts += numberValue(ticket.finalPayout);
    bucket.tickets += 1;
  }

  let settledShipments7Days = 0;
  for (const shipment of shipments) {
    const settlement = shipment.settlement;
    if (!settlement || typeof settlement !== "object" || Array.isArray(settlement)) continue;
    const record = settlement as StateRecord;
    if (typeof record.settledAt !== "string") continue;
    const settledAt = new Date(record.settledAt);
    if (!Number.isFinite(settledAt.getTime()) || settledAt < firstDay) continue;
    const bucket = dailyMap.get(dateKey(settledAt));
    if (!bucket) continue;
    bucket.revenue += numberValue(record.amountPaid);
    settledShipments7Days += 1;
  }

  const daily = Array.from(dailyMap, ([date, metrics]) => ({ date, ...metrics }));
  const last7DaysLbs = daily.reduce((total, day) => total + day.weight, 0);
  const completedTickets7Days = daily.reduce((total, day) => total + day.tickets, 0);
  const payouts7Days = daily.reduce((total, day) => total + day.payouts, 0);
  const revenue7Days = daily.reduce((total, day) => total + day.revenue, 0);
  const grossMargin7Days = revenue7Days - payouts7Days;

  return {
    generatedAt: new Date().toISOString(),
    inventory: {
      totalValue,
      totalWeightLbs: totalWeight,
      capacityUtilizationPercent: totalCapacity > 0 ? (totalWeight / totalCapacity) * 100 : 0,
      bayCount: bays.length,
      categories: Array.from(categoryTotals, ([key, totals]) => ({
        key,
        name: CATEGORY_LABELS[key] || key.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        value: totals.value,
        weightLbs: totals.weight,
      })).sort((a, b) => b.value - a.value),
    },
    throughput: {
      todayLbs: daily.at(-1)?.weight || 0,
      last7DaysLbs,
      completedTickets7Days,
      averageLbsPerTicket: completedTickets7Days > 0 ? last7DaysLbs / completedTickets7Days : 0,
      daily: daily.map(({ date, weight, tickets: count }) => ({ date, weight, tickets: count })),
    },
    financials: {
      payouts7Days,
      revenue7Days,
      grossMargin7Days,
      marginPercent: revenue7Days > 0 ? (grossMargin7Days / revenue7Days) * 100 : null,
      settledShipments7Days,
      daily: daily.map(({ date, payouts, revenue }) => ({ date, payouts, revenue })),
    },
  };
});
