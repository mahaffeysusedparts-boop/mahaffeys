import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Save, X } from "lucide-react";
import { addMaintenanceLog } from "@/services/fleetService";
import type { EquipmentItem, MaintenanceLogEntry } from "@/types/scrap";

interface MaintenanceLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: EquipmentItem[];
  editingLog?: MaintenanceLogEntry | null;
  onSaved: () => void;
}

const TASK_TYPES = ["Oil change", "Filter", "Inspection", "Repair", "Other"];

export function MaintenanceLogForm({ open, onOpenChange, equipment, editingLog, onSaved }: MaintenanceLogFormProps) {
  const [formData, setFormData] = useState<Partial<MaintenanceLogEntry>>(editingLog ?? {});

  const handleChange = (field: keyof MaintenanceLogEntry, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.equipmentId) return;
    addMaintenanceLog({
      equipmentId: formData.equipmentId,
      completedAt: formData.completedAt,
      notes: formData.notes || "",
      meterReading: formData.meterReading,
      performedBy: formData.performedBy,
      taskType: formData.taskType,
      cost: formData.cost,
      vendor: formData.vendor,
      downtimeHours: formData.downtimeHours,
    });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingLog ? "Edit Maintenance Log" : "Add Maintenance Log"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Equipment *</Label>
            <Select
              value={formData.equipmentId || ""}
              onValueChange={(v) => handleChange("equipmentId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Task Type</Label>
              <Select
                value={formData.taskType || ""}
                onValueChange={(v) => handleChange("taskType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Performed By</Label>
              <Input
                value={formData.performedBy || ""}
                onChange={(e) => handleChange("performedBy", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.completedAt?.slice(0, 10) || ""}
                onChange={(e) => handleChange("completedAt", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Meter Reading</Label>
              <Input
                type="number"
                value={formData.meterReading ?? ""}
                onChange={(e) => handleChange("meterReading", parseInt(e.target.value) || undefined)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost ?? ""}
                onChange={(e) => handleChange("cost", parseFloat(e.target.value) || undefined)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Vendor</Label>
              <Input
                value={formData.vendor || ""}
                onChange={(e) => handleChange("vendor", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Downtime (Hours)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.downtimeHours ?? ""}
                onChange={(e) => handleChange("downtimeHours", parseFloat(e.target.value) || undefined)}
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
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            {editingLog ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}