import React from 'react';
import { Ticket, YardSettings } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, ShieldCheck, QrCode, CheckCircle, FileSignature } from 'lucide-react';

interface ReceiptModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ ticket, open, onOpenChange }) => {
  if (!ticket) return null;

  const settings: YardSettings = storageService.getSettings();
  const caps = ticket.complianceCaptures || ticket.carRecord?.complianceCaptures;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-lg font-bold text-white font-mono">
                Intake Ticket & Legal Payout Voucher
              </DialogTitle>
            </div>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Voucher
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Area */}
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-lg shadow-inner font-mono text-xs space-y-5 border border-slate-300 print:p-0 print:border-none print:shadow-none print:text-black">
          
          {/* Receipt Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              {settings.yardName}
            </h2>
            <p className="text-[11px] text-slate-700">{settings.address}, {settings.cityStateZip}</p>
            <p className="text-[11px] text-slate-700">Phone: {settings.phone} | Lic #: {settings.licenseNumber}</p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <span className="inline-block px-2 py-0.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded">
                {ticket.ticketType === 'CAR_SALVAGE' ? 'AUTO SALVAGE INTAKE VOUCHER' : 'SCRAP METAL PAYOUT VOUCHER'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold text-[10px] uppercase rounded">
                <ShieldCheck className="w-3 h-3 text-emerald-700 inline" /> COMPLIANCE VERIFIED
              </span>
            </div>
          </div>

          {/* Ticket Metadata Bar */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-3 text-[11px]">
            <div>
              <p><span className="font-bold">TICKET #:</span> {ticket.id}</p>
              <p><span className="font-bold">DATE / TIME:</span> {new Date(ticket.createdAt).toLocaleString()}</p>
              <p><span className="font-bold">PAYOUT METHOD:</span> {ticket.payoutMethod.toUpperCase()} {ticket.checkNumber ? `(#${ticket.checkNumber})` : ''}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold">SELLER / CUSTOMER:</span> {ticket.customerName}</p>
              <p><span className="font-bold">ID #:</span> {ticket.customerIdNumber || 'VERIFIED ON FILE'}</p>
              {ticket.vehicleLicensePlate && (
                <p><span className="font-bold">VEHICLE PLATE:</span> {ticket.vehicleLicensePlate}</p>
              )}
            </div>
          </div>

          {/* Car Salvage Details Breakdown */}
          {ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord && (
            <div className="space-y-3">
              <div className="bg-slate-100 p-3 rounded border border-slate-300">
                <p className="font-bold text-sm uppercase mb-1">
                  VEHICLE SPECIFICATIONS: {ticket.carRecord.year} {ticket.carRecord.make} {ticket.carRecord.model}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <p><span className="font-bold">VIN:</span> {ticket.carRecord.vin}</p>
                  <p><span className="font-bold">TITLE STATUS:</span> {ticket.carRecord.titleStatus}</p>
                  <p><span className="font-bold">SCALE WEIGHT:</span> {ticket.carRecord.vehicleWeightLbs.toLocaleString()} LBS</p>
                  <p><span className="font-bold">TITLE #:</span> {ticket.carRecord.titleNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Component checklist summary */}
              <div className="border border-slate-300 rounded p-3 space-y-1">
                <p className="font-bold border-b border-slate-300 pb-1 uppercase">Component & Compliance Check:</p>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <p>Cat Converter: {ticket.carRecord.hasCatalyticConverter ? `YES (${ticket.carRecord.catCondition})` : 'NO'}</p>
                  <p>Engine & Trans: {ticket.carRecord.hasEngineAndTrans ? 'YES' : 'NO'}</p>
                  <p>12V Battery: {ticket.carRecord.hasBattery ? 'YES' : 'NO'}</p>
                  <p>Fluids Drained: {ticket.carRecord.fluidsDrained ? 'YES (EPA VERIFIED)' : 'NO'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Scrap Metal Line Items Table */}
          {ticket.ticketType === 'SCRAP_METAL' && ticket.scrapLines && (
            <div className="space-y-2">
              <p className="font-bold uppercase text-[11px] border-b border-slate-300 pb-1">Weighed Scrap Items:</p>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 font-bold">
                    <th className="py-1">GRADE / MATERIAL</th>
                    <th className="py-1 text-right">NET LBS</th>
                    <th className="py-1 text-right">RATE/LB</th>
                    <th className="py-1 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.scrapLines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-200">
                      <td className="py-1.5 font-bold">
                        {line.metalName}
                        <span className="block text-[9px] text-slate-500 font-normal">{line.metalCategory}</span>
                      </td>
                      <td className="py-1.5 text-right">{line.billableWeight} lbs</td>
                      <td className="py-1.5 text-right">${line.ratePerLb.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-bold">${line.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ATTACHED COMPLIANCE PHOTO GALLERY */}
          {caps && (
            <div className="border border-slate-300 rounded p-3 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <p className="font-bold text-[10px] uppercase text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 inline" /> ATTACHED COMPLIANCE PHOTO RECORD
                </p>
                <span className="text-[9px] font-bold text-emerald-800">STATE ANTI-THEFT AUDIT SEAL</span>
              </div>
              
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: "ID SCAN", url: caps.idPhotoUrl },
                  { label: "SELLER FACE", url: caps.personPhotoUrl },
                  { label: "VEHICLE", url: caps.vehiclePhotoUrl },
                  { label: "PLATE OCR", url: caps.licensePlatePhotoUrl },
                  { label: "CARGO LOAD", url: caps.loadPhotoUrl },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-1 border border-slate-300 rounded">
                    <div className="aspect-square bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                      {item.url ? (
                        <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] text-slate-500">N/A</span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold text-slate-700 block mt-0.5 truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Summary Box */}
          <div className="border-t-2 border-slate-900 pt-3 space-y-1 font-mono">
            <div className="flex justify-between text-[11px]">
              <span>GROSS PAYOUT AMOUNT:</span>
              <span>${ticket.grossTotal.toFixed(2)}</span>
            </div>
            {ticket.totalDeductions > 0 && (
              <div className="flex justify-between text-[11px] text-red-600">
                <span>DEDUCTIONS / CONTAMINATION:</span>
                <span>-${ticket.totalDeductions.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black border-t border-slate-400 pt-2 text-slate-900">
              <span>FINAL PAYOUT ({ticket.payoutMethod.toUpperCase()}):</span>
              <span>${ticket.finalPayout.toFixed(2)}</span>
            </div>
          </div>

          {/* Statutory Payout & Legal Disclosures */}
          <div className="text-[9px] text-slate-600 border-t border-slate-300 pt-3 space-y-1 leading-tight">
            <p className="font-bold uppercase">{settings.receiptHeader}</p>
            <p>
              Seller certifies legal ownership of all scrap materials and vehicles listed above. State photo ID was presented and logged into the compliance system. Cash payouts are limited under State Statutory Scrap Metal Theft Prevention Laws ($25.00 for Non-Ferrous and $100.00 for Ferrous). Amounts exceeding statutory cash limits are paid via Check.
            </p>
          </div>

          {/* DUAL SIGNATURE BOX: SELLER SIGNATURE & AUTOMATIC YARD EMPLOYEE SIGNATURE */}
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-6 items-end">
            
            {/* 1. SELLER SIGNATURE LINE */}
            <div className="space-y-1">
              <div className="border-b border-slate-900 h-10 flex items-end pb-1">
                <span className="text-[10px] text-slate-400 italic font-sans">
                  Sign here: X _______________________
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase text-slate-900">
                SELLER / CUSTOMER SIGNATURE
              </p>
              <p className="text-[9px] text-slate-500 font-sans">
                I hereby declare under penalty of perjury that I am the legal owner or authorized seller of the scrap metal listed above.
              </p>
            </div>

            {/* 2. AUTOMATIC YARD EMPLOYEE SIGNATURE: Jackson Hilliard */}
            <div className="bg-slate-100 p-2.5 rounded border border-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-600 uppercase flex items-center gap-1">
                  <FileSignature className="w-3 h-3 text-blue-600" /> Yard Employee Sign-Off
                </span>
                <span className="bg-emerald-200 text-emerald-950 font-bold text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-800" /> AUTO-SIGNED
                </span>
              </div>
              
              <div className="bg-white p-2 rounded border border-slate-200 text-center">
                <span className="font-serif italic font-extrabold text-slate-900 text-base tracking-wide block border-b border-slate-300 pb-1">
                  Jackson Hilliard
                </span>
                <span className="text-[8px] text-slate-500 uppercase font-mono mt-0.5 block">
                  Authorized Yard Scale Inspector & Compliance Officer
                </span>
              </div>
            </div>

          </div>

          {/* QR Verification Seal */}
          <div className="pt-2 flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-200">
            <span>OPERATOR: Jackson Hilliard (Yard Scale Manager)</span>
            <div className="flex items-center gap-1">
              <QrCode className="w-4 h-4 text-slate-800" />
              <span>AUTH CODE: #{ticket.id}</span>
            </div>
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
};