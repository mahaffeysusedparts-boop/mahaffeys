import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, Wrench, Tool, AlertCircle, Truck } from "lucide-react";
import { getFleetKPIs } from "@/services/fleetService";

export function FleetKPICards() {
  const kpis = getFleetKPIs();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Equipment</CardTitle>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalEquipment}</div>
          <p className="text-xs text-muted-foreground">
            {kpis.equipmentActive} active, {kpis.equipmentDown} down, {kpis.equipmentRetired} retired
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Overdue Service</CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{kpis.overdueServiceCount}</div>
          <p className="text-xs text-muted-foreground">{kpis.dueSoonCount} due soon</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tools</CardTitle>
          <Tool className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalTools}</div>
          <p className="text-xs text-muted-foreground">
            {kpis.toolsAvailable} available, {kpis.toolsOut} out, {kpis.toolsMissing} missing
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Overdue Checkouts</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{kpis.overdueCheckouts}</div>
          <p className="text-xs text-muted-foreground">Tools past due date</p>
        </CardContent>
      </Card>
    </div>
  );
}