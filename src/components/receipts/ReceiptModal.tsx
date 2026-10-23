import React, { useEffect, useState } from 'react';
import { Ticket, YardSettings } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { customerService } from '@/services/customerService';
import { printBrowserDocument } from '@/utils/preparePrintDocument';
import { toast } from 'sonner';
import { CheckPrintModal } from '@/components/receipts/CheckPrintModal';
import { NetworkPrintButton } from '@/components/settings/NetworkPrintButton';
import { BinReviewEvidence } from '@/components/intake/BinInspectionSummary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, ShieldCheck, QrCode, AlertTriangle, UserCheck, Building, Landmark } from 'lucide-react';

interface ReceiptModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ ticket, open, onOpenChange }) => {
  const [checkOpen, setCheckOpen] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<{ key: string; url?: string; error?: string } | null>(null);
  const [photoRetry, setPhotoRetry] = useState(0);
  const customerId = ticket?.customerId;
  const idNumber = ticket?.customerIdNumber || ticket?.buying?.sellerIdentity?.idNumber;
  const ticketPhoto = ticket?.complianceCaptures?.idPhotoUrl || ticket?.carRecord?.complianceCaptures?.idPhotoUrl;
  const photoKey = `${ticket?.id}:${customerId || ''}:${idNumber || ''}`;
  const needsProfilePhoto = !ticketPhoto && Boolean(customerId || idNumber);
  const photoPending = open && needsProfilePhoto && profilePhoto?.key !== photoKey;
  const photoError = needsProfilePhoto && profilePhoto?.key === photoKey ? profilePhoto.error : undefined;

  useEffect(() => {
    if (!open || !needsProfilePhoto) {
      setProfilePhoto(null);
      return;
    }
    let active = true;
    setProfilePhoto(null);
    const load = async () => {
      try {
        let url: string | undefined;
        if (customerId) {
          url = (await customerService.get(customerId)).idPhotoUrl;
        } else if (idNumber) {
          const result = await customerService.list({ search: idNumber, pageSize: 100 });
          const matches = result.customers.filter(customer => customer.idNumber.trim().toUpperCase() === idNumber.trim().toUpperCase());
          // Never infer an ID photo from a name or an ambiguous registry match.
          if (matches.length === 1 && result.totalPages <= 1) url = matches[0].idPhotoUrl;
        }
        if (active) setProfilePhoto({ key: photoKey, url });
      } catch {
        if (active) setProfilePhoto({ key: photoKey, error: 'Could not load the seller ID photo. Retry before printing.' });
      }
    };
    void load();
    return () => { active = false; };
  }, [open, needsProfilePhoto, customerId, idNumber, photoKey, photoRetry]);

  if (!ticket) return null;

  const settings: YardSettings = storageService.getSettings();
  const caps = { ...ticket.carRecord?.complianceCaptures, ...ticket.complianceCaptures,
    idPhotoUrl: ticketPhoto || (profilePhoto?.key === photoKey ? profilePhoto.url : undefined) };
  const paymentMethod = ticket.buying?.payment?.method ?? ticket.payoutMethod;
  const checkNumber = ticket.buying?.payment?.checkReference ?? ticket.checkNumber;

