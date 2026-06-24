"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Period = "daily" | "weekly" | "monthly" | "bonus";

interface RankEntry {
  employee_id: string;
  display_name?: string;
  wins: number;
  total_attempts: number;
  ribbons: number;
  points: number; // daily win (1) + ribbons; weekly/monthly wins + ribbons
}

function getDateRange(period: Period) {
  const today = new Date();
  const start = new Date(today);
  if (period === "weekly") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
  } else if (period === "monthly") {
    start.setDate(1);
  }
  // daily and bonus use today; bonus uses no date filter
  return {
    start: start.toISOString().split("T")[0],
    end: today.toISOString().split("T")[0],
  };
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { start, end } = getDateRange(period);

      if (period === "bonus") {
        // All‑time ribbon totals
        const { data, error } = await supabase
          .from("bonus_leaderboard")
          .select("employee_id, display_name, ribbons")
          .order("ribbons", { ascending: false })
          .limit(5);

        if (!error && data) {
          setEntries(
            data.map((d) => ({
              employee_id: d.employee_id,
              display_name: d.display_name,
              wins: 0,
              total_attempts: 0,
              ribbons: d.ribbons,
              points: d.ribbons,
            }))
          );
        } else {
          setEntries([]);
        }
      } else {
        // Daily, weekly, monthly: combine daily wins + ribbons

        // Fetch daily wins (leaderboard table)
        const { data: dailyData, error: dailyError } = await supabase
          .from("leaderboard")
          .select("employee_id, display_name, won, attempts_used")
          .gte("puzzle_date", start)
          .lte("puzzle_date", end)
          .eq("won", true);

        // Fetch ribbons (bonus_leaderboard table) for the same period
        const { data: bonusData, error: bonusError } = await supabase
          .from("bonus_leaderboard")
          .select("employee_id, display_name, ribbons")
          .gte("puzzle_date", start)
          .lte("puzzle_date", end);

        if (dailyError || bonusError) {
          setEntries([]);
          setLoading(false);
          return;
        }

        // Aggregate wins and attempts from daily
        const employeeMap = new Map<
          string,
          { display_name?: string; wins: number; total_attempts: number; ribbons: number }
        >();

        (dailyData || []).forEach((row) => {
          const cur = employeeMap.get(row.employee_id) || {
            display_name: row.display_name,
            wins: 0,
            total_attempts: 0,
            ribbons: 0,
          };
          cur.wins += 1;
          cur.total_attempts += row.attempts_used || 0;
          employeeMap.set(row.employee_id, cur);
        });

        // Add ribbons from bonus
        (bonusData || []).forEach((row) => {
          const cur = employeeMap.get(row.employee_id) || {
            display_name: row.display_name,
            wins: 0,
            total_attempts: 0,
            ribbons: 0,
          };
          cur.ribbons += row.ribbons || 0;
          employeeMap.set(row.employee_id, cur);
        });

        // Compute points: daily win counts as 1 point, each ribbon is 1 point
        const ranked = Array.from(employeeMap.entries())
          .map(([id, val]) => ({
            employee_id: id,
            display_name: val.display_name,
            wins: val.wins,
            total_attempts: val.total_attempts,
            ribbons: val.ribbons,
            points: val.wins + val.ribbons,
          }))
          .sort((a, b) => b.points - a.points || a.total_attempts - b.total_attempts)
          .slice(0, 5);

        setEntries(ranked);
      }
      setLoading(false);
    }
    fetchData();
  }, [period]);

  return (
    <main className="min-h-dvh bg-brand-dark text-brand-light flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="inline-block mb-4 text-sm text-brand-peach hover:text-brand-orange transition-colors"
        >
          ← Back to Game
        </a>

        <h1 className="text-3xl font-bold mb-2 text-center">Leaderboard</h1>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {(["daily", "weekly", "monthly", "bonus"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded font-semibold text-sm transition-colors ${
                period === p
                  ? "bg-brand-orange text-brand-dark"
                  : "bg-brand-mid text-white hover:bg-brand-light"
              }`}
            >
              {p === "bonus"
                ? "🎀 Bonus"
                : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <p className="text-sm text-brand-mid text-center mb-4">
          {period === "daily"
            ? "Today's Top 5"
            : period === "weekly"
            ? "This Week's Top 5"
            : period === "monthly"
            ? "This Month's Top 5"
            : "All‑Time Ribbon Leaders"}
        </p>

        {loading ? (
          <p className="text-center text-brand-mid">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="bg-brand-dark border border-brand-mid rounded-xl p-6 text-center">
            <p className="text-brand-peach text-lg mb-2">No data yet!</p>
            <p className="text-sm text-brand-mid">
              {period === "bonus"
                ? "Earn ribbons by completing bonus rounds."
                : "Solve the daily puzzle or earn bonus ribbons to appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-brand-mid uppercase tracking-wider px-2 pb-2 border-b border-brand-mid">
              <span className="w-8 text-center">#</span>
              <span className="flex-1">Player</span>
              {period === "bonus" ? (
                <span className="w-14 text-center">Ribbons</span>
              ) : (
                <>
                  <span className="w-10 text-center">Pts</span>
                  <span className="w-10 text-center">Wins</span>
                  <span className="w-10 text-center">🎀</span>
                </>
              )}
            </div>

            {entries.map((entry, index) => (
              <div
                key={entry.employee_id}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg ${
                  index === 0
                    ? "bg-brand-orange/20 border border-brand-orange"
                    : "bg-brand-dark border border-brand-mid"
                }`}
              >
                <span className="w-8 text-center font-bold text-lg">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                </span>
                <span className="flex-1 font-semibold text-brand-light truncate">
                  {entry.display_name || entry.employee_id}
                </span>
                {period === "bonus" ? (
                  <span className="w-14 text-center text-brand-peach font-bold">
                    {entry.ribbons}
                  </span>
                ) : (
                  <>
                    <span className="w-10 text-center text-brand-peach font-bold">
                      {entry.points}
                    </span>
                    <span className="w-10 text-center text-brand-light">
                      {entry.wins}
                    </span>
                    <span className="w-10 text-center text-brand-light">
                      {entry.ribbons}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}