'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkCompanion } from '@/lib/companion';

export interface CompanionState {
  available: boolean;
  checking: boolean;
}

export function useCompanion() {
  const [state, setState] = useState<CompanionState>({
    available: false,
    checking: true,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    const available = await checkCompanion();
    setState({ available, checking: false });
  }, []);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  return { ...state, recheckCompanion: check };
}
