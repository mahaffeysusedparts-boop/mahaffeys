import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Save, X } from "lucide-react";
import { storageService } from "@/services/storageService";
import type { EquipmentItem } from "@/types/scrap";

interface EquipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: EquipmentItem | null;
  onSaved: () => void;
}

const CATEGORIES = ["Loader", "Forklift", "Tow Truck", "Crusher", "Other"];
const STATUSES = ["Active", "Down for service", "Retired"];

export function EquipmentForm({ open, onOpenChange, editingItem, onSaved }: EquipmentFormProps) {
  const isEdit = !!editingItem;
  const [formData, setFormData] = useState<Partial<EquipmentItem>>(editingItem ?? {});

  const handleChange = (field: keyof EquipmentItem, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const now = new Date().toISOString();
    const item: EquipmentItem = {
      id: editingItem?.id ?? `eq-${Date.now()}`,
      name: formData.name || "",
      assetType: formData.assetType || "",
      meterLabel: formData.meterLabel || "Hours",
      meterReading: formData.meterReading ?? 0,
      lastServiceDate: formData.lastServiceDate,
      nextServiceDue: formData.nextServiceDue || new Date(now).toISOString(),
      category: formData.category,
      make: formData.make,
      model: formData.model,
      year: formData.year,
      serialOrVin: formData.serialOrVin,
      plate: formData.plate,
      status: formData.status ?? "Active",
      serviceIntervalHours: formData.serviceIntervalHours,
      serviceIntervalDays: formData.serviceIntervalDays,
      notes: formData.notes,
    };
    storageService.saveEquipment(item);
    onSaved();
    onOpenChange(false);
  };

  const handleReset = () => {
    setFormData(editingItem ?? {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Name *</Label>
            <Input
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Loader #3"
            />
          </div>
          <div className="grid gap-2">
            <Label>Asset Type</Label>
            <Input
              value={formData.assetType || ""}
              onChange={(e) => handleChange("assetType", e.target.value)}
              placeholder="e.g., Hydraulic Loader"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={formData.category || ""}
                onValueChange={(v) => handleChange("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status || "Active"}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Make</Label>
              <Input
                value={formData.make || ""}
                onChange={(e) => handleChange("make", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Model</Label>
              <Input
                value={formData.model || ""}
                onChange={(e) => handleChange("model", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={formData.year || ""}
                onChange={(e) => handleChange("year", parseInt(e.target.value) || undefined)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Serial / VIN</Label>
              <Input
                value={formData.serialOrVin || ""}
                onChange={(e) => handleChange("serialOrVin", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Plate</Label>
              <Input
                value={formData.plate || ""}
                onChange={(e) => handleChange("plate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Meter Label</Label>
              <Input
                value={formData.meterLabel || "Hours"}
                onChange={(e) => handleChange("meterLabel", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Meter Reading</Label>
              <Input
                type="number"
                value={formData.meterReading || 0}
                onChange={(e) => handleChange("meterReading", parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Last Service Date</Label>
              <Input
                type="date"
                value={formData.lastServiceDate?.slice(0, 10) || ""}
                onChange={(e) => handleChange("lastServiceDate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Service Interval (Days)</Label>
              <Input
                type="number"
                value={formData.serviceIntervalDays || ""}
                onChange={(e) => handleChange("serviceIntervalDays", parseInt(e.target.value) || undefined)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Service Interval (Hours)</Label>
              <Input
                type="number"
                value={formData.serviceIntervalHours || ""}
                onChange={(e) => handleChange("serviceIntervalHours", parseInt(e.target.value) || undefined)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            {isEdit ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
