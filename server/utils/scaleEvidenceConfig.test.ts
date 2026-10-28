import { describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { preserveEvidenceMappings, validateEvidenceMappings } from './scaleEvidenceConfig';
const cameras = [{id:'load-camera',isActive:true},{id:'truck-camera',isActive:true},{id:'paused-camera',isActive:false}];
describe('scale evidence mappings',() => {
  it('defaults legacy mappings to unconfigured and allows shared cameras',() => {
    expect(validateEvidenceMappings({},cameras)).toEqual({});
    expect(validateEvidenceMappings({load:'load-camera',vehicle:'truck-camera',plate:'truck-camera'},cameras)).toEqual({load:'load-camera',vehicle:'truck-camera',plate:'truck-camera'});
  });
  it('rejects destinations, unknown or disabled cameras and invalid categories',() => {
    for (const value of [{load:'http://192.168.1.150/shot'}, {plate:'missing'}, {vehicle:'paused-camera'}, {seller:'load-camera'}, {load:''}]) expect(() => validateEvidenceMappings(value,cameras)).toThrow();
    expect(() => validateEvidenceMappings({load:'cloud'},[{id:'cloud',isActive:true,provider:'ALARM_COM'}])).toThrow();
  });
  it('preserves acknowledged mappings against stale whole-settings updates',async () => {
    const client = {query:async () => ({rows:[{value:{scales:[{id:'truck',evidenceCameras:{load:'load-camera'}}]}}]})} as unknown as PoolClient;
    const incoming = {yardName:'New name',scales:[{id:'truck',name:'Renamed scale',evidenceCameras:{load:'truck-camera'}},{id:'new-scale',evidenceCameras:{plate:'truck-camera'}}]};
    expect(await preserveEvidenceMappings(client,incoming)).toEqual({yardName:'New name',scales:[{id:'truck',name:'Renamed scale',evidenceCameras:{load:'load-camera'}},{id:'new-scale'}]});
    expect(incoming.scales[0].evidenceCameras.load).toBe('truck-camera');
  });
});
