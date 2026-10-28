import { describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { preserveEvidenceMappings, validateEvidenceMappings } from './scaleEvidenceConfig';

const cameras = [{ id: 'load-camera', isActive: true },{ id: 'truck-camera', isActive: true },{ id: 'paused-camera', isActive: false }];
describe('scale evidence camera mappings',() => {
  it('leaves legacy mappings unconfigured and allows a shared truck/plate camera',() => {
    expect(validateEvidenceMappings({},cameras)).toEqual({});
    expect(validateEvidenceMappings({load:'load-camera',vehicle:'truck-camera',plate:'truck-camera'},cameras)).toEqual({load:'load-camera',vehicle:'truck-camera',plate:'truck-camera'});
  });
  it('rejects destinations, unknown/disabled cameras and invalid categories',() => {
    for (const value of [{load:'http://192.168.1.150/snapshot'}, {plate:'missing-camera'}, {vehicle:'paused-camera'}, {seller:'load-camera'}, {load:''}]) {
      expect(() => validateEvidenceMappings(value,cameras)).toThrow();
    }
    expect(() => validateEvidenceMappings({load:'cloud'},[{id:'cloud',isActive:true,provider:'ALARM_COM'}])).toThrow();
  });
  it('preserves acknowledged mappings while allowing unrelated settings changes',async () => {
    const client = {query:async () => ({rows:[{value:{scales:[{id:'truck',evidenceCameras:{load:'load-camera'}}]}}]})} as unknown as PoolClient;
    const incoming = {yardName:'Changed name',scales:[{id:'truck',name:'Renamed scale',evidenceCameras:{load:'truck-camera'}},{id:'new-scale',evidenceCameras:{plate:'truck-camera'}}]};
    expect(await preserveEvidenceMappings(client,incoming)).toEqual({yardName:'Changed name',scales:[{id:'truck',name:'Renamed scale',evidenceCameras:{load:'load-camera'}},{id:'new-scale'}]});
    expect(incoming.scales[0].evidenceCameras.load).toBe('truck-camera');
  });
});
