"use client";

import {
  Customer,
  MetalGrade,
  AutoSalvageCategoryRate,
  Ticket,
  YardSettings,
  NMVTISReportLog,
  CatalyticConverterCode,
  ContainerDrop,
  CashDrawerLog,
  YardBayLocation,
  PullPartItem,
  PullYardVehicle,
  CoreReturnLog,
  AdmissionPass,
  IpCamera,
  VehicleArrivalSubscription,
  VehicleRelocationLog,
  PullYardVehicleStatus,
} from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import {
  INITIAL_IP_CAMERAS,
  INITIAL_PULL_PARTS,
  INITIAL_PULL_VEHICLES,
  INITIAL_CORE_RETURNS,
  INITIAL_ADMISSION_PASSES,
  INITIAL_CAT_CODES,
  INITIAL_CONTAINER_DROPS,
  INITIAL_CASH_DRAWER,
  INITIAL_YARD_BAYS,
  INITIAL_METALS,
  INITIAL_CAR_RATES,
  INITIAL_CUSTOMERS,
  INITIAL_SETTINGS,
  INITIAL_TICKETS,
} from "@/services/data/initialData";

import { cameraStorage } from "./storage/cameraStorage";
import { vehicleStorage } from "./storage/vehicleStorage";
import { partStorage } from "./storage/partStorage";
import { customerStorage } from "./storage/customerStorage";
import { yardStorage } from "./storage/yardStorage";
import { ticketStorage } from "./storage/ticketStorage";

export {
  INITIAL_IP_CAMERAS,
  INITIAL_PULL_PARTS,
  INITIAL_PULL_VEHICLES,
  INITIAL_CORE_RETURNS,
  INITIAL_ADMISSION_PASSES,
  INITIAL_CAT_CODES,
  INITIAL_CONTAINER_DROPS,
  INITIAL_CASH_DRAWER,
  INITIAL_YARD_BAYS,
  INITIAL_METALS,
  INITIAL_CAR_RATES,
  INITIAL_CUSTOMERS,
  INITIAL_SETTINGS,
  INITIAL_TICKETS,
};

