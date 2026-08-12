import { PullYardVehicle, VehicleArrivalSubscription, PullYardVehicleStatus } from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import { INITIAL_PULL_VEHICLES } from "@/services/data/initialData";

const VEH_KEY = 'mahaffeys_pull_yard_vehicles';
const SUB_KEY = 'mahaffeys_arrival_subscriptions';

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

  deletePullYardVehicle(vehicleId: string): void {
    const vehicles = this.getPullYardVehicles().filter((vehicle) => vehicle.id !== vehicleId);
    sharedStorage.setItem(VEH_KEY, JSON.stringify(vehicles));
  },
};