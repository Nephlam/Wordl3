"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type CellStatus = "" | "correct" | "present" | "absent";

const KEYBOARD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

interface Puzzle {
  word: string;
  hint: string;
  explanation: string;
  date: string;
}

export default function Home() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [wordLength, setWordLength] = useState(5);
  const [board, setBoard] = useState<string[][]>([]);
  const [cellStatuses, setCellStatuses] = useState<CellStatus[][]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, CellStatus>>({});
  const [message, setMessage] = useState("");
  const [explanationText, setExplanationText] = useState("");

  // Fetch puzzle
  useEffect(() => {
    async function fetchPuzzle() {
      setLoading(true);
      setError("");
      const today = new Date().toISOString().split("T")[0];
      const { data, error: fetchError } = await supabase
        .from("puzzles")
        .select("*")
        .eq("publish_date", today)
        .single();

      if (fetchError) {
        setError("No puzzle found for today. Check back later!");
        setLoading(false);
        return;
      }

      setPuzzle({
        word: data.word,
        hint: data.hint,
        explanation: data.explanation,
        date: data.publish_date,
      });
      setWordLength(data.word.length);
      setLoading(false);
    }
    fetchPuzzle();
  }, []);

  // Reset board when puzzle changes
  useEffect(() => {
    if (!puzzle) return;
    const len = puzzle.word.length;
    setBoard(Array.from({ length: 5 }, () => Array(len).fill("")));
    setCellStatuses(Array.from({ length: 5 }, () => Array(len).fill("")));
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
    setKeyStatuses({});
    setMessage("");
    setExplanationText("");
  }, [puzzle]);

  // Evaluation logic (unchanged)
  const evaluateGuess = (guess: string[], solution: string): CellStatus[] => {
    const statuses: CellStatus[] = Array(guess.length).fill("");
    const solutionLetters = solution.split("");
    const guessLetters = [...guess];

    for (let i = 0; i < guess.length; i++) {
      if (guessLetters[i] === solutionLetters[i]) {
        statuses[i] = "correct";
        solutionLetters[i] = "";
        guessLetters[i] = "";
      }
    }
    for (let i = 0; i < guess.length; i++) {
      if (guessLetters[i] === "") continue;
      const idx = solutionLetters.indexOf(guessLetters[i]);
      if (idx !== -1) {
        statuses[i] = "present";
        solutionLetters[idx] = "";
      } else {
        statuses[i] = "absent";
      }
    }
    return statuses;
  };

  // Key processing
  const processKey = useCallback((key: string) => {
    if (gameOver || !puzzle) return;
    if (/^[a-zA-Z0-9]$/.test(key) && currentCol < wordLength) {
      setBoard((prev) => {
        const newBoard = prev.map((row) => [...row]);
        newBoard[currentRow][currentCol] = key.toUpperCase();
        return newBoard;
      });
      setCurrentCol((prev) => prev + 1);
    } else if (key === "Backspace" && currentCol > 0) {
      setBoard((prev) => {
        const newBoard = prev.map((row) => [...row]);
        newBoard[currentRow][currentCol - 1] = "";
        return newBoard;
      });
      setCurrentCol((prev) => prev - 1);
    } else if (key === "Enter") {
      handleEnter();
    }
  }, [gameOver, puzzle, currentCol, wordLength, currentRow]);

  // Handle Enter: update cellStatuses, then win/loss logic
  const handleEnter = useCallback(() => {
    if (!puzzle || currentCol !== wordLength) return;

    const guess = board[currentRow].map((l) => l.toUpperCase());
    const solution = puzzle.word.toUpperCase();
    const newStatuses = evaluateGuess(guess, solution);

    // Update cell statuses (functional update ensures latest state)
    setCellStatuses((prev) => {
      const updated = prev.map((row) => [...row]);
      updated[currentRow] = newStatuses;
      return updated;
    });

    // Update keyboard colors
    setKeyStatuses((prev) => {
      const updated = { ...prev };
      guess.forEach((letter, i) => {
        const currentBest = updated[letter] || "";
        const newStatus = newStatuses[i];
        if (
          newStatus === "correct" ||
          (newStatus === "present" && currentBest !== "correct") ||
          (newStatus === "absent" && !currentBest)
        ) {
          updated[letter] = newStatus;
        }
      });
      return updated;
    });

    // Set game over flags AFTER statuses update
    // (use timeout to allow re-render with colors first)
    setTimeout(() => {
      if (guess.join("") === solution) {
        setGameOver(true);
        setMessage("You won! 🎉");
        setExplanationText(puzzle.explanation);
      } else if (currentRow === 4) {
        setGameOver(true);
        setMessage("You lost! The word was " + puzzle.word + ".");
        setExplanationText(puzzle.explanation);
      } else {
        setCurrentRow((prev) => prev + 1);
        setCurrentCol(0);
      }
    }, 0);
  }, [puzzle, currentCol, wordLength, board, currentRow, evaluateGuess]);

  // Keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => processKey(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [processKey]); // processKey is memoized with its deps

  // Helper for tile classes
  const getCellClasses = (row: number, col: number) => {
    const status = cellStatuses[row]?.[col] || "";
    let base =
      "w-[clamp(2rem,8vw,3.5rem)] h-[clamp(2rem,8vw,3.5rem)] border-2 flex items-center justify-center text-[clamp(1rem,5vw,1.5rem)] font-bold uppercase ";
    if (status === "correct") base += "bg-green-600 border-green-600 text-white";
    else if (status === "present") base += "bg-yellow-500 border-yellow-500 text-white";
    else if (status === "absent") base += "bg-gray-700 border-gray-500 text-white";
    else base += "border-gray-600 bg-gray-800";
    return base;
  };

  // Helper for keyboard key classes (resized for mobile)
  const getKeyClasses = (key: string) => {
    const status = keyStatuses[key] || "";
    let base =
      "h-10 sm:h-12 min-w-[2rem] sm:min-w-[2.8rem] rounded font-bold text-xs sm:text-sm mx-0.5 flex items-center justify-center select-none ";
    if (status === "correct") base += "bg-green-600 text-white";
    else if (status === "present") base += "bg-yellow-500 text-white";
    else if (status === "absent") base += "bg-gray-700 text-white";
    else base += "bg-gray-600 text-white active:bg-gray-500";
    return base;
  };

  // Render
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-2xl">Loading puzzle...</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">MESdle</h1>
        <p className="text-red-400 text-lg">{error}</p>
      </main>
    );
  }
  if (!puzzle) return null;

  return (
    <main className="min-h-dvh bg-gray-900 text-white flex flex-col items-center">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-2 pt-4">
        <h1 className="text-3xl font-bold mb-3">MESdle</h1>
        <div className="mb-3 text-lg text-gray-300 italic text-center">
          {puzzle.hint}
        </div>

        <div className="grid gap-1 sm:gap-1.5 mb-4">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1 sm:gap-1.5">
              {row.map((cell, colIndex) => (
                <div key={colIndex} className={getCellClasses(rowIndex, colIndex)}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>

        {message && <div className="text-xl font-bold text-center mb-2">{message}</div>}
        {explanationText && (
          <div className="text-base text-gray-300 max-w-md text-center mb-3">
            {explanationText}
          </div>
        )}
      </div>

      <div className="w-full max-w-lg pb-4 px-1 mt-2">
        {KEYBOARD_ROWS.map((row, i) => (
          <div key={i} className="flex justify-center my-0.5 sm:my-1">
            {row.map((key) => {
              const display = key === "BACKSPACE" ? "←" : key === "ENTER" ? "↵" : key;
              const isSpecial = key === "BACKSPACE" || key === "ENTER";
              return (
                <button
                  key={key}
                  onClick={() =>
                    processKey(key === "BACKSPACE" ? "Backspace" : key === "ENTER" ? "Enter" : key)
                  }
                  className={
                    (isSpecial ? "min-w-[3rem] sm:min-w-[4.5rem] px-1 " : "") +
                    getKeyClasses(key)
                  }
                >
                  {display}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}