import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, X } from "lucide-react";
import { checkoutTool } from "@/services/fleetService";
import type { ToolItem } from "@/types/scrap";

interface ToolCheckoutFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: ToolItem[];
  onSaved: () => void;
}

export function ToolCheckoutForm({ open, onOpenChange, tools, onSaved }: ToolCheckoutFormProps) {
  const [toolId, setToolId] = useState("");
  const [checkedOutBy, setCheckedOutBy] = useState("");
  const [dueBackAt, setDueBackAt] = useState("");
  const [conditionOnCheckout, setConditionOnCheckout] = useState("");
  const [notes, setNotes] = useState("");

  const availableTools = tools.filter((t) => t.status === "Available");

  const handleSubmit = () => {
    if (!toolId || !checkedOutBy) return;
    checkoutTool({
      toolId,
      checkedOutBy,
      dueBackAt: dueBackAt || undefined,
      conditionOnCheckout: conditionOnCheckout || undefined,
      notes: notes || undefined,
    });
    setToolId("");
    setCheckedOutBy("");
    setDueBackAt("");
    setConditionOnCheckout("");
    setNotes("");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Checkout Tool</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Tool *</Label>
            <Select value={toolId} onValueChange={setToolId}>
              <SelectTrigger>
                <SelectValue placeholder="Select tool" />
              </SelectTrigger>
              <SelectContent>
                {availableTools.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Checked Out By *</Label>
              <Input
                value={checkedOutBy}
                onChange={(e) => setCheckedOutBy(e.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="grid gap-2">
              <Label>Due Back</Label>
              <Input
                type="date"
                value={dueBackAt}
                onChange={(e) => setDueBackAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Condition On Checkout</Label>
            <Input
              value={conditionOnCheckout}
              onChange={(e) => setConditionOnCheckout(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!toolId || !checkedOutBy}>
            <Save className="h-4 w-4 mr-2" />
            Checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}