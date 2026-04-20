import {
  GameState,
  GameAction,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  SCORE_TABLE,
} from '../types';
import {
  createEmptyGrid,
  randomPiece,
  collides,
  rotatePiece,
  mergePiece,
  clearLines,
  hardDrop,
  movePiece,
} from './Piece';

// ─── Initial State ────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  const grid = createEmptyGrid();
  const currentPiece = randomPiece();
  const nextPiece = randomPiece();
  return {
    grid,
    currentPiece,
    nextPiece,
    score: 0,
    lines: 0,
    level: 1,
    isGameOver: false,
    isPaused: false,
  };
}

// ─── Level & Speed ────────────────────────────────────────────────────────────

export function getDropInterval(level: number): number {
  // Milliseconds between automatic drops
  return Math.max(100, 800 - (level - 1) * 70);
}

// ─── Spawn New Piece ──────────────────────────────────────────────────────────

function spawnNext(state: GameState): GameState {
  const newCurrent = state.nextPiece!;
  const newNext = randomPiece();

  // Check game over: new piece immediately collides
  if (collides(newCurrent, state.grid)) {
    return { ...state, currentPiece: newCurrent, isGameOver: true };
  }

  return {
    ...state,
    currentPiece: newCurrent,
    nextPiece: newNext,
  };
}

// ─── Lock Piece & Clear Lines ─────────────────────────────────────────────────

function lockPiece(state: GameState): GameState {
  if (!state.currentPiece) return state;

  const merged = mergePiece(state.currentPiece, state.grid);
  const { newGrid, linesCleared } = clearLines(merged);

  const lineScore = SCORE_TABLE[linesCleared] ?? 0;
  const bonus = linesCleared * 50 * state.level; // level multiplier bonus
  const newScore = state.score + lineScore * state.level + bonus;
  const newLines = state.lines + linesCleared;
  const newLevel = Math.floor(newLines / 10) + 1;

  const next: GameState = {
    ...state,
    grid: newGrid,
    score: newScore,
    lines: newLines,
    level: newLevel,
    currentPiece: null,
  };

  return spawnNext(next);
}

function pruneExpiredFakes(grid: GameState['grid'], nowMs: number) {
  let changed = false;
  const next = grid.map(row => row.slice());
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const cell = next[r][c];
      if (cell && typeof cell === 'object' && (cell as any).value === 'fake') {
        const exp = (cell as any).expires_at as number;
        if (typeof exp === 'number' && exp <= nowMs) {
          next[r][c] = null;
          changed = true;
        }
      }
    }
  }
  return changed ? next : grid;
}

function applyShotToGrid(grid: GameState['grid'], row: number, col: number) {
  if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) return grid;
  const next = grid.map(r => r.slice());
  if (next[row][col] !== null) {
    next[row][col] = null;
    return next;
  }
  for (let r = row + 1; r < BOARD_HEIGHT; r++) {
    if (next[r][col] !== null) {
      next[r][col] = null;
      return next;
    }
  }
  return grid;
}

function applyFakeBlocksToGrid(
  grid: GameState['grid'],
  blocks: { row: number; col: number }[],
  durationMs: number,
  nowMs: number
) {
  if (blocks.length === 0) return grid;
  const expires_at = nowMs + Math.max(0, durationMs);
  const next = grid.map(r => r.slice());
  let changed = false;

  for (const b of blocks) {
    const col = b.col;
    let row = b.row;
    if (col < 0 || col >= BOARD_WIDTH) continue;
    if (row < 0) row = 0;
    if (row >= BOARD_HEIGHT) row = BOARD_HEIGHT - 1;

    // Place fake block on first empty cell at/above requested row (never overwrite real blocks)
    for (let r = row; r >= 0; r--) {
      if (next[r][col] === null) {
        next[r][col] = { value: 'fake', expires_at } as any;
        changed = true;
        break;
      }
    }
  }

  return changed ? next : grid;
}

// ─── Main Reducer ─────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.isGameOver && action.type !== 'RESET' && action.type !== 'SET_GAME_OVER') return state;
  if (state.isPaused && action.type !== 'RESUME' && action.type !== 'RESET') return state;

  const nowMs = Date.now();
  const prunedGrid = pruneExpiredFakes(state.grid, nowMs);
  const baseState = prunedGrid === state.grid ? state : { ...state, grid: prunedGrid };

  switch (action.type) {
    case 'MOVE_LEFT': {
      if (!baseState.currentPiece) return baseState;
      return {
        ...baseState,
        currentPiece: movePiece(baseState.currentPiece, -1, 0, baseState.grid),
      };
    }

    case 'MOVE_RIGHT': {
      if (!baseState.currentPiece) return baseState;
      return {
        ...baseState,
        currentPiece: movePiece(baseState.currentPiece, 1, 0, baseState.grid),
      };
    }

    case 'MOVE_DOWN': {
      if (!baseState.currentPiece) return baseState;
      const moved = movePiece(baseState.currentPiece, 0, 1, baseState.grid);
      // If it didn't move (collision), lock it
      if (moved === baseState.currentPiece) {
        return lockPiece(baseState);
      }
      return { ...baseState, currentPiece: moved, score: baseState.score + 1 };
    }

    case 'ROTATE': {
      if (!baseState.currentPiece) return baseState;
      return {
        ...baseState,
        currentPiece: rotatePiece(baseState.currentPiece, baseState.grid),
      };
    }

    case 'HARD_DROP': {
      if (!baseState.currentPiece) return baseState;
      const { piece, distance } = hardDrop(baseState.currentPiece, baseState.grid);
      const dropped = { ...baseState, currentPiece: piece, score: baseState.score + distance * 2 };
      return lockPiece(dropped);
    }

    case 'TICK': {
      // Natural gravity tick — same as MOVE_DOWN but without score
      if (!baseState.currentPiece) return baseState;
      const moved = movePiece(baseState.currentPiece, 0, 1, baseState.grid);
      if (moved === baseState.currentPiece) {
        return lockPiece(baseState);
      }
      return { ...baseState, currentPiece: moved };
    }

    case 'PAUSE': {
      return { ...baseState, isPaused: true };
    }

    case 'RESUME': {
      return { ...baseState, isPaused: false };
    }

    case 'RESET': {
      return createInitialState();
    }

    case 'SET_GAME_OVER': {
      return {
        ...state,
        isGameOver: true,
        currentPiece: null,
      };
    }

    case 'APPLY_SHOT': {
      const nextGrid = applyShotToGrid(baseState.grid, action.row, action.col);
      return nextGrid === baseState.grid ? baseState : { ...baseState, grid: nextGrid };
    }

    case 'APPLY_FAKE_BLOCKS': {
      const nextGrid = applyFakeBlocksToGrid(baseState.grid, action.blocks, action.durationMs, nowMs);
      return nextGrid === baseState.grid ? baseState : { ...baseState, grid: nextGrid };
    }

    default:
      return baseState;
  }
}
