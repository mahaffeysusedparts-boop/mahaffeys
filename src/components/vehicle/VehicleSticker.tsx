import QRCode from 'react-qr-code';

export interface VehicleStickerData {
  businessName: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  intakeDate: string;
}

interface VehicleStickerProps {
  vehicle: VehicleStickerData;
}

const formatIntakeDate = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
}).format(new Date(value));

export const VehicleSticker = ({ vehicle }: VehicleStickerProps) => (
  <section
    className="vehicle-sticker mx-auto aspect-[2/3] w-full max-w-[400px] overflow-hidden rounded-[28px] border-[5px] border-slate-950 bg-white text-slate-950 shadow-2xl"
    aria-label={`Windshield sticker for ${vehicle.vin}`}
  >
    <header className="border-b-[5px] border-slate-950 bg-amber-400 px-5 py-4 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.3em]">Vehicle Intake</p>
      <h2 className="mt-1 text-2xl font-black uppercase leading-none tracking-tight">
        {vehicle.businessName}
      </h2>
    </header>

    <div className="flex h-[calc(100%-92px)] flex-col p-5">
      <div className="text-center">
        <p className="text-4xl font-black leading-none tracking-tight">{vehicle.year}</p>
        <p className="mt-1 text-2xl font-black uppercase leading-tight">
          {vehicle.make} {vehicle.model}
        </p>
      </div>

      <div className="my-4 flex flex-1 items-center justify-center">
        <div className="rounded-2xl border-4 border-slate-950 bg-white p-3">
          <QRCode
            value={vehicle.vin}
            size={190}
            bgColor="#ffffff"
            fgColor="#020617"
            level="H"
            title={`VIN ${vehicle.vin}`}
          />
        </div>
      </div>

      <div className="space-y-3 border-t-4 border-slate-950 pt-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">VIN</p>
          <p className="break-all font-mono text-[17px] font-black leading-tight tracking-[0.08em]">
            {vehicle.vin}
          </p>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">Intake Date</p>
            <p className="text-lg font-black">{formatIntakeDate(vehicle.intakeDate)}</p>
          </div>
          <p className="text-right text-[10px] font-bold uppercase leading-tight text-slate-600">
            Scan for<br />vehicle VIN
          </p>
        </div>
      </div>
    </div>
  </section>
);
