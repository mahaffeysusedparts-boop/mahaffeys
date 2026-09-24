import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Wrench, Trash2, Plus } from "lucide-react";
import { storageService } from "@/services/storageService";
import { getEquipmentDueInfo } from "@/services/fleetService";
import { EquipmentForm } from "./EquipmentForm";
import { MaintenanceLogForm } from "./MaintenanceLogForm";
import type { EquipmentItem } from "@/types/scrap";

export function EquipmentTable() {
  const [search, setSearch] = useState("");
  const [equipFormOpen, setEquipFormOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<EquipmentItem | null>(null);
  const [maintFormOpen, setMaintFormOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState<{ equipmentId: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const equipment = storageService.getEquipment();
  const filtered = equipment.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.assetType.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase()) ||
      e.make?.toLowerCase().includes(search.toLowerCase()) ||
      e.model?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (confirm("Delete this equipment?")) {
      storageService.removeEquipment(id);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleAddMaintenance = (equipmentId: string) => {
    setEditingMaint({ equipmentId });
    setMaintFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Equipment</h3>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => { setEditingEquip(null); setEquipFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Equipment
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Meter</TableHead>
              <TableHead>Last Service</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const dueInfo = getEquipmentDueInfo(e);
              const isOverdue = dueInfo.isOverdue;
              const isDueSoon = dueInfo.isDueSoon;
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.assetType}</TableCell>
                  <TableCell>{e.category || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.status === "Active" ? "default" :
                        e.status === "Down for service" ? "destructive" : "secondary"
                      }
                    >
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{e.meterReading} {e.meterLabel}</TableCell>
                  <TableCell>{e.lastServiceDate?.slice(0, 10) || "—"}</TableCell>
                  <TableCell>
                    {e.nextServiceDue?.slice(0, 10) || "—"}
                    {isOverdue && <span className="ml-2 text-destructive">● Overdue</span>}
                    {isDueSoon && !isOverdue && <span className="ml-2 text-amber-600">● Due soon</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleAddMaintenance(e.id)} title="Add Maintenance">
                        <Wrench className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingEquip(e); setEquipFormOpen(true); }} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} title="Delete" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <EquipmentForm
        open={equipFormOpen}
        onOpenChange={setEquipFormOpen}
        editingItem={editingEquip}
        onSaved={() => { setRefreshKey((k) => k + 1); setEditingEquip(null); }}
      />
      <MaintenanceLogForm
        open={maintFormOpen}
        onOpenChange={setMaintFormOpen}
        equipment={equipment}
        editingLog={editingMaint ? { equipmentId: editingMaint.equipmentId } as any : null}
        onSaved={() => { setRefreshKey((k) => k + 1); setMaintFormOpen(false); setEditingMaint(null); }}
      />
    </div>
  );
}