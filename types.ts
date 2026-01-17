
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface Cell {
  value: number | null;
  fixed: boolean;
  notes: number[];
  row: number;
  col: number;
}

export type Grid = Cell[][];

export interface GameState {
  grid: Grid;
  difficulty: Difficulty;
  mistakes: number;
  maxMistakes: number;
  time: number;
  score: number;
  isPaused: boolean;
  isWon: boolean;
  history: Grid[];
  selectedCell: { row: number; col: number } | null;
  pencilMode: boolean;
}

export interface AIHint {
  explanation: string;
  row: number;
  col: number;
  value: number;
}
