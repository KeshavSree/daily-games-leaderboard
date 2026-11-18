import { dateInZone, defaultSettings, puzzleNumber } from "./games";
import type { DashboardData } from "./types";
export function demoData(): DashboardData {
  const date = dateInZone();
  return {
    demo: true,
    date,
    settings: defaultSettings,
    me: "you",
    players: [
      { id: "sam", name: "Sam", rating: 1184, delta: 18 },
      { id: "alex", name: "Alex", rating: 1142, delta: -7 },
      { id: "you", name: "You", rating: 1106, delta: 24 },
      { id: "jordan", name: "Jordan", rating: 1088, delta: 6 },
      { id: "riley", name: "Riley", rating: 1041, delta: -16 },
      { id: "jamie", name: "Jamie", rating: 1007, delta: -25 },
    ].map((p) => ({
      ...p,
      avatar: null,
      role: p.id === "you" ? "owner" : "member",
      active: true,
    })),
    submissions: [
      {
        userId: "sam",
        game: "maptap",
        score: 974,
        date,
        puzzleKey: date,
        raw: "",
      },
      {
        userId: "alex",
        game: "maptap",
        score: 921,
        date,
        puzzleKey: date,
        raw: "",
      },
      {
        userId: "jordan",
        game: "maptap",
        score: 886,
        date,
        puzzleKey: date,
        raw: "",
      },
      {
        userId: "riley",
        game: "chainle",
        score: 3820,
        date,
        puzzleKey: String(puzzleNumber(date)),
        raw: "",
      },
      {
        userId: "sam",
        game: "chainle",
        score: 4210,
        date,
        puzzleKey: String(puzzleNumber(date)),
        raw: "",
      },
    ],
    history: [],
    invites: [],
  };
}