export const storageService = {
  // --- Cameras ---
  getIpCameras(): IpCamera[] {
    return cameraStorage.getIpCameras();
  },

  saveIpCamera(camera: IpCamera): IpCamera {
    return cameraStorage.saveIpCamera(camera);
  },

  deleteIpCamera(cameraId: string): void {
    cameraStorage.deleteIpCamera(cameraId);
  },

  // --- Vehicles, Relocations & Subscriptions ---
  getArrivalSubscriptions(): VehicleArrivalSubscription[] {
    return vehicleStorage.getArrivalSubscriptions();
  },

  saveArrivalSubscription(sub: VehicleArrivalSubscription): VehicleArrivalSubscription {
    return vehicleStorage.saveArrivalSubscription(sub);
  },

  checkSubscriptionsForVehicle(make: string, model: string): VehicleArrivalSubscription[] {
    return vehicleStorage.checkSubscriptionsForVehicle(make, model);
  },

  getNewArrivals(days: number = 7): PullYardVehicle[] {
    return vehicleStorage.getNewArrivals(days);
  },

  getPullYardVehicles(): PullYardVehicle[] {
    return vehicleStorage.getPullYardVehicles();
  },

  savePullYardVehicle(veh: PullYardVehicle): PullYardVehicle {
    return vehicleStorage.savePullYardVehicle(veh);
  },

  relocateVehicle(
    vehicleId: string,
    newSection: PullYardVehicle["section"],
    newRow: string,
    newSpace: string,
    operatorName: string,
    reason?: string
  ): PullYardVehicle | null {
    return vehicleStorage.relocateVehicle(vehicleId, newSection, newRow, newSpace, operatorName, reason);
  },

  getRelocationLogs(): VehicleRelocationLog[] {
    return vehicleStorage.getRelocationLogs();
  },

  deletePullYardVehicle(vehicleId: string): void {
    vehicleStorage.deletePullYardVehicle(vehicleId);
  },

  // --- Parts, Cores & Admission Passes ---
  getPullParts(): PullPartItem[] {
    return partStorage.getPullParts();
  },

  savePullParts(parts: PullPartItem[]): void {
    partStorage.savePullParts(parts);
  },

  getCoreReturns(): CoreReturnLog[] {
    return partStorage.getCoreReturns();
  },

  saveCoreReturn(log: CoreReturnLog): CoreReturnLog {
    return partStorage.saveCoreReturn(log, (amount, operatorName, notes) => {
      this.addCashDrawerEntry({
        type: 'PAYOUT_DISBURSEMENT',
        amount,
        operatorName,
        notes,
      });
    });
  },

  getAdmissionPasses(): AdmissionPass[] {
    return partStorage.getAdmissionPasses();
  },

  saveAdmissionPass(pass: AdmissionPass): AdmissionPass {
    return partStorage.saveAdmissionPass(pass, (amount, operatorName, notes) => {
      this.addCashDrawerEntry({
        type: 'VAULT_REPLENISHMENT',
        amount,
        operatorName,
        notes,
      });
    });
  },

  // --- Metals, Rates, Containers, Cash Drawer, Bays & Settings ---
  getMetals(): MetalGrade[] {
    return yardStorage.getMetals();
  },

  saveMetals(metals: MetalGrade[]): void {
    yardStorage.saveMetals(metals);
  },

  getCarRates(): AutoSalvageCategoryRate[] {
    return yardStorage.getCarRates();
  },

  saveCarRates(rates: AutoSalvageCategoryRate[]): void {
    yardStorage.saveCarRates(rates);
  },

  getCatCodes(): CatalyticConverterCode[] {
    return yardStorage.getCatCodes();
  },

  saveCatCode(codeObj: CatalyticConverterCode): void {
    yardStorage.saveCatCode(codeObj);
  },

  getContainerDrops(): ContainerDrop[] {
    return yardStorage.getContainerDrops();
  },

  saveContainerDrop(drop: ContainerDrop): ContainerDrop {
    return yardStorage.saveContainerDrop(drop);
  },

  getCashDrawerLogs(): CashDrawerLog[] {
    return yardStorage.getCashDrawerLogs();
  },

  addCashDrawerEntry(entry: Omit<CashDrawerLog, 'id' | 'timestamp' | 'balanceAfter'>): CashDrawerLog {
    return yardStorage.addCashDrawerEntry(entry);
  },

  getYardBays(): YardBayLocation[] {
    return yardStorage.getYardBays();
  },

  saveYardBays(bays: YardBayLocation[]): void {
    yardStorage.saveYardBays(bays);
  },

  getSettings(): YardSettings {
    return yardStorage.getSettings();
  },

  saveSettings(settings: YardSettings): void {
    yardStorage.saveSettings(settings);
  },

  // --- Customers ---
  getCustomers(): Customer[] {
    return customerStorage.getCustomers();
  },

  saveCustomer(customer: Customer): Customer {
    return customerStorage.saveCustomer(customer);
  },

  // --- Tickets & NMVTIS ---
  getTickets(): Ticket[] {
    return ticketStorage.getTickets();
  },

  saveTicket(ticket: Ticket): Ticket {
    return ticketStorage.saveTicket(
      ticket,
      (veh) => this.savePullYardVehicle(veh),
      (amount, operatorName, notes) => {
        this.addCashDrawerEntry({
          type: 'PAYOUT_DISBURSEMENT',
          amount,
          operatorName,
          notes,
        });
      },
      () => this.getCustomers(),
      (cust) => this.saveCustomer(cust)
    );
  },

  updateTicketId(oldId: string, newId: string): { success: boolean; message?: string } {
    return ticketStorage.updateTicketId(
      oldId,
      newId,
      () => this.getCashDrawerLogs(),
      (logs) => sharedStorage.setItem('mahaffeys_cash_drawer', JSON.stringify(logs))
    );
  },

  getNMVTISLogs(): NMVTISReportLog[] {
    return ticketStorage.getNMVTISLogs();
  },

  saveNMVTISLog(log: NMVTISReportLog): void {
    ticketStorage.saveNMVTISLog(log);
  },

  markTicketsAsNMVTISReported(ticketIds: string[], batchId: string): void {
    ticketStorage.markTicketsAsNMVTISReported(ticketIds, batchId);
  },

  // --- Factory Reset ---
  resetToDefaults(): void {
    sharedStorage.setItem('mahaffeys_metals', JSON.stringify(INITIAL_METALS));
    sharedStorage.setItem('mahaffeys_car_rates', JSON.stringify(INITIAL_CAR_RATES));
    sharedStorage.setItem('mahaffeys_customers', JSON.stringify(INITIAL_CUSTOMERS));
    sharedStorage.setItem('mahaffeys_tickets', JSON.stringify(INITIAL_TICKETS));
    sharedStorage.setItem(STORAGE_KEYS_SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    sharedStorage.setItem('mahaffeys_cat_codes', JSON.stringify(INITIAL_CAT_CODES));
    sharedStorage.setItem('mahaffeys_container_drops', JSON.stringify(INITIAL_CONTAINER_DROPS));
    sharedStorage.setItem('mahaffeys_cash_drawer', JSON.stringify(INITIAL_CASH_DRAWER));
    sharedStorage.setItem('mahaffeys_yard_bays', JSON.stringify(INITIAL_YARD_BAYS));
    sharedStorage.setItem('mahaffeys_pull_parts', JSON.stringify(INITIAL_PULL_PARTS));
    sharedStorage.setItem('mahaffeys_pull_yard_vehicles', JSON.stringify(INITIAL_PULL_VEHICLES));
    sharedStorage.setItem('mahaffeys_core_returns', JSON.stringify(INITIAL_CORE_RETURNS));
    sharedStorage.setItem('mahaffeys_admission_passes', JSON.stringify(INITIAL_ADMISSION_PASSES));
    sharedStorage.setItem('mahaffeys_ip_cameras', JSON.stringify(INITIAL_IP_CAMERAS));
    sharedStorage.removeItem('mahaffeys_nmvtis_logs');
    sharedStorage.removeItem('mahaffeys_arrival_subscriptions');
    sharedStorage.removeItem('mahaffeys_vehicle_relocations');
  },
};

const STORAGE_KEYS_SETTINGS = 'mahaffeys_settings';