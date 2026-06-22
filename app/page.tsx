"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Tutorial from "@/components/Tutorial";

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
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const [flippingTiles, setFlippingTiles] = useState<boolean[]>([]);
  const [winningRow, setWinningRow] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

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
  // Show tutorial only if not previously seen
    useEffect(() => {
        const seenTutorial = localStorage.getItem("wordl3_tutorial_seen");
        if (!seenTutorial) {
          setShowTutorial(true);
        }
      }, []);
      const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("wordl3_tutorial_seen", "true");
  };
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
    setAnimatingRow(null);
    setFlippingTiles([]);
    setWinningRow(null);
    setEntranceDone(false);
    setTimeout(() => setEntranceDone(true), 50);
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
    if (animatingRow !== null) return;   // animation in progress, ignore input
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
  }, [gameOver, puzzle, currentCol, wordLength, currentRow, animatingRow]);

  // Handle Enter: update cellStatuses, then win/loss logic
const handleEnter = useCallback(() => {
  if (!puzzle || currentCol !== wordLength) return;
  if (animatingRow !== null) return; // already animating – safety lock

  const guess = board[currentRow].map((l) => l.toUpperCase());
  const solution = puzzle.word.toUpperCase();
  const newStatuses = evaluateGuess(guess, solution);

  // Update keyboard colours immediately (they don't flip)
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

  // Begin flip animation
  const row = currentRow;
  const length = wordLength;

  setAnimatingRow(row);
  setFlippingTiles(new Array(length).fill(false));

  for (let i = 0; i < length; i++) {
    const tileIndex = i;
    const startDelay = tileIndex * 200; // stagger each tile

    setTimeout(() => {
      // Trigger the flip class
      setFlippingTiles((prev) => {
        const updated = [...prev];
        if (updated.length === 0) return updated;
        updated[tileIndex] = true;
        return updated;
      });

      // Halfway through the flip (250ms), reveal colour
      setTimeout(() => {
        setCellStatuses((prev) => {
          const updated = prev.map((r) => [...r]);
          updated[row][tileIndex] = newStatuses[tileIndex];
          return updated;
        });
      }, 250);

      // If this is the last tile, schedule cleanup and win/loss after its animation finishes
      if (tileIndex === length - 1) {
      const animationFinishTime = 500; // animation duration
      setTimeout(() => {
        setAnimatingRow(null);
        setFlippingTiles([]);

        const guessWord = guess.join("").toUpperCase();
        if (guessWord === solution) {
          setGameOver(true);
          setWinningRow(row);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000); // auto-hide after 3 seconds
          setMessage("You won! 🎉");
          setExplanationText(puzzle.explanation);
        } else if (row === 4) {
          setGameOver(true);
          setMessage("You lost! The word was " + puzzle.word + ".");
          setExplanationText(puzzle.explanation);
        } else {
          setCurrentRow((prev) => prev + 1);
          setCurrentCol(0);
        }
      }, animationFinishTime); // wait just for the last tile's flip to finish
    } // wait longer than animation (500ms) to avoid visual glitch
      
    }, startDelay);
  }
}, [puzzle, currentCol, wordLength, board, currentRow, evaluateGuess, animatingRow]);

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
  if (status === "correct") {
    base += "bg-correct border-correct text-white";
  } else if (status === "present") {
    base += "bg-present border-present text-white";
  } else if (status === "absent") {
    base += "bg-absent border-absent text-white";
  } else {
    // Empty / not yet evaluated — use brand colours
    base += "border-brand-mid bg-brand-dark text-brand-light";
  }
  return base;
};

  // Helper for keyboard key classes (resized for mobile)
  const getKeyClasses = (key: string) => {
  const status = keyStatuses[key] || "";
  let base =
    "h-10 sm:h-12 min-w-[2rem] sm:min-w-[2.8rem] rounded font-bold text-xs sm:text-sm mx-0.5 flex items-center justify-center select-none ";
  if (status === "correct") {
    base += "bg-correct text-white";
  } else if (status === "present") {
    base += "bg-present text-white";
  } else if (status === "absent") {
    base += "bg-absent text-white";
  } else {
    // Unpressed / default — use brand mid-grey with dark text
    base += "bg-brand-mid text-white active:bg-brand-light";
  }
  return base;
};

  // Render
  if (loading) {
    return (
      <main className="min-h-screen bg-brand-dark text-brand-light flex items-center justify-center">
        <p className="text-2xl">Loading puzzle...</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="min-h-screen bg-brand-dark text-brand-light flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">Wordl3</h1>
        <p className="text-red-400 text-lg">{error}</p>
      </main>
    );
  }
  if (!puzzle) return null;

  return (
    <>
    {showTutorial && <Tutorial onClose={closeTutorial} />}
    <main className={`min-h-dvh bg-brand-dark text-brand-light flex flex-col items-center ${entranceDone ? 'animate-fade-in-up' : 'opacity-0'}`}>
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-2 pt-4">
        <h1 className="text-3xl font-bold mb-3">Wordl3</h1>
        <div className="mb-3 text-lg text-brand-peach italic text-center">
          {puzzle.hint}
        </div>
      

        <div className="grid gap-1 sm:gap-1.5 mb-4">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1 sm:gap-1.5">
              {row.map((cell, colIndex) => (
                <div
  key={colIndex}
  className={
    getCellClasses(rowIndex, colIndex) +
    (animatingRow === rowIndex && flippingTiles[colIndex]
      ? " tile-flip"
      : "") +
    (winningRow === rowIndex ? " tile-bounce" : "")
  }
>
  {cell}
</div>
              ))}
            </div>
          ))}
        </div>

        {message && <div className="text-xl font-bold text-center mb-2 text-brand-orange">{message}</div>}
        {explanationText && (
          <div className="text-base text-brand-light max-w-md text-center mb-3">
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
                  getKeyClasses(key) +
                  " transition-transform active:scale-90"
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
{showConfetti && (
  <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
    {Array.from({ length: 60 }).map((_, i) => (
      <div
        key={i}
        className="confetti-piece"
        style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: [
            '#6AAA64',
            '#F5C518',
            '#FF8C00',
            '#FFC089',
            '#A7A9AC',
            '#0D3B66',
            '#FFFFFF',
          ][Math.floor(Math.random() * 7)],
          animationDelay: `${Math.random() * 2.5}s`,
          animationDuration: `${2.5 + Math.random() * 3}s`,
          width: `${6 + Math.random() * 10}px`,
          height: `${6 + Math.random() * 10}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '0',
        }}
      />
    ))}
  </div>
)}
</>
  );
}