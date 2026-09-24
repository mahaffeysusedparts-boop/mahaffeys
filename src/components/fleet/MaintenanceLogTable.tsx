import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2 } from "lucide-react";
import { storageService } from "@/services/storageService";
import { MaintenanceLogForm } from "./MaintenanceLogForm";
import type { MaintenanceLogEntry } from "@/types/scrap";

export function MaintenanceLogTable() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<MaintenanceLogEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const equipment = storageService.getEquipment();
  const logs = storageService.getMaintenanceLogs();
  const equipmentName = (id: string) => equipment.find((e) => e.id === id)?.name || id;

  const filtered = logs
    .filter((l) => {
      const equipment = equipmentName(l.equipmentId).toLowerCase();
      return equipment.includes(search.toLowerCase()) ||
        (l.taskType || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.performedBy || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.notes || "").toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

  const handleDelete = (id: string) => {
    if (confirm("Delete this maintenance log?")) {
      storageService.removeMaintenanceLog(id);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Maintenance History</h3>
          <p className="text-sm text-muted-foreground">Track repairs, inspections, parts, costs, and downtime.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Button onClick={() => { setEditingLog(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Log
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Task Type</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Meter</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Downtime</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.completedAt?.slice(0, 10) || "—"}</TableCell>
                <TableCell className="font-medium">{equipmentName(l.equipmentId)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{l.taskType || "Maintenance"}</Badge>
                </TableCell>
                <TableCell>{l.performedBy || "—"}</TableCell>
                <TableCell>{l.meterReading ?? "—"}</TableCell>
                <TableCell>{l.cost != null ? `$${l.cost.toFixed(2)}` : "—"}</TableCell>
                <TableCell>{l.downtimeHours != null ? `${l.downtimeHours}h` : "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{l.notes || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)} title="Delete" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MaintenanceLogForm
        open={formOpen}
        onOpenChange={setFormOpen}
        equipment={equipment}
        editingLog={editingLog}
        onSaved={() => { setRefreshKey((k) => k + 1); setFormOpen(false); setEditingLog(null); }}
      />
    </div>
  );
}