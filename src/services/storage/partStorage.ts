import { PullPartItem, CoreReturnLog, AdmissionPass } from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import {
  INITIAL_PULL_PARTS,
  INITIAL_CORE_RETURNS,
  INITIAL_ADMISSION_PASSES,
} from "@/services/data/initialData";

const PARTS_KEY = 'mahaffeys_pull_parts';
const CORES_KEY = 'mahaffeys_core_returns';
const PASSES_KEY = 'mahaffeys_admission_passes';

export const partStorage = {
  getPullParts(): PullPartItem[] {
    const data = sharedStorage.getItem(PARTS_KEY);
    if (!data) {
      sharedStorage.setItem(PARTS_KEY, JSON.stringify(INITIAL_PULL_PARTS));
      return INITIAL_PULL_PARTS;
    }
    return JSON.parse(data);
  },

  savePullParts(parts: PullPartItem[]): void {
    sharedStorage.setItem(PARTS_KEY, JSON.stringify(parts));
  },

  getCoreReturns(): CoreReturnLog[] {
    const data = sharedStorage.getItem(CORES_KEY);
    if (!data) {
      sharedStorage.setItem(CORES_KEY, JSON.stringify(INITIAL_CORE_RETURNS));
      return INITIAL_CORE_RETURNS;
    }
    return JSON.parse(data);
  },

  saveCoreReturn(log: CoreReturnLog, addCashDrawerDisbursement: (amount: number, operatorName: string, notes: string) => void): CoreReturnLog {
    const logs = this.getCoreReturns();
    logs.unshift(log);
    sharedStorage.setItem(CORES_KEY, JSON.stringify(logs));

    addCashDrawerDisbursement(
      -Math.abs(log.coreDepositRefunded),
      log.operatorName,
      `Core deposit refund for ${log.partName} - ${log.customerName}`
    );

    return log;
  },

  getAdmissionPasses(): AdmissionPass[] {
    const data = sharedStorage.getItem(PASSES_KEY);
    if (!data) {
      sharedStorage.setItem(PASSES_KEY, JSON.stringify(INITIAL_ADMISSION_PASSES));
      return INITIAL_ADMISSION_PASSES;
    }
    return JSON.parse(data);
  },

  saveAdmissionPass(pass: AdmissionPass, addCashDrawerReplenishment: (amount: number, operatorName: string, notes: string) => void): AdmissionPass {
    const passes = this.getAdmissionPasses();
    passes.unshift(pass);
    sharedStorage.setItem(PASSES_KEY, JSON.stringify(passes));

    addCashDrawerReplenishment(
      Math.abs(pass.feePaid),
      pass.operatorName,
      `$${pass.feePaid.toFixed(2)} Yard Gate Admission Fee Pass - ${pass.customerName}`
    );

    return pass;
  },
};