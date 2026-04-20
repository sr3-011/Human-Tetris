/**
 * useAmmo.ts
 * Tracks local ammo based on lines cleared.
 * Kept separate from core GameState to avoid touching the reducer.
 */
import { useEffect, useRef, useState } from 'react';

const MAX_AMMO = 10;

function ammoForLines(lines: number): number {
  if (lines <= 0) return 0;
  if (lines === 1) return 1;
  if (lines === 2) return 2;
  if (lines === 3) return 3;
  return 4;
}

export function useAmmo(totalLines: number): {
  ammo: number;
  consumeAmmo: () => boolean;
} {
  const [ammo, setAmmo] = useState(0);
  const prevLinesRef = useRef(0);

  useEffect(() => {
    const diff = totalLines - prevLinesRef.current;
    prevLinesRef.current = totalLines;
    if (diff > 0) {
      setAmmo(prev => Math.min(MAX_AMMO, prev + ammoForLines(diff)));
    }
  }, [totalLines]);

  const consumeAmmo = (): boolean => {
    if (ammo <= 0) return false;
    setAmmo(prev => prev - 1);
    return true;
  };

  return { ammo, consumeAmmo };
}
