import React, { useState } from 'react';
import { Customer } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { Navbar } from '@/components/layout/Navbar';
import { generateSampleThumbprint, generateSamplePhoto } from '@/utils/complianceUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, Search, UserPlus, ShieldCheck, Phone, Car, Fingerprint, CreditCard, Camera } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(storageService.getCustomers());
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New Customer Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idType, setIdType] = useState<Customer['idType']>('Driver License');
  const [idNumber, setIdNumber] = useState('');
  const [idState, setIdState] = useState('GA');
  const [address, setAddress] = useState('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState('');

  const handleSaveNewCustomer = () => {
    if (!fullName.trim() || !idNumber.trim()) {
      toast.error('Full Name and ID Number are required for state compliance');
      return;
    }

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      fullName,
      phone,
      idType,
      idNumber,
      idState,
      address,
      vehicleLicensePlate,
      createdAt: new Date().toISOString(),
      totalPayouts: 0,
      totalWeightLbs: 0,
      idPhotoUrl: generateSamplePhoto('id'),
      thumbprintData: generateSampleThumbprint(),
      capturedPlates: vehicleLicensePlate ? [vehicleLicensePlate] : [],
    };

    storageService.saveCustomer(newCust);
    setCustomers(storageService.getCustomers());
    toast.success(`Customer ${fullName} registered successfully with ID scan & thumbprint profile!`);
    setAddOpen(false);

    // Reset
    setFullName('');
    setPhone('');
    setIdNumber('');
    setAddress('');
    setVehicleLicensePlate('');
  };

  const filtered = customers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.idNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.vehicleLicensePlate && c.vehicleLicensePlate.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Seller Compliance & Customer Registry
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              State-mandated photo ID registry, biometric thumbprints, tow truck customer accounts, and transaction records
            </p>
          </div>

          <Button
            onClick={() => setAddOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Register New Customer
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <Input
                placeholder="Search by name, ID number, phone, or plate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer Table */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No registered customers found.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 text-xs">
                    <TableHead className="w-12 text-slate-400">ID Scan</TableHead>
                    <TableHead className="text-slate-400">Full Name & Address</TableHead>
                    <TableHead className="text-slate-400">ID Credentials</TableHead>
                    <TableHead className="text-slate-400">Biometrics & Plates</TableHead>
                    <TableHead className="text-slate-400 text-right">Lifetime Weight</TableHead>
                    <TableHead className="text-slate-400 text-right">Lifetime Payouts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/50 text-xs">
                      
                      <TableCell>
                        <div
                          onClick={() => setSelectedCustomer(c)}
                          className="w-10 h-7 bg-slate-950 rounded border border-slate-800 overflow-hidden cursor-pointer flex items-center justify-center group"
                        >
                          {c.idPhotoUrl ? (
                            <img src={c.idPhotoUrl} alt="ID" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-bold text-white font-sans">
                        {c.fullName}
                        <span className="block text-[10px] text-slate-400 font-normal">{c.address || 'Address on file'}</span>
                      </TableCell>

                      <TableCell className="font-mono text-slate-300">
                        <Badge variant="outline" className="border-slate-700 text-emerald-400 text-[10px] mr-1.5">
                          {c.idType}
                        </Badge>
                        {c.idNumber} ({c.idState})
                      </TableCell>

                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {c.thumbprintData ? (
                            <Badge className="bg-sky-950 text-sky-300 border-sky-800 text-[9px] gap-1">
                              <Fingerprint className="w-2.5 h-2.5 text-sky-400" /> Thumbprint Sealed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[9px]">No Biometrics</Badge>
                          )}
                        </div>
                        {c.vehicleLicensePlate && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Car className="w-3 h-3 text-amber-400" /> Plate: {c.vehicleLicensePlate}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-mono text-slate-300 font-bold">
                        {c.totalWeightLbs.toLocaleString()} LBS
                      </TableCell>

                      <TableCell className="text-right font-mono font-extrabold text-emerald-400">
                        ${c.totalPayouts.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Add Customer Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" /> Register Seller ID Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-slate-300">Full Name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Marcus Vance"
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">ID Type</Label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as any)}
                  className="w-full h-9 bg-slate-950 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
                >
                  <option value="Driver License">Driver License</option>
                  <option value="State ID">State ID</option>
                  <option value="Passport">Passport</option>
                  <option value="Military ID">Military ID</option>
                </select>
              </div>

              <div>
                <Label className="text-slate-300">ID Number *</Label>
                <Input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. DL-4481029-GA"
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Default License Plate</Label>
                <Input
                  value={vehicleLicensePlate}
                  onChange={(e) => setVehicleLicensePlate(e.target.value)}
                  placeholder="e.g. TOW-912"
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Street Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Industrial Blvd, City, State"
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSaveNewCustomer} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Customer ID Photo & Biometrics Modal */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border-slate-800 p-6">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Seller ID Credentials - {selectedCustomer.fullName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                {selectedCustomer.idPhotoUrl ? (
                  <img src={selectedCustomer.idPhotoUrl} alt="ID Card" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-500">No Driver License image on file</span>
                )}
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                <div>ID Type: <span className="text-white font-bold">{selectedCustomer.idType}</span></div>
                <div>ID Number: <span className="text-emerald-400 font-bold">{selectedCustomer.idNumber} ({selectedCustomer.idState})</span></div>
                <div>Address: <span className="text-slate-300">{selectedCustomer.address}</span></div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
