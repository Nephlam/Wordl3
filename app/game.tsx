"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

// Bonus game state shape stored in localStorage
interface BonusGameState {
  bonusPuzzle: Puzzle;
  board: string[][];
  cellStatuses: CellStatus[][];
  currentRow: number;
  currentCol: number;
  bonusGameOver: boolean;
  bonusMessage: string;
  keyStatuses: Record<string, CellStatus>;
  bonusAttemptsLeft: number;
  bonusRibbons: number;
  bonusSessionActive: boolean;
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

  // Bonus round states
  const [bonusRibbons, setBonusRibbons] = useState(0);
  const [bonusAttemptsLeft, setBonusAttemptsLeft] = useState(5);
  const [bonusPuzzle, setBonusPuzzle] = useState<Puzzle | null>(null);
  const [bonusUsedIds, setBonusUsedIds] = useState<number[]>([]);
  const [bonusGameOver, setBonusGameOver] = useState(false);
  const [bonusMessage, setBonusMessage] = useState("");
  const inBonusRound = bonusPuzzle !== null;

  // Suggestion box states
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [suggestionWord, setSuggestionWord] = useState("");
  const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState("");

  const entranceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dailyCellStatusesRef = useRef<CellStatus[][]>([]);
  const dailyMessageRef = useRef<string>("");
  const [hasUnfinishedBonus, setHasUnfinishedBonus] = useState(false);
  const savedBonusStateRef = useRef<BonusGameState | null>(null);

  // Pre‑generate confetti pieces to keep render pure
  const confettiPieces = useMemo(() => {
    if (!showConfetti) return [];
    return Array.from({ length: 60 }, () => ({
      left: Math.random() * 100 + "%",
      backgroundColor: [
        "#6AAA64",
        "#F5C518",
        "#FF8C00",
        "#FFC089",
        "#A7A9AC",
        "#0D3B66",
        "#FFFFFF",
      ][Math.floor(Math.random() * 7)],
      animationDelay: Math.random() * 2.5 + "s",
      animationDuration: 2.5 + Math.random() * 3 + "s",
      width: 6 + Math.random() * 10 + "px",
      height: 6 + Math.random() * 10 + "px",
      borderRadius: Math.random() > 0.5 ? "50%" : "0",
    }));
  }, [showConfetti]);

  // ─── Helper functions ───

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

  const loadNextBonusWord = useCallback(async () => {
    if (bonusAttemptsLeft <= 0) return;
    setHasUnfinishedBonus(false);
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("bonus_words").select("*");
    if (!data || data.length === 0) return;
    const available = data.filter((w) => !bonusUsedIds.includes(w.id));
    if (available.length === 0) return;
    const randomWord = available[Math.floor(Math.random() * available.length)];
    const newBonusPuzzle = {
      word: randomWord.word,
      hint: randomWord.hint,
      explanation: randomWord.explanation,
      date: today,
    };
    setBonusPuzzle(newBonusPuzzle);
    localStorage.setItem(`bonus_puzzle_${employeeId}_${today}`, JSON.stringify(newBonusPuzzle));
    const newUsedIds = [...bonusUsedIds, randomWord.id];
    setBonusUsedIds(newUsedIds);
    localStorage.setItem(`bonus_used_${employeeId}_${today}`, JSON.stringify(newUsedIds));
    const len = randomWord.word.length;
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
    setAlreadyCompleted(false);
    setShowShare(false);
    setBonusGameOver(false);
    setBonusMessage("");
  }, [bonusAttemptsLeft, bonusUsedIds, employeeId, supabase]);

