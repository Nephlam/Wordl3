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
  const [employeeId, setEmployeeId] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [employeeInput, setEmployeeInput] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<string>("");
  const [poppedCell, setPoppedCell] = useState<{ row: number; col: number } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [streak, setStreak] = useState(0);
  const [streakLoaded, setStreakLoaded] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // true when ID not found
  const [loginError, setLoginError] = useState("");

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

  // Change employee ID
  const changeEmployeeId = () => {
    localStorage.removeItem("wordl3_employee_id");
    setEmployeeId("");
    setLoggedIn(false);
    setEmployeeInput("");
    setSubmissionStatus("");
  };

  // Check localStorage for saved employee ID
  useEffect(() => {
    const savedId = localStorage.getItem("wordl3_employee_id");
    if (savedId) {
      setEmployeeId(savedId);
      setLoggedIn(true);
    }
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
    setAnimatingRow(null);
    setFlippingTiles([]);
    setWinningRow(null);
    setEntranceDone(false);
    setTimeout(() => setEntranceDone(true), 50);
  }, [puzzle]);

  // ─── STEP 2: Load saved game state when puzzle and login are both ready ───
  // Load saved game state when puzzle, loggedIn, or employeeId changes
useEffect(() => {
  if (!puzzle || !loggedIn || !employeeId) return;

  const len = puzzle.word.length;
  const emptyBoard = Array.from({ length: 5 }, () => Array(len).fill(""));

  // 1. Immediately reset to an empty board for the new user
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

  // 2. Try to load saved state for this employee + today
  async function loadSavedState() {
    const todayStr = new Date().toISOString().split("T")[0];
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
    }
  }
  
  loadSavedState();
  fetchStreak();
}, [puzzle, loggedIn, employeeId]);

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
  const processKey = useCallback(
    (key: string) => {
      if (gameOver || !puzzle) return;
      if (animatingRow !== null) return;
      if (/^[a-zA-Z0-9]$/.test(key) && currentCol < wordLength) {
        setBoard((prev) => {
          const newBoard = prev.map((row) => [...row]);
          newBoard[currentRow][currentCol] = key.toUpperCase();
          return newBoard;
        });
        // Trigger pop animation on this cell
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
    [gameOver, puzzle, currentCol, wordLength, currentRow, animatingRow]
  );

  // ─── STEP 1a: saveGameState (used by both auto-save and post-guess save) ───
  const saveGameState = useCallback(async () => {
    if (!employeeId || !puzzle) return;
    const today = new Date().toISOString().split("T")[0];

    const { error: upsertError } = await supabase
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

    if (upsertError && Object.keys(upsertError).length > 0) {
      console.error("Failed to save game state:", upsertError);
    }
  }, [
    employeeId,
    puzzle,
    board,
    cellStatuses,
    currentRow,
    currentCol,
    keyStatuses,
    gameOver,
    message,
    explanationText,
  ]);

  // ─── STEP 1b: Auto-save on every keystroke (debounced 800ms) ───
  useEffect(() => {
    if (!loggedIn || !puzzle || gameOver) return;
    const timer = setTimeout(() => {
      saveGameState();
    }, 800);
    return () => clearTimeout(timer);
  }, [board, currentCol, loggedIn, puzzle, gameOver, saveGameState]);

  // Submit result to leaderboard
  const submitToLeaderboard = useCallback(
    async (won: boolean, attemptsUsed: number | null) => {
      if (!employeeId || !puzzle) return;
      const today = new Date().toISOString().split("T")[0];

      const { error: insertError } = await supabase
        .from("leaderboard")
        .insert([
          {
            employee_id: employeeId,
            puzzle_date: today,
            attempts_used: attemptsUsed,
            won: won,
          },
        ]);

      if (insertError) {
        if (insertError.code === "23505") {
          setSubmissionStatus("Score already submitted for today!");
        } else {
          console.error("Leaderboard insert error:", insertError);
          setSubmissionStatus("Failed to submit score.");
        }
      } else {
        setSubmissionStatus("Score submitted! 📊");

        // ─── STEP 3: Clear saved game state after successful leaderboard submission ───
        await supabase
          .from("game_state")
          .delete()
          .eq("employee_id", employeeId)
          .eq("puzzle_date", today);
      }

      setTimeout(() => setSubmissionStatus(""), 4000);
    },
    [employeeId, puzzle]
  );

    const fetchStreak = useCallback(async () => {
    if (!employeeId) return;
    const today = new Date();
    let count = 0;
    // Check yesterday backwards until a day is missing or lost
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
    // If user won today, include today in streak
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


  const handleShare = useCallback(async () => {
    if (!puzzle) return;

    // Only include rows that have been evaluated
    const evaluatedRows: string[] = [];

    for (let r = 0; r < 5; r++) {
      const row = cellStatuses[r];
      // If row exists and has any non-empty status, consider it evaluated
      if (row && row.some(status => status !== "")) {
        const emojiRow = row
          .map(status => {
            if (status === "correct") return "🟩";
            if (status === "present") return "🟨";
            return "⬛"; // absent or empty (should be absent if evaluated)
          })
          .join("");
        evaluatedRows.push(emojiRow);
      }
    }

    const attemptsUsed = evaluatedRows.length;
    const won = message.includes("won");

    const shareText =
      `Wordl3 ${puzzle.date}\n` +
      `${won ? "✅" : "❌"} ${attemptsUsed}/5\n\n` +
      evaluatedRows.join("\n") +
      `\n\nhttps://wordl3-amber.vercel.app/`; // adjust to your actual URL

    try {
      await navigator.clipboard.writeText(shareText);
      setSubmissionStatus("Copied to clipboard! 📋");
      setTimeout(() => setSubmissionStatus(""), 2000);
    } catch {
      setSubmissionStatus("Failed to copy.");
      setTimeout(() => setSubmissionStatus(""), 2000);
    }
  }, [puzzle, cellStatuses, message]);

  // Handle Enter: update cellStatuses, then win/loss logic
  const handleEnter = useCallback(() => {
    if (!puzzle || currentCol !== wordLength) return;
    if (animatingRow !== null) return;

    const guess = board[currentRow].map((l) => l.toUpperCase());
    const solution = puzzle.word.toUpperCase();
    const newStatuses = evaluateGuess(guess, solution);

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

    const row = currentRow;
    const length = wordLength;

    setAnimatingRow(row);
    setFlippingTiles(new Array(length).fill(false));

    for (let i = 0; i < length; i++) {
      const tileIndex = i;
      const startDelay = tileIndex * 200;

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
          const animationFinishTime = 500;
          setTimeout(() => {
            setAnimatingRow(null);
            setFlippingTiles([]);

            const guessWord = guess.join("").toUpperCase();
            if (guessWord === solution) {
              setGameOver(true);
              setWinningRow(row);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
              setMessage("You won! 🎉");
              setExplanationText(puzzle.explanation);
              submitToLeaderboard(true, row + 1);
              fetchStreak();
              setShowShare(true);
            } else if (row === 4) {
              setGameOver(true);
              setMessage("You lost! The word was " + puzzle.word + ".");
              setExplanationText(puzzle.explanation);
              submitToLeaderboard(false, null);
              fetchStreak();
              setShowShare(true);
            } else {
              setCurrentRow((prev) => prev + 1);
              setCurrentCol(0);
            }
            saveGameState();
          }, animationFinishTime);
        }
      }, startDelay);
    }
  }, [
    puzzle,
    currentCol,
    wordLength,
    board,
    currentRow,
    evaluateGuess,
    animatingRow,
    submitToLeaderboard,
    saveGameState,
  ]);

  // Keyboard listener
  useEffect(() => {
    if (!loggedIn) return;
    const handler = (e: KeyboardEvent) => processKey(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [processKey, loggedIn]);

  // Compute tile size based on word length
  const getTileSize = () => {
    if (!puzzle) return "3.5rem";
    const len = puzzle.word.length;
    if (len <= 3) return "3.5rem";
    if (len <= 5) return "3rem";
    if (len <= 7) return "2.5rem";
    if (len <= 10) return "2rem";
    if (len <= 12) return "1.75rem";
    return "1.5rem";
  };

  // Helper for tile classes
  const getCellClasses = (row: number, col: number) => {
    const status = cellStatuses[row]?.[col] || "";
    const tileSize = getTileSize();
    let base = `w-[${tileSize}] h-[${tileSize}] border-2 flex items-center justify-center text-[clamp(0.75rem,4vw,1.5rem)] font-bold uppercase `;
    if (status === "correct") {
      base += "bg-correct border-correct text-white";
    } else if (status === "present") {
      base += "bg-present border-present text-white";
    } else if (status === "absent") {
      base += "bg-absent border-absent text-white";
    } else {
      base += "border-brand-mid bg-brand-dark text-brand-light";
    }
    return base;
  };

  // Helper for keyboard key classes
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
      base += "bg-brand-mid text-white active:bg-brand-light";
    }
    return base;
  };

  // Render
  if (loading) {
    return (
      <main className="min-h-screen bg-brand-dark text-brand-light flex items-center justify-center">
        <p className="text-2xl">Exploding puzzle...</p>
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
      {/* Employee ID login prompt */}
    {!loggedIn && (
      <main className="h-dvh bg-brand-dark text-brand-light flex items-center justify-center p-4 overflow-hidden">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoginError("");
            const trimmedId = employeeInput.trim();
            if (!trimmedId) return;

            // Check if user exists
            const { data: existingUser, error: fetchError } = await supabase
              .from("users")
              .select("employee_id")
              .eq("employee_id", trimmedId)
              .maybeSingle();

            if (fetchError) {
              setLoginError("Error checking account.");
              return;
            }

            if (!existingUser) {
              // New user → show sign-up (ask for password creation)
              setIsSignUp(true);
              return;
            }

            // Existing user → verify password
            const { data: user, error: loginErr } = await supabase
              .from("users")
              .select("password")
              .eq("employee_id", trimmedId)
              .single();

            if (loginErr || !user) {
              setLoginError("Account error.");
              return;
            }

            if (user.password !== passwordInput) {
              setLoginError("Incorrect password.");
              return;
            }

            // Success
            setEmployeeId(trimmedId);
            setLoggedIn(true);
            localStorage.setItem("wordl3_employee_id", trimmedId);
            setPasswordInput("");
          }}
          className="bg-brand-dark border border-brand-mid rounded-xl p-6 max-w-sm w-full shadow-2xl animate-fade-in-up"
        >
          <h1 className="text-2xl font-bold mb-2 text-brand-orange">Wordl3</h1>

          {!isSignUp ? (
            <>
              <p className="text-sm text-brand-light mb-4">
                Enter your Employee ID to play.
              </p>
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                placeholder="e.g., EMP001"
                required
                autoFocus
                className="w-full p-3 mb-3 bg-brand-dark border border-brand-mid rounded text-brand-light placeholder:text-brand-mid text-center text-lg tracking-wider"
              />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                required
                className="w-full p-3 mb-4 bg-brand-dark border border-brand-mid rounded text-brand-light placeholder:text-brand-mid text-center"
              />
              {loginError && (
                <p className="text-red-400 text-sm mb-2 text-center">{loginError}</p>
              )}
              <button
                type="submit"
                className="w-full bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold py-2 rounded transition-colors"
              >
                Log In
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-brand-light mb-2">
                New account for <span className="font-bold">{employeeInput.trim()}</span>
              </p>
              <p className="text-xs text-brand-mid mb-4">
                Create a password to register.
              </p>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Choose a password"
                required
                autoFocus
                className="w-full p-3 mb-4 bg-brand-dark border border-brand-mid rounded text-brand-light placeholder:text-brand-mid text-center"
              />
              {loginError && (
                <p className="text-red-400 text-sm mb-2 text-center">{loginError}</p>
              )}
              <button
                type="button"
                onClick={async () => {
                  const trimmedId = employeeInput.trim();
                  if (!passwordInput) return;
                  const { error: insertErr } = await supabase
                    .from("users")
                    .insert({ employee_id: trimmedId, password: passwordInput });
                  if (insertErr) {
                    setLoginError("Could not create account.");
                    return;
                  }
                  setEmployeeId(trimmedId);
                  setLoggedIn(true);
                  localStorage.setItem("wordl3_employee_id", trimmedId);
                  setPasswordInput("");
                  setIsSignUp(false);
                }}
                className="w-full bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold py-2 rounded transition-colors"
              >
                Create Account & Play
              </button>
            </>
          )}
        </form>
      </main>
    )}

      {/* Tutorial (if not seen and logged in) */}
      {loggedIn && showTutorial && <Tutorial onClose={closeTutorial} />}

      {/* Main game (only when logged in) */}
      {loggedIn && (
        <main
          className={`h-dvh bg-brand-dark text-brand-light flex flex-col items-center overflow-hidden ${
            entranceDone ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          {/* Change ID button in top right corner */}
         <div className="absolute top-2 right-2 left-2 flex items-center justify-end gap-1 sm:gap-2 text-xs sm:text-sm">
              <a
                href="/leaderboard"
                className="px-1.5 sm:px-2 py-1 bg-brand-orange hover:bg-brand-peach text-brand-dark rounded font-semibold transition-colors whitespace-nowrap"
              >
                🏆
              </a>
              <span className="text-brand-peach truncate max-w-[100px] sm:max-w-none">
                {employeeId}
                {streakLoaded && streak > 0 && (
                  <span className="ml-1">🔥{streak}</span>
                )}
              </span>
              <button
                onClick={changeEmployeeId}
                className="px-1.5 sm:px-2 py-1 bg-brand-mid hover:bg-brand-light text-brand-dark rounded transition-colors whitespace-nowrap"
              >
                ✎
              </button>
            </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full px-2 pt-4 overflow-y-auto">
            <h1 className="text-3xl font-bold mb-3">Wordl3</h1>
            <div className="mb-3 text-lg text-brand-peach italic text-center">
              Hint: {puzzle.hint}
            </div>

            {/* Board container with controlled width and overflow */}
            <div className="mb-4 w-full flex justify-center overflow-x-auto">
              <div className="grid gap-1 sm:gap-1.5">
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

            {message && (
              <div className="text-xl font-bold text-center mb-2 text-brand-orange">
                {message}
              </div>
            )}
            {explanationText && (
              <div className="text-base text-brand-light max-w-md text-center mb-3">
                {explanationText}
              </div>
            )}
            {showShare && (
              <button
                onClick={handleShare}
                className="mt-4 px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
              >
                📤 Share Result
              </button>
            )}
            {submissionStatus && (
              <div className="text-base font-semibold text-center mb-2 text-brand-peach">
                {submissionStatus}
              </div>
            )}
          </div>

          <div className="w-full max-w-lg pb-4 px-1 flex-shrink-0">
            {KEYBOARD_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center my-0.5 sm:my-1">
                {row.map((key) => {
                  const display =
                    key === "BACKSPACE" ? "←" : key === "ENTER" ? "↵" : key;
                  const isSpecial = key === "BACKSPACE" || key === "ENTER";
                  return (
                    <button
                      key={key}
                      onClick={() =>
                        processKey(
                          key === "BACKSPACE"
                            ? "Backspace"
                            : key === "ENTER"
                            ? "Enter"
                            : key
                        )
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
      )}

      {/* Confetti (only when logged in and game won) */}
      {loggedIn && showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: [
                  "#6AAA64",
                  "#F5C518",
                  "#FF8C00",
                  "#FFC089",
                  "#A7A9AC",
                  "#0D3B66",
                  "#FFFFFF",
                ][Math.floor(Math.random() * 7)],
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
    </>
  );
}
