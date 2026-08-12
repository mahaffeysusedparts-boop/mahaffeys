"use client";

import { PullYardVehicle, VehicleArrivalSubscription, VehicleRelocationLog, PullYardVehicleStatus } from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import { INITIAL_PULL_VEHICLES } from "@/services/data/initialData";

const VEH_KEY = 'mahaffeys_pull_yard_vehicles';
const SUB_KEY = 'mahaffeys_arrival_subscriptions';
const RELOC_LOG_KEY = 'mahaffeys_vehicle_relocations';

export const vehicleStorage = {
  getArrivalSubscriptions(): VehicleArrivalSubscription[] {
    const data = sharedStorage.getItem(SUB_KEY);
    if (!data) return [];
    return JSON.parse(data);
  },

  saveArrivalSubscription(sub: VehicleArrivalSubscription): VehicleArrivalSubscription {
    const list = this.getArrivalSubscriptions();
    list.unshift(sub);
    sharedStorage.setItem(SUB_KEY, JSON.stringify(list));
    return sub;
  },

  checkSubscriptionsForVehicle(make: string, model: string): VehicleArrivalSubscription[] {
    const subs = this.getArrivalSubscriptions().filter((s) => !s.isFulfilled);
    const mMake = make.trim().toLowerCase();
    const mModel = model.trim().toLowerCase();

    return subs.filter((s) => {
      const matchMake = s.make.trim().toLowerCase() === mMake || mMake.includes(s.make.trim().toLowerCase());
      const matchModel = s.model.trim().toLowerCase() === mModel || mModel.includes(s.model.trim().toLowerCase());
      return matchMake && matchModel;
    });
  },

  getNewArrivals(days: number = 7): PullYardVehicle[] {
    const vehicles = this.getPullYardVehicles();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return vehicles.filter((v) => new Date(v.dateSetInYard).getTime() >= cutoff);
  },

  getPullYardVehicles(): PullYardVehicle[] {
    const data = sharedStorage.getItem(VEH_KEY);
    if (!data) {
      sharedStorage.setItem(VEH_KEY, JSON.stringify(INITIAL_PULL_VEHICLES));
      return INITIAL_PULL_VEHICLES;
    }

    const vehicles = JSON.parse(data) as Array<Omit<PullYardVehicle, 'status' | 'dismantlingLog'> & {
      status: string;
      dismantlingLog?: PullYardVehicle['dismantlingLog'];
    }>;

    return vehicles.map((vehicle) => ({
      ...vehicle,
      status:
        vehicle.status === 'CRUSHED' || vehicle.status === 'STRIPPED_SHELL' || vehicle.status === 'READY_FOR_CRUSHER'
          ? 'CRUSHED'
          : vehicle.status === 'PENDING'
            ? 'PENDING'
            : 'AVAILABLE',
      dismantlingLog: vehicle.dismantlingLog || {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
        coolantDrained: false,
        batteryPulled: false,
      },
    }));
  },

  savePullYardVehicle(veh: PullYardVehicle): PullYardVehicle {
    const vehicles = this.getPullYardVehicles();
    const idx = vehicles.findIndex((v) => v.id === veh.id);
    if (idx >= 0) {
      vehicles[idx] = veh;
    } else {
      vehicles.unshift(veh);
    }
    sharedStorage.setItem(VEH_KEY, JSON.stringify(vehicles));
    return veh;
  },

  relocateVehicle(
    vehicleId: string,
    newSection: PullYardVehicle["section"],
    newRow: string,
    newSpace: string,
    operatorName: string,
    reason?: string
  ): PullYardVehicle | null {
    const vehicles = this.getPullYardVehicles();
    const vehicle = vehicles.find((v) => v.id === vehicleId || v.vin === vehicleId || v.stockNumber === vehicleId);

    if (!vehicle) return null;

    const oldLocation = `${vehicle.section} (${vehicle.rowNumber || "Unassigned"} - ${vehicle.spaceNumber || "Spot"})`;
    const newLocation = `${newSection} (${newRow || "Row"} - ${newSpace || "Spot"})`;

    const relocationLog: VehicleRelocationLog = {
      id: `reloc-${Date.now()}`,
      vehicleId: vehicle.id,
      vehicleDesc: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      fromLocation: oldLocation,
      toLocation: newLocation,
      operatorName,
      timestamp: new Date().toISOString(),
      reason: reason || "Yard Forklift Relocation",
    };

    const history = vehicle.relocationHistory || [];
    history.unshift(relocationLog);

    vehicle.section = newSection;
    vehicle.rowNumber = newRow;
    vehicle.spaceNumber = newSpace;
    vehicle.relocationHistory = history;

    this.savePullYardVehicle(vehicle);

    // Save global relocation log
    const globalLogs = this.getRelocationLogs();
    globalLogs.unshift(relocationLog);
    sharedStorage.setItem(RELOC_LOG_KEY, JSON.stringify(globalLogs));

    return vehicle;
  },

  getRelocationLogs(): VehicleRelocationLog[] {
    const data = sharedStorage.getItem(RELOC_LOG_KEY);
    if (!data) return [];
    return JSON.parse(data);
  },

  deletePullYardVehicle(vehicleId: string): void {
    const vehicles = this.getPullYardVehicles().filter((vehicle) => vehicle.id !== vehicleId);
    sharedStorage.setItem(VEH_KEY, JSON.stringify(vehicles));
  },
};