  const resumeBonusRound = useCallback(() => {
    const saved = savedBonusStateRef.current;
    if (!saved) return;
    setBonusPuzzle(saved.bonusPuzzle);
    setWordLength(saved.bonusPuzzle.word.length); // <-- fix: set wordLength for bonus word
    setBoard(saved.board);
    setCellStatuses(saved.cellStatuses);
    setCurrentRow(saved.currentRow);
    setCurrentCol(saved.currentCol);
    setBonusGameOver(saved.bonusGameOver);
    setBonusMessage(saved.bonusMessage);
    setKeyStatuses(saved.keyStatuses || {});
    setBonusAttemptsLeft(saved.bonusAttemptsLeft ?? bonusAttemptsLeft);
    setBonusRibbons(saved.bonusRibbons ?? bonusRibbons);
    setGameOver(false);
    setAlreadyCompleted(false);
    setHasUnfinishedBonus(false);
  }, [bonusAttemptsLeft, bonusRibbons]);

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
        if (data) setSuggestionSubmitted(true);
      });
  }, [employeeId, puzzle]);

  // Reset board when the daily puzzle changes (or component mounts)
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
    entranceTimerRef.current = setTimeout(() => setEntranceDone(true), 50);
    return () => {
      if (entranceTimerRef.current) clearTimeout(entranceTimerRef.current);
    };
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
    let ignore = false; // cleanup flag

    async function load() {
      const todayStr = new Date().toISOString().split("T")[0];
      setHasUnfinishedBonus(false);

      // Prevent entrance animation from revealing the page before we've loaded saved state
      if (entranceTimerRef.current) clearTimeout(entranceTimerRef.current);
      if (!ignore) setEntranceDone(false);

      // Check if already completed today
      const { data: existingResult } = await supabase
        .from("leaderboard")
        .select("won, attempts_used")
        .eq("employee_id", employeeId)
        .eq("puzzle_date", todayStr)
        .maybeSingle();

      if (existingResult) {
        if (ignore) return;
        setAlreadyCompleted(true);
        const { data: savedState } = await supabase
          .from("game_state")
          .select("*")
          .eq("employee_id", employeeId)
          .eq("puzzle_date", todayStr)
          .maybeSingle();

        let finalBoard: string[][];
        let finalStatuses: CellStatus[][];
        let finalMessage: string;

        if (savedState && savedState.board_state) {
          finalBoard = savedState.board_state;
          finalStatuses = savedState.cell_statuses;
          finalMessage = existingResult.won
            ? "You won! 🎉"
            : `You lost! The word was ${puzzle.word}.`;
          setBoard(finalBoard);
          setCellStatuses(finalStatuses);
          setKeyStatuses(savedState.key_statuses || {});
        } else {
          finalBoard = Array.from({ length: 5 }, () => Array(len).fill(""));
          finalStatuses = Array.from({ length: 5 }, () => Array(len).fill(""));
          finalMessage = existingResult.won
            ? "You won! 🎉"
            : `You lost! The word was ${puzzle.word}.`;
          setBoard(finalBoard);
          setCellStatuses(finalStatuses);
        }
        setGameOver(true);
        setMessage(finalMessage);
        setExplanationText(puzzle.explanation);
        setShowShare(true);
        setAnimatingRow(null);
        setFlippingTiles([]);
        setWinningRow(null);
        setShowConfetti(false);
        setPoppedCell(null);

        // Populate daily result refs for sharing later
        dailyCellStatusesRef.current = finalStatuses;
        dailyMessageRef.current = finalMessage;

        // Check for unfinished bonus round
        const storedBonusGameState = localStorage.getItem(
          `bonus_game_state_${employeeId}_${todayStr}`
        );
        if (storedBonusGameState) {
          try {
            const parsed: BonusGameState = JSON.parse(storedBonusGameState);
            if (parsed && parsed.bonusSessionActive) {
              if (!ignore) {
                setHasUnfinishedBonus(true);
                savedBonusStateRef.current = parsed;
                setBonusRibbons(parsed.bonusRibbons ?? 0);
                setBonusAttemptsLeft(parsed.bonusAttemptsLeft ?? 5);
              }
            }
          } catch {
            // invalid data, ignore
          }
        }

        fetchStreak();
        if (!ignore) entranceTimerRef.current = setTimeout(() => setEntranceDone(true), 50);
        return;
      }

      // Not completed → reset to empty and load any partial saved state
      if (ignore) return;
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
        if (!ignore) {
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
      }

      // Bonus progress
      const { data: bonusData } = await supabase
        .from("bonus_leaderboard")
        .select("ribbons")
        .eq("employee_id", employeeId)
        .eq("puzzle_date", todayStr)
        .maybeSingle();
      if (bonusData && !ignore) {
        setBonusRibbons(bonusData.ribbons);
        setBonusAttemptsLeft(5 - bonusData.ribbons);
      }

      const storedUsedIds = localStorage.getItem(`bonus_used_${employeeId}_${todayStr}`);
      if (storedUsedIds && !ignore) {
        setBonusUsedIds(JSON.parse(storedUsedIds));
      }

      const storedBonusPuzzle = localStorage.getItem(`bonus_puzzle_${employeeId}_${todayStr}`);
      if (storedBonusPuzzle && !ignore) {
        try {
          const parsedPuzzle = JSON.parse(storedBonusPuzzle);
          setBonusPuzzle(parsedPuzzle);
        } catch {
          // ignore
        }
      }

      const storedBonusGameState = localStorage.getItem(`bonus_game_state_${employeeId}_${todayStr}`);
      if (storedBonusGameState && !ignore) {
        try {
          const gameState: BonusGameState = JSON.parse(storedBonusGameState);
          setBonusPuzzle(gameState.bonusPuzzle);
          setBoard(gameState.board);
          setCellStatuses(gameState.cellStatuses);
          setCurrentRow(gameState.currentRow);
          setCurrentCol(gameState.currentCol);
          setBonusGameOver(gameState.bonusGameOver);
          setBonusMessage(gameState.bonusMessage);
          setKeyStatuses(gameState.keyStatuses || {});
          setGameOver(true);
          setAlreadyCompleted(true);
        } catch {
          // ignore
        }
      }

      fetchStreak();
      if (!ignore) entranceTimerRef.current = setTimeout(() => setEntranceDone(true), 50);
    }

    load();

    return () => {
      ignore = true;
    };
  }, [puzzle, employeeId, fetchStreak]);

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

  const forceSaveGameState = async (
    finalBoard: string[][],
    finalCellStatuses: CellStatus[][],
    finalMessage: string,
    finalExplanation: string
  ) => {
    if (!employeeId || !puzzle) return;
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("game_state").upsert(
      {
        employee_id: employeeId,
        puzzle_date: today,
        board_state: finalBoard,
        cell_statuses: finalCellStatuses,
        current_row: currentRow,
        current_col: currentCol,
        key_statuses: keyStatuses,
        game_over: true,
        message: finalMessage,
        explanation: finalExplanation,
        submitted: false,
      },
      { onConflict: "employee_id,puzzle_date" }
    );
  };

  // Save bonus game state whenever it changes
  useEffect(() => {
    if (!bonusPuzzle) return;
    const today = new Date().toISOString().split("T")[0];
    const bonusGameState: BonusGameState = {
      bonusPuzzle,
      board,
      cellStatuses,
      currentRow,
      currentCol,
      bonusGameOver,
      bonusMessage,
      keyStatuses,
      bonusAttemptsLeft,
      bonusRibbons,
      bonusSessionActive: bonusAttemptsLeft > 0,
    };
    localStorage.setItem(
      `bonus_game_state_${employeeId}_${today}`,
      JSON.stringify(bonusGameState)
    );
  }, [bonusPuzzle, board, cellStatuses, currentRow, currentCol, bonusGameOver, bonusMessage, keyStatuses, bonusAttemptsLeft, bonusRibbons, employeeId]);

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

  const updateRibbons = async (newRibbons: number) => {
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("bonus_leaderboard")
      .upsert(
        {
          employee_id: employeeId,
          display_name: displayName || employeeId,
          puzzle_date: today,
          ribbons: newRibbons,
        },
        { onConflict: "employee_id,puzzle_date" }
      );
  };

  const handleEnter = useCallback(() => {
    const activePuzzle = bonusPuzzle ? bonusPuzzle : puzzle;
    if (!activePuzzle || currentCol !== activePuzzle.word.length || animatingRow !== null) return;

    const guess = board[currentRow].map((l) => l.toUpperCase());
    const solution = activePuzzle.word.toUpperCase();
    const newStatuses = evaluateGuess(guess, solution);

    const predictedFinalStatuses = cellStatuses.map((row) => [...row]);
    predictedFinalStatuses[currentRow] = newStatuses;

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
    const length = activePuzzle.word.length;
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

            if (inBonusRound) {
              if (guessWord === solution) {
                const newRibbons = bonusRibbons + 1;
                setBonusRibbons(newRibbons);
                updateRibbons(newRibbons);
                setBonusMessage("Ribbon earned! 🎀");
                setExplanationText(activePuzzle.explanation);
                setBonusGameOver(true);
                setBonusAttemptsLeft((prev) => prev - 1);
                setGameOver(true);
                setAlreadyCompleted(true);
                setHasUnfinishedBonus(false);
              } else if (row === 4) {
                setBonusMessage("Not quite! The word was " + activePuzzle.word);
                setExplanationText(activePuzzle.explanation);
                setBonusGameOver(true);
                setBonusAttemptsLeft((prev) => prev - 1);
                setGameOver(true);
                setAlreadyCompleted(true);
                setHasUnfinishedBonus(false);
              } else {
                setCurrentRow((prev) => prev + 1);
                setCurrentCol(0);
              }
            } else {
              // Daily game handling
              const finalMessage = guessWord === solution
                ? "You won! 🎉"
                : (row === 4 ? `You lost! The word was ${puzzle.word}.` : "");
              const finalExplanation = puzzle.explanation;

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
                forceSaveGameState(
                  board.map((r) => [...r]),
                  predictedFinalStatuses,
                  "You won! 🎉",
                  puzzle.explanation
                );
                dailyCellStatusesRef.current = predictedFinalStatuses;
                dailyMessageRef.current = "You won! 🎉";
              } else if (row === 4) {
                setGameOver(true);
                setAlreadyCompleted(true);
                setMessage("You lost! The word was " + puzzle.word + ".");
                setExplanationText(puzzle.explanation);
                submitToLeaderboard(false, null, displayName);
                fetchStreak();
                setShowShare(true);
                forceSaveGameState(
                  board.map((r) => [...r]),
                  predictedFinalStatuses,
                  `You lost! The word was ${puzzle.word}.`,
                  puzzle.explanation
                );
                dailyCellStatusesRef.current = predictedFinalStatuses;
                dailyMessageRef.current = `You lost! The word was ${puzzle.word}.`;
              } else {
                setCurrentRow((prev) => prev + 1);
                setCurrentCol(0);
              }
            }
          }, 500);
        }
      }, tileIndex * 200);
    }
  }, [
    puzzle,
    bonusPuzzle,
    inBonusRound,
    currentCol,
    board,
    currentRow,
    evaluateGuess,
    animatingRow,
    submitToLeaderboard,
    fetchStreak,
    displayName,
    bonusRibbons,
    updateRibbons,
    cellStatuses,
    keyStatuses,
  ]);

  const processKey = useCallback(
    (key: string) => {
      if (gameOver || !(bonusPuzzle ? bonusPuzzle : puzzle) || (alreadyCompleted && !bonusPuzzle) || animatingRow !== null || (bonusPuzzle && bonusGameOver)) return;
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
    [gameOver, puzzle, alreadyCompleted, animatingRow, currentCol, wordLength, currentRow, handleEnter, bonusPuzzle, bonusGameOver]
  );

  useEffect(() => {
    if (alreadyCompleted && !bonusPuzzle) return;
    const handler = (e: KeyboardEvent) => processKey(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [processKey, alreadyCompleted, bonusPuzzle]);

  const currentPuzzle = bonusPuzzle ? bonusPuzzle : puzzle;

  const getTileSize = () => {
    const len = currentPuzzle.word.length;
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
          {bonusRibbons > 0 && <span className="ml-1">🎀{bonusRibbons}</span>}
        </span>
        <button onClick={changeEmployeeId} className="px-1.5 sm:px-2 py-1 bg-brand-mid hover:bg-brand-light text-brand-dark rounded transition-colors whitespace-nowrap">✎</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full px-2 pt-4 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-3">Wordl3</h1>
        {alreadyCompleted && !inBonusRound && <p className="text-sm text-brand-orange uppercase tracking-wider mb-1">✨ Admire Puzzle ✨</p>}
        {inBonusRound && <p className="text-sm text-brand-orange uppercase tracking-wider mb-1">🎁 Bonus Round</p>}

        <div className="mb-3 text-lg text-brand-peach italic text-center">Hint: {currentPuzzle.hint}</div>

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

        {/* Messages */}
        {message && !inBonusRound && <div className="text-xl font-bold text-center mb-2 text-brand-orange">{message}</div>}
        {explanationText && !inBonusRound && <div className="text-base text-brand-light max-w-md text-center mb-3">{explanationText}</div>}

        {/* Bonus round messages */}
        {inBonusRound && bonusMessage && <div className="text-xl font-bold text-center mb-2 text-brand-orange">{bonusMessage}</div>}
        {inBonusRound && (
          <button
            onClick={async () => {
              const evaluatedRows: string[] = [];
              const statuses = dailyCellStatusesRef.current;
              for (let r = 0; r < statuses.length; r++) {
                const row = statuses[r];
                if (row && row.some((s) => s !== "")) {
                  evaluatedRows.push(
                    row
                      .map((s) =>
                        s === "correct"
                          ? "🟩"
                          : s === "present"
                          ? "🟨"
                          : "⬛"
                      )
                      .join("")
                  );
                }
              }
              const attemptsUsed = evaluatedRows.length;
              const won = dailyMessageRef.current.includes("won");
              const shareText =
                `Wordl3 ${puzzle.date}\n${won ? "✅" : "❌"} ${attemptsUsed}/5\n\n${evaluatedRows.join("\n")}\n\nhttps://wordl3-amber.vercel.app/`;
              try {
                await navigator.clipboard.writeText(shareText);
                setSubmissionStatus("Daily result copied! 📋");
                setTimeout(() => setSubmissionStatus(""), 2000);
              } catch {
                setSubmissionStatus("Failed to copy.");
                setTimeout(() => setSubmissionStatus(""), 2000);
              }
            }}
            className="mt-2 px-4 py-2 bg-brand-mid hover:bg-brand-light text-white font-semibold rounded transition-colors text-sm"
          >
            📤 Share Daily Result
          </button>
        )}
        {inBonusRound && bonusGameOver && explanationText && <div className="text-base text-brand-light max-w-md text-center mb-3">{explanationText}</div>}

        {/* Daily share button (hide during bonus) */}
        {showShare && !inBonusRound && (
          <button onClick={handleShare} className="mt-4 px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors">📤 Share Result</button>
        )}
        {submissionStatus && <div className="text-base font-semibold text-center mb-2 text-brand-peach">{submissionStatus}</div>}

        {/* Next bonus word button */}
        {inBonusRound && bonusGameOver && bonusAttemptsLeft > 0 && (
          <button
            onClick={() => {
              setBonusGameOver(false);
              loadNextBonusWord();
            }}
            className="mt-4 px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
          >
            ➡️ Next Bonus Word ({bonusAttemptsLeft} left)
          </button>
        )}

        {/* Bonus round complete */}
        {inBonusRound && bonusAttemptsLeft === 0 && (
          <div className="mt-4 text-center">
            <p className="text-xl font-bold text-brand-orange mb-2">Bonus round complete! 🎉</p>
            <p className="text-brand-peach">You earned 🎀 {bonusRibbons} ribbon{bonusRibbons > 1 ? "s" : ""}!</p>
            <button
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
                localStorage.removeItem(`bonus_puzzle_${employeeId}_${today}`);
                localStorage.removeItem(`bonus_game_state_${employeeId}_${today}`);
                window.location.reload();
              }}
              className="mt-4 px-6 py-2 bg-brand-mid hover:bg-brand-light text-white font-bold rounded transition-colors"
            >
              ← Back to daily puzzle
            </button>
          </div>
        )}

        {/* Bonus Round entry button (after daily game over) */}
        {gameOver && !inBonusRound && bonusAttemptsLeft > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {hasUnfinishedBonus ? (
              <button
                onClick={resumeBonusRound}
                className="px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
              >
                ▶️ Resume Bonus Round
              </button>
            ) : (
              <button
                onClick={() => {
                  loadNextBonusWord();
                }}
                className="px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
              >
                🎁 Bonus Round ({bonusAttemptsLeft} left)
              </button>
            )}
            {bonusRibbons > 0 && (
              <span className="text-brand-peach text-sm">
                🎀 {bonusRibbons} ribbon{bonusRibbons > 1 ? "s" : ""} earned today
              </span>
            )}
          </div>
        )}
      </div>

      {/* Suggestion box */}
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

      {/* Keyboard */}
      {!alreadyCompleted && !(inBonusRound && bonusGameOver) && (
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

      {/* Confetti (pure render) */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiPieces.map((piece, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={piece}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// "use client";

// import { useState, useEffect, useCallback, useRef } from "react";
// import { supabase } from "@/lib/supabase";

// type CellStatus = "" | "correct" | "present" | "absent";

// const KEYBOARD_ROWS = [
//   ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
//   ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
//   ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
//   ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
// ];

// interface Puzzle {
//   word: string;
//   hint: string;
//   explanation: string;
//   date: string;
// }

// interface GameProps {
//   puzzle: Puzzle;
//   employeeId: string;
//   displayName: string;
//   changeEmployeeId: () => void;
// }

// export default function Game({ puzzle, employeeId, displayName, changeEmployeeId }: GameProps) {
//   const [wordLength, setWordLength] = useState(puzzle.word.length);
//   const [board, setBoard] = useState<string[][]>([]);
//   const [cellStatuses, setCellStatuses] = useState<CellStatus[][]>([]);
//   const [currentRow, setCurrentRow] = useState(0);
//   const [currentCol, setCurrentCol] = useState(0);
//   const [gameOver, setGameOver] = useState(false);
//   const [keyStatuses, setKeyStatuses] = useState<Record<string, CellStatus>>({});
//   const [message, setMessage] = useState("");
//   const [explanationText, setExplanationText] = useState("");
//   const [animatingRow, setAnimatingRow] = useState<number | null>(null);
//   const [flippingTiles, setFlippingTiles] = useState<boolean[]>([]);
//   const [winningRow, setWinningRow] = useState<number | null>(null);
//   const [showConfetti, setShowConfetti] = useState(false);
//   const [entranceDone, setEntranceDone] = useState(false);
//   const [poppedCell, setPoppedCell] = useState<{ row: number; col: number } | null>(null);
//   const [showShare, setShowShare] = useState(false);
//   const [alreadyCompleted, setAlreadyCompleted] = useState(false);
//   const [submissionStatus, setSubmissionStatus] = useState<string>("");
//   const [streak, setStreak] = useState(0);
//   const [streakLoaded, setStreakLoaded] = useState(false);

//   // Bonus round states
//   const [bonusRibbons, setBonusRibbons] = useState(0);
//   const [bonusAttemptsLeft, setBonusAttemptsLeft] = useState(5);
//   const [bonusPuzzle, setBonusPuzzle] = useState<Puzzle | null>(null);
//   const [bonusUsedIds, setBonusUsedIds] = useState<number[]>([]);
//   const [bonusGameOver, setBonusGameOver] = useState(false);
//   const [bonusMessage, setBonusMessage] = useState("");
//   const inBonusRound = bonusPuzzle !== null;

//   // Suggestion box states (unchanged)
//   const [showSuggestionBox, setShowSuggestionBox] = useState(false);
//   const [suggestionWord, setSuggestionWord] = useState("");
//   const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);
//   const [suggestionStatus, setSuggestionStatus] = useState("");

//   const entranceTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const dailyCellStatusesRef = useRef<CellStatus[][]>([]);
//   const dailyMessageRef = useRef<string>("");
//   const [hasUnfinishedBonus, setHasUnfinishedBonus] = useState(false);
//   const savedBonusStateRef = useRef<any>(null);
//   // ─── Helper functions ───

//   const handleSuggestionSubmit = async () => {
//     if (!suggestionWord.trim()) return;
//     const today = new Date().toISOString().split("T")[0];
//     const { error } = await supabase
//       .from("suggestions")
//       .insert({
//         employee_id: employeeId,
//         display_name: displayName || employeeId,
//         suggested_word: suggestionWord.trim().toUpperCase(),
//         puzzle_date: today,
//       });
//     if (error) {
//       if (error.code === "23505") {
//         setSuggestionStatus("You already suggested a word today!");
//       } else {
//         setSuggestionStatus("Failed to submit suggestion.");
//       }
//     } else {
//       setSuggestionStatus("Suggestion submitted! 🎉");
//       setSuggestionSubmitted(true);
//       setShowSuggestionBox(false);
//       setSuggestionWord("");
//     }
//     setTimeout(() => setSuggestionStatus(""), 4000);
//   };

//   const loadNextBonusWord = useCallback(async () => {
//     if (bonusAttemptsLeft <= 0) return;
//     setHasUnfinishedBonus(false);
//     const today = new Date().toISOString().split("T")[0];
//     const { data } = await supabase.from("bonus_words").select("*");
//     if (!data || data.length === 0) return;
//     const available = data.filter((w) => !bonusUsedIds.includes(w.id));
//     if (available.length === 0) return;
//     const randomWord = available[Math.floor(Math.random() * available.length)];
//     const newBonusPuzzle = {
//       word: randomWord.word,
//       hint: randomWord.hint,
//       explanation: randomWord.explanation,
//       date: today,
//     };
//     setBonusPuzzle(newBonusPuzzle);
//     // Persist bonus puzzle to localStorage for refresh resilience
//     localStorage.setItem(`bonus_puzzle_${employeeId}_${today}`, JSON.stringify(newBonusPuzzle));
//     const newUsedIds = [...bonusUsedIds, randomWord.id];
//     setBonusUsedIds(newUsedIds);
//     localStorage.setItem(`bonus_used_${employeeId}_${today}`, JSON.stringify(newUsedIds));
//     // Reset board for new bonus word
//     const len = randomWord.word.length;
//     setWordLength(len);
//     setBoard(Array.from({ length: 5 }, () => Array(len).fill("")));
//     setCellStatuses(Array.from({ length: 5 }, () => Array(len).fill("")));
//     setCurrentRow(0);
//     setCurrentCol(0);
//     setGameOver(false);
//     setKeyStatuses({});
//     setMessage("");
//     setExplanationText("");
//     setAnimatingRow(null);
//     setFlippingTiles([]);
//     setWinningRow(null);
//     setShowConfetti(false);
//     // REMOVED: setEntranceDone(false); -- prevent blank page
//     setAlreadyCompleted(false);
//     setShowShare(false);
//     setBonusGameOver(false);
//     setBonusMessage("");
//   }, [bonusAttemptsLeft, bonusUsedIds, employeeId, supabase]);

//   const resumeBonusRound = useCallback(() => {
//     const saved = savedBonusStateRef.current;
//     if (!saved) return;
//     setBonusPuzzle(saved.bonusPuzzle);
//     setWordLength(saved.bonusPuzzle.word.length);
//     setBoard(saved.board);
//     setCellStatuses(saved.cellStatuses);
//     setCurrentRow(saved.currentRow);
//     setCurrentCol(saved.currentCol);
//     setBonusGameOver(saved.bonusGameOver);
//     setBonusMessage(saved.bonusMessage);
//     setKeyStatuses(saved.keyStatuses || {});
//     setBonusAttemptsLeft(saved.bonusAttemptsLeft ?? bonusAttemptsLeft);
//     setBonusRibbons(saved.bonusRibbons ?? bonusRibbons);
//     setGameOver(false);
//     setAlreadyCompleted(false);
//     setHasUnfinishedBonus(false);
//   }, [bonusAttemptsLeft, bonusRibbons]);

//   useEffect(() => {
//     if (!employeeId || !puzzle) return;
//     const today = new Date().toISOString().split("T")[0];
//     supabase
//       .from("suggestions")
//       .select("id")
//       .eq("employee_id", employeeId)
//       .eq("puzzle_date", today)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (data) setSuggestionSubmitted(true);
//       });
//   }, [employeeId, puzzle]);

//   // Reset board when the daily puzzle changes (or component mounts)
//   useEffect(() => {
//     const len = puzzle.word.length;
//     setWordLength(len);
//     setBoard(Array.from({ length: 5 }, () => Array(len).fill("")));
//     setCellStatuses(Array.from({ length: 5 }, () => Array(len).fill("")));
//     setCurrentRow(0);
//     setCurrentCol(0);
//     setGameOver(false);
//     setKeyStatuses({});
//     setMessage("");
//     setExplanationText("");
//     setAnimatingRow(null);
//     setFlippingTiles([]);
//     setWinningRow(null);
//     setShowConfetti(false);
//     setEntranceDone(false);
//     setShowShare(false);
//     setAlreadyCompleted(false);
//     setSubmissionStatus("");
//     setPoppedCell(null);
//     entranceTimerRef.current = setTimeout(() => setEntranceDone(true), 50);
//     return () => {
//       if (entranceTimerRef.current) clearTimeout(entranceTimerRef.current);
//       };
//   }, [puzzle]);

//   const fetchStreak = useCallback(async () => {
//     if (!employeeId) return;
//     const today = new Date();
//     let count = 0;
//     for (let i = 1; i <= 365; i++) {
//       const checkDate = new Date(today);
//       checkDate.setDate(checkDate.getDate() - i);
//       const dateStr = checkDate.toISOString().split("T")[0];
//       const { data } = await supabase
//         .from("leaderboard")
//         .select("won")
//         .eq("employee_id", employeeId)
//         .eq("puzzle_date", dateStr)
//         .maybeSingle();
//       if (data && data.won) {
//         count++;
//       } else {
//         break;
//       }
//     }
//     const todayStr = today.toISOString().split("T")[0];
//     const { data: todayData } = await supabase
//       .from("leaderboard")
//       .select("won")
//       .eq("employee_id", employeeId)
//       .eq("puzzle_date", todayStr)
//       .maybeSingle();
//     if (todayData && todayData.won) {
//       count++;
//     }
//     setStreak(count);
//     setStreakLoaded(true);
//   }, [employeeId]);

//   // Load saved game state for this employee
//   useEffect(() => {
//     if (!puzzle || !employeeId) return;

//     const len = puzzle.word.length;

//     async function load() {
//       const todayStr = new Date().toISOString().split("T")[0];
//     setHasUnfinishedBonus(false);

//       // Check if already completed today
//       const { data: existingResult } = await supabase
//         .from("leaderboard")
//         .select("won, attempts_used")
//         .eq("employee_id", employeeId)
//         .eq("puzzle_date", todayStr)
//         .maybeSingle();
      
//       // Prevent entrance animation from revealing the page before we've loaded saved state
//       if (entranceTimerRef.current) clearTimeout(entranceTimerRef.current);
//       setEntranceDone(false);
      
//       if (existingResult) {
//         setAlreadyCompleted(true);
//         const { data: savedState } = await supabase
//           .from("game_state")
//           .select("*")
//           .eq("employee_id", employeeId)
//           .eq("puzzle_date", todayStr)
//           .maybeSingle();
//         const restoredDailyMessage = existingResult.won
//           ? "You won! 🎉"
//           : `You lost! The word was ${puzzle.word}.`;
//         const restoredDailyCellStatuses = savedState && savedState.cell_statuses
//           ? savedState.cell_statuses
//           : Array.from({ length: 5 }, () => Array(len).fill(""));
//         if (savedState && savedState.board_state) {
//           setBoard(savedState.board_state);
//           setCellStatuses(savedState.cell_statuses);
//           setKeyStatuses(savedState.key_statuses || {});
//           setGameOver(true);
//           setMessage(restoredDailyMessage);
//           setExplanationText(puzzle.explanation);
//         } else {
//           setBoard(Array.from({ length: 5 }, () => Array(len).fill("")));
//           setCellStatuses(Array.from({ length: 5 }, () => Array(len).fill("")));
//           setMessage(restoredDailyMessage);
//           setExplanationText(puzzle.explanation);
//         }
//         dailyCellStatusesRef.current = restoredDailyCellStatuses;
//         dailyMessageRef.current = restoredDailyMessage;
//         setShowShare(true);
//         setGameOver(true);
//         setAnimatingRow(null);
//         setFlippingTiles([]);
//         setWinningRow(null);
//         setShowConfetti(false);
//         setPoppedCell(null);
//         fetchStreak();

//         const storedBonusGameState = localStorage.getItem(`bonus_game_state_${employeeId}_${todayStr}`);
//         if (storedBonusGameState) {
//           try {
//             const parsed = JSON.parse(storedBonusGameState);
//             if (parsed && parsed.bonusSessionActive) {
//               setHasUnfinishedBonus(true);
//               savedBonusStateRef.current = parsed;
//               setBonusRibbons(parsed.bonusRibbons ?? 0);
//               setBonusAttemptsLeft(parsed.bonusAttemptsLeft ?? 5);
//             }
//           } catch {
//             // ignore invalid data
//           }
//         }

//         // Now that state is fully restored, show the page
//         entranceTimerRef.current = setTimeout(() => setEntranceDone(true), 50);
//         return;
//       }

//       // Not completed → reset to empty and load any partial saved state
//       const emptyBoard = Array.from({ length: 5 }, () => Array(len).fill(""));
//       setBoard(emptyBoard);
//       setCellStatuses(Array.from({ length: 5 }, () => Array(len).fill("")));
//       setCurrentRow(0);
//       setCurrentCol(0);
//       setGameOver(false);
//       setKeyStatuses({});
//       setMessage("");
//       setExplanationText("");
//       setAnimatingRow(null);
//       setFlippingTiles([]);
//       setWinningRow(null);
//       setShowConfetti(false);
//       setShowShare(false);
//       setPoppedCell(null);
//       setAlreadyCompleted(false);

//       const { data: savedState } = await supabase
//         .from("game_state")
//         .select("*")
//         .eq("employee_id", employeeId)
//         .eq("puzzle_date", todayStr)
//         .maybeSingle();

//       if (savedState && savedState.board_state) {
//         setBoard(savedState.board_state);
//         setCellStatuses(savedState.cell_statuses);
//         setCurrentRow(savedState.current_row);
//         setCurrentCol(savedState.current_col);
//         setKeyStatuses(savedState.key_statuses || {});
//         setGameOver(savedState.game_over);
//         setMessage(savedState.message || "");
//         setExplanationText(savedState.explanation || "");
//         if (savedState.game_over) {
//           setAlreadyCompleted(true);
//           setShowShare(true);
//         }
//       }

//       // Bonus progress
//       const { data: bonusData } = await supabase
//         .from("bonus_leaderboard")
//         .select("ribbons")
//         .eq("employee_id", employeeId)
//         .eq("puzzle_date", todayStr)
//         .maybeSingle();
//       if (bonusData) {
//         setBonusRibbons(bonusData.ribbons);
//         setBonusAttemptsLeft(5 - bonusData.ribbons);
//       }
//       const storedUsedIds = localStorage.getItem(`bonus_used_${employeeId}_${todayStr}`);
//       if (storedUsedIds) {
//         setBonusUsedIds(JSON.parse(storedUsedIds));
//       }
//       // Restore bonus puzzle if it was persisted during a previous session
//       const storedBonusPuzzle = localStorage.getItem(`bonus_puzzle_${employeeId}_${todayStr}`);
//       if (storedBonusPuzzle) {
//         try {
//           const parsedPuzzle = JSON.parse(storedBonusPuzzle);
//           setBonusPuzzle(parsedPuzzle);
//         } catch (e) {
//           // Invalid stored data, ignore
//         }
//       }
      
//       // Restore complete bonus game state if it was persisted
//       const storedBonusGameState = localStorage.getItem(`bonus_game_state_${employeeId}_${todayStr}`);
//       if (storedBonusGameState) {
//         try {
//           const gameState = JSON.parse(storedBonusGameState);
//           setBonusPuzzle(gameState.bonusPuzzle);
//           setBoard(gameState.board);
//           setCellStatuses(gameState.cellStatuses);
//           setCurrentRow(gameState.currentRow);
//           setCurrentCol(gameState.currentCol);
//           setBonusGameOver(gameState.bonusGameOver);
//           setBonusMessage(gameState.bonusMessage);
//           setKeyStatuses(gameState.keyStatuses || {});
//           setGameOver(true);
//           setAlreadyCompleted(true);
//         } catch (e) {
//           // Invalid stored data, ignore
//         }
//       }
//       fetchStreak();
//       // Now that state is fully restored, show the page
//       entranceTimerRef.current = setTimeout(() => setEntranceDone(true), 50);
//     }

//     load();
//   }, [puzzle, employeeId, fetchStreak]);

//   const evaluateGuess = (guess: string[], solution: string): CellStatus[] => {
//     const statuses: CellStatus[] = Array(guess.length).fill("");
//     const solutionLetters = solution.split("");
//     const guessLetters = [...guess];
//     for (let i = 0; i < guess.length; i++) {
//       if (guessLetters[i] === solutionLetters[i]) {
//         statuses[i] = "correct";
//         solutionLetters[i] = "";
//         guessLetters[i] = "";
//       }
//     }
//     for (let i = 0; i < guess.length; i++) {
//       if (guessLetters[i] === "") continue;
//       const idx = solutionLetters.indexOf(guessLetters[i]);
//       if (idx !== -1) {
//         statuses[i] = "present";
//         solutionLetters[idx] = "";
//       } else {
//         statuses[i] = "absent";
//       }
//     }
//     return statuses;
//   };

//   const saveGameState = useCallback(async () => {
//     if (!employeeId || !puzzle) return;
//     const today = new Date().toISOString().split("T")[0];
//     await supabase
//       .from("game_state")
//       .upsert(
//         {
//           employee_id: employeeId,
//           puzzle_date: today,
//           board_state: board,
//           cell_statuses: cellStatuses,
//           current_row: currentRow,
//           current_col: currentCol,
//           key_statuses: keyStatuses,
//           game_over: gameOver,
//           message: message,
//           explanation: explanationText,
//           submitted: false,
//         },
//         { onConflict: "employee_id,puzzle_date" }
//       );
//   }, [employeeId, puzzle, board, cellStatuses, currentRow, currentCol, keyStatuses, gameOver, message, explanationText]);

//   // Force-save with explicit values to avoid timing issues
//   const forceSaveGameState = async (
//     finalBoard: string[][],
//     finalCellStatuses: CellStatus[][],
//     finalMessage: string,
//     finalExplanation: string
//   ) => {
//     if (!employeeId || !puzzle) return;
//     const today = new Date().toISOString().split("T")[0];
//     await supabase.from("game_state").upsert(
//       {
//         employee_id: employeeId,
//         puzzle_date: today,
//         board_state: finalBoard,
//         cell_statuses: finalCellStatuses,
//         current_row: currentRow,
//         current_col: currentCol,
//         key_statuses: keyStatuses,
//         game_over: true,
//         message: finalMessage,
//         explanation: finalExplanation,
//         submitted: false,
//       },
//       { onConflict: "employee_id,puzzle_date" }
//     );
//   };

//   // Save bonus game state whenever it changes
//   useEffect(() => {
//     if (!bonusPuzzle) return;
//     const today = new Date().toISOString().split("T")[0];
//     const bonusGameState = {
//       bonusPuzzle,
//       board,
//       cellStatuses,
//       currentRow,
//       currentCol,
//       bonusGameOver,
//       bonusMessage,
//       keyStatuses,
//       bonusAttemptsLeft,
//       bonusRibbons,
//       bonusSessionActive: bonusAttemptsLeft > 0,
//     };
//     localStorage.setItem(
//       `bonus_game_state_${employeeId}_${today}`,
//       JSON.stringify(bonusGameState)
//     );
//   }, [bonusPuzzle, board, cellStatuses, currentRow, currentCol, bonusGameOver, bonusMessage, keyStatuses, bonusAttemptsLeft, bonusRibbons, employeeId]);

//   useEffect(() => {
//     if (gameOver) {
//       saveGameState();
//     }
//   }, [gameOver, saveGameState]);

//   const submitToLeaderboard = useCallback(
//     async (won: boolean, attemptsUsed: number | null, displayName: string) => {
//       if (!employeeId || !puzzle) return;
//       const today = new Date().toISOString().split("T")[0];
//       const { error: insertError } = await supabase
//         .from("leaderboard")
//         .insert([{ employee_id: employeeId, puzzle_date: today, attempts_used: attemptsUsed, won, display_name: displayName }]);
//       if (insertError) {
//         if (insertError.code === "23505") {
//           setSubmissionStatus("Score already submitted for today!");
//         } else {
//           setSubmissionStatus("Failed to submit score.");
//         }
//       } else {
//         setSubmissionStatus("Score submitted! 📊");
//       }
//       setTimeout(() => setSubmissionStatus(""), 4000);
//     },
//     [employeeId, puzzle]
//   );

//   const handleShare = useCallback(async () => {
//     if (!puzzle) return;
//     const evaluatedRows: string[] = [];
//     for (let r = 0; r < 5; r++) {
//       const row = cellStatuses[r];
//       if (row && row.some(status => status !== "")) {
//         evaluatedRows.push(row.map(s => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛")).join(""));
//       }
//     }
//     const attemptsUsed = evaluatedRows.length;
//     const won = message.includes("won");
//     const shareText = `Wordl3 ${puzzle.date}\n${won ? "✅" : "❌"} ${attemptsUsed}/5\n\n${evaluatedRows.join("\n")}\n\nhttps://wordl3-amber.vercel.app/`;
//     try {
//       await navigator.clipboard.writeText(shareText);
//       setSubmissionStatus("Copied to clipboard! 📋");
//       setTimeout(() => setSubmissionStatus(""), 2000);
//     } catch {
//       setSubmissionStatus("Failed to copy.");
//       setTimeout(() => setSubmissionStatus(""), 2000);
//     }
//   }, [puzzle, cellStatuses, message]);

//   const updateRibbons = async (newRibbons: number) => {
//     const today = new Date().toISOString().split("T")[0];
//     await supabase
//       .from("bonus_leaderboard")
//       .upsert(
//         {
//           employee_id: employeeId,
//           display_name: displayName || employeeId,
//           puzzle_date: today,
//           ribbons: newRibbons,
//         },
//         { onConflict: "employee_id,puzzle_date" }
//       );
//   };

//   const handleEnter = useCallback(() => {
//     const activePuzzle = bonusPuzzle ? bonusPuzzle : puzzle;
//     if (!activePuzzle || currentCol !== activePuzzle.word.length || animatingRow !== null) return;

//     const guess = board[currentRow].map((l) => l.toUpperCase());
//     const solution = activePuzzle.word.toUpperCase();
//     const newStatuses = evaluateGuess(guess, solution);

//     // Predict final cellStatuses after all tiles are revealed
//     const predictedFinalStatuses = cellStatuses.map((row) => [...row]);
//     predictedFinalStatuses[currentRow] = newStatuses;

//     setKeyStatuses((prev) => {
//       const updated = { ...prev };
//       guess.forEach((letter, i) => {
//         const currentBest = updated[letter] || "";
//         const newStatus = newStatuses[i];
//         if (newStatus === "correct" || (newStatus === "present" && currentBest !== "correct") || (newStatus === "absent" && !currentBest)) {
//           updated[letter] = newStatus;
//         }
//       });
//       return updated;
//     });

//     const row = currentRow;
//     const length = activePuzzle.word.length;
//     setAnimatingRow(row);
//     setFlippingTiles(new Array(length).fill(false));

//     for (let i = 0; i < length; i++) {
//       const tileIndex = i;
//       setTimeout(() => {
//         setFlippingTiles((prev) => {
//           const updated = [...prev];
//           if (updated.length === 0) return updated;
//           updated[tileIndex] = true;
//           return updated;
//         });
//         setTimeout(() => {
//           setCellStatuses((prev) => {
//             const updated = prev.map((r) => [...r]);
//             updated[row][tileIndex] = newStatuses[tileIndex];
//             return updated;
//           });
//         }, 250);
//         if (tileIndex === length - 1) {
//           setTimeout(() => {
//             setAnimatingRow(null);
//             setFlippingTiles([]);
//             const guessWord = guess.join("").toUpperCase();

//             if (inBonusRound) {
//               // Bonus round handling
//               if (guessWord === solution) {
//                 const newRibbons = bonusRibbons + 1;
//                 setBonusRibbons(newRibbons);
//                 updateRibbons(newRibbons);
//                 setBonusMessage("Ribbon earned! 🎀");
//                 setExplanationText(activePuzzle.explanation);
//                 setBonusGameOver(true);
//                 setBonusAttemptsLeft((prev) => prev - 1);
//                 setGameOver(true);
//                 setAlreadyCompleted(true);
//                 setHasUnfinishedBonus(false);
//               } else if (row === 4) {
//                 setBonusMessage("Not quite! The word was " + activePuzzle.word);
//                 setExplanationText(activePuzzle.explanation);
//                 setBonusGameOver(true);
//                 setBonusAttemptsLeft((prev) => prev - 1);
//                 setGameOver(true);
//                 setAlreadyCompleted(true);
//                 setHasUnfinishedBonus(false);
//               } else {
//                 setCurrentRow((prev) => prev + 1);
//                 setCurrentCol(0);
//               }
//             } else {
//               // Daily game handling
//               const finalMessage = guessWord === solution
//                 ? "You won! 🎉"
//                 : (row === 4 ? `You lost! The word was ${puzzle.word}.` : "");
//               const finalExplanation = puzzle.explanation;

//               if (guessWord === solution) {
//                 setGameOver(true);
//                 setAlreadyCompleted(true);
//                 setWinningRow(row);
//                 setShowConfetti(true);
//                 setTimeout(() => setShowConfetti(false), 3000);
//                 setMessage("You won! 🎉");
//                 setExplanationText(puzzle.explanation);
//                 submitToLeaderboard(true, row + 1, displayName);
//                 fetchStreak();
//                 setShowShare(true);
//                 // Force-save final state (win)
//                 forceSaveGameState(
//                   board.map((r) => [...r]),
//                   predictedFinalStatuses,
//                   "You won! 🎉",
//                   puzzle.explanation
//                 );
//                 dailyCellStatusesRef.current = predictedFinalStatuses;
//                 dailyMessageRef.current = "You won! 🎉";
//               } else if (row === 4) {
//                 setGameOver(true);
//                 setAlreadyCompleted(true);
//                 setMessage("You lost! The word was " + puzzle.word + ".");
//                 setExplanationText(puzzle.explanation);
//                 submitToLeaderboard(false, null, displayName);
//                 fetchStreak();
//                 setShowShare(true);
//                 // Force-save final state (loss)
//                 forceSaveGameState(
//                   board.map((r) => [...r]),
//                   predictedFinalStatuses,
//                   `You lost! The word was ${puzzle.word}.`,
//                   puzzle.explanation
//                 );
//                 dailyCellStatusesRef.current = predictedFinalStatuses;
//                 dailyMessageRef.current = `You lost! The word was ${puzzle.word}.`;
//               } else {
//                 setCurrentRow((prev) => prev + 1);
//                 setCurrentCol(0);
//               }
//             }
//           }, 500);
//         }
//       }, tileIndex * 200);
//     }
//   }, [
//     puzzle,
//     bonusPuzzle,
//     inBonusRound,
//     currentCol,
//     board,
//     currentRow,
//     evaluateGuess,
//     animatingRow,
//     submitToLeaderboard,
//     fetchStreak,
//     displayName,
//     bonusRibbons,
//     updateRibbons,
//     cellStatuses,
//     keyStatuses,
//   ]);

//   const processKey = useCallback(
//     (key: string) => {
//       if (gameOver || !(bonusPuzzle ? bonusPuzzle : puzzle) || (alreadyCompleted && !bonusPuzzle) || animatingRow !== null || (bonusPuzzle && bonusGameOver)) return;
//       if (/^[a-zA-Z0-9]$/.test(key) && currentCol < wordLength) {
//         setBoard((prev) => {
//           const newBoard = prev.map((row) => [...row]);
//           newBoard[currentRow][currentCol] = key.toUpperCase();
//           return newBoard;
//         });
//         setPoppedCell({ row: currentRow, col: currentCol });
//         setTimeout(() => setPoppedCell(null), 150);
//         setCurrentCol((prev) => prev + 1);
//       } else if (key === "Backspace" && currentCol > 0) {
//         setBoard((prev) => {
//           const newBoard = prev.map((row) => [...row]);
//           newBoard[currentRow][currentCol - 1] = "";
//           return newBoard;
//         });
//         setCurrentCol((prev) => prev - 1);
//       } else if (key === "Enter") {
//         handleEnter();
//       }
//     },
//     [gameOver, puzzle, alreadyCompleted, animatingRow, currentCol, wordLength, currentRow, handleEnter, bonusPuzzle, bonusGameOver]
//   );

//   useEffect(() => {
//     if (alreadyCompleted && !bonusPuzzle) return;
//     const handler = (e: KeyboardEvent) => processKey(e.key);
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [processKey, alreadyCompleted, bonusPuzzle]);

//   const currentPuzzle = bonusPuzzle ? bonusPuzzle : puzzle;

//   const getTileSize = () => {
//     const len = currentPuzzle.word.length;
//     if (len <= 3) return "3.5rem";
//     if (len <= 5) return "3rem";
//     if (len <= 7) return "2.5rem";
//     if (len <= 10) return "2rem";
//     if (len <= 12) return "1.75rem";
//     return "1.5rem";
//   };

//   const getCellClasses = (row: number, col: number) => {
//     const status = cellStatuses[row]?.[col] || "";
//     let base = `w-[${getTileSize()}] h-[${getTileSize()}] border-2 flex items-center justify-center text-[clamp(0.75rem,4vw,1.5rem)] font-bold uppercase `;
//     if (status === "correct") base += "bg-correct border-correct text-white";
//     else if (status === "present") base += "bg-present border-present text-white";
//     else if (status === "absent") base += "bg-absent border-absent text-white";
//     else base += "border-brand-mid bg-brand-dark text-brand-light";
//     return base;
//   };

//   const getKeyClasses = (key: string) => {
//     const status = keyStatuses[key] || "";
//     let base = "h-10 sm:h-12 min-w-[2rem] sm:min-w-[2.8rem] rounded font-bold text-xs sm:text-sm mx-0.5 flex items-center justify-center select-none ";
//     if (status === "correct") base += "bg-correct text-white";
//     else if (status === "present") base += "bg-present text-white";
//     else if (status === "absent") base += "bg-absent text-white";
//     else base += "bg-brand-mid text-white active:bg-brand-light";
//     return base;
//   };

//   return (
//     <main className={`h-dvh bg-brand-dark text-brand-light flex flex-col items-center overflow-hidden ${entranceDone ? "animate-fade-in-up" : "opacity-0"}`}>
//       {/* Top bar */}
//       <div className="absolute top-2 right-2 left-2 flex items-center justify-end gap-1 sm:gap-2 text-xs sm:text-sm">
//         <a href="/leaderboard" className="px-1.5 sm:px-2 py-1 bg-brand-orange hover:bg-brand-peach text-brand-dark rounded font-semibold transition-colors whitespace-nowrap">🏆</a>
//         <span className="text-brand-peach truncate max-w-[100px] sm:max-w-none">
//           {displayName || employeeId}
//           {streakLoaded && streak > 0 && <span className="ml-1">🔥{streak}</span>}
//           {bonusRibbons > 0 && <span className="ml-1">🎀{bonusRibbons}</span>}
//         </span>
//         <button onClick={changeEmployeeId} className="px-1.5 sm:px-2 py-1 bg-brand-mid hover:bg-brand-light text-brand-dark rounded transition-colors whitespace-nowrap">✎</button>
//       </div>

//       <div className="flex-1 flex flex-col items-center justify-center w-full px-2 pt-4 overflow-y-auto">
//         <h1 className="text-3xl font-bold mb-3">Wordl3</h1>
//         {alreadyCompleted && !inBonusRound && <p className="text-sm text-brand-orange uppercase tracking-wider mb-1">✨ Admire Puzzle ✨</p>}
//         {inBonusRound && <p className="text-sm text-brand-orange uppercase tracking-wider mb-1">🎁 Bonus Round</p>}

//         <div className="mb-3 text-lg text-brand-peach italic text-center">Hint: {currentPuzzle.hint}</div>

//         <div className="mb-4 w-full flex justify-center overflow-x-auto">
//           <div className="grid gap-1 sm:gap-1.5">
//             {board.map((row, rowIndex) => (
//               <div key={rowIndex} className="flex gap-1 sm:gap-1.5">
//                 {row.map((cell, colIndex) => (
//                   <div
//                     key={colIndex}
//                     className={
//                       getCellClasses(rowIndex, colIndex) +
//                       (animatingRow === rowIndex && flippingTiles[colIndex] ? " tile-flip" : "") +
//                       (winningRow === rowIndex ? " tile-bounce" : "") +
//                       (poppedCell?.row === rowIndex && poppedCell?.col === colIndex ? " tile-pop" : "")
//                     }
//                     style={{ width: getTileSize(), height: getTileSize() }}
//                   >
//                     {cell}
//                   </div>
//                 ))}
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Messages */}
//         {message && !inBonusRound && <div className="text-xl font-bold text-center mb-2 text-brand-orange">{message}</div>}
//         {explanationText && !inBonusRound && <div className="text-base text-brand-light max-w-md text-center mb-3">{explanationText}</div>}

//         {/* Bonus round messages */}
//         {inBonusRound && bonusMessage && <div className="text-xl font-bold text-center mb-2 text-brand-orange">{bonusMessage}</div>}
//         {inBonusRound && (
//           <button
//             onClick={async () => {
//               const evaluatedRows: string[] = [];
//               const statuses = dailyCellStatusesRef.current;
//               for (let r = 0; r < statuses.length; r++) {
//                 const row = statuses[r];
//                 if (row && row.some((s) => s !== "")) {
//                   evaluatedRows.push(
//                     row
//                       .map((s) =>
//                         s === "correct"
//                           ? "🟩"
//                           : s === "present"
//                           ? "🟨"
//                           : "⬛"
//                       )
//                       .join("")
//                   );
//                 }
//               }
//               const attemptsUsed = evaluatedRows.length;
//               const won = dailyMessageRef.current.includes("won");
//               const shareText =
//                 `Wordl3 ${puzzle.date}\n${won ? "✅" : "❌"} ${attemptsUsed}/5\n\n${evaluatedRows.join("\n")}\n\nhttps://wordl3-amber.vercel.app/`;
//               try {
//                 await navigator.clipboard.writeText(shareText);
//                 setSubmissionStatus("Daily result copied! 📋");
//                 setTimeout(() => setSubmissionStatus(""), 2000);
//               } catch {
//                 setSubmissionStatus("Failed to copy.");
//                 setTimeout(() => setSubmissionStatus(""), 2000);
//               }
//             }}
//             className="mt-2 px-4 py-2 bg-brand-mid hover:bg-brand-light text-white font-semibold rounded transition-colors text-sm"
//           >
//             📤 Share Daily Result
//           </button>
//         )}
//         {inBonusRound && bonusGameOver && explanationText && <div className="text-base text-brand-light max-w-md text-center mb-3">{explanationText}</div>}

//         {/* Daily share button (hide during bonus) */}
//         {showShare && !inBonusRound && (
//           <button onClick={handleShare} className="mt-4 px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors">📤 Share Result</button>
//         )}
//         {submissionStatus && <div className="text-base font-semibold text-center mb-2 text-brand-peach">{submissionStatus}</div>}

//         {/* Next bonus word button */}
//         {inBonusRound && bonusGameOver && bonusAttemptsLeft > 0 && (
//           <button
//             onClick={() => {
//               setBonusGameOver(false);
//               loadNextBonusWord();
//             }}
//             className="mt-4 px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
//           >
//             ➡️ Next Bonus Word ({bonusAttemptsLeft} left)
//           </button>
//         )}

//         {/* Bonus round complete */}
//         {inBonusRound && bonusAttemptsLeft === 0 && (
//           <div className="mt-4 text-center">
//             <p className="text-xl font-bold text-brand-orange mb-2">Bonus round complete! 🎉</p>
//             <p className="text-brand-peach">You earned 🎀 {bonusRibbons} ribbon{bonusRibbons > 1 ? "s" : ""}!</p>
//             <button
//               onClick={() => {
//                 const today = new Date().toISOString().split("T")[0];
//                 localStorage.removeItem(`bonus_puzzle_${employeeId}_${today}`);
//                 localStorage.removeItem(`bonus_game_state_${employeeId}_${today}`);
//                 window.location.reload();
//               }}
//               className="mt-4 px-6 py-2 bg-brand-mid hover:bg-brand-light text-white font-bold rounded transition-colors"
//             >
//               ← Back to daily puzzle
//             </button>
//           </div>
//         )}

//         {/* Bonus Round entry button (after daily game over) */}
//         {gameOver && !inBonusRound && bonusAttemptsLeft > 0 && (
//           <div className="mt-4 flex flex-col items-center gap-2">
//             {hasUnfinishedBonus ? (
//               <button
//                 onClick={resumeBonusRound}
//                 className="px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
//               >
//                 ▶️ Resume Bonus Round
//               </button>
//             ) : (
//               <button
//                 onClick={() => {
//                   loadNextBonusWord();
//                 }}
//                 className="px-6 py-2 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold rounded transition-colors"
//               >
//                 🎁 Bonus Round ({bonusAttemptsLeft} left)
//               </button>
//             )}
//             {bonusRibbons > 0 && (
//               <span className="text-brand-peach text-sm">
//                 🎀 {bonusRibbons} ribbon{bonusRibbons > 1 ? "s" : ""} earned today
//               </span>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Suggestion box (unchanged) */}
//       <div className="w-full flex justify-center px-2">
//         <div className="w-full max-w-sm">
//           {!showSuggestionBox && !suggestionSubmitted && (
//             <button
//               onClick={() => setShowSuggestionBox(true)}
//               className="w-full px-4 py-3 sm:py-4 bg-gradient-to-r from-brand-mid to-brand-orange hover:from-brand-light hover:to-brand-peach text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-sm sm:text-base"
//             >
//               💡 Suggest a word for tomorrow
//             </button>
//           )}
//           {showSuggestionBox && !suggestionSubmitted && (
//             <div className="bg-brand-dark border-2 border-brand-orange rounded-lg p-4 sm:p-5 space-y-3 shadow-lg animate-fade-in-up">
//               <p className="text-sm text-brand-light text-center font-semibold">💭 What word would you like to see?</p>
//               <input
//                 type="text"
//                 value={suggestionWord}
//                 onChange={(e) => setSuggestionWord(e.target.value)}
//                 maxLength={15}
//                 placeholder="e.g., VALIDATION"
//                 autoFocus
//                 className="w-full p-3 bg-brand-dark border-2 border-brand-mid rounded-lg text-brand-light text-center uppercase font-bold tracking-wider focus:border-brand-orange focus:outline-none transition-colors"
//               />
//               <div className="flex gap-2 pt-2">
//                 <button
//                   onClick={handleSuggestionSubmit}
//                   className="flex-1 bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold py-2 sm:py-3 rounded-lg transition-colors active:scale-95 text-sm sm:text-base"
//                 >
//                   ✨ Submit
//                 </button>
//                 <button
//                   onClick={() => {
//                     setShowSuggestionBox(false);
//                     setSuggestionWord("");
//                     setSuggestionStatus("");
//                   }}
//                   className="flex-1 bg-brand-mid hover:bg-brand-light text-white font-bold py-2 sm:py-3 rounded-lg transition-colors active:scale-95 text-sm sm:text-base"
//                 >
//                   ✕ Cancel
//                 </button>
//               </div>
//             </div>
//           )}
//           {suggestionSubmitted && (
//             <p className="text-sm text-center text-brand-peach font-semibold mt-3">✅ Thank you! Your suggestion has been recorded.</p>
//           )}
//           {suggestionStatus && (
//             <p className="text-sm text-center text-brand-peach font-semibold mt-2">{suggestionStatus}</p>
//           )}
//         </div>
//       </div>

//       {/* Keyboard (hidden during daily admire or after bonus game over) */}
//       {!alreadyCompleted && !(inBonusRound && bonusGameOver) && (
//         <div className="w-full max-w-lg pb-4 px-1 flex-shrink-0">
//           {KEYBOARD_ROWS.map((row, i) => (
//             <div key={i} className="flex justify-center my-0.5 sm:my-1">
//               {row.map((key) => {
//                 const display = key === "BACKSPACE" ? "←" : key === "ENTER" ? "↵" : key;
//                 const isSpecial = key === "BACKSPACE" || key === "ENTER";
//                 return (
//                   <button
//                     key={key}
//                     onClick={() => processKey(key === "BACKSPACE" ? "Backspace" : key === "ENTER" ? "Enter" : key)}
//                     className={(isSpecial ? "min-w-[3rem] sm:min-w-[4.5rem] px-1 " : "") + getKeyClasses(key) + " transition-transform active:scale-90"}
//                   >
//                     {display}
//                   </button>
//                 );
//               })}
//             </div>
//           ))}
//         </div>
//       )}

//       {showConfetti && (
//         <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
//           {Array.from({ length: 60 }).map((_, i) => (
//             <div
//               key={i}
//               className="confetti-piece"
//               style={{
//                 left: `${Math.random() * 100}%`,
//                 backgroundColor: ["#6AAA64", "#F5C518", "#FF8C00", "#FFC089", "#A7A9AC", "#0D3B66", "#FFFFFF"][Math.floor(Math.random() * 7)],
//                 animationDelay: `${Math.random() * 2.5}s`,
//                 animationDuration: `${2.5 + Math.random() * 3}s`,
//                 width: `${6 + Math.random() * 10}px`,
//                 height: `${6 + Math.random() * 10}px`,
//                 borderRadius: Math.random() > 0.5 ? "50%" : "0",
//               }}
//             />
//           ))}
//         </div>
//       )}
//     </main>
//   );
// }