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
  const [displayName, setDisplayName] = useState<string>("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showPasswordSignUp, setShowPasswordSignUp] = useState(false);
  const isValidEmployeeId = (id: string) => /^IN\d+$/i.test(id);
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
    localStorage.removeItem("wordl3_display_name");
    setEmployeeId("");
    setLoggedIn(false);
    setEmployeeInput("");
    setPasswordInput("");
    setLoginError("");
    setIsSignUp(false);
    setShowPasswordLogin(false);
    setShowPasswordSignUp(false);
  };

  // Auto-login from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("wordl3_employee_id");
    if (savedId) {
      setEmployeeId(savedId);
      setLoggedIn(true);
    }
  }, []);

    // Auto-login from localStorage
    useEffect(() => {
      const savedId = localStorage.getItem("wordl3_employee_id");
      const savedDisplay = localStorage.getItem("wordl3_display_name");
      if (savedId) {
        setEmployeeId(savedId);
        setLoggedIn(true);
        if (savedDisplay) setDisplayName(savedDisplay);
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
              setShowPasswordLogin(false);
                              // Success – fetch display name
                const { data: userData } = await supabase
                  .from("users")
                  .select("display_name")
                  .eq("employee_id", trimmedId)
                  .single();
                if (userData) {
                  setDisplayName(userData.display_name);
                  localStorage.setItem("wordl3_display_name", userData.display_name);
                }
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
                <div className="relative mb-4">
                  <input
                    type={showPasswordLogin ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full p-3 pr-10 bg-brand-dark border border-brand-mid rounded text-brand-light placeholder:text-brand-mid text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-mid hover:text-brand-light transition-colors"
                    aria-label={showPasswordLogin ? "Hide password" : "Show password"}
                  >
                    {showPasswordLogin ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
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
                // Sign-up form (existing code) -> replace the entire : ( ... ) block
                <>
                  <p className="text-sm text-brand-light mb-2">
                    New account for{" "}
                    <span className="font-bold">{employeeInput.trim()}</span>
                  </p>
                  <p className="text-xs text-brand-mid mb-4">
                    Create a password and choose a display name.
                  </p>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Display Name (e.g., Jaadu)"
                    required
                    className="w-full p-3 mb-3 bg-brand-dark border border-brand-mid rounded text-brand-light placeholder:text-brand-mid text-center text-lg"
                  />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Choose a password"
                    required
                    className="w-full p-3 mb-4 bg-brand-dark border border-brand-mid rounded text-brand-light placeholder:text-brand-mid text-center"
                  />
                  {loginError && (
                    <p className="text-red-400 text-sm mb-2 text-center">{loginError}</p>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const trimmedId = employeeInput.trim();
                      const trimmedDisplay = displayNameInput.trim();
                      if (!passwordInput || !trimmedDisplay) return;

                      // Validate employee ID format
                      if (!isValidEmployeeId(trimmedId)) {
                        setLoginError("Employee ID must be like IN1234");
                        return;
                      }

                      const { error: insertErr } = await supabase
                        .from("users")
                        .insert({
                          employee_id: trimmedId,
                          password: passwordInput,
                          display_name: trimmedDisplay,
                        });
                      if (insertErr) {
                        setLoginError("Could not create account.");
                        return;
                      }
                      setEmployeeId(trimmedId);
                      setDisplayName(trimmedDisplay);
                      setLoggedIn(true);
                      localStorage.setItem("wordl3_employee_id", trimmedId);
                      localStorage.setItem("wordl3_display_name", trimmedDisplay);
                      setPasswordInput("");
                      setDisplayNameInput("");
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
          displayName={displayName}
          changeEmployeeId={changeEmployeeId}
        />
      )}
    </>
  );
}