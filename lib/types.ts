import type { Game, Settings } from "./games";
export type Player = {
  id: string;
  name: string;
  rating: number;
  delta: number;
  avatar: string | null;
  role: "owner" | "member";
  active: boolean;
};
export type Submission = {
  userId: string;
  game: Game;
  score: number;
  date: string;
  puzzleKey: string;
  raw: string;
};
export type History = {
  date: string;
  game: Game;
  score: number;
  delta: number | null;
  rating: number | null;
};
export type Invite = {
  id: string;
  email: string;
  expires: string;
  accepted: boolean;
};
export type DashboardData = {
  demo: boolean;
  date: string;
  settings: Settings;
  me: string;
  players: Player[];
  submissions: Submission[];
  latestSubmission?: Submission | null;
  history: History[];
  invites: Invite[];
};
