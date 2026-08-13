"use client";

import React from 'react';
import { PullYardVehicle } from '@/types/scrap';
import QRCode from 'qrcode.react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface VehicleWindowTagProps {
  vehicle: PullYardVehicle;
  yardName: string;
  publicUrl: string;
}

export const VehicleWindowTag: React.FC<VehicleWindowTagProps> = ({ vehicle, yardName, publicUrl }) => {
  const handlePrint = () => {
    window.print();
  };

  const vehicleUrl = `${publicUrl}/vehicles?vin=${vehicle.vin}`;

  return (
    <div className="p-4 bg-gray-100">
      <div className="printable-area bg-white p-6 max-w-md mx-auto border-4 border-black border-dashed">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold uppercase">{yardName}</h1>
          <p className="text-lg font-semibold">Pull-A-Part Inventory</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="col-span-2">
            <p className="text-4xl font-black">{vehicle.year}</p>
            <p className="text-2xl font-bold">{vehicle.make}</p>
            <p className="text-xl">{vehicle.model}</p>
            <p className="text-md text-gray-600">{vehicle.color}</p>
          </div>
          <div className="col-span-1 flex justify-center items-center">
            <QRCode value={vehicleUrl} size={100} />
          </div>
        </div>

        <div className="mt-4 border-t-2 border-black pt-2">
          <div className="flex justify-between text-xl font-bold">
            <span>SECTION:</span>
            <span>{vehicle.section}</span>
          </div>
          {vehicle.rowNumber && (
            <div className="flex justify-between text-xl font-bold mt-1">
              <span>ROW:</span>
              <span>{vehicle.rowNumber}</span>
            </div>
          )}
        </div>

        <div className="mt-2 text-center text-sm">
          <p>Date Set: {format(new Date(vehicle.dateSetInYard), 'MM/dd/yyyy')}</p>
          <p className="font-mono text-xs mt-1">VIN: {vehicle.vin}</p>
          <p className="mt-2 font-semibold">Scan QR code for part interchange info.</p>
        </div>
      </div>
      <div className="mt-4 text-center non-printable">
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Tag
        </Button>
      </div>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .non-printable {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};