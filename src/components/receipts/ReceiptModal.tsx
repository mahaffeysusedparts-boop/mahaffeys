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
import { Printer, ShieldCheck, QrCode, CheckCircle, FileSignature, AlertTriangle, UserCheck, Building, Phone } from 'lucide-react';

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

  const renderReceiptCard = (isYardCopy: boolean) => {
    return (
      <div
        className={`printable-receipt-card bg-white text-slate-900 p-6 sm:p-7 rounded-lg shadow-inner font-mono text-xs space-y-4 border ${
          isYardCopy ? 'border-slate-900 bg-amber-50/10' : 'border-slate-300'
        } print:p-8 print:rounded-none print:border-slate-900 print:shadow-none print:text-black ${
          isYardCopy ? 'print:break-before-page' : ''
        }`}
      >
        {/* COPY HEADER BADGE */}
        <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-1.5 rounded font-bold uppercase tracking-wider text-[11px] print:bg-slate-900 print:text-white">
          <div className="flex items-center gap-1.5">
            {isYardCopy ? (
              <>
                <Building className="w-4 h-4 text-amber-400 print:text-amber-300" />
                <span>YARD / OFFICE COPY — OFFICIAL COMPLIANCE RECORD</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 text-blue-400 print:text-blue-300" />
                <span>CUSTOMER COPY — FOR YOUR RECORDS</span>
              </>
            )}
          </div>
          <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
            {isYardCopy ? "SIGNATURE REQUIRED" : "NO SIGNATURE NEEDED"}
          </span>
        </div>

        {/* Yard / Header Info */}
        <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
          <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
            {settings.yardName}
          </h2>
          <p className="text-[11px] text-slate-700">{settings.address}, {settings.cityStateZip}</p>
          <p className="text-[11px] text-slate-700">Phone: {settings.phone} | Lic #: {settings.licenseNumber}</p>
          <div className="pt-1.5 flex items-center justify-center gap-2">
            <span className="inline-block px-2 py-0.5 bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest rounded">
              {ticket.ticketType === 'CAR_SALVAGE' ? 'AUTO SALVAGE INTAKE VOUCHER' : 'SCRAP METAL PAYOUT VOUCHER'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold text-[10px] uppercase rounded">
              <ShieldCheck className="w-3 h-3 text-emerald-700 inline" /> COMPLIANCE VERIFIED
            </span>
          </div>
        </div>

        {/* Ticket Metadata Bar with Customer Phone */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-2 text-[11px]">
          <div>
            <p><span className="font-bold">TICKET #:</span> {ticket.id}</p>
            <p><span className="font-bold">DATE / TIME:</span> {new Date(ticket.createdAt).toLocaleString()}</p>
            <p><span className="font-bold">PAYOUT METHOD:</span> {ticket.payoutMethod.toUpperCase()} {ticket.checkNumber ? `(#${ticket.checkNumber})` : ''}</p>
          </div>
          <div className="text-right">
            <p><span className="font-bold">SELLER / CUSTOMER:</span> {ticket.customerName}</p>
            {ticket.customerPhone && (
              <p><span className="font-bold">PHONE #:</span> {ticket.customerPhone}</p>
            )}
            <p><span className="font-bold">ID #:</span> {ticket.customerIdNumber || 'VERIFIED ON FILE'}</p>
            {ticket.vehicleLicensePlate && (
              <p><span className="font-bold">VEHICLE PLATE:</span> {ticket.vehicleLicensePlate}</p>
            )}
          </div>
        </div>

        {/* Car Salvage Details Breakdown */}
        {ticket.ticketType === 'CAR_SALVAGE' && ticket.carRecord && (
          <div className="space-y-2">
            <div className="bg-slate-100 p-2.5 rounded border border-slate-300">
              <p className="font-bold text-xs uppercase mb-1">
                VEHICLE SPECIFICATIONS: {ticket.carRecord.year} {ticket.carRecord.make} {ticket.carRecord.model} {ticket.carRecord.trim || ''}
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <p><span className="font-bold">VIN:</span> {ticket.carRecord.vin}</p>
                <p><span className="font-bold">TITLE STATUS:</span> {ticket.carRecord.titleStatus}</p>
                <p><span className="font-bold">ENGINE:</span> {[ticket.carRecord.engineSizeLiters ? `${ticket.carRecord.engineSizeLiters}L` : null, ticket.carRecord.engineCylinders ? `${ticket.carRecord.engineCylinders} CYL` : null, ticket.carRecord.engineModel].filter(Boolean).join(' ') || 'N/A'}</p>
                <p><span className="font-bold">FUEL:</span> {ticket.carRecord.fuelType || 'N/A'}</p>
                <p><span className="font-bold">SCALE WEIGHT:</span> {ticket.carRecord.vehicleWeightLbs.toLocaleString()} LBS</p>
                <p><span className="font-bold">TITLE #:</span> {ticket.carRecord.titleNumber || 'N/A'}</p>
              </div>
            </div>

            <div className="border border-slate-300 rounded p-2 space-y-0.5">
              <p className="font-bold border-b border-slate-300 pb-0.5 uppercase text-[10px]">Component & Compliance Check:</p>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
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
          <div className="space-y-1.5">
            <p className="font-bold uppercase text-[11px] border-b border-slate-300 pb-0.5">Weighed Scrap Items:</p>
            <table className="w-full text-left text-[10px] border-collapse">
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
                    <td className="py-1 font-bold">
                      {line.metalName}
                      <span className="block text-[8px] text-slate-500 font-normal">{line.metalCategory}</span>
                    </td>
                    <td className="py-1 text-right">{line.billableWeight} lbs</td>
                    <td className="py-1 text-right">${line.ratePerLb.toFixed(2)}</td>
                    <td className="py-1 text-right font-bold">${line.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ATTACHED COMPLIANCE PHOTO GALLERY */}
        {caps && (
          <div className="border border-slate-300 rounded p-2 bg-slate-50 space-y-1">
            <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
              <p className="font-bold text-[9px] uppercase text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-600 inline" /> ATTACHED COMPLIANCE PHOTO RECORD
              </p>
              <span className="text-[8px] font-bold text-emerald-800">STATE ANTI-THEFT AUDIT SEAL</span>
            </div>
            
            <div className="grid grid-cols-5 gap-1 text-center">
              {[
                { label: "ID SCAN", url: caps.idPhotoUrl },
                { label: "SELLER FACE", url: caps.personPhotoUrl },
                { label: "VEHICLE", url: caps.vehiclePhotoUrl },
                { label: "PLATE OCR", url: caps.licensePlatePhotoUrl },
                { label: "CARGO LOAD", url: caps.loadPhotoUrl },
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-0.5 border border-slate-300 rounded">
                  <div className="aspect-square bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                    {item.url ? (
                      <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[7px] text-slate-500">N/A</span>
                    )}
                  </div>
                  <span className="text-[7px] font-bold text-slate-700 block mt-0.5 truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Summary Box */}
        <div className="border-t-2 border-slate-900 pt-2 space-y-1 font-mono">
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
          <div className="flex justify-between text-sm font-black border-t border-slate-400 pt-1 text-slate-900">
            <span>FINAL PAYOUT ({ticket.payoutMethod.toUpperCase()}):</span>
            <span>${ticket.finalPayout.toFixed(2)}</span>
          </div>
        </div>

        {/* Statutory Payout & Legal Disclosures */}
        <div className="text-[8px] text-slate-600 border-t border-slate-300 pt-2 space-y-0.5 leading-tight">
          <p className="font-bold uppercase">{settings.receiptHeader}</p>
          <p>
            Cash payouts are strictly limited under State Statutory Scrap Metal Theft Prevention Laws ($25.00 for Non-Ferrous and $100.00 for Ferrous). Amounts exceeding statutory cash limits are paid via Check.
          </p>
        </div>

        {/* CONDITIONAL CONTENT: YARD COPY GETS CERTIFICATION & SIGNATURES */}
        {isYardCopy ? (
          <>
            {/* SELLER CERTIFICATION BOX */}
            <div className="border-2 border-slate-900 rounded p-2.5 bg-slate-50 space-y-1 text-[9px] leading-snug">
              <div className="flex items-center gap-1 text-slate-900 font-bold border-b border-slate-300 pb-0.5 uppercase tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>SELLER CERTIFICATION STATEMENT</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-800 font-sans font-medium">
                <li>I am the rightful owner of all metal listed above, or I have express written authorization from the rightful owner to sell these materials.</li>
                <li>These materials were not acquired through theft, trespass, or other unlawful activity.</li>
                <li>I have never been convicted of an offense involving metal theft.</li>
                <li>I understand that making a false statement on this document is a criminal offense punishable by fines and imprisonment.</li>
              </ol>
            </div>

            {/* DUAL SIGNATURE BOX: SELLER SIGNATURE LINE & AUTOMATIC YARD EMPLOYEE SIGNATURE */}
            <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-2 gap-4 items-end print:pt-3">
              
              {/* 1. SELLER SIGNATURE AREA */}
              <div className="space-y-1">
                {caps?.signatureUrl ? (
                  <div className="border-b-2 border-slate-900 h-12 flex items-center justify-center p-1 bg-white">
                    <img src={caps.signatureUrl} alt="Seller Digital Signature" className="max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="border-b-2 border-slate-900 h-12 flex items-end pb-1 bg-white">
                    <span className="text-[11px] font-bold text-slate-900 italic font-serif">
                      X ________________________________________
                    </span>
                  </div>
                )}
                <p className="text-[10px] font-black uppercase text-slate-900 tracking-wider">
                  SELLER / CUSTOMER SIGNATURE
                </p>
                <p className="text-[8px] text-slate-600 font-sans leading-tight">
                  By signing above, I acknowledge reading and agreeing to the Seller Certification statements.
                </p>
              </div>

              {/* 2. AUTOMATIC YARD EMPLOYEE SIGNATURE */}
              <div className="bg-slate-100 p-2 rounded border border-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold text-slate-700 uppercase flex items-center gap-1">
                    <FileSignature className="w-3 h-3 text-blue-600" /> Yard Inspector Sign-Off
                  </span>
                  <span className="bg-emerald-200 text-emerald-950 font-bold text-[7px] px-1 py-0.5 rounded flex items-center gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-800" /> VERIFIED
                  </span>
                </div>
                
                <div className="bg-white p-1.5 rounded border border-slate-300 text-center">
                  <span className="font-serif italic font-black text-slate-900 text-sm tracking-wide block border-b border-slate-300 pb-0.5">
                    {ticket.operatorName || settings.operatorName || 'Jackson Hilliard'}
                  </span>
                  <span className="text-[8px] text-slate-600 uppercase font-mono mt-0.5 block font-bold">
                    Authorized Scale Inspector & Compliance Officer
                  </span>
                </div>
              </div>

            </div>
          </>
        ) : (
          /* CUSTOMER COPY NOTICE */
          <div className="border border-dashed border-slate-400 rounded p-3 bg-blue-50/50 text-center space-y-1">
            <p className="font-bold text-blue-900 text-xs uppercase flex items-center justify-center gap-1">
              <UserCheck className="w-4 h-4 text-blue-600" /> CUSTOMER RECEIPT — THANK YOU FOR YOUR BUSINESS!
            </p>
            <p className="text-[10px] text-slate-600">
              Please retain this voucher for your personal records and tax reporting.
            </p>
          </div>
        )}

        {/* QR Verification Seal */}
        <div className="pt-1.5 flex items-center justify-between text-[8px] text-slate-500 font-mono border-t border-slate-200">
          <span>OPERATOR: {ticket.operatorName || settings.operatorName}</span>
          <div className="flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-slate-800" />
            <span>AUTH CODE: #{ticket.id}</span>
          </div>
        </div>

      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto printable-receipt-container">
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-lg font-bold text-white font-mono">
                Dual Intake Ticket & Legal Payout Voucher (8.5×11 Letter, 2 Pages)
              </DialogTitle>
            </div>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Both Copies
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Area - Renders Copy 1 (Customer Copy) and Copy 2 (Yard Copy) */}
        <div className="space-y-6">
          
          {/* COPY 1: CUSTOMER COPY */}
          {renderReceiptCard(false)}

          {/* PAGE BREAK / SEPARATOR */}
          <div className="relative my-4 print:hidden">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-dashed border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-3 py-1 rounded border border-slate-700 text-amber-400 font-mono font-bold">
                ✂️ Tear / Print Separator — Yard Copy Below
              </span>
            </div>
          </div>

          {/* COPY 2: YARD / OFFICE COPY (THE ONE TO BE SIGNED) */}
          {renderReceiptCard(true)}

        </div>

      </DialogContent>
    </Dialog>
  );
};