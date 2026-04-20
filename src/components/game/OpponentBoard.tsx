/**
 * OpponentBoard.tsx
 * Renders the opponent's board as a mini canvas preview.
 * Receives the opponent's grid from server state.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { Grid, COLORS, BOARD_WIDTH, BOARD_HEIGHT } from '../../types';

interface OpponentBoardProps {
  grid: Grid;
  isGameOver: boolean;
  /** Column index that was just shot — triggers flash animation */
  flashCol: number | null;
  onShoot?: (row: number, col: number) => void;
}

const MINI_CELL = 14; // smaller than main board's 32px
const W = BOARD_WIDTH * MINI_CELL;
const H = BOARD_HEIGHT * MINI_CELL;

const OpponentBoard: React.FC<OpponentBoardProps> = ({ grid, isGameOver, flashCol, onShoot }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onShoot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / MINI_CELL);
    const row = Math.floor(y / MINI_CELL);
    if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) return;
    onShoot(row, col);
  }, [onShoot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(100,150,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= BOARD_WIDTH; x++) {
      ctx.beginPath(); ctx.moveTo(x * MINI_CELL, 0); ctx.lineTo(x * MINI_CELL, H); ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * MINI_CELL); ctx.lineTo(W, y * MINI_CELL); ctx.stroke();
    }

    // Cells
    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        const cell = grid[row]?.[col];
        if (!cell) continue;
        const isFake = typeof cell === 'object' && (cell as any).value === 'fake';
        const color = isFake ? 'rgba(200,220,255,0.55)' : (COLORS[cell as keyof typeof COLORS] ?? '#888');
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.globalAlpha = isFake ? 0.55 : 1;
        ctx.fillRect(col * MINI_CELL + 1, row * MINI_CELL + 1, MINI_CELL - 2, MINI_CELL - 2);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    }

    // Flash column highlight when shot lands
    if (flashCol !== null && flashCol >= 0 && flashCol < BOARD_WIDTH) {
      ctx.fillStyle = 'rgba(255, 45, 85, 0.35)';
      ctx.fillRect(flashCol * MINI_CELL, 0, MINI_CELL, H);
    }

    // Game over overlay
    if (isGameOver) {
      ctx.fillStyle = 'rgba(6, 10, 18, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FF2D55';
      ctx.font = `bold 10px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('OVER', W / 2, H / 2);
    }
  }, [grid, isGameOver, flashCol]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleClick}
      style={{ display: 'block', imageRendering: 'pixelated', cursor: onShoot ? 'crosshair' : 'default' }}
    />
  );
};

export default OpponentBoard;
