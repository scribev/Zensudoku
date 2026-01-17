
import { GoogleGenAI, Type } from "@google/genai";
import { Grid, AIHint } from "../types";

export const getAIHint = async (grid: Grid, selectedCell: { row: number, col: number } | null): Promise<AIHint | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const numericGrid = grid.map(row => row.map(cell => cell.value || 0));
  const prompt = `
    I am playing Sudoku. Here is the current state of my 9x9 board (0 represents an empty cell):
    ${JSON.stringify(numericGrid)}
    
    The user is currently focused on cell at Row ${selectedCell?.row ?? 'unknown'}, Column ${selectedCell?.col ?? 'unknown'}.
    Please analyze the board and find a logical next move. 
    If the selected cell is solvable, explain why. If not, pick another empty cell that can be solved logically.
    Use Sudoku terminology like "Hidden Single", "Naked Pair", "Pointing Pairs", or "X-Wing" if applicable.
    Provide a clear, brief explanation of the logic.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            row: { type: Type.INTEGER },
            col: { type: Type.INTEGER },
            value: { type: Type.INTEGER },
          },
          required: ["explanation", "row", "col", "value"],
        }
      }
    });

    const hintData = JSON.parse(response.text);
    return hintData as AIHint;
  } catch (error) {
    console.error("Failed to get AI hint:", error);
    return null;
  }
};
