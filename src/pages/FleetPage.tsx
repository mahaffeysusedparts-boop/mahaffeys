import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Hammer, AlertCircle } from "lucide-react";
import { FleetKPICards } from "@/components/fleet/FleetKPICards";
import { EquipmentTable } from "@/components/fleet/EquipmentTable";
import { MaintenanceLogTable } from "@/components/fleet/MaintenanceLogTable";
import { ToolTable } from "@/components/fleet/ToolTable";
import { ToolCheckoutTable } from "@/components/fleet/ToolCheckoutTable";
import { ToolCheckoutForm } from "@/components/fleet/ToolCheckoutForm";
import { getOverdueCheckouts, getOverdueEquipment } from "@/services/fleetService";
import { storageService } from "@/services/storageService";

export function FleetPage() {
  const [tab, setTab] = useState("equipment");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const equipment = storageService.getEquipment();
  const tools = storageService.getTools();
  const overdueEquipment = getOverdueEquipment(7);
  const overdueCheckouts = getOverdueCheckouts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7" />
            Fleet & Tools
          </h1>
          <p className="text-muted-foreground">
            Equipment service schedules, maintenance history, and tool checkout tracking.
          </p>
        </div>
      </div>

      <FleetKPICards />

      {/* Alerts */}
      {overdueEquipment.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Service Overdue</AlertTitle>
          <AlertDescription>
            {overdueEquipment.length} piece{overdueEquipment.length === 1 ? "" : "s"} of equipment are overdue for service.
          </AlertDescription>
        </Alert>
      )}

      {overdueCheckouts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Overdue Tool Checkouts</AlertTitle>
          <AlertDescription>
            {overdueCheckouts.length} tool{overdueCheckouts.length === 1 ? "" : "s"} are past their due date.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="equipment" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Equipment
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Hammer className="h-4 w-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCheckoutOpen(true)}>
              <Hammer className="h-4 w-4 mr-2" />
              Checkout Tool
            </Button>
          </div>
          <EquipmentTable key={refreshKey} />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceLogTable key={refreshKey} />
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCheckoutOpen(true)}>
              <Hammer className="h-4 w-4 mr-2" />
              Checkout Tool
            </Button>
          </div>
          <ToolCheckoutTable onSaved={() => { setRefreshKey((k) => k + 1); }} />
          <ToolTable key={refreshKey} />
        </TabsContent>
      </Tabs>

      <ToolCheckoutForm
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        tools={tools}
        onSaved={() => { setRefreshKey((k) => k + 1); }}
      />
    </div>
  );
}

export default FleetPage;