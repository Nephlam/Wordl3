"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSWORD = "mesdle123"; // simple demo password

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Form fields
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [explanation, setExplanation] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password!");
      setPasswordInput("");
    }
  };

  // Handle puzzle submission
  const handlePuzzleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage("");
    setSubmitting(true);

    const { error } = await supabase.from("puzzles").insert([
      {
        word: word.trim().toUpperCase(),
        hint: hint.trim(),
        explanation: explanation.trim(),
        publish_date: publishDate,
      },
    ]);

    setSubmitting(false);

    if (error) {
      setSubmitMessage("❌ Error: " + error.message);
    } else {
      setSubmitMessage("✅ Puzzle added successfully!");
      // Clear form
      setWord("");
      setHint("");
      setExplanation("");
      setPublishDate("");
    }
  };

  // If not authenticated, show password form
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <form
          onSubmit={handlePasswordSubmit}
          className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-sm"
        >
          <h1 className="text-2xl font-bold mb-4 text-center">Admin Login</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter admin password"
            className="w-full p-2 mb-3 bg-gray-700 border border-gray-600 rounded text-white"
            autoFocus
          />
          {passwordError && (
            <p className="text-red-400 text-sm mb-2">{passwordError}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold"
          >
            Login
          </button>
        </form>
      </main>
    );
  }

  // Authenticated – show puzzle form
  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Admin Panel</h1>
        <form
          onSubmit={handlePuzzleSubmit}
          className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold mb-1">Word</label>
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              required
              maxLength={15}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="e.g., ISA88"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Hint</label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              required
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="e.g., ISA standard used for batch process control."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">
              Explanation
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              required
              rows={3}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="e.g., ISA-88 is an international standard..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">
              Publish Date
            </label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              required
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-500 py-2 rounded font-bold disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add Puzzle"}
          </button>
          {submitMessage && (
            <p
              className={`text-center text-sm ${
                submitMessage.startsWith("✅")
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {submitMessage}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}