"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LeaderboardEntry {
  id: string;
  employee_id: string;
  attempts_used: number | null;
  won: boolean;
  created_at: string;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    async function fetchLeaderboard() {
      const todayStr = new Date().toISOString().split("T")[0];
      setToday(todayStr);

      // Fetch only winners for today, ordered by attempts ascending, limit 5
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("puzzle_date", todayStr)
        .eq("won", true)
        .order("attempts_used", { ascending: true })
        .limit(5);

      if (!error && data) {
        setEntries(data);
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  return (
    <main className="min-h-dvh bg-brand-dark text-brand-light flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <a
          href="/"
          className="inline-block mb-4 text-sm text-brand-peach hover:text-brand-orange transition-colors"
        >
          ← Back to Game
        </a>

        <h1 className="text-3xl font-bold mb-2 text-center">Leaderboard</h1>
        <p className="text-sm text-brand-mid text-center mb-6">
          {today} — Top 5 Winners
        </p>

        {loading ? (
          <p className="text-center text-brand-mid">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="bg-brand-dark border border-brand-mid rounded-xl p-6 text-center">
            <p className="text-brand-peach text-lg mb-2">No winners yet today!</p>
            <p className="text-sm text-brand-mid">
              Be the first to solve today's puzzle and claim the top spot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-3 text-xs text-brand-mid uppercase tracking-wider px-2 pb-2 border-b border-brand-mid">
              <span className="w-8 text-center">#</span>
              <span className="flex-1">Employee</span>
              <span className="w-16 text-center">Attempts</span>
            </div>

            {/* Ranked entries */}
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg ${
                  index === 0
                    ? "bg-brand-orange/20 border border-brand-orange"
                    : "bg-brand-dark border border-brand-mid"
                }`}
              >
                {/* Rank badge */}
                <span className="w-8 text-center font-bold text-lg">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                </span>

                {/* Employee ID */}
                <span className="flex-1 font-semibold text-brand-light">
                  {entry.employee_id}
                </span>

                {/* Attempts */}
                <span className="w-16 text-center text-brand-peach font-bold">
                  {entry.attempts_used}/5
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Link to full history (future) */}
        <p className="text-xs text-brand-mid text-center mt-8">
          Only your first win of the day counts. Play again to improve? Your first score sticks!
        </p>
      </div>
    </main>
  );
}