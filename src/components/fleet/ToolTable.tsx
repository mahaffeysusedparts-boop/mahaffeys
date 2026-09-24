import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, Trash2 } from "lucide-react";
import { storageService } from "@/services/storageService";
import { ToolForm } from "./ToolForm";
import type { ToolItem } from "@/types/scrap";

const STATUS_VARIANT: Record<ToolItem["status"], "default" | "destructive" | "secondary" | "outline"> = {
  Available: "default",
  Out: "secondary",
  Missing: "destructive",
  Retired: "outline",
};

export function ToolTable() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tools = storageService.getTools();
  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (confirm("Delete this tool?")) {
      storageService.removeTool(id);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tools</h3>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => { setEditingTool(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono">{t.code}</TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.category || "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[t.status] ?? "default"}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell>{t.homeLocation || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{t.conditionNotes || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingTool(t); setFormOpen(true); }} title="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} title="Delete" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ToolForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingTool={editingTool}
        onSaved={() => { setRefreshKey((k) => k + 1); setEditingTool(null); }}
      />
    </div>
  );
}