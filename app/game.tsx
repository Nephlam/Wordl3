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

interface GameProps {
  puzzle: Puzzle;
  employeeId: string;
  displayName: string;
  changeEmployeeId: () => void;
}

export default function Game({ puzzle, employeeId, displayName, changeEmployeeId }: GameProps) {
  const [wordLength, setWordLength] = useState(puzzle.word.length);
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
  const [poppedCell, setPoppedCell] = useState<{ row: number; col: number } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string>("");
  const [streak, setStreak] = useState(0);
  const [streakLoaded, setStreakLoaded] = useState(false);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
    const [suggestionWord, setSuggestionWord] = useState("");
    const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState("");

const handleSuggestionSubmit = async () => {
  if (!suggestionWord.trim()) return;
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("suggestions")
    .insert({
      employee_id: employeeId,
      display_name: displayName || employeeId,
      suggested_word: suggestionWord.trim().toUpperCase(),
      puzzle_date: today,
    });
  if (error) {
    if (error.code === "23505") {
      setSuggestionStatus("You already suggested a word today!");
    } else {
      setSuggestionStatus("Failed to submit suggestion.");
    }
  } else {
    setSuggestionStatus("Suggestion submitted! 🎉");
    setSuggestionSubmitted(true);
    setShowSuggestionBox(false);
    setSuggestionWord("");
  }
  setTimeout(() => setSuggestionStatus(""), 4000);
};

useEffect(() => {
  if (!employeeId || !puzzle) return;
  const today = new Date().toISOString().split("T")[0];
  supabase
    .from("suggestions")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("puzzle_date", today)
    .maybeSingle()
    .then(({ data }) => {
      if (data) {
        setSuggestionSubmitted(true);
      }
    });
}, [employeeId, puzzle]);

  // Reset board when puzzle changes (or component mounts)
  useEffect(() => {
    const len = puzzle.word.length;
    setWordLength(len);
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
    setShowConfetti(false);
    setEntranceDone(false);
    setShowShare(false);
    setAlreadyCompleted(false);
    setSubmissionStatus("");
    setPoppedCell(null);
    setTimeout(() => setEntranceDone(true), 50);
  }, [puzzle]);

  const fetchStreak = useCallback(async () => {
    if (!employeeId) return;
    const today = new Date();
    let count = 0;
    for (let i = 1; i <= 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const { data } = await supabase
        .from("leaderboard")
        .select("won")
        .eq("employee_id", employeeId)
        .eq("puzzle_date", dateStr)
        .maybeSingle();
      if (data && data.won) {
        count++;
      } else {
        break;
      }
    }
    const todayStr = today.toISOString().split("T")[0];
    const { data: todayData } = await supabase
      .from("leaderboard")
      .select("won")
      .eq("employee_id", employeeId)
      .eq("puzzle_date", todayStr)
      .maybeSingle();
    if (todayData && todayData.won) {
      count++;
    }
    setStreak(count);
    setStreakLoaded(true);
  }, [employeeId]);

  // Load saved game state for this employee
  useEffect(() => {
    if (!puzzle || !employeeId) return;

    const len = puzzle.word.length;

    async function load() {
      const todayStr = new Date().toISOString().split("T")[0];

      // Check if already completed today
      const { data: existingResult } = await supabase
        .from("leaderboard")
        .select("won, attempts_used")
        .eq("employee_id", employeeId)
        .eq("puzzle_date", todayStr)
        .maybeSingle();

      if (existingResult) {
        // Already completed → load saved state WITHOUT clearing first
        setAlreadyCompleted(true);
        const { data: savedState } = await supabase
          .from("game_state")
          .select("*")
          .eq("employee_id", employeeId)
          .eq("puzzle_date", todayStr)
          .maybeSingle();
        if (savedState && savedState.board_state) {
          setBoard(savedState.board_state);
          setCellStatuses(savedState.cell_statuses);
          setKeyStatuses(savedState.key_statuses || {});
          setGameOver(true);
          setMessage(
            existingResult.won
              ? "You won! 🎉"
              : `You lost! The word was ${puzzle.word}.`
          );
          setExplanationText(puzzle.explanation);
        } else {
          setBoard(Array.from({ length: 5 }, () => Array(len).fill("")));
          setCellStatuses(Array.from({ length: 5 }, () => Array(len).fill("")));
          setMessage(
            existingResult.won
              ? "You won! 🎉"
              : `You lost! The word was ${puzzle.word}.`
          );
          setExplanationText(puzzle.explanation);
        }
        setShowShare(true);
        setGameOver(true);
        setAnimatingRow(null);
        setFlippingTiles([]);
        setWinningRow(null);
        setShowConfetti(false);
        setPoppedCell(null);
        fetchStreak();
        return;
      }

      // Not completed → reset to empty and load any partial saved state
      const emptyBoard = Array.from({ length: 5 }, () => Array(len).fill(""));
      setBoard(emptyBoard);
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
      setShowConfetti(false);
      setShowShare(false);
      setPoppedCell(null);
      setAlreadyCompleted(false);

      const { data: savedState } = await supabase
        .from("game_state")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("puzzle_date", todayStr)
        .maybeSingle();

      if (savedState && savedState.board_state) {
        setBoard(savedState.board_state);
        setCellStatuses(savedState.cell_statuses);
        setCurrentRow(savedState.current_row);
        setCurrentCol(savedState.current_col);
        setKeyStatuses(savedState.key_statuses || {});
        setGameOver(savedState.game_over);
        setMessage(savedState.message || "");
        setExplanationText(savedState.explanation || "");
        if (savedState.game_over) {
          setAlreadyCompleted(true);
          setShowShare(true);
        }
      }

      fetchStreak();
    }

    load();
  }, [puzzle, employeeId, fetchStreak]);

  // Evaluation logic
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

  const saveGameState = useCallback(async () => {
    if (!employeeId || !puzzle) return;
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("game_state")
      .upsert(
        {
          employee_id: employeeId,
          puzzle_date: today,
          board_state: board,
          cell_statuses: cellStatuses,
          current_row: currentRow,
          current_col: currentCol,
          key_statuses: keyStatuses,
          game_over: gameOver,
          message: message,
          explanation: explanationText,
          submitted: false,
        },
        { onConflict: "employee_id,puzzle_date" }
      );
  }, [employeeId, puzzle, board, cellStatuses, currentRow, currentCol, keyStatuses, gameOver, message, explanationText]);

  // Auto-save on keystroke
  useEffect(() => {
    if (!puzzle || gameOver) return;
    const timer = setTimeout(() => saveGameState(), 800);
    return () => clearTimeout(timer);
  }, [board, currentCol, puzzle, gameOver, saveGameState]);

  // Save final state when game ends
  useEffect(() => {
    if (gameOver) {
      saveGameState();
    }
  }, [gameOver, saveGameState]);

  const submitToLeaderboard = useCallback(
    async (won: boolean, attemptsUsed: number | null, displayName: string) => {
      if (!employeeId || !puzzle) return;
      const today = new Date().toISOString().split("T")[0];
      const { error: insertError } = await supabase
        .from("leaderboard")
        .insert([{ employee_id: employeeId, puzzle_date: today, attempts_used: attemptsUsed, won, display_name: displayName }]);
      if (insertError) {
        if (insertError.code === "23505") {
          setSubmissionStatus("Score already submitted for today!");
        } else {
          setSubmissionStatus("Failed to submit score.");
        }
      } else {
        setSubmissionStatus("Score submitted! 📊");
      }
      setTimeout(() => setSubmissionStatus(""), 4000);
    },
    [employeeId, puzzle]
  );

  const handleShare = useCallback(async () => {
    if (!puzzle) return;
    const evaluatedRows: string[] = [];
    for (let r = 0; r < 5; r++) {
      const row = cellStatuses[r];
      if (row && row.some(status => status !== "")) {
        evaluatedRows.push(row.map(s => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛")).join(""));
      }
    }
    const attemptsUsed = evaluatedRows.length;
    const won = message.includes("won");
    const shareText = `Wordl3 ${puzzle.date}\n${won ? "✅" : "❌"} ${attemptsUsed}/5\n\n${evaluatedRows.join("\n")}\n\nhttps://wordl3-amber.vercel.app/`;
    try {
      await navigator.clipboard.writeText(shareText);
      setSubmissionStatus("Copied to clipboard! 📋");
      setTimeout(() => setSubmissionStatus(""), 2000);
    } catch {
      setSubmissionStatus("Failed to copy.");
      setTimeout(() => setSubmissionStatus(""), 2000);
    }
  }, [puzzle, cellStatuses, message]);

  const handleEnter = useCallback(() => {
    if (!puzzle || currentCol !== wordLength || animatingRow !== null) return;

    const guess = board[currentRow].map((l) => l.toUpperCase());
    const solution = puzzle.word.toUpperCase();
    const newStatuses = evaluateGuess(guess, solution);

    setKeyStatuses((prev) => {
      const updated = { ...prev };
      guess.forEach((letter, i) => {
        const currentBest = updated[letter] || "";
        const newStatus = newStatuses[i];
        if (newStatus === "correct" || (newStatus === "present" && currentBest !== "correct") || (newStatus === "absent" && !currentBest)) {
          updated[letter] = newStatus;
        }
      });
      return updated;
    });

    const row = currentRow;
    const length = wordLength;
    setAnimatingRow(row);
    setFlippingTiles(new Array(length).fill(false));

    for (let i = 0; i < length; i++) {
      const tileIndex = i;
      setTimeout(() => {
        setFlippingTiles((prev) => {
          const updated = [...prev];
          if (updated.length === 0) return updated;
          updated[tileIndex] = true;
          return updated;
        });
        setTimeout(() => {
          setCellStatuses((prev) => {
            const updated = prev.map((r) => [...r]);
            updated[row][tileIndex] = newStatuses[tileIndex];
            return updated;
          });
        }, 250);
        if (tileIndex === length - 1) {
          setTimeout(() => {
            setAnimatingRow(null);
            setFlippingTiles([]);
            const guessWord = guess.join("").toUpperCase();
            if (guessWord === solution) {
              setGameOver(true);
              setAlreadyCompleted(true);
              setWinningRow(row);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
              setMessage("You won! 🎉");
              setExplanationText(puzzle.explanation);
              submitToLeaderboard(true, row + 1, displayName);
              fetchStreak();
              setShowShare(true);
            } else if (row === 4) {
              setGameOver(true);
              setAlreadyCompleted(true);
              setMessage("You lost! The word was " + puzzle.word + ".");
              setExplanationText(puzzle.explanation);
              submitToLeaderboard(false, null, displayName);
              fetchStreak();
              setShowShare(true);
            } else {
              setCurrentRow((prev) => prev + 1);
              setCurrentCol(0);
            }
          }, 500);
        }
      }, tileIndex * 200);
    }
  }, [puzzle, currentCol, wordLength, board, currentRow, evaluateGuess, animatingRow, submitToLeaderboard, fetchStreak, displayName]);

  const processKey = useCallback(
    (key: string) => {
      if (gameOver || !puzzle || alreadyCompleted || animatingRow !== null) return;
      if (/^[a-zA-Z0-9]$/.test(key) && currentCol < wordLength) {
        setBoard((prev) => {
          const newBoard = prev.map((row) => [...row]);
          newBoard[currentRow][currentCol] = key.toUpperCase();
          return newBoard;
        });
        setPoppedCell({ row: currentRow, col: currentCol });
        setTimeout(() => setPoppedCell(null), 150);
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
    },
    [gameOver, puzzle, alreadyCompleted, animatingRow, currentCol, wordLength, currentRow, handleEnter]
  );

  useEffect(() => {
    if (alreadyCompleted) return;
    const handler = (e: KeyboardEvent) => processKey(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [processKey, alreadyCompleted]);

  const getTileSize = () => {
    const len = puzzle.word.length;
    if (len <= 3) return "3.5rem";
    if (len <= 5) return "3rem";
    if (len <= 7) return "2.5rem";
    if (len <= 10) return "2rem";
    if (len <= 12) return "1.75rem";
    return "1.5rem";
  };

  const getCellClasses = (row: number, col: number) => {
    const status = cellStatuses[row]?.[col] || "";
    let base = `w-[${getTileSize()}] h-[${getTileSize()}] border-2 flex items-center justify-center text-[clamp(0.75rem,4vw,1.5rem)] font-bold uppercase `;
    if (status === "correct") base += "bg-correct border-correct text-white";
    else if (status === "present") base += "bg-present border-present text-white";
    else if (status === "absent") base += "bg-absent border-absent text-white";
    else base += "border-brand-mid bg-brand-dark text-brand-light";
    return base;
  };

  const getKeyClasses = (key: string) => {
    const status = keyStatuses[key] || "";
    let base = "h-10 sm:h-12 min-w-[2rem] sm:min-w-[2.8rem] rounded font-bold text-xs sm:text-sm mx-0.5 flex items-center justify-center select-none ";
    if (status === "correct") base += "bg-correct text-white";
    else if (status === "present") base += "bg-present text-white";
    else if (status === "absent") base += "bg-absent text-white";
    else base += "bg-brand-mid text-white active:bg-brand-light";
    return base;
  };

  return (
    <main className={`h-dvh bg-brand-dark text-brand-light flex flex-col items-center overflow-hidden ${entranceDone ? "animate-fade-in-up" : "opacity-0"}`}>
      {/* Top bar */}
      <div className="absolute top-2 right-2 left-2 flex items-center justify-end gap-1 sm:gap-2 text-xs sm:text-sm">
        <a href="/leaderboard" className="px-1.5 sm:px-2 py-1 bg-brand-orange hover:bg-brand-peach text-brand-dark rounded font-semibold transition-colors whitespace-nowrap">🏆</a>
        <span className="text-brand-peach truncate max-w-[100px] sm:max-w-none">
          {displayName || employeeId}
          {streakLoaded && streak > 0 && <span className="ml-1">🔥{streak}</span>}
        </span>
        <button onClick={changeEmployeeId} className="px-1.5 sm:px-2 py-1 bg-brand-mid hover:bg-brand-light text-brand-dark rounded transition-colors whitespace-nowrap">✎</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full px-2 pt-4 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-3">Wordl3</h1>
        {alreadyCompleted && <p className="text-sm text-brand-orange uppercase tracking-wider mb-1">✨ Admire Puzzle ✨</p>}
        <div className="mb-3 text-lg text-brand-peach italic text-center">Hint: {puzzle.hint}</div>

        <div className="mb-4 w-full flex justify-center overflow-x-auto">
          <div className="grid gap-1 sm:gap-1.5">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1 sm:gap-1.5">
                {row.map((cell, colIndex) => (
                  <div
                    key={colIndex}
                    className={
                      getCellClasses(rowIndex, colIndex) +
                      (animatingRow === rowIndex && flippingTiles[colIndex] ? " tile-flip" : "") +
                      (winningRow === rowIndex ? " tile-bounce" : "") +
                      (poppedCell?.row === rowIndex && poppedCell?.col === colIndex ? " tile-pop" : "")
                    }
                    style={{ width: getTileSize(), height: getTileSize() }}
                  >
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {message && <div className="text-xl font-bold text-center mb-2 text-brand-orange">{message}</div>}
        {explanationText && <div className="text-base text-brand-light max-w-md text-center mb-3">{explanationText}</div>}
        {showShare && (
          <button onClick={handleShare} className="mt-4 px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors">📤 Share Result</button>
        )}
        {submissionStatus && <div className="text-base font-semibold text-center mb-2 text-brand-peach">{submissionStatus}</div>}
      </div>

      {/* Community Suggestion Box – always visible when logged in */}
<div className="w-full flex justify-center px-2">
  <div className="w-full max-w-sm">
    {!showSuggestionBox && !suggestionSubmitted && (
      <button
        onClick={() => setShowSuggestionBox(true)}
        className="w-full px-4 py-3 sm:py-4 bg-gradient-to-r from-brand-mid to-brand-orange hover:from-brand-light hover:to-brand-peach text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-sm sm:text-base"
      >
        💡 Suggest a word for tomorrow
      </button>
    )}
    {showSuggestionBox && !suggestionSubmitted && (
      <div className="bg-brand-dark border-2 border-brand-orange rounded-lg p-4 sm:p-5 space-y-3 shadow-lg animate-fade-in-up">
        <p className="text-sm text-brand-light text-center font-semibold">💭 What word would you like to see?</p>
        <input
          type="text"
          value={suggestionWord}
          onChange={(e) => setSuggestionWord(e.target.value)}
          maxLength={15}
          placeholder="e.g., VALIDATION"
          autoFocus
          className="w-full p-3 bg-brand-dark border-2 border-brand-mid rounded-lg text-brand-light text-center uppercase font-bold tracking-wider focus:border-brand-orange focus:outline-none transition-colors"
        />
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSuggestionSubmit}
            className="flex-1 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold py-2 sm:py-3 rounded-lg transition-colors active:scale-95 text-sm sm:text-base"
          >
            ✨ Submit
          </button>
          <button
            onClick={() => {
              setShowSuggestionBox(false);
              setSuggestionWord("");
              setSuggestionStatus("");
            }}
            className="flex-1 bg-brand-mid hover:bg-brand-light text-white font-bold py-2 sm:py-3 rounded-lg transition-colors active:scale-95 text-sm sm:text-base"
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    )}
    {suggestionSubmitted && (
      <p className="text-sm text-center text-brand-peach font-semibold mt-3">✅ Thank you! Your suggestion has been recorded.</p>
    )}
    {suggestionStatus && (
      <p className="text-sm text-center text-brand-peach font-semibold mt-2">{suggestionStatus}</p>
    )}
  </div>
</div>

      {!alreadyCompleted && (
        <div className="w-full max-w-lg pb-4 px-1 flex-shrink-0">
          {KEYBOARD_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center my-0.5 sm:my-1">
              {row.map((key) => {
                const display = key === "BACKSPACE" ? "←" : key === "ENTER" ? "↵" : key;
                const isSpecial = key === "BACKSPACE" || key === "ENTER";
                return (
                  <button
                    key={key}
                    onClick={() => processKey(key === "BACKSPACE" ? "Backspace" : key === "ENTER" ? "Enter" : key)}
                    className={(isSpecial ? "min-w-[3rem] sm:min-w-[4.5rem] px-1 " : "") + getKeyClasses(key) + " transition-transform active:scale-90"}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ["#6AAA64", "#F5C518", "#FF8C00", "#FFC089", "#A7A9AC", "#0D3B66", "#FFFFFF"][Math.floor(Math.random() * 7)],
                animationDelay: `${Math.random() * 2.5}s`,
                animationDuration: `${2.5 + Math.random() * 3}s`,
                width: `${6 + Math.random() * 10}px`,
                height: `${6 + Math.random() * 10}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "0",
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}