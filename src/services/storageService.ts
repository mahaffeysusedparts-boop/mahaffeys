function patchCached<T>(key: string, value: T): void {
  writeCached(key, value);
}