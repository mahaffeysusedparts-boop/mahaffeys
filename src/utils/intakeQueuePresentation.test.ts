import { describe, expect, it } from 'vitest';
import { intakeAge, presentIntakeQueue, queueStage, queueWeighingType } from './intakeQueuePresentation';
import type { Ticket } from '../types/scrap';
const now = Date.parse('2026-01-03T00:24:00Z');
const row = (id: string, createdAt: string) => ({ id, createdAt, customerName: 'Seller', customerPhone: '555123', vehicleLicensePlate: 'ABC-123' }) as Ticket;
describe('safe intake age', () => {
  it('handles minutes, midnight, multi-day loads, invalid and future dates', () => {
    expect(intakeAge('2026-01-03T00:00:00Z', now)).toBe('24 min');
    expect(intakeAge('2026-01-02T23:00:00Z', now)).toBe('1 hr 24 min');
    expect(intakeAge('2026-01-01T00:00:00Z', now)).toBe('2 d 0 hr');
    for (const timestamp of [undefined, 'invalid', '2026-01-04T00:00:00Z']) expect(intakeAge(timestamp, now)).toBe('unavailable');
  });
});
describe('queue presentation', () => {
  it('keeps existing order by default and stable ties with oldest first', () => {
    const rows = [row('later', '2026-01-02'), row('first-tie', '2026-01-01'), row('second-tie', '2026-01-01'), row('invalid', 'bad')];
    const options = { search: '', needsDetails: false, oldestFirst: false, attention: () => true };
    expect(presentIntakeQueue(rows, options)).toEqual(rows);
    expect(presentIntakeQueue(rows, { ...options, oldestFirst: true }).map(ticket => ticket.id)).toEqual(['first-tie', 'second-tie', 'later', 'invalid']);
    expect(rows[0].id).toBe('later');
  });
  it('searches small queues by ticket, seller, phone and plate; filters unknown attention', () => {
    const rows = [row('TICKET', '2026-01-01')];
    for (const search of ['ticket', 'seller', '555', 'abc-123']) expect(presentIntakeQueue(rows, { search, needsDetails: true, oldestFirst: false, attention: () => true })).toHaveLength(1);
    expect(presentIntakeQueue(rows, { search: 'missing', needsDetails: false, oldestFirst: false, attention: () => true })).toEqual([]);
  });
  it('stage does not depend on selection and saved IN outranks previous lines', () => {
    const ticket = { ...row('T', '2026-01-01'), scaleGrossInWeight: 1000, scrapLines: [{}] as Ticket['scrapLines'] };
    expect(queueStage(ticket)).toBe('On yard · awaiting OUT');
    expect(queueWeighingType(ticket)).toBe('Truck IN/OUT');
    expect(queueStage({ ...ticket, scaleTareOutWeight: 500 })).toBe('Confirm material grade');
  });
});
