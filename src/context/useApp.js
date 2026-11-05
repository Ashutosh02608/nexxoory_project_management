import { useContext } from 'react';
import { AppContext } from './appContextValue';

export const useApp = () => useContext(AppContext);

