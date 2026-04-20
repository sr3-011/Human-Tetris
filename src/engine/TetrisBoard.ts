import { Grid, Piece, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, COLORS, GLOW, CellValue } from '../types';
import { getGhostPiece } from './Piece';

// ─── Canvas Renderer ──────────────────────────────────────────────────────────

export const CANVAS_WIDTH = BOARD_WIDTH * CELL_SIZE;
export const CANVAS_HEIGHT = BOARD_HEIGHT * CELL_SIZE;

// ─── Draw Single Cell ─────────────────────────────────────────────────────────

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: CellValue,
  alpha = 1,
  isGhost = false
) {
  if (!type) return;
  const isFake = typeof type === 'object' && (type as any).value === 'fake';
  const color = isFake ? 'rgba(200,220,255,0.55)' : COLORS[type as keyof typeof COLORS];
  const glow = isFake ? 'rgba(200,220,255,0.25)' : GLOW[type as keyof typeof GLOW];
  const px = x * CELL_SIZE;
  const py = y * CELL_SIZE;
  const pad = 1;
  const size = CELL_SIZE - pad * 2;

  ctx.save();
  ctx.globalAlpha = isFake ? alpha * 0.55 : alpha;

  if (isGhost) {
    // Ghost: just border outline
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + pad + 1, py + pad + 1, size - 2, size - 2);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color;
    ctx.fillRect(px + pad + 1, py + pad + 1, size - 2, size - 2);
    ctx.restore();
    return;
  }

  // Glow shadow
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;

  // Main fill
  if (isFake) {
    ctx.fillStyle = color;
  } else {
    const gradient = ctx.createLinearGradient(px + pad, py + pad, px + size, py + size);
    gradient.addColorStop(0, lighten(color, 0.35));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(px + pad, py + pad, size, size);

  // Inner highlight (top-left bevel)
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(px + pad, py + pad, size, size / 2);

  // Edge stroke
  ctx.strokeStyle = isFake ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + pad + 0.5, py + pad + 0.5, size - 1, size - 1);

  ctx.restore();
}

// ─── Color Helper ─────────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

// ─── Draw Grid Background ─────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Deep dark background
  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(100, 150, 255, 0.06)';
  ctx.lineWidth = 0.5;

  for (let x = 0; x <= BOARD_WIDTH; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE, 0);
    ctx.lineTo(x * CELL_SIZE, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= BOARD_HEIGHT; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL_SIZE);
    ctx.lineTo(CANVAS_WIDTH, y * CELL_SIZE);
    ctx.stroke();
  }
}

// ─── Draw Placed Cells ────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid) {
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const cell = grid[row][col];
      if (cell) {
        drawCell(ctx, col, row, cell);
      }
    }
  }
}

// ─── Draw Active Piece ────────────────────────────────────────────────────────

function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, isGhost = false) {
  const { matrix, position, type } = piece;
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;
      const gx = position.x + col;
      const gy = position.y + row;
      if (gy < 0) continue;
      drawCell(ctx, gx, gy, type, 1, isGhost);
    }
  }
}

// ─── Draw Game Over Overlay ───────────────────────────────────────────────────

function drawGameOver(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 18, 0.82)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign = 'center';

  // GAME OVER text
  ctx.shadowColor = '#FF2D55';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#FF2D55';
  ctx.font = 'bold 28px "Press Start 2P", monospace';
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(200,220,255,0.7)';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

  ctx.restore();
}

// ─── Draw Pause Overlay ───────────────────────────────────────────────────────

function drawPause(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 18, 0.75)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign = 'center';
  ctx.shadowColor = '#BF00FF';
  ctx.shadowBlur = 25;
  ctx.fillStyle = '#BF00FF';
  ctx.font = 'bold 20px "Press Start 2P", monospace';
  ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  ctx.restore();
}

// ─── Main Render Function ─────────────────────────────────────────────────────

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  currentPiece: Piece | null,
  isGameOver: boolean,
  isPaused: boolean
) {
  drawBackground(ctx);
  drawGrid(ctx, grid);

  if (currentPiece && !isGameOver) {
    const ghost = getGhostPiece(currentPiece, grid);
    drawPiece(ctx, ghost, true);
    drawPiece(ctx, currentPiece, false);
  }

  if (isGameOver) drawGameOver(ctx);
  if (isPaused && !isGameOver) drawPause(ctx);
}

// ─── Next Piece Preview Renderer ──────────────────────────────────────────────

export function renderNextPiece(ctx: CanvasRenderingContext2D, piece: Piece | null) {
  const previewSize = 4 * CELL_SIZE;
  ctx.clearRect(0, 0, previewSize, previewSize);
  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, previewSize, previewSize);

  if (!piece) return;

  const { matrix, type } = piece;
  const cols = matrix[0].length;
  const rows = matrix.length;
  const offsetX = Math.floor((4 - cols) / 2);
  const offsetY = Math.floor((4 - rows) / 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!matrix[row][col]) continue;
      drawCell(ctx, offsetX + col, offsetY + row, type);
    }
  }
}
