import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Camera,
  CreditCard,
  Car,
  Package,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Scan,
  Upload,
  RefreshCw,
  Zap,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Trash2,
} from "lucide-react";
import {
  ComplianceCaptures,
  Customer,
} from "@/types/scrap";
import {
  DLScanResult,
  SAMPLE_DL_PROFILES,
  generateSamplePhoto,
  generateSampleThumbprint,
  calculateComplianceScore,
} from "@/utils/complianceUtils";
import { toast } from "sonner";

interface ComplianceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCaptures?: ComplianceCaptures;
  onSaveCaptures: (captures: ComplianceCaptures, scannedProfile?: DLScanResult) => void;
  intakeType?: 'CAR_SALVAGE' | 'SCRAP_METAL';
}

export const ComplianceCaptureModal: React.FC<ComplianceCaptureModalProps> = ({
  isOpen,
  onClose,
  initialCaptures,
  onSaveCaptures,
  intakeType = 'CAR_SALVAGE',
}) => {
  const [captures, setCaptures] = useState<ComplianceCaptures>(
    initialCaptures || {
      personPhotoUrl: undefined,
      idPhotoUrl: undefined,
      vehiclePhotoUrl: undefined,
      licensePlatePhotoUrl: undefined,
      loadPhotoUrl: undefined,
      thumbprintCaptured: false,
      thumbprintDataUrl: undefined,
    }
  );

  const [activeTab, setActiveTab] = useState<string>("id");
  const [scannedProfile, setScannedProfile] = useState<DLScanResult | undefined>();
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadTarget, setCurrentUploadTarget] = useState<keyof ComplianceCaptures | null>(null);

  const complianceStats = calculateComplianceScore(captures);

  // Auto snapshot generator helper for fast demo testing
  const handleGenerateSample = (key: keyof ComplianceCaptures, type: 'person' | 'id' | 'vehicle' | 'plate' | 'load') => {
    setIsCapturing(true);
    setTimeout(() => {
      const url = generateSamplePhoto(type);
      setCaptures((prev) => ({
        ...prev,
        [key]: url,
      }));
      setIsCapturing(false);
      toast.success(`${type.toUpperCase()} snapshot captured successfully!`);
    }, 400);
  };

  // DL OCR Simulator
  const handleScanDlProfile = (profile: DLScanResult) => {
    setIsCapturing(true);
    setTimeout(() => {
      const idPhoto = generateSamplePhoto('id');
      const platePhoto = generateSamplePhoto('plate');
      const personPhoto = generateSamplePhoto('person');

      setCaptures((prev) => ({
        ...prev,
        idPhotoUrl: idPhoto,
        licensePlatePhotoUrl: prev.licensePlatePhotoUrl || platePhoto,
        personPhotoUrl: prev.personPhotoUrl || personPhoto,
      }));
      setScannedProfile(profile);
      setIsCapturing(false);
      toast.success(`DL Barcode Scanned: ${profile.fullName} (${profile.idNumber})`, {
        description: "Customer fields and license plate auto-filled!",
      });
    }, 500);
  };

  // Thumbprint capture
  const handleCaptureThumbprint = () => {
    const thumbUrl = generateSampleThumbprint();
    setCaptures((prev) => ({
      ...prev,
      thumbprintCaptured: true,
      thumbprintDataUrl: thumbUrl,
    }));
    toast.success("Biometric Thumbprint Recorded & Sealed");
  };

  // Clear single capture
  const handleClearCapture = (key: keyof ComplianceCaptures) => {
    setCaptures((prev) => {
      const updated = { ...prev };
      delete updated[key];
      if (key === 'thumbprintCaptured') {
        updated.thumbprintCaptured = false;
        delete updated.thumbprintDataUrl;
      }
      return updated;
    });
  };

  // Instant Auto-Capture All (One-Click 100% Studio)
  const handleOneClickStudioScan = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const randomProfile = SAMPLE_DL_PROFILES[Math.floor(Math.random() * SAMPLE_DL_PROFILES.length)];
      const updated: ComplianceCaptures = {
        personPhotoUrl: generateSamplePhoto('person'),
        idPhotoUrl: generateSamplePhoto('id'),
        vehiclePhotoUrl: generateSamplePhoto('vehicle'),
        licensePlatePhotoUrl: generateSamplePhoto('plate'),
        loadPhotoUrl: generateSamplePhoto('load'),
        thumbprintCaptured: true,
        thumbprintDataUrl: generateSampleThumbprint(),
      };
      setCaptures(updated);
      setScannedProfile(randomProfile);
      setIsCapturing(false);
      toast.success("100% Full Studio Capture Completed!", {
        description: `Verified for ${randomProfile.fullName} (${randomProfile.idNumber})`,
      });
    }, 600);
  };

  // Custom Image File Upload
  const handleTriggerUpload = (key: keyof ComplianceCaptures) => {
    setCurrentUploadTarget(key);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUploadTarget) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCaptures((prev) => ({
          ...prev,
          [currentUploadTarget]: result,
        }));
        toast.success("Photo uploaded successfully");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSaveCaptures(captures, scannedProfile);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800 p-6">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        <DialogHeader className="space-y-2 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Legal Compliance & 4-Point Photo Studio
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  State Scrap Theft Statute & NMVTIS Anti-Fraud Digital Audit Suite
                </DialogDescription>
              </div>
            </div>

            {/* Compliance Badge Indicator */}
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                  complianceStats.score === 100
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/50"
                    : complianceStats.score > 0
                    ? "bg-amber-950/80 text-amber-400 border-amber-500/50"
                    : "bg-rose-950/80 text-rose-400 border-rose-500/50"
                }`}
              >
                {complianceStats.score === 100 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400 inline" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-amber-400 inline" />
                )}
                {complianceStats.score}% Compliant ({6 - complianceStats.missingItems.length}/6 Captures)
              </Badge>

              <Button
                size="sm"
                variant="outline"
                onClick={handleOneClickStudioScan}
                disabled={isCapturing}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-none shadow-md shadow-blue-900/30 font-medium text-xs gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                Auto-Capture Studio (1-Click)
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Live Thumbnails Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 my-4 p-3 bg-slate-900/90 rounded-xl border border-slate-800">
          {[
            { id: 'idPhotoUrl', title: 'DL / State ID', icon: CreditCard, val: captures.idPhotoUrl, tab: 'id' },
            { id: 'personPhotoUrl', title: 'Seller Face', icon: UserCheck, val: captures.personPhotoUrl, tab: 'person' },
            { id: 'vehiclePhotoUrl', title: 'Vehicle 45°', icon: Car, val: captures.vehiclePhotoUrl, tab: 'vehicle' },
            { id: 'licensePlatePhotoUrl', title: 'License Plate', icon: Scan, val: captures.licensePlatePhotoUrl, tab: 'plate' },
            { id: 'loadPhotoUrl', title: 'Cargo / Load', icon: Package, val: captures.loadPhotoUrl, tab: 'load' },
            { id: 'thumbprintCaptured', title: 'Thumbprint', icon: Fingerprint, val: captures.thumbprintCaptured ? (captures.thumbprintDataUrl || generateSampleThumbprint()) : undefined, tab: 'thumbprint' },
          ].map((item) => {
            const Icon = item.icon;
            const isDone = !!item.val;
            return (
              <div
                key={item.id}
                onClick={() => setActiveTab(item.tab)}
                className={`relative group cursor-pointer p-2 rounded-lg border text-center transition-all ${
                  isDone
                    ? "bg-slate-800/80 border-emerald-500/50 hover:border-emerald-400"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="aspect-video bg-slate-900 rounded overflow-hidden relative flex items-center justify-center mb-1">
                  {item.val ? (
                    <img src={item.val} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-500" />
                  )}
                  {isDone && (
                    <span className="absolute top-1 right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-medium text-slate-300 truncate">{item.title}</div>
                <div className="text-[9px] font-semibold text-slate-500">
                  {isDone ? "VERIFIED" : "PENDING"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Studio Workspace Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger value="id" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> ID Scan
            </TabsTrigger>
            <TabsTrigger value="person" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Seller Face
            </TabsTrigger>
            <TabsTrigger value="vehicle" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <Car className="w-3.5 h-3.5" /> Vehicle
            </TabsTrigger>
            <TabsTrigger value="plate" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <Scan className="w-3.5 h-3.5" /> Plate
            </TabsTrigger>
            <TabsTrigger value="load" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <Package className="w-3.5 h-3.5" /> Cargo Load
            </TabsTrigger>
            <TabsTrigger value="thumbprint" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <Fingerprint className="w-3.5 h-3.5" /> Thumbprint
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ID BARCODE / OCR SCANNER */}
          <TabsContent value="id" className="mt-4 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <CreditCard className="w-4 h-4" /> Driver License / State ID Scanner (OCR & Barcode)
                  </span>
                  {captures.idPhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ID Verified</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  {/* Viewfinder Preview */}
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.idPhotoUrl ? (
                      <>
                        <img src={captures.idPhotoUrl} alt="ID Scan" className="w-full h-full object-contain rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerUpload('idPhotoUrl')}>
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('idPhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                          <Scan className="w-6 h-6 animate-pulse" />
                        </div>
                        <p className="text-xs text-slate-400">Place DL / State ID under scanner or select a test profile</p>
                      </div>
                    )}
                  </div>

                  {/* Quick DL Scanner Simulator Profiles */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Simulate Barcode/OCR DL Scanner:</span>
                      <span className="text-[10px] text-blue-400 font-mono">2D PDF417 BARCODE</span>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {SAMPLE_DL_PROFILES.map((profile, i) => (
                        <div
                          key={i}
                          onClick={() => handleScanDlProfile(profile)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            scannedProfile?.idNumber === profile.idNumber
                              ? "bg-blue-950/70 border-blue-500 text-white"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-100">{profile.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{profile.idNumber} ({profile.idState})</div>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/30">
                            Scan ID
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateSample('idPhotoUrl', 'id')}
                        className="flex-1 text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Snap ID Photo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTriggerUpload('idPhotoUrl')}
                        className="text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" /> Upload File
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Scanned Output Card */}
                {scannedProfile && (
                  <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg text-xs space-y-1 font-mono text-blue-200">
                    <div className="text-white font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" /> OCR Extracted Details:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div><strong className="text-slate-400">Name:</strong> {scannedProfile.fullName}</div>
                      <div><strong className="text-slate-400">ID Number:</strong> {scannedProfile.idNumber}</div>
                      <div><strong className="text-slate-400">State:</strong> {scannedProfile.idState}</div>
                      <div><strong className="text-slate-400">Plate Ref:</strong> {scannedProfile.vehicleLicensePlate}</div>
                      <div className="col-span-2"><strong className="text-slate-400">Address:</strong> {scannedProfile.address}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: SELLER FACE SHOT */}
          <TabsContent value="person" className="mt-4 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <UserCheck className="w-4 h-4" /> Seller Face Identification Shot
                  </span>
                  {captures.personPhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Face Shot Clear</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.personPhotoUrl ? (
                      <>
                        <img src={captures.personPhotoUrl} alt="Seller Face" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerUpload('personPhotoUrl')}>
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('personPhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <UserCheck className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Direct camera at seller for facial verification</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <p className="text-slate-400 leading-relaxed">
                      State anti-scrap statutes require a clear headshot photo of the individual presenting scrap materials or delivering salvage vehicles.
                    </p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleGenerateSample('personPhotoUrl', 'person')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> Trigger Camera Face Shot
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleTriggerUpload('personPhotoUrl')}
                        className="w-full text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Photo File
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: VEHICLE SHOT */}
          <TabsContent value="vehicle" className="mt-4 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <Car className="w-4 h-4" /> Vehicle 45° Angle Front Snapshot
                  </span>
                  {captures.vehiclePhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Vehicle Captured</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.vehiclePhotoUrl ? (
                      <>
                        <img src={captures.vehiclePhotoUrl} alt="Vehicle" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerUpload('vehiclePhotoUrl')}>
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('vehiclePhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <Car className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Capture overall vehicle condition showing make, model & color</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <p className="text-slate-400 leading-relaxed">
                      Required for NMVTIS salvage record auditing to verify vehicle body structure and completeness.
                    </p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleGenerateSample('vehiclePhotoUrl', 'vehicle')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> Trigger Yard Camera #2 (Vehicle)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleTriggerUpload('vehiclePhotoUrl')}
                        className="w-full text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Photo File
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: LICENSE PLATE SHOT */}
          <TabsContent value="plate" className="mt-4 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <Scan className="w-4 h-4" /> License Plate & Tag OCR Snapshot
                  </span>
                  {captures.licensePlatePhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Plate Verified</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.licensePlatePhotoUrl ? (
                      <>
                        <img src={captures.licensePlatePhotoUrl} alt="License Plate" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerUpload('licensePlatePhotoUrl')}>
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('licensePlatePhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <Scan className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Capture close-up of vehicle rear license plate tag</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <p className="text-slate-400 leading-relaxed">
                      Automatically cross-referenced against law enforcement stolen vehicle databases and state registries.
                    </p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleGenerateSample('licensePlatePhotoUrl', 'plate')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> Trigger LPR Plate Camera
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleTriggerUpload('licensePlatePhotoUrl')}
                        className="w-full text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload File
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: CARGO / SCRAP LOAD SHOT */}
          <TabsContent value="load" className="mt-4 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-blue-400">
                    <Package className="w-4 h-4" /> Scrap Cargo / Load Bed Snapshot
                  </span>
                  {captures.loadPhotoUrl && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Cargo Captured</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  <div className="relative aspect-video bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    {captures.loadPhotoUrl ? (
                      <>
                        <img src={captures.loadPhotoUrl} alt="Cargo Load" className="w-full h-full object-cover rounded" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleTriggerUpload('loadPhotoUrl')}>
                            <Upload className="w-3.5 h-3.5 mr-1" /> Replace
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClearCapture('loadPhotoUrl')}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-2">
                        <Package className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-xs text-slate-400">Overhead or scale view of scrap material load</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <p className="text-slate-400 leading-relaxed">
                      Provides photo verification of high-value metals (copper wire, brass, catalytic converters) before payment disbursement.
                    </p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleGenerateSample('loadPhotoUrl', 'load')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> Trigger Scale Overhead Camera
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleTriggerUpload('loadPhotoUrl')}
                        className="w-full text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload File
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: THUMBPRINT SCANNER */}
          <TabsContent value="thumbprint" className="mt-4 space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sky-400">
                    <Fingerprint className="w-4 h-4" /> Digital Biometric Thumbprint Pad
                  </span>
                  {captures.thumbprintCaptured && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Thumbprint Sealed</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6 items-center">
                  {/* Thumbprint Preview Box */}
                  <div
                    onClick={handleCaptureThumbprint}
                    className={`relative aspect-square max-w-[240px] mx-auto w-full rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center p-4 overflow-hidden ${
                      captures.thumbprintCaptured
                        ? "bg-slate-950 border-sky-500 shadow-lg shadow-sky-950/50"
                        : "bg-slate-950/80 border-dashed border-slate-700 hover:border-sky-400"
                    }`}
                  >
                    {captures.thumbprintCaptured ? (
                      <img
                        src={captures.thumbprintDataUrl || generateSampleThumbprint()}
                        alt="Thumbprint"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center space-y-2">
                        <Fingerprint className="w-16 h-16 mx-auto text-sky-400/60 animate-pulse" />
                        <p className="text-xs font-semibold text-slate-300">Tap to Scan Right Thumbprint</p>
                        <p className="text-[10px] text-slate-500">USB Biometric Touch Scanner</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3 bg-sky-950/30 border border-sky-500/20 rounded-xl space-y-1.5">
                      <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-sky-400" /> Anti-Theft Statute Compliance
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11px]">
                        State regulations mandate digital biometric thumbprint records for cash payouts exceeding $50 or non-ferrous precious scrap sales.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Button
                        onClick={handleCaptureThumbprint}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs gap-1.5"
                      >
                        <Fingerprint className="w-4 h-4" /> Touch Sensor to Capture Thumbprint
                      </Button>
                      {captures.thumbprintCaptured && (
                        <Button
                          variant="ghost"
                          onClick={() => handleClearCapture('thumbprintCaptured')}
                          className="w-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                        >
                          Clear Thumbprint Record
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <DialogFooter className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
            <span>Digital Audit Trail Encrypted (SHA-256)</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Apply Compliance Captures
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
