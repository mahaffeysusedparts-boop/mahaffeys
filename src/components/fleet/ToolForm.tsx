import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, X } from "lucide-react";
import { storageService } from "@/services/storageService";
import type { ToolItem } from "@/types/scrap";

interface ToolFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTool?: ToolItem | null;
  onSaved: () => void;
}

const STATUSES: ToolItem["status"][] = ["Available", "Out", "Missing", "Retired"];

export function ToolForm({ open, onOpenChange, editingTool, onSaved }: ToolFormProps) {
  const isEdit = !!editingTool;
  const [formData, setFormData] = useState<Partial<ToolItem>>(editingTool ?? {});

  const handleChange = (field: keyof ToolItem, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const now = new Date().toISOString();
    const tool: ToolItem = {
      id: editingTool?.id ?? `tool-${Date.now()}`,
      code: formData.code || "",
      name: formData.name || "",
      category: formData.category || "",
      status: formData.status ?? "Available",
      homeLocation: formData.homeLocation || "",
      conditionNotes: formData.conditionNotes,
      serialNumber: formData.serialNumber,
      purchaseDate: formData.purchaseDate,
      notes: formData.notes,
      createdAt: editingTool?.createdAt ?? now,
      updatedAt: now,
    };
    storageService.saveTool(tool);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tool" : "Add Tool"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Code *</Label>
              <Input
                value={formData.code || ""}
                onChange={(e) => handleChange("code", e.target.value)}
                placeholder="e.g., IW-01"
              />
            </div>
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g., Impact Wrench"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Input
                value={formData.category || ""}
                onChange={(e) => handleChange("category", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status || "Available"}
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
              <Label>Home Location</Label>
              <Input
                value={formData.homeLocation || ""}
                onChange={(e) => handleChange("homeLocation", e.target.value)}
                placeholder="e.g., Tool Crib A"
              />
            </div>
            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input
                value={formData.serialNumber || ""}
                onChange={(e) => handleChange("serialNumber", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Purchase Date</Label>
            <Input
              type="date"
              value={formData.purchaseDate?.slice(0, 10) || ""}
              onChange={(e) => handleChange("purchaseDate", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Condition Notes</Label>
            <Textarea
              value={formData.conditionNotes || ""}
              onChange={(e) => handleChange("conditionNotes", e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={2}
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
            {isEdit ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
