"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Tutorial from "@/components/Tutorial";
import Game from "./game";

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

  const [employeeId, setEmployeeId] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [employeeInput, setEmployeeInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [showTutorial, setShowTutorial] = useState(false);

  // Fetch today's puzzle
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

  // Change employee ID (log out)
  const changeEmployeeId = () => {
    localStorage.removeItem("wordl3_employee_id");
    setEmployeeId("");
    setLoggedIn(false);
    setEmployeeInput("");
    setPasswordInput("");
    setLoginError("");
    setIsSignUp(false);
  };

  // Auto-login from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("wordl3_employee_id");
    if (savedId) {
      setEmployeeId(savedId);
      setLoggedIn(true);
    }
  }, []);

  // Render loading / error states
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
      {/* Login prompt */}
      {!loggedIn && (
        <main className="h-dvh bg-brand-dark text-brand-light flex items-center justify-center p-4 overflow-hidden">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError("");
              const trimmedId = employeeInput.trim();
              if (!trimmedId) return;

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
                setIsSignUp(true);
                return;
              }

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

      {/* Tutorial overlay */}
      {loggedIn && showTutorial && <Tutorial onClose={closeTutorial} />}

      {/* Game component (remounts on employee or date change) */}
      {loggedIn && puzzle && (
        <Game
          key={`${employeeId}-${puzzle.date}`}
          puzzle={puzzle}
          employeeId={employeeId}
          changeEmployeeId={changeEmployeeId}
        />
      )}
    </>
  );
}