  const handlePrint = async () => {
    const root = document.querySelector('.printable-receipt-container');
    if (!(root instanceof HTMLElement) || photoPending || photoError) return;
    setPreparingPrint(true);
    try {
      await printBrowserDocument(root);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare receipt photos for printing');
    } finally {
      setPreparingPrint(false);
    }
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
          <span className="text-[9px] bg-amber-300 px-2 py-0.5 rounded text-slate-950">
            BOTH SIGNATURES REQUIRED
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
              {ticket.buying ? ticket.buying.stage === 'PAID' ? 'PAID — PAYMENT RECEIPT' : ticket.buying.stage === 'VOIDED' ? 'VOIDED — NOT PAYABLE' : 'UNPAID VOUCHER — COPY, NOT A PAYMENT' : ticket.ticketType === 'CAR_SALVAGE' ? 'AUTO SALVAGE INTAKE VOUCHER' : 'LEGACY SCRAP VOUCHER — PAYMENT STATUS NOT RECONCILED'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold text-[10px] uppercase rounded">
              <ShieldCheck className="w-3 h-3 text-emerald-700 inline" /> {ticket.buying ? ticket.buying.stage === 'PAID' ? 'PAID IN FULL' : 'PAYMENT NOT RECORDED' : 'LEGACY COMPLIANCE RECORD'}
            </span>
          </div>
        </div>

        {/* Ticket Metadata Bar with Customer Phone */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-2 text-[11px]">
          <div>
            <p><span className="font-bold">TICKET #:</span> {ticket.id}</p>
            <p><span className="font-bold">DATE / TIME:</span> {new Date(ticket.createdAt).toLocaleString()}</p>
            <p><span className="font-bold">PAYOUT METHOD:</span> {paymentMethod.toUpperCase()}</p>
            {paymentMethod === 'Check' && checkNumber && <p><span className="font-bold">CHECK NUMBER:</span> {checkNumber}</p>}
            {ticket.buying?.payment && <p><span className="font-bold">PAYMENT RECORDED BY:</span> {ticket.buying.payment.paidBy} · {new Date(ticket.buying.payment.paidAt).toLocaleString()}</p>}
            {ticket.buying?.payment?.safeguardReview && <p><span className="font-bold">PAYMENT-RULE SAFEGUARDS:</span> {ticket.buying.payment.safeguardReview.enabled ? 'ON' : 'OFF — ADMINISTRATOR OVERRIDE'} · Revision {ticket.buying.payment.safeguardReview.revision}</p>}
            {ticket.buying?.payment?.safeguardReview?.enabled === false && <p><span className="font-bold">OVERRIDE:</span> {ticket.buying.payment.safeguardReview.updatedBy} · {ticket.buying.payment.safeguardReview.reason}. Application checks disabled; not a certification of legal compliance.</p>}
          </div>
          <div className="text-right">
            <p><span className="font-bold">SELLER / CUSTOMER:</span> {ticket.customerName}</p>
            {ticket.customerPhone && (
              <p><span className="font-bold">PHONE #:</span> {ticket.customerPhone}</p>
            )}
            {ticket.customerAddress && <p><span className="font-bold">ADDRESS:</span> {ticket.customerAddress}</p>}
            <p><span className="font-bold">ID #:</span> {ticket.customerIdNumber || ticket.buying?.sellerIdentity?.idNumber || 'NOT SUPPLIED'}</p>
            <p><span className="font-bold">VEHICLE PLATE:</span> {ticket.vehicleLicensePlate || 'NOT SUPPLIED'}</p>
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
                  <th className="py-1 text-right">IN (GROSS)</th>
                  <th className="py-1 text-right">OUT (TARE)</th>
                  <th className="py-1 text-right">NET LBS</th>
                  <th className="py-1 text-right">RATE/LB</th>
                  <th className="py-1 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {ticket.scrapLines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-200">
                    <td className="py-1 font-bold">
                      <span className="text-slate-500">#{line.loadNumber ?? '—'}</span> {line.metalName}
                      <span className="block text-[8px] text-slate-500 font-normal">
                        {line.metalCategory}
                        {line.deductionPercent > 0 && (
                          <span className="text-red-600">
                            {' '}· net {line.netWeight.toLocaleString()} lb − {line.deductionPercent}% ({line.deductionLbs.toLocaleString()} lb)
                          </span>
                        )}
                      </span>
                      {line.binReview && <div className="mt-2 text-[9px] font-normal text-slate-800"><BinReviewEvidence review={line.binReview} /><p>Measured net {line.netWeight.toLocaleString()} lb − items {line.deductionLbs.toLocaleString()} lb = payable {line.billableWeight.toLocaleString()} lb</p></div>}
                      {line.missingBinReview && <p className="mt-2 text-[9px] font-normal text-slate-800">No bin review; no item deduction. Explicitly acknowledged by {line.missingBinReview.actorName} at {new Date(line.missingBinReview.acknowledgedAt).toLocaleString()}.</p>}
                    </td>
                    <td className="py-1 text-right">{line.grossWeight.toLocaleString()} lb</td>
                    <td className="py-1 text-right">{line.tareWeight.toLocaleString()} lb</td>
                    <td className="py-1 text-right font-bold">{line.billableWeight.toLocaleString()} lb</td>
                    <td className="py-1 text-right">${line.ratePerLb.toFixed(2)}</td>
                    <td className="py-1 text-right font-bold">${line.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-900 font-black">
                  <td className="py-1 uppercase">Totals</td>
                  <td className="py-1 text-right">
                    {ticket.scrapLines.reduce((acc, l) => acc + l.grossWeight, 0).toLocaleString()} lb
                  </td>
                  <td className="py-1 text-right">
                    {ticket.scrapLines.reduce((acc, l) => acc + l.tareWeight, 0).toLocaleString()} lb
                  </td>
                  <td className="py-1 text-right">
                    {ticket.scrapLines.reduce((acc, l) => acc + l.billableWeight, 0).toLocaleString()} lb
                  </td>
                  <td className="py-1" />
                  <td className="py-1 text-right">
                    ${ticket.scrapLines.reduce((acc, l) => acc + l.lineTotal, 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-[8px] text-slate-500">
              IN (gross) and OUT (tare) are certified platform-scale readings captured at weigh-in and weigh-out.
              NET is the billable weight after any contamination deduction.
            </p>
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
                      <img src={item.url} alt={item.label} className={`w-full h-full ${item.label === 'ID SCAN' ? 'object-contain bg-white' : 'object-cover'}`} />
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

        {/* Payment disclosure */}
        <div className="text-[8px] text-slate-600 border-t border-slate-300 pt-2 space-y-0.5 leading-tight">
          <p className="font-bold uppercase">{settings.receiptHeader}</p>
          <p>
            {ticket.buying?.payment?.paymentRuleVersion ? 'Yard payment rules: cash through $25.00 for ferrous / mixed loads and through $100.00 for non-ferrous-only loads; check above those amounts. PAID records cash handover or check issuance, not check clearance or legal-compliance certification.' : 'Payment status reflects recorded payment evidence. This copy does not certify legal compliance or check clearance.'}
          </p>
        </div>

        {/* SELLER CERTIFICATION BOX — BOTH PRINTED COPIES MUST BE SIGNED */}
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

        {/* HANDWRITTEN SIGNATURES — NO DIGITAL OR AUTOMATIC SIGNATURES */}
        <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-2 gap-5 items-end print:pt-3">
          <div className="space-y-1">
            <div className="h-12 border-b-2 border-slate-900 bg-white" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-900">Seller / Customer Signature</p>
            <p className="text-[8px] text-slate-600">Printed name: {ticket.customerName}</p>
            <p className="text-[8px] text-slate-600">Date: ____________________</p>
          </div>

          <div className="space-y-1">
            <div className="h-12 border-b-2 border-slate-900 bg-white" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-900">Yard Representative Signature</p>
            <p className="text-[8px] text-slate-600">Printed name: {ticket.operatorName || settings.operatorName}</p>
            <p className="text-[8px] text-slate-600">Date: ____________________</p>
          </div>
        </div>

        <p className="rounded border border-slate-400 bg-slate-100 px-2 py-1 text-center text-[8px] font-bold uppercase tracking-wide text-slate-700">
          This copy is valid only after both the seller and an authorized yard representative sign it by hand.
        </p>

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] bg-slate-950 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto printable-receipt-container">
        <DialogHeader className="border-b border-slate-800 pb-3 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-lg font-bold text-white font-mono">
                {ticket.buying?.stage === 'PAID' ? 'PAID Receipt — Customer & Yard Copies' : 'Intake Ticket — Customer & Yard Copies'}
              </DialogTitle>
            </div>
            <Button
              onClick={() => void handlePrint()}
              disabled={preparingPrint || photoPending || Boolean(photoError)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Printer className="w-4 h-4 mr-1.5" /> {preparingPrint ? 'Preparing Photos…' : 'Print Both Copies'}
            </Button>
            <NetworkPrintButton kind="standard" rootSelector=".printable-receipt-container .space-y-6" documentName={`receipt-${ticket.id}`} disabled={preparingPrint || photoPending || Boolean(photoError)} />
            {ticket.payoutMethod === 'Check' && (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setCheckOpen(true);
                }}
                size="sm"
                variant="outline"
                className="border-sky-500/40 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 font-bold"
              >
                <Landmark className="w-4 h-4 mr-1.5" /> Print Check
              </Button>
            )}
          </div>
          {photoPending && <p className="text-sm text-sky-200">Loading the seller's saved ID photo…</p>}
          {photoError && <div className="flex items-center gap-2 text-sm text-rose-200"><span>{photoError}</span><Button size="sm" variant="outline" onClick={() => setPhotoRetry(value => value + 1)} className="rounded-lg border-rose-400 text-rose-100">Retry ID photo</Button></div>}
        </DialogHeader>

        {/* Printable Area - Renders Copy 1 (Customer Copy) and Copy 2 (Yard Copy) */}
        <div className="space-y-6">
          
          {/* COPY 1: CUSTOMER COPY — BOTH PARTIES SIGN */}
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

          {/* COPY 2: YARD / OFFICE COPY — BOTH PARTIES SIGN */}
          {renderReceiptCard(true)}

        </div>

      </DialogContent>
    </Dialog>

      <CheckPrintModal
        ticket={ticket}
        open={checkOpen}
        onOpenChange={setCheckOpen}
      />
    </>
  );
};