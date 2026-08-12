import {
  MetalGrade,
  AutoSalvageCategoryRate,
  CatalyticConverterCode,
  ContainerDrop,
  CashDrawerLog,
  YardBayLocation,
  YardSettings,
} from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import {
  INITIAL_METALS,
  INITIAL_CAR_RATES,
  INITIAL_CAT_CODES,
  INITIAL_CONTAINER_DROPS,
  INITIAL_CASH_DRAWER,
  INITIAL_YARD_BAYS,
  INITIAL_SETTINGS,
} from "@/services/data/initialData";

const KEYS = {
  METALS: 'mahaffeys_metals',
  CAR_RATES: 'mahaffeys_car_rates',
  CATALYTIC_CODES: 'mahaffeys_cat_codes',
  CONTAINER_DROPS: 'mahaffeys_container_drops',
  CASH_DRAWER: 'mahaffeys_cash_drawer',
  YARD_BAYS: 'mahaffeys_yard_bays',
  SETTINGS: 'mahaffeys_settings',
};

export const yardStorage = {
  getMetals(): MetalGrade[] {
    const data = sharedStorage.getItem(KEYS.METALS);
    if (!data) {
      sharedStorage.setItem(KEYS.METALS, JSON.stringify(INITIAL_METALS));
      return INITIAL_METALS;
    }
    return JSON.parse(data);
  },

  saveMetals(metals: MetalGrade[]): void {
    sharedStorage.setItem(KEYS.METALS, JSON.stringify(metals));
  },

  getCarRates(): AutoSalvageCategoryRate[] {
    const data = sharedStorage.getItem(KEYS.CAR_RATES);
    if (!data) {
      sharedStorage.setItem(KEYS.CAR_RATES, JSON.stringify(INITIAL_CAR_RATES));
      return INITIAL_CAR_RATES;
    }
    return JSON.parse(data);
  },

  saveCarRates(rates: AutoSalvageCategoryRate[]): void {
    sharedStorage.setItem(KEYS.CAR_RATES, JSON.stringify(rates));
  },

  getCatCodes(): CatalyticConverterCode[] {
    const data = sharedStorage.getItem(KEYS.CATALYTIC_CODES);
    if (!data) {
      sharedStorage.setItem(KEYS.CATALYTIC_CODES, JSON.stringify(INITIAL_CAT_CODES));
      return INITIAL_CAT_CODES;
    }
    return JSON.parse(data);
  },

  saveCatCode(codeObj: CatalyticConverterCode): void {
    const codes = this.getCatCodes();
    const existingIndex = codes.findIndex((c) => c.id === codeObj.id);
    if (existingIndex >= 0) {
      codes[existingIndex] = codeObj;
    } else {
      codes.unshift(codeObj);
    }
    sharedStorage.setItem(KEYS.CATALYTIC_CODES, JSON.stringify(codes));
  },

  getContainerDrops(): ContainerDrop[] {
    const data = sharedStorage.getItem(KEYS.CONTAINER_DROPS);
    if (!data) {
      sharedStorage.setItem(KEYS.CONTAINER_DROPS, JSON.stringify(INITIAL_CONTAINER_DROPS));
      return INITIAL_CONTAINER_DROPS;
    }
    return JSON.parse(data);
  },

  saveContainerDrop(drop: ContainerDrop): ContainerDrop {
    const drops = this.getContainerDrops();
    const idx = drops.findIndex((d) => d.id === drop.id);
    if (idx >= 0) {
      drops[idx] = drop;
    } else {
      drops.unshift(drop);
    }
    sharedStorage.setItem(KEYS.CONTAINER_DROPS, JSON.stringify(drops));
    return drop;
  },

  getCashDrawerLogs(): CashDrawerLog[] {
    const data = sharedStorage.getItem(KEYS.CASH_DRAWER);
    if (!data) {
      sharedStorage.setItem(KEYS.CASH_DRAWER, JSON.stringify(INITIAL_CASH_DRAWER));
      return INITIAL_CASH_DRAWER;
    }
    return JSON.parse(data);
  },

  addCashDrawerEntry(entry: Omit<CashDrawerLog, 'id' | 'timestamp' | 'balanceAfter'>): CashDrawerLog {
    const logs = this.getCashDrawerLogs();
    const lastLog = logs[0];
    const currentBalance = lastLog ? lastLog.balanceAfter : 0;
    const newBalance = currentBalance + entry.amount;

    const newLog: CashDrawerLog = {
      id: `cd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      balanceAfter: Math.round(newBalance * 100) / 100,
      ...entry,
    };

    logs.unshift(newLog);
    sharedStorage.setItem(KEYS.CASH_DRAWER, JSON.stringify(logs));
    return newLog;
  },

  getYardBays(): YardBayLocation[] {
    const data = sharedStorage.getItem(KEYS.YARD_BAYS);
    if (!data) {
      sharedStorage.setItem(KEYS.YARD_BAYS, JSON.stringify(INITIAL_YARD_BAYS));
      return INITIAL_YARD_BAYS;
    }
    return JSON.parse(data);
  },

  saveYardBays(bays: YardBayLocation[]): void {
    sharedStorage.setItem(KEYS.YARD_BAYS, JSON.stringify(bays));
  },

  getSettings(): YardSettings {
    const data = sharedStorage.getItem(KEYS.SETTINGS);
    if (!data) {
      sharedStorage.setItem(KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    return JSON.parse(data);
  },

  saveSettings(settings: YardSettings): void {
    sharedStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },
};