
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Trophy, 
  RotateCcw, 
  Lightbulb, 
  Pause, 
  Play, 
  Undo, 
  Eraser, 
  Pencil,
  AlertCircle,
  Loader2,
  ChevronRight,
  Zap,
  Coins
} from 'lucide-react';
import { Difficulty, Grid, GameState, AIHint } from './types';
import { generatePuzzle, getSolution } from './utils/sudokuLogic';
import { getAIHint } from './services/geminiService';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];

const App: React.FC = () => {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [totalScore, setTotalScore] = useState<number>(() => {
    const saved = localStorage.getItem('zen_sudoku_total_score');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [gameState, setGameState] = useState<GameState>({
    grid: [],
    difficulty: 'Easy',
    mistakes: 0,
    maxMistakes: 3,
    time: 0,
    score: 0,
    isPaused: false,
    isWon: false,
    history: [],
    selectedCell: null,
    pencilMode: false,
  });

  const [hint, setHint] = useState<AIHint | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Sync total score to localStorage
  useEffect(() => {
    localStorage.setItem('zen_sudoku_total_score', totalScore.toString());
  }, [totalScore]);

  const calculateScore = (time: number, difficulty: Difficulty, mistakes: number) => {
    const baseScores: Record<Difficulty, number> = {
      'Easy': 1000,
      'Medium': 2500,
      'Hard': 5000,
      'Expert': 10000
    };
    const timePenaltyFactor: Record<Difficulty, number> = {
      'Easy': 1,
      'Medium': 2,
      'Hard': 3,
      'Expert': 5
    };
    
    const base = baseScores[difficulty];
    const timePenalty = time * timePenaltyFactor[difficulty];
    const mistakePenalty = mistakes * 200;
    
    return Math.max(0, base - timePenalty - mistakePenalty);
  };

  // Timer logic
  useEffect(() => {
    if (view === 'game' && !gameState.isPaused && !gameState.isWon && gameState.mistakes < gameState.maxMistakes) {
      timerRef.current = window.setInterval(() => {
        setGameState(prev => ({ ...prev, time: prev.time + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [view, gameState.isPaused, gameState.isWon, gameState.mistakes]);

  const startNewGame = (difficulty: Difficulty) => {
    setGameState({
      grid: generatePuzzle(difficulty),
      difficulty,
      mistakes: 0,
      maxMistakes: 3,
      time: 0,
      score: 0,
      isPaused: false,
      isWon: false,
      history: [],
      selectedCell: null,
      pencilMode: false,
    });
    setHint(null);
    setView('game');
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameState.isPaused || gameState.isWon) return;
    setGameState(prev => ({ ...prev, selectedCell: { row, col } }));
  };

  const handleInput = useCallback((num: number | null) => {
    const { selectedCell, grid, pencilMode, mistakes, maxMistakes, history, difficulty, time } = gameState;
    if (!selectedCell || gameState.isPaused || gameState.isWon || mistakes >= maxMistakes) return;
    
    const { row, col } = selectedCell;
    const cell = grid[row][col];
    
    if (cell.fixed) return;

    const newGrid = grid.map(r => r.map(c => ({ ...c, notes: [...c.notes] })));
    
    if (pencilMode && num !== null) {
      const currentNotes = newGrid[row][col].notes;
      if (currentNotes.includes(num)) {
        newGrid[row][col].notes = currentNotes.filter(n => n !== num);
      } else {
        newGrid[row][col].notes = [...currentNotes, num].sort();
      }
      setGameState(prev => ({ ...prev, grid: newGrid }));
      return;
    }

    if (num === null) {
      newGrid[row][col].value = null;
      newGrid[row][col].notes = [];
      setGameState(prev => ({ ...prev, grid: newGrid }));
      return;
    }

    const solution = getSolution(grid);
    if (solution[row][col] === num) {
      newGrid[row][col].value = num;
      newGrid[row][col].notes = [];
      
      const isWon = newGrid.every(r => r.every(c => c.value !== null));
      let finalScore = 0;
      if (isWon) {
        finalScore = calculateScore(time, difficulty, mistakes);
        setTotalScore(prev => prev + finalScore);
      }

      setGameState(prev => ({ 
        ...prev, 
        grid: newGrid, 
        isWon,
        score: isWon ? finalScore : prev.score,
        history: [...history, grid]
      }));
    } else {
      setGameState(prev => ({ 
        ...prev, 
        mistakes: mistakes + 1
      }));
    }
  }, [gameState]);

  useEffect(() => {
    if (view !== 'game') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') handleInput(parseInt(e.key));
      if (e.key === 'Backspace' || e.key === 'Delete') handleInput(null);
      if (e.key === 'n' || e.key === 'N') setGameState(prev => ({ ...prev, pencilMode: !prev.pencilMode }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, handleInput]);

  const requestHint = async () => {
    if (isAiLoading || gameState.isPaused || gameState.isWon) return;
    setIsAiLoading(true);
    setHint(null);
    
    // Deduct 10 points for each hint accessed
    setTotalScore(prev => prev - 10);
    
    const aiHint = await getAIHint(gameState.grid, gameState.selectedCell);
    setIsAiLoading(false);
    if (aiHint) {
      setHint(aiHint);
      setGameState(prev => ({ ...prev, selectedCell: { row: aiHint.row, col: aiHint.col } }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const undo = () => {
    if (gameState.history.length === 0) return;
    const previousGrid = gameState.history[gameState.history.length - 1];
    setGameState(prev => ({
      ...prev,
      grid: previousGrid,
      history: prev.history.slice(0, -1)
    }));
  };

  const isGameOver = gameState.mistakes >= gameState.maxMistakes;

  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-4">
        {/* Top Right Score Display */}
        <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-5 py-2.5 rounded-2xl backdrop-blur-md shadow-lg shadow-indigo-900/10">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg">
            <Coins size={18} className="text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">Total Zen Points</span>
            <span className="text-xl font-black font-mono text-indigo-100">{totalScore.toLocaleString()}</span>
          </div>
        </div>

        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-extrabold bg-gradient-to-br from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              Zen Sudoku
            </h1>
            <p className="text-slate-400 text-sm font-medium tracking-wide">CHOOSE YOUR CHALLENGE</p>
          </div>

          <div className="space-y-4">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => startNewGame(d)}
                className="w-full group relative flex items-center justify-between p-6 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-2xl transition-all duration-300"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xl font-bold text-slate-100">{d}</span>
                </div>
                <ChevronRight className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-slate-800 flex items-center justify-center gap-4 text-slate-500 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><Zap size={14} className="text-yellow-500" /> Scoring On</div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
            <div className="flex items-center gap-1.5 text-indigo-400/80"><Lightbulb size={14} /> Hint (-10 pts)</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-xl flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <button 
            onClick={() => setView('menu')}
            className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 hover:text-indigo-300 transition-colors"
          >
            ← Back to Menu
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">Zen Sudoku</h1>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-tighter">
              {gameState.difficulty}
            </span>
          </div>
        </div>

        <div className="flex gap-6 items-center">
          <div className="flex flex-col items-end">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Time</div>
             <div className="text-lg font-mono text-slate-200">{formatTime(gameState.time)}</div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mistakes</div>
            <div className={`text-lg font-mono ${gameState.mistakes > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {gameState.mistakes}/{gameState.maxMistakes}
            </div>
          </div>
          <button 
            onClick={() => setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            {gameState.isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
          </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative w-full max-w-xl aspect-square bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
        <div className={`grid grid-cols-9 h-full transition-all duration-500 ${gameState.isPaused || isGameOver || gameState.isWon ? 'blur-xl grayscale opacity-30 pointer-events-none' : ''}`}>
          {gameState.grid.map((row, rowIndex) => (
            row.map((cell, colIndex) => {
              const isSelected = gameState.selectedCell?.row === rowIndex && gameState.selectedCell?.col === colIndex;
              const isSameSubgrid = gameState.selectedCell && 
                Math.floor(rowIndex / 3) === Math.floor(gameState.selectedCell.row / 3) &&
                Math.floor(colIndex / 3) === Math.floor(gameState.selectedCell.col / 3);
              const isSameLine = gameState.selectedCell?.row === rowIndex || gameState.selectedCell?.col === colIndex;
              const isHighlightValue = gameState.selectedCell && 
                gameState.grid[gameState.selectedCell.row][gameState.selectedCell.col].value === cell.value && 
                cell.value !== null;
              
              const borderClasses = `
                ${colIndex % 3 === 2 && colIndex !== 8 ? 'border-r-2 border-slate-700' : 'border-r border-slate-800'}
                ${rowIndex % 3 === 2 && rowIndex !== 8 ? 'border-b-2 border-slate-700' : 'border-b border-slate-800'}
              `;

              const bgClasses = `
                ${isSelected ? 'bg-indigo-600/40' : 
                  isHighlightValue ? 'bg-indigo-500/20' :
                  isSameLine ? 'bg-slate-800/40' : 
                  isSameSubgrid ? 'bg-slate-800/20' : 'bg-transparent'}
              `;

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${borderClasses} ${bgClasses} group`}
                >
                  {cell.value ? (
                    <span className={`text-xl md:text-2xl font-medium ${cell.fixed ? 'text-slate-300' : 'text-indigo-400 font-bold'}`}>
                      {cell.value}
                    </span>
                  ) : (
                    <div className="grid grid-cols-3 w-full h-full p-0.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <div key={n} className="flex items-center justify-center">
                          {cell.notes.includes(n) && (
                            <span className="text-[8px] md:text-[10px] text-slate-500 leading-none">
                              {n}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {hint && hint.row === rowIndex && hint.col === colIndex && (
                    <div className="absolute inset-0 border-2 border-emerald-500 animate-pulse pointer-events-none"></div>
                  )}
                </div>
              );
            })
          ))}
        </div>

        {/* Overlays */}
        {gameState.isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md z-10">
            <h2 className="text-4xl font-black mb-6 tracking-tighter">ZEN STATE</h2>
            <button 
              onClick={() => setGameState(prev => ({ ...prev, isPaused: false }))}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105 font-bold shadow-xl shadow-indigo-600/20"
            >
              <Play size={20} fill="currentColor" /> RESUME GAME
            </button>
          </div>
        )}

        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/60 backdrop-blur-md z-10 p-6 text-center">
            <div className="p-5 bg-rose-500/20 rounded-full mb-6">
              <AlertCircle size={48} className="text-rose-500" />
            </div>
            <h2 className="text-4xl font-black mb-2 tracking-tighter text-rose-100 uppercase">Mistakes Exhausted</h2>
            <p className="text-rose-200/60 mb-8 max-w-xs font-medium">Your focus wavered. Re-center and try again.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setView('menu')}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold"
              >
                MENU
              </button>
              <button 
                onClick={() => startNewGame(gameState.difficulty)}
                className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-2xl flex items-center gap-2 transition-all transform hover:scale-105 font-bold shadow-xl shadow-rose-600/20"
              >
                <RotateCcw size={20} /> RETRY
              </button>
            </div>
          </div>
        )}

        {gameState.isWon && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/60 backdrop-blur-md z-10 p-6 text-center">
            <div className="p-5 bg-emerald-500/20 rounded-full mb-6 animate-bounce">
              <Trophy size={48} className="text-emerald-500" />
            </div>
            <h2 className="text-4xl font-black mb-1 tracking-tighter text-emerald-100 uppercase">Sudoku Solved</h2>
            <div className="flex flex-col items-center gap-1 mb-8">
              <span className="text-emerald-400 text-6xl font-black font-mono tracking-tighter">
                {gameState.score.toLocaleString()}
              </span>
              <span className="text-emerald-200/40 text-xs font-black uppercase tracking-widest">Zen Points Earned</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                 <div className="text-[10px] text-emerald-300/50 font-bold uppercase">Accuracy</div>
                 <div className="text-emerald-100 font-mono">{gameState.maxMistakes - gameState.mistakes}/{gameState.maxMistakes}</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                 <div className="text-[10px] text-emerald-300/50 font-bold uppercase">Time</div>
                 <div className="text-emerald-100 font-mono">{formatTime(gameState.time)}</div>
              </div>
            </div>

            <button 
              onClick={() => setView('menu')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105 font-bold shadow-xl shadow-emerald-600/20"
            >
              <Play size={20} fill="currentColor" /> NEXT PUZZLE
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-xl mt-8">
        <div className="grid grid-cols-5 gap-2 mb-6">
          <ControlButton icon={<Undo size={20} />} label="Undo" onClick={undo} />
          <ControlButton icon={<Eraser size={20} />} label="Erase" onClick={() => handleInput(null)} />
          <ControlButton 
            icon={<Pencil size={20} />} 
            label="Notes" 
            active={gameState.pencilMode} 
            onClick={() => setGameState(prev => ({ ...prev, pencilMode: !prev.pencilMode }))} 
          />
          <ControlButton 
            icon={isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Lightbulb size={20} />} 
            label="Hint" 
            onClick={requestHint}
            disabled={isAiLoading}
          />
          <ControlButton icon={<RotateCcw size={20} />} label="Restart" onClick={() => startNewGame(gameState.difficulty)} />
        </div>

        {hint && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                <Lightbulb size={20} className="text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Logic Stream</h4>
                  <button onClick={() => setHint(null)} className="text-emerald-400/50 hover:text-emerald-400 transition-colors uppercase text-[10px] font-bold">Dismiss</button>
                </div>
                <p className="text-sm text-emerald-100/80 leading-relaxed font-medium">{hint.explanation}</p>
                <div className="mt-1 text-[10px] font-bold text-rose-400/60 uppercase">-10 Points deducted</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-9 gap-1.5 md:gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleInput(num)}
              className="aspect-square flex items-center justify-center text-xl md:text-3xl font-bold bg-slate-900 border border-slate-800 rounded-xl hover:bg-indigo-600 hover:text-white transition-all transform active:scale-90"
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

const ControlButton: React.FC<ControlButtonProps> = ({ icon, label, onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl transition-all ${
      active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-100 border border-slate-800/50'
    } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
  >
    {icon}
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;
