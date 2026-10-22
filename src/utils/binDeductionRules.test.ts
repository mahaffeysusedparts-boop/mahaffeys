import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_CATALOG } from '../types/binDeductions';
import { binCatalogSchema, binSubmissionSchema, resolveBinSelections } from './binDeductionRules';
import { validatedItemBreakdown, validatedBreakdown } from './weighingContract';
describe('bin item deduction contract', () => {
  it('preserves real captures and replaces percentages with item pounds', () => {
    const items = resolveBinSelections(DEFAULT_BIN_CATALOG, [{itemId:'tire',quantity:2},{itemId:'tanks',quantity:2},{itemId:'dirt',quantity:3},{itemId:'fluids',quantity:2,poundsPerUnit:50}]);
    expect(validatedItemBreakdown(5000,3000,items,0.1)).toEqual({grossWeight:5000,tareWeight:3000,netWeight:2000,deductionPercent:0,deductionLbs:815,billableWeight:1185,ratePerLb:0.1,lineTotal:118.5});
    expect(validatedBreakdown(100,0,10,1).billableWeight).toBe(90);
  });
  it.each([5,50])('accepts fluid boundary %s', poundsPerUnit => expect(resolveBinSelections(DEFAULT_BIN_CATALOG,[{itemId:'fluids',quantity:2,poundsPerUnit}])[0].poundsPerUnit).toBe(poundsPerUnit));
  it.each([-1,0,0.5,Infinity,10001])('rejects quantity %s', quantity => expect(() => resolveBinSelections(DEFAULT_BIN_CATALOG,[{itemId:'tire',quantity}])).toThrow());
  it.each([4.99,50.01,NaN,Infinity])('rejects fluid pounds %s', poundsPerUnit => expect(() => resolveBinSelections(DEFAULT_BIN_CATALOG,[{itemId:'fluids',quantity:1,poundsPerUnit}])).toThrow());
  it('rejects fixed tampering, duplicate or disabled selections', () => {
    expect(() => resolveBinSelections(DEFAULT_BIN_CATALOG,[{itemId:'tire',quantity:1,poundsPerUnit:1}])).toThrow();
    expect(() => resolveBinSelections(DEFAULT_BIN_CATALOG,[{itemId:'tire',quantity:1},{itemId:'tire',quantity:2}])).toThrow();
    expect(() => resolveBinSelections({...DEFAULT_BIN_CATALOG,items:DEFAULT_BIN_CATALOG.items.map(item=>({...item,enabled:false}))},[{itemId:'tire',quantity:1}])).toThrow();
  });
  it('rounds once to tenths and money to cents; rejects excessive totals', () => {
    expect(validatedItemBreakdown(100,0,[{quantity:3,poundsPerUnit:5.05}],0.15)).toMatchObject({deductionLbs:15.2,billableWeight:84.8,lineTotal:12.72});
    expect(() => validatedItemBreakdown(100,0,[{quantity:1,poundsPerUnit:150}],1)).toThrow('exceed');
    expect(validatedItemBreakdown(100,0,[],1).billableWeight).toBe(100);
  });
  it('strictly rejects injected fields, duplicate IDs and invalid policy', () => {
    expect(binSubmissionSchema.safeParse({cycleId:'00000000-0000-4000-8000-000000000001',expectedRevision:0,catalogRevision:1,selections:[],ticket:{finalPayout:99}}).success).toBe(false);
    expect(binCatalogSchema.safeParse({...DEFAULT_BIN_CATALOG,items:[DEFAULT_BIN_CATALOG.items[0],DEFAULT_BIN_CATALOG.items[0]]}).success).toBe(false);
    expect(binCatalogSchema.safeParse({revision:1,items:[{id:'fluids',name:'Fluids',enabled:true,mode:'RANGED',minPounds:50,maxPounds:5}]}).success).toBe(false);
    expect(binCatalogSchema.safeParse({revision:1,items:[{id:'fixed',name:'Fixed',enabled:true,mode:'FIXED',pounds:NaN}]}).success).toBe(false);
  });
});
