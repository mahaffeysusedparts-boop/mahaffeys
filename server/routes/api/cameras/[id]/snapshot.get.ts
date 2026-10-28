import { defineHandler } from 'nitro';
import { createError, getRouterParam } from 'nitro/h3';
import { requireUser } from '../../../../utils/auth';
import { acquireCameraSnapshot } from '../../../../utils/cameraSnapshots';

export default defineHandler(async event => {
  await requireUser(event);
  const id = getRouterParam(event,'id');
  if (!id) throw createError({statusCode:400,statusMessage:'Camera ID is required'});
  try {
    const snapshot = await acquireCameraSnapshot(id,event.req.signal);
    return new Response(new Uint8Array(snapshot.bytes),{headers:{
      'Content-Type':snapshot.contentType,'Cache-Control':'no-store, private',
      'X-Content-Type-Options':'nosniff','X-Snapshot-Captured-At':snapshot.capturedAt,
    }});
  } catch {
    throw createError({statusCode:502,statusMessage:'Camera snapshot unavailable; check the active camera, snapshot URL, credentials and server network access'});
  }
});
