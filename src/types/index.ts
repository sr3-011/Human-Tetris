// ─── Core Types ───────────────────────────────────────────────────────────────

export type TetrominoType = 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';

export type FakeCell = {
  value: 'fake';
  /** epoch ms */
  expires_at: number;
};

export type CellValue = TetrominoType | FakeCell | null;

export type Grid = CellValue[][];

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  type: TetrominoType;
  position: Position;
  rotation: number; // 0, 1, 2, 3
  matrix: number[][];
}

export interface GameState {
  grid: Grid;
  currentPiece: Piece | null;
  nextPiece: Piece | null;
  score: number;
  lines: number;
  level: number;
  isGameOver: boolean;
  isPaused: boolean;
}

export type GameAction =
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_DOWN' }
  | { type: 'ROTATE' }
  | { type: 'HARD_DROP' }
  | { type: 'TICK' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'SET_GAME_OVER'; winnerPlayerId?: string | null }
  | { type: 'APPLY_SHOT'; row: number; col: number }
  | { type: 'APPLY_FAKE_BLOCKS'; blocks: { row: number; col: number }[]; durationMs: number };

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const CELL_SIZE = 32;

export const COLORS: Record<TetrominoType, string> = {
  I: '#00F5FF',
  O: '#FFE600',
  T: '#BF00FF',
  L: '#FF8C00',
  J: '#0055FF',
  S: '#00FF88',
  Z: '#FF2D55',
};

export const GLOW: Record<TetrominoType, string> = {
  I: 'rgba(0, 245, 255, 0.6)',
  O: 'rgba(255, 230, 0, 0.6)',
  T: 'rgba(191, 0, 255, 0.6)',
  L: 'rgba(255, 140, 0, 0.6)',
  J: 'rgba(0, 85, 255, 0.6)',
  S: 'rgba(0, 255, 136, 0.6)',
  Z: 'rgba(255, 45, 85, 0.6)',
};

export const SCORE_TABLE: Record<number, number> = {
  0: 0,
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};
