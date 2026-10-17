import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useLinkedSearch() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [search, setSearch] = useState(query);
  useEffect(() => { setSearch(query); }, [query]);
  return [search, setSearch] as const;
}
