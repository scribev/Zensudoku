
import { Difficulty, Grid, Cell } from '../types';

export const createEmptyGrid = (): Grid => {
  return Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => ({
      value: null,
      fixed: false,
      notes: [],
      row: r,
      col: c,
    }))
  );
};

export const isValid = (grid: number[][], row: number, col: number, num: number): boolean => {
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
  }
  for (let x = 0; x < 9; x++) {
    if (grid[x][col] === num) return false;
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
};

const solve = (grid: number[][]): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (solve(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
};

export const getSolution = (grid: Grid): number[][] => {
  const numericGrid = grid.map(row => row.map(cell => cell.value || 0));
  const sol = JSON.parse(JSON.stringify(numericGrid));
  solve(sol);
  return sol;
};

export const generatePuzzle = (difficulty: Difficulty): Grid => {
  const numericGrid: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  
  // Fill diagonal blocks
  const fillDiagonal = () => {
    for (let i = 0; i < 9; i += 3) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          let num;
          do {
            num = Math.floor(Math.random() * 9) + 1;
          } while (!isValid(numericGrid, i + r, i + c, num));
          numericGrid[i + r][i + c] = num;
        }
      }
    }
  };

  fillDiagonal();
  solve(numericGrid);

  // Remove elements based on difficulty
  const removals = {
    'Easy': 30,
    'Medium': 45,
    'Hard': 55,
    'Expert': 62
  };
  
  const puzzle = JSON.parse(JSON.stringify(numericGrid));
  let count = removals[difficulty];
  while (count > 0) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      count--;
    }
  }

  return puzzle.map((row: number[], r: number) =>
    row.map((val: number, c: number) => ({
      value: val === 0 ? null : val,
      fixed: val !== 0,
      notes: [],
      row: r,
      col: c,
    }))
  );
};
