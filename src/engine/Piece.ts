import { TetrominoType, Piece, Position, BOARD_WIDTH, BOARD_HEIGHT, Grid } from '../types';

// ─── Tetromino Shape Matrices ─────────────────────────────────────────────────
// Each piece defined as rotation 0 matrix (row-major)

export const TETROMINOES: Record<TetrominoType, number[][][]> = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  O: [
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
  ],
  T: [
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
    [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
  ],
};

const PIECE_TYPES: TetrominoType[] = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];

// ─── Piece Factory ────────────────────────────────────────────────────────────

export function createPiece(type: TetrominoType): Piece {
  const matrix = TETROMINOES[type][0];
  const width = matrix[0].length;
  return {
    type,
    rotation: 0,
    matrix,
    position: {
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(width / 2),
      y: 0,
    },
  };
}

export function randomPiece(): Piece {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return createPiece(type);
}

// ─── Rotation ─────────────────────────────────────────────────────────────────
// Uses pre-defined rotation matrices; cycles through 0-3 states.
// Wall kicks: tries right offset (+1), then left offset (-1) if rotation fails.

export function rotatePiece(piece: Piece, grid: Grid): Piece {
  const nextRotation = (piece.rotation + 1) % 4;
  const nextMatrix = TETROMINOES[piece.type][nextRotation];

  const rotated: Piece = { ...piece, rotation: nextRotation, matrix: nextMatrix };

  // Try original position
  if (!collides(rotated, grid)) return rotated;

  // Wall kick: try shifting right
  const kickRight = { ...rotated, position: { ...rotated.position, x: rotated.position.x + 1 } };
  if (!collides(kickRight, grid)) return kickRight;

  // Wall kick: try shifting left
  const kickLeft = { ...rotated, position: { ...rotated.position, x: rotated.position.x - 1 } };
  if (!collides(kickLeft, grid)) return kickLeft;

  // Wall kick: try double shift (for I piece)
  const kickRight2 = { ...rotated, position: { ...rotated.position, x: rotated.position.x + 2 } };
  if (!collides(kickRight2, grid)) return kickRight2;

  const kickLeft2 = { ...rotated, position: { ...rotated.position, x: rotated.position.x - 2 } };
  if (!collides(kickLeft2, grid)) return kickLeft2;

  // Can't rotate — return original
  return piece;
}

// ─── Collision Detection ──────────────────────────────────────────────────────
// Iterates each occupied cell of the piece matrix.
// Checks:
//   1. Out-of-bounds left/right/bottom
//   2. Occupied cell in grid

export function collides(piece: Piece, grid: Grid): boolean {
  const { matrix, position } = piece;
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;

      const gridX = position.x + col;
      const gridY = position.y + row;

      if (gridX < 0 || gridX >= BOARD_WIDTH) return true;
      if (gridY >= BOARD_HEIGHT) return true;
      if (gridY >= 0 && grid[gridY][gridX] !== null) return true;
    }
  }
  return false;
}

// ─── Ghost Piece ──────────────────────────────────────────────────────────────
// Drops a shadow preview to show where piece will land

export function getGhostPiece(piece: Piece, grid: Grid): Piece {
  let ghost = { ...piece };
  while (true) {
    const dropped = { ...ghost, position: { ...ghost.position, y: ghost.position.y + 1 } };
    if (collides(dropped, grid)) break;
    ghost = dropped;
  }
  return ghost;
}

// ─── Merge Piece into Grid ────────────────────────────────────────────────────

export function mergePiece(piece: Piece, grid: Grid): Grid {
  const newGrid = grid.map(row => [...row]);
  const { matrix, position, type } = piece;

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;
      const gridY = position.y + row;
      const gridX = position.x + col;
      if (gridY >= 0 && gridY < BOARD_HEIGHT && gridX >= 0 && gridX < BOARD_WIDTH) {
        newGrid[gridY][gridX] = type;
      }
    }
  }
  return newGrid;
}

// ─── Line Clearing ────────────────────────────────────────────────────────────
// Scans every row; a full row has no null cells.
// Full rows are removed and new empty rows are prepended at the top.

export function clearLines(grid: Grid): { newGrid: Grid; linesCleared: number } {
  const fullRows: number[] = [];

  for (let row = 0; row < BOARD_HEIGHT; row++) {
    if (grid[row].every(cell => cell !== null)) {
      fullRows.push(row);
    }
  }

  if (fullRows.length === 0) return { newGrid: grid, linesCleared: 0 };

  const filtered = grid.filter((_, rowIdx) => !fullRows.includes(rowIdx));
  const emptyRows: Grid = Array.from({ length: fullRows.length }, () =>
    Array(BOARD_WIDTH).fill(null)
  );

  return {
    newGrid: [...emptyRows, ...filtered],
    linesCleared: fullRows.length,
  };
}

// ─── Create Empty Grid ────────────────────────────────────────────────────────

export function createEmptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

// ─── Hard Drop ────────────────────────────────────────────────────────────────

export function hardDrop(piece: Piece, grid: Grid): { piece: Piece; distance: number } {
  let dropped = { ...piece };
  let distance = 0;
  while (true) {
    const next = { ...dropped, position: { ...dropped.position, y: dropped.position.y + 1 } };
    if (collides(next, grid)) break;
    dropped = next;
    distance++;
  }
  return { piece: dropped, distance };
}

// ─── Move helpers ─────────────────────────────────────────────────────────────

export function movePiece(piece: Piece, dx: number, dy: number, grid: Grid): Piece {
  const moved: Piece = {
    ...piece,
    position: { x: piece.position.x + dx, y: piece.position.y + dy },
  };
  return collides(moved, grid) ? piece : moved;
}
