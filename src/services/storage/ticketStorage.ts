import { Ticket, NMVTISReportLog, Customer, PullYardVehicle } from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import { INITIAL_TICKETS } from "@/services/data/initialData";

const TICKETS_KEY = 'mahaffeys_tickets';
const NMVTIS_KEY = 'mahaffeys_nmvtis_logs';

export const ticketStorage = {
  getTickets(): Ticket[] {
    const data = sharedStorage.getItem(TICKETS_KEY);
    if (!data) {
      sharedStorage.setItem(TICKETS_KEY, JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    return JSON.parse(data);
  },

  saveTicket(
    ticket: Ticket,
    saveVehicleHandler: (veh: PullYardVehicle) => void,
    addCashDrawerDisbursement: (amount: number, operatorName: string, notes: string) => void,
    getCustomersHandler: () => Customer[],
    saveCustomerHandler: (c: Customer) => void
  ): Ticket {
    const tickets = this.getTickets();
    const existingIndex = tickets.findIndex((t) => t.id === ticket.id);
    if (existingIndex >= 0) {
      tickets[existingIndex] = ticket;
    } else {
      tickets.unshift(ticket);
    }
    sharedStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));

    if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
      const c = ticket.carRecord;
      saveVehicleHandler({
        id: `veh-${Date.now()}`,
        section: c.make.includes('Ford')
          ? 'Ford & Lincoln'
          : c.make.includes('Chevy') || c.make.includes('Chevrolet') || c.make.includes('GMC')
          ? 'GM & Chevrolet'
          : c.make.includes('Toyota') || c.make.includes('Nissan') || c.make.includes('Honda')
          ? 'Asian Imports'
          : 'Domestic Trucks & SUVs',
        year: c.year,
        make: c.make,
        model: c.model,
        color: c.color,
        vin: c.vin,
        dateSetInYard: new Date().toISOString(),
        status: c.yardStatus || 'PENDING',
        partsRemaining: ['Engine Assembly', 'Transmission', 'Doors', 'Wheels', 'Headlights', 'Fenders'],
        photoUrl: c.photoUrl || ticket.complianceCaptures?.vehiclePhotoUrl,
        purchasePrice: c.purchasePrice ?? ticket.finalPayout,
        originSource: c.originSource || 'Tow Intake',
        notes: c.notes || ticket.notes,
        dismantlingLog: {
          catalyticConvertersRemoved: 0,
          wheelsRemoved: 0,
          gasDrained: c.fluidsDrained,
          oilDrained: c.fluidsDrained,
        },
      });
    }

    if (ticket.payoutMethod === 'Cash') {
      addCashDrawerDisbursement(
        -Math.abs(ticket.finalPayout),
        ticket.operatorName,
        `Cash voucher payout for ticket #${ticket.id}`
      );
    }

    // Save/update associated customer record
    if (ticket.customerId) {
      const customers = getCustomersHandler();
      const cust = customers.find((c) => c.id === ticket.customerId);
      if (cust) {
        cust.totalPayouts += ticket.finalPayout;
        if (ticket.customerPhone) {
          cust.phone = ticket.customerPhone;
        }
        let totalLbs = 0;
        if (ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord) {
          totalLbs = ticket.carRecord.vehicleWeightLbs;
        } else if (ticket.scrapLines) {
          totalLbs = ticket.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0);
        }
        cust.totalWeightLbs += totalLbs;
        if (ticket.complianceCaptures?.idPhotoUrl) {
          cust.idPhotoUrl = ticket.complianceCaptures.idPhotoUrl;
        }
        if (ticket.vehicleLicensePlate && (!cust.capturedPlates || !cust.capturedPlates.includes(ticket.vehicleLicensePlate))) {
          cust.capturedPlates = [...(cust.capturedPlates || []), ticket.vehicleLicensePlate];
        }
        saveCustomerHandler(cust);
      }
    } else if (ticket.customerName && ticket.customerPhone) {
      const customers = getCustomersHandler();
      const existing = customers.find(c => c.fullName.toLowerCase() === ticket.customerName.toLowerCase() || (c.phone && c.phone === ticket.customerPhone));
      if (!existing) {
        saveCustomerHandler({
          id: `cust-${Date.now()}`,
          fullName: ticket.customerName,
          phone: ticket.customerPhone,
          idType: 'Driver License',
          idNumber: ticket.customerIdNumber || 'ON-FILE',
          idState: 'GA',
          address: 'Address On File',
          vehicleLicensePlate: ticket.vehicleLicensePlate,
          createdAt: new Date().toISOString(),
          totalPayouts: ticket.finalPayout,
          totalWeightLbs: ticket.scrapLines ? ticket.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0) : 0,
          idPhotoUrl: ticket.complianceCaptures?.idPhotoUrl,
          capturedPlates: ticket.vehicleLicensePlate ? [ticket.vehicleLicensePlate] : [],
        });
      }
    }

    return ticket;
  },

  updateTicketId(oldId: string, newId: string, getCashDrawerLogsHandler: () => any[], saveCashDrawerLogsHandler: (logs: any[]) => void): { success: boolean; message?: string } {
    const cleanNewId = newId.trim();
    if (!cleanNewId) {
      return { success: false, message: "Receipt / Ticket number cannot be empty" };
    }

    const tickets = this.getTickets();
    const existingTarget = tickets.find((t) => t.id === cleanNewId);
    if (existingTarget && oldId !== cleanNewId) {
      return { success: false, message: `Receipt number "${cleanNewId}" is already used by another ticket` };
    }

    const ticketIndex = tickets.findIndex((t) => t.id === oldId);
    if (ticketIndex === -1) {
      return { success: false, message: "Original ticket not found" };
    }

    tickets[ticketIndex].id = cleanNewId;
    sharedStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));

    const cashLogs = getCashDrawerLogsHandler();
    let updatedCashLogs = false;
    cashLogs.forEach((log) => {
      if (log.ticketId === oldId) {
        log.ticketId = cleanNewId;
        log.notes = log.notes?.replace(oldId, cleanNewId);
        updatedCashLogs = true;
      }
    });
    if (updatedCashLogs) {
      saveCashDrawerLogsHandler(cashLogs);
    }

    return { success: true };
  },

  getNMVTISLogs(): NMVTISReportLog[] {
    const data = sharedStorage.getItem(NMVTIS_KEY);
    if (!data) {
      return [
        {
          id: 'log-101',
          batchId: 'NMVTIS-BATCH-20250104-01',
          exportedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          ticketCount: 1,
          ticketIds: ['T-2025-1001'],
          status: 'EXPORTED',
          exportedBy: 'Scale Tech Station 1',
        }
      ];
    }
    return JSON.parse(data);
  },

  saveNMVTISLog(log: NMVTISReportLog): void {
    const logs = this.getNMVTISLogs();
    logs.unshift(log);
    sharedStorage.setItem(NMVTIS_KEY, JSON.stringify(logs));
  },

  markTicketsAsNMVTISReported(ticketIds: string[], batchId: string): void {
    const tickets = this.getTickets();
    const now = new Date().toISOString();
    tickets.forEach((t) => {
      if (ticketIds.includes(t.id)) {
        if (!t.complianceCaptures) {
          t.complianceCaptures = {};
        }
        t.complianceCaptures.nmvtisReported = true;
        t.complianceCaptures.nmvtisReportedAt = now;
        t.complianceCaptures.nmvtisBatchId = batchId;
        if (t.carRecord) {
          if (!t.carRecord.complianceCaptures) {
            t.carRecord.complianceCaptures = {};
          }
          t.carRecord.complianceCaptures.nmvtisReported = true;
          t.carRecord.complianceCaptures.nmvtisReportedAt = now;
          t.carRecord.complianceCaptures.nmvtisBatchId = batchId;
        }
      }
    });
    sharedStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  },
};