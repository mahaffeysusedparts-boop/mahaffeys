import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parsePriceSheetLines } from './priceSheetParser';
import { extractPDF,publishableRows } from './priceSheets';

describe('protected PDF extraction and review contract',()=>{
  it('extracts only explicit currency prices; all rows require review',()=>{
    const result=parsePriceSheetLines([{page:1,text:'TEST PART A $12.50'},{page:1,text:'TEST PART B $10 - $20'},{page:1,text:'TEST PART C $20 Core $5'}]);
    expect(result.rows[0].price).toBe('12.50');
    expect(result.rows[1].price).toBe('10.00–20.00');
    expect(result.rows[2].price).toBe('');
    expect(result.rows.every(row=>!row.reviewed)).toBe(true);
    expect(()=>publishableRows(result.rows)).toThrow();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('scans/empty text yield an actionable manual-review path',()=>{
    const result=parsePriceSheetLines([]);
    expect(result.rows).toEqual([]);
    expect(result.warnings.join(' ')).toContain('OCR is not enabled');
    expect(()=>publishableRows([])).toThrow();
  });
  it('rejects duplicate reviewed public rows',()=>{
    const row=parsePriceSheetLines([{page:1,text:'TEST PART $5'}]).rows[0];
    row.reviewed=true;
    expect(()=>publishableRows([row,{...row,id:'35dad944-c3b1-4bde-b646-7d775c833cec'}])).toThrow('Duplicate');
    expect(publishableRows([row])[0].price).toBe('5.00');
  });
  it.skipIf(Number(process.versions.node.split('.')[0])<22)('runs the real isolated PDF worker against a synthetic fixture',async()=>{
    const bytes=await readFile(new URL('../test-fixtures/parts-prices-synthetic.pdf',import.meta.url));
    const lines=await extractPDF(bytes);
    expect(lines.some(line=>line.text.includes('TEST PART A'))).toBe(true);
    expect(lines.every(line=>line.page===1)).toBe(true);
    const draft=parsePriceSheetLines(lines);
    expect(draft.rows.some(row=>row.price==='12.50')).toBe(true);
    expect(draft.rows.some(row=>row.price==='10.00–20.00')).toBe(true);
  });
});
