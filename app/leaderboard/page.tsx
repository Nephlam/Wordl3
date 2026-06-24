"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Period = "daily" | "weekly" | "monthly";

interface RankEntry {
  employee_id: string;
  wins: number;
  total_attempts: number;
}

function getDateRange(period: Period) {
  const today = new Date();
  const start = new Date(today);
  if (period === "weekly") {
    // Monday of current week
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
  } else if (period === "monthly") {
    start.setDate(1); // first day of month
  }
  // daily: just today
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

      if (period === "daily") {
        // Original daily query: top 5 winners today
        const { data, error } = await supabase
          .from("leaderboard")
          .select("*")
          .eq("puzzle_date", start)
          .eq("won", true)
          .order("attempts_used", { ascending: true })
          .limit(5);
        if (!error && data) {
          setEntries(
            data.map((d) => ({
              employee_id: d.employee_id,
              wins: 1,
              total_attempts: d.attempts_used || 0,
            }))
          );
        }
      } else {
        // Weekly or monthly: aggregate wins and total attempts
        const { data, error } = await supabase
          .from("leaderboard")
          .select("employee_id, attempts_used, won")
          .gte("puzzle_date", start)
          .lte("puzzle_date", end)
          .eq("won", true);
        if (!error && data) {
          const map = new Map<string, { wins: number; total: number }>();
          data.forEach((row) => {
            const cur = map.get(row.employee_id) || { wins: 0, total: 0 };
            cur.wins += 1;
            cur.total += row.attempts_used || 0;
            map.set(row.employee_id, cur);
          });
          const ranked = Array.from(map.entries())
            .map(([id, val]) => ({
              employee_id: id,
              wins: val.wins,
              total_attempts: val.total,
            }))
            .sort((a, b) => b.wins - a.wins || a.total_attempts - b.total_attempts)
            .slice(0, 5);
          setEntries(ranked);
        } else {
          setEntries([]);
        }
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
        <div className="flex justify-center gap-2 mb-6">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded font-semibold text-sm transition-colors ${
                period === p
                  ? "bg-brand-orange text-brand-dark"
                  : "bg-brand-mid text-white hover:bg-brand-light"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <p className="text-sm text-brand-mid text-center mb-4">
          {period === "daily"
            ? "Today's Top 5"
            : period === "weekly"
            ? "This Week's Top 5"
            : "This Month's Top 5"}
        </p>

        {loading ? (
          <p className="text-center text-brand-mid">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="bg-brand-dark border border-brand-mid rounded-xl p-6 text-center">
            <p className="text-brand-peach text-lg mb-2">No winners yet!</p>
            <p className="text-sm text-brand-mid">
              Be the first to solve and claim the top spot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-brand-mid uppercase tracking-wider px-2 pb-2 border-b border-brand-mid">
              <span className="w-8 text-center">#</span>
              <span className="flex-1">Employee</span>
              {period === "daily" ? (
                <span className="w-16 text-center">Attempts</span>
              ) : (
                <>
                  <span className="w-12 text-center">Wins</span>
                  <span className="w-16 text-center">Att.</span>
                </>
              )}
            </div>
            {entries.map((entry, index) => (
              <div
                key={entry.employee_id}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg ${
                  index === 0
                    ? "bg-brand-orange/20 border border-brand-orange"
                    : "bg-brand-dark border border-brand-mid"
                }`}
              >
                <span className="w-8 text-center font-bold text-lg">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                </span>
                <span className="flex-1 font-semibold text-brand-light">
                  {entry.employee_id}
                </span>
                {period === "daily" ? (
                  <span className="w-16 text-center text-brand-peach font-bold">
                    {entry.total_attempts}/5
                  </span>
                ) : (
                  <>
                    <span className="w-12 text-center text-brand-peach font-bold">
                      {entry.wins}
                    </span>
                    <span className="w-16 text-center text-brand-peach font-bold">
                      {entry.total_attempts}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-brand-mid text-center mt-8">
          Only your first win of the day counts.
        </p>
      </div>
    </main>
  );
}

// "use client";

// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase";

// interface LeaderboardEntry {
//   id: string;
//   employee_id: string;
//   attempts_used: number | null;
//   won: boolean;
//   created_at: string;
// }

// export default function LeaderboardPage() {
//   const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [today, setToday] = useState("");

//   useEffect(() => {
//     async function fetchLeaderboard() {
//       const todayStr = new Date().toISOString().split("T")[0];
//       setToday(todayStr);

//       // Fetch only winners for today, ordered by attempts ascending, limit 5
//       const { data, error } = await supabase
//         .from("leaderboard")
//         .select("*")
//         .eq("puzzle_date", todayStr)
//         .eq("won", true)
//         .order("attempts_used", { ascending: true })
//         .limit(5);

//       if (!error && data) {
//         setEntries(data);
//       }
//       setLoading(false);
//     }
//     fetchLeaderboard();
//   }, []);

//   return (
//     <main className="min-h-dvh bg-brand-dark text-brand-light flex flex-col items-center p-4">
//       <div className="w-full max-w-md">
//         {/* Back button */}
//         <a
//           href="/"
//           className="inline-block mb-4 text-sm text-brand-peach hover:text-brand-orange transition-colors"
//         >
//           ← Back to Game
//         </a>

//         <h1 className="text-3xl font-bold mb-2 text-center">Leaderboard</h1>
//         <p className="text-sm text-brand-mid text-center mb-6">
//           {today} — Top 5 Winners
//         </p>

//         {loading ? (
//           <p className="text-center text-brand-mid">Loading...</p>
//         ) : entries.length === 0 ? (
//           <div className="bg-brand-dark border border-brand-mid rounded-xl p-6 text-center">
//             <p className="text-brand-peach text-lg mb-2">No winners yet today!</p>
//             <p className="text-sm text-brand-mid">
//               Be the first to solve today's puzzle and claim the top spot.
//             </p>
//           </div>
//         ) : (
//           <div className="space-y-2">
//             {/* Header row */}
//             <div className="flex items-center gap-3 text-xs text-brand-mid uppercase tracking-wider px-2 pb-2 border-b border-brand-mid">
//               <span className="w-8 text-center">#</span>
//               <span className="flex-1">Employee</span>
//               <span className="w-16 text-center">Attempts</span>
//             </div>

//             {/* Ranked entries */}
//             {entries.map((entry, index) => (
//               <div
//                 key={entry.id}
//                 className={`flex items-center gap-3 px-3 py-3 rounded-lg ${
//                   index === 0
//                     ? "bg-brand-orange/20 border border-brand-orange"
//                     : "bg-brand-dark border border-brand-mid"
//                 }`}
//               >
//                 {/* Rank badge */}
//                 <span className="w-8 text-center font-bold text-lg">
//                   {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
//                 </span>

//                 {/* Employee ID */}
//                 <span className="flex-1 font-semibold text-brand-light">
//                   {entry.employee_id}
//                 </span>

//                 {/* Attempts */}
//                 <span className="w-16 text-center text-brand-peach font-bold">
//                   {entry.attempts_used}/5
//                 </span>
//               </div>
//             ))}
//           </div>
//         )}

//         {/* Link to full history (future) */}
//         <p className="text-xs text-brand-mid text-center mt-8">
//           Only your first win of the day counts. Play again to improve? Your first score sticks!
//         </p>
//       </div>
//     </main>
//   );
// }