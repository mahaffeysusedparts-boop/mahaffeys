import { apiRequest } from './apiClient';
import { storageService } from './storageService';
import { sharedStorage } from './sharedStorage';
import type { CashDrawerLog } from '@/types/scrap';

const retries = new Map<string,CashDrawerLog>();
export async function recordDrawerEntry(input: {type:'VAULT_REPLENISHMENT'|'CLOSING_AUDIT';amount:number;notes:string;expectedBalance:number}) {
  const previous = storageService.getCashDrawerLogs();
  const balance = input.expectedBalance;
  const signature = JSON.stringify(input.type==='VAULT_REPLENISHMENT'?{type:input.type,amount:input.amount,notes:input.notes}:input);
  let entry = retries.get(signature);
  if (!entry) {
    entry = {...input,id:crypto.randomUUID(),timestamp:new Date().toISOString(),operatorName:'Awaiting server',balanceAfter:Math.round((balance+input.amount)*100)/100};
    retries.set(signature,entry);
  }
  const response = await apiRequest<{value:CashDrawerLog[]}>('/api/state/mahaffeys_cash_drawer',{method:'PUT',body:JSON.stringify({value:[...previous,entry]})});
  sharedStorage.applyServerValue('mahaffeys_cash_drawer',response.value);
  retries.delete(signature);
}
