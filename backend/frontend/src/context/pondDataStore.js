import { createContext, useContext } from 'react';

export const PondDataContext = createContext(null);

export function usePondData() {
  const context = useContext(PondDataContext);
  if (!context) throw new Error('usePondData must be used within PondDataProvider.');
  return context;
}
