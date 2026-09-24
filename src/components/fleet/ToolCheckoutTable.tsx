import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Undo2 } from "lucide-react";
import { storageService } from "@/services/storageService";
import { checkinTool } from "@/services/fleetService";
import { toast } from "sonner";
import type { ToolCheckout } from "@/types/scrap";

export function ToolCheckoutTable({ onSaved }: { onSaved: () => void }) {
  const [checkinTarget, setCheckinTarget] = useState<ToolCheckout | null>(null);
  const [condition, setCondition] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const tools = storageService.getTools();
  const checkouts = storageService.getToolCheckouts();
  const toolName = (id: string) => tools.find((t) => t.id === id)?.name || "Unknown tool";
  const isOverdue = (c: ToolCheckout) => !c.checkedInAt && !!c.dueBackAt && new Date(c.dueBackAt) < new Date();

  const open = checkouts
    .filter((c) => !c.checkedInAt)
    .sort((a, b) => (b.checkedOutAt || "").localeCompare(a.checkedOutAt || ""));
  const recent = checkouts
    .filter((c) => c.checkedInAt)
    .sort((a, b) => (b.checkedInAt || "").localeCompare(a.checkedInAt || ""))
    .slice(0, 10);

  const handleCheckin = () => {
    if (!checkinTarget) return;
    const updated = checkinTool(checkinTarget.id, condition.trim() || undefined);
    if (updated) {
      toast.success(`${toolName(updated.toolId)} checked back in`);
      setCheckinTarget(null);
      setCondition("");
      setRefreshKey((k) => k + 1);
      onSaved();
    }
  };

  return (
    <div className="space-y-4" key={refreshKey}>
      <div>
        <h3 className="text-lg font-semibold">Active Checkouts</h3>
        <p className="text-sm text-muted-foreground">Tools currently out of the crib — check them back in here.</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Checked Out By</TableHead>
              <TableHead>Out Since</TableHead>
              <TableHead>Due Back</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {open.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{toolName(c.toolId)}</TableCell>
                <TableCell>{c.checkedOutBy}</TableCell>
                <TableCell>{c.checkedOutAt?.slice(0, 10) || "—"}</TableCell>
                <TableCell>
                  {c.dueBackAt ? c.dueBackAt.slice(0, 10) : "—"}
                  {isOverdue(c) && <span className="ml-2 text-destructive font-semibold">● Overdue</span>}
                </TableCell>
                <TableCell className="max-w-xs truncate">{c.notes || c.conditionOnCheckout || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => { setCheckinTarget(c); setCondition(c.conditionOnCheckout || ""); }}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Check In
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!open.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No tools are currently checked out.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {recent.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Recently returned</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Checked Out By</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{toolName(c.toolId)}</TableCell>
                    <TableCell>{c.checkedOutBy}</TableCell>
                    <TableCell>{c.checkedInAt?.slice(0, 10) || "—"}</TableCell>
                    <TableCell>{c.conditionOnCheckin || c.conditionOnCheckout || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!checkinTarget} onOpenChange={(openState) => { if (!openState) setCheckinTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check in {checkinTarget ? toolName(checkinTarget.toolId) : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Condition on return</Label>
            <Input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. Good / Needs blade"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinTarget(null)}>Cancel</Button>
            <Button onClick={handleCheckin}>
              <Undo2 className="h-4 w-4 mr-2" />
              Confirm Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
