import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";

type ScaleConnectionMode = 'SERVER' | 'WEB_SERIAL' | 'WEBSOCKET';

interface ScaleConfig {
  id: string;
  name: string;
  location: string;
  connectionType: ScaleConnectionMode;
  portName?: string;
  baudRate?: number;
  webSocketUrl?: string;
  isDefault: boolean;
}

// In-memory scale registry — in production this would be a database.
// Each scale has its own connection parameters.
const scaleRegistry = new Map<string, ScaleConfig>();

export default defineHandler(async (event) => {
  const query = getQuery(event) as Record<string, string>;
  const scaleId = query.scaleId as string | undefined;
  const connectionType = query.connectionType as string | undefined;
  const portName = query.portName as string | undefined;
  const baudRate = query.baudRate ? parseInt(query.baudRate, 10) : undefined;
  const webSocketUrl = query.webSocketUrl as string | undefined;

  // Register/update the scale config if provided
  if (scaleId && connectionType) {
    const existing = scaleRegistry.get(scaleId);
    scaleRegistry.set(scaleId, {
      id: scaleId,
      name: existing?.name || scaleId,
      location: existing?.location || '',
      connectionType: connectionType as ScaleConnectionMode,
      portName,
      baudRate,
      webSocketUrl,
      isDefault: existing?.isDefault ?? false,
    });
  }

  // If a specific scale is requested, look it up
  const config = scaleId ? scaleRegistry.get(scaleId) : undefined;

  // Simulate scale status based on connection type
  // In production, this would read from the actual hardware/serial/websocket
  const isConnected = !!config || !scaleId;

  return {
    connected: isConnected,
    connectionType: config?.connectionType || 'serial',
    weight: isConnected ? Math.round(8000 + Math.random() * 2000) : 0,
    unit: 'LBS' as const,
    isStable: isConnected,
    isZero: false,
    portName: config?.portName || (isConnected ? 'COM3' : undefined),
    baudRate: config?.baudRate || 9600,
    errorMessage: isConnected ? undefined : 'Scale not configured',
  };
});