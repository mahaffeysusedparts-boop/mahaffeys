import { describe, expect, it } from 'vitest';
import { windowsSshEnvironment } from './windowsSshProcess';

describe('Windows SSH child environment', () => {
  it('supplies missing ProgramData and TMP without mutating the parent environment', () => {
    const source = { SystemRoot: 'D:\\Windows', TEMP: 'D:\\Users\\jackh\\Temp', PATH: 'original-path' };
    expect(windowsSshEnvironment(source)).toEqual({
      ...source, ProgramData: 'D:\\ProgramData', TMP: source.TEMP,
    });
    expect(source).not.toHaveProperty('ProgramData');
    expect(source).not.toHaveProperty('TMP');
  });

  it('preserves configured paths and handles Windows variable names case-insensitively', () => {
    const source = { PROGRAMDATA: 'E:\\SharedData', tmp: 'E:\\Temp', Temp: 'D:\\Temp' };
    expect(windowsSshEnvironment(source)).toEqual(source);
  });

  it('fills empty variables using their existing spelling without duplicate keys', () => {
    expect(windowsSshEnvironment({ programdata: '', tmp: '', TEMP: 'C:\\Temp' })).toEqual({
      programdata: 'C:\\ProgramData', tmp: 'C:\\Temp', TEMP: 'C:\\Temp',
    });
  });
});
