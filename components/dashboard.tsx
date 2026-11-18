"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  Plus,
  X,
  LogOut,
  Upload,
  ArrowLeft,
} from "lucide-react";
import {
  deleteScore,
  inviteFriend,
  logOut,
  revokeInvite,
  saveProfile,
  submitScore,
} from "@/app/actions";
import {
  gameNames,
  gameLinks,
  supportedGames,
  parseScore,
  type Game,
} from "@/lib/games";
import { mergeScoreHistory } from "@/lib/history";
import type { DashboardData, Player } from "@/lib/types";
const num = (n: number) => Math.round(n).toLocaleString("en-US");
function Delta({ value }: { value: number }) {
  return (
    <span
      className={`delta ${value > 0 ? "positive" : value < 0 ? "negative" : ""}`}
    >
      {value > 0 ? "+" : ""}
      {Math.round(value) || "—"}
    </span>
  );
}
function Avatar({ player }: { player: Player }) {
  return player.avatar ? (
    <img className="avatar" src={player.avatar} alt="" />
  ) : null;
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function Dashboard({ initial }: { initial: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [hydrated, setHydrated] = useState(false);
  const closed = false;
  const [tab, setTab] = useState<"leaderboard" | "history">("leaderboard");
  const [filter, setFilter] = useState<"all" | Game>("all");
  const [raw, setRaw] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const [modal, setModal] = useState<"profile" | "invites" | null>(null);
  const [modalError, setModalError] = useState("");
  const [modalNotice, setModalNotice] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const gamesMenu = useRef<HTMLDetailsElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const me = data.players.find((p) => p.id === data.me)!;
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!gamesMenu.current?.contains(event.target as Node))
        gamesMenu.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (initial.demo) {
      try {
        const stored = JSON.parse(
          localStorage.getItem("daily-demo-v1") || "null",
        );
        if (
          stored?.data?.date === initial.date &&
          Array.isArray(stored.data.players) &&
          stored.data.players.some((p: Player) => p.id === "you") &&
          Array.isArray(stored.data.submissions) &&
          Array.isArray(stored.data.history)
        ) {
          setData(stored.data);
        }
      } catch {}
    }
    setHydrated(true);
  }, [initial.demo, initial.date]);
  useEffect(() => {
    if (!initial.demo) setData(initial);
  }, [initial]);
  useEffect(() => {
    if (initial.demo) return;
    const refresh = () => router.refresh();
    const timer = setInterval(refresh, 60000);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [initial.demo, router]);
  useEffect(() => {
    if (data.demo && hydrated) {
      try {
        localStorage.setItem("daily-demo-v1", JSON.stringify({ data, closed }));
      } catch {
        setError("Your browser could not save this demo.");
      }
    }
  }, [data, closed, hydrated]);
  const preview = useMemo(() => {
    try {
      return parseScore(raw, data.date, data.settings);
    } catch {
      return null;
    }
  }, [raw, data.date, data.settings]);
  const players = [...data.players].sort(
    (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
  );
  const myScores = data.submissions.filter((s) => s.userId === data.me);
  const historyRows = mergeScoreHistory(myScores, data.history);
  const lastScore = data.demo ? myScores.at(-1) : data.latestSubmission;
  const dateLabel = new Date(
    (lastScore?.date || data.date) + "T12:00:00Z",
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const headerDate = `${data.date.slice(5, 7)}.${data.date.slice(8, 10)}.${data.date.slice(2, 4)}`;
  function openModal(which: "profile" | "invites") {
    setModalError("");
    setModalNotice("");
    setRemovePhoto(false);
    setModal(which);
  }
  function submit() {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const parsed = parseScore(raw, data.date, data.settings);
        if (closed) throw new Error("Day closed. Reset the demo to try again.");
        if (!data.demo) {
          const result = await submitScore(raw);
          if (result.error) throw new Error(result.error);
        }
        setData((d) => ({
          ...d,
          latestSubmission: { ...parsed, userId: d.me, raw },
          submissions: [
            ...d.submissions.filter(
              (s) =>
                !(
                  s.userId === d.me &&
                  s.game === parsed.game &&
                  s.date === parsed.date
                ),
            ),
            { ...parsed, userId: d.me, raw },
          ],
        }));
        if (!data.demo) router.refresh();
        setRaw("");
        setNotice(`${gameNames[parsed.game]} submitted`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit score.");
      }
    });
  }
  function remove(game: Game) {
    setError("");
    startTransition(async () => {
      if (data.demo) {
        setData((d) => ({
          ...d,
          submissions: d.submissions.filter(
            (s) => !(s.userId === d.me && s.game === game),
          ),
        }));
      } else {
        const result = await deleteScore(game, data.date);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      }
      setNotice("Score removed");
    });
  }
  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Daily home">
          daily<span>/</span>
          <time className="wordmark-date" dateTime={data.date}>
            {headerDate}
          </time>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={tab === "leaderboard" ? "nav-link active" : "nav-link"}
            onClick={() => setTab("leaderboard")}
          >
            Leaderboard
          </button>
          <button
            className={tab === "history" ? "nav-link active" : "nav-link"}
            onClick={() => setTab("history")}
          >
            History
          </button>
          <details
            className="games-menu"
            ref={gamesMenu}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                gamesMenu.current?.removeAttribute("open");
                gamesMenu.current?.querySelector("summary")?.focus();
              }
            }}
          >
            <summary className="nav-link">
              Games
              <ChevronDown size={12} />
            </summary>
            <div className="games-dropdown">
              {supportedGames.map((game) => (
                <a
                  key={game}
                  href={gameLinks[game]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => gamesMenu.current?.removeAttribute("open")}
                >
                  {gameNames[game]}
                </a>
              ))}
            </div>
          </details>
        </nav>
        <div className="header-actions">
          {me.role === "owner" && (
            <button
              className="invite-link"
              onClick={() => openModal("invites")}
            >
              <Plus size={14} />
              Invite a friend
            </button>
          )}
          <button className="profile-link" onClick={() => openModal("profile")}>
            <Avatar player={me} />
            <span>{me.name}</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <h1>
              {tab === "leaderboard" ? "Leaderboard" : "Your history"}
              <span className="heading-period">.</span>
            </h1>
          </div>
        </div>
        {tab === "leaderboard" ? (
          <div className="main-grid">
            <section className="standings" aria-label="Leaderboard">
              <div className="section-toolbar">
                <div className="section-title">
                  Overall <span className="count">{players.length}</span>
                </div>
                <label className="filter">
                  <span className="sr-only">Today’s score filter</span>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as typeof filter)}
                  >
                    <option value="all">All games</option>
                    {supportedGames.map((game) => (
                      <option key={game} value={game}>
                        {gameNames[game]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="table-scroll">
                <table className="leaderboard">
                  <thead>
                    <tr>
                      <th scope="col" className="rank">
                        #
                      </th>
                      <th scope="col">Player</th>
                      <th scope="col" className="numeric">
                        Elo
                      </th>
                      <th scope="col" className="numeric change-col">
                        Change
                      </th>
                      <th scope="col" className="numeric today-col">
                        {filter === "all" ? "Today" : gameNames[filter]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => {
                      const scores = data.submissions.filter(
                        (s) => s.userId === player.id,
                      );
                      const score = scores.find((s) => s.game === filter);
                      return (
                        <tr
                          key={player.id}
                          className={player.id === data.me ? "your-row" : ""}
                        >
                          <td className="rank">{index + 1}</td>
                          <td>
                            <div className="player-name">
                              <Avatar player={player} />
                              <span>{player.name}</span>
                            </div>
                          </td>
                          <td className="numeric rating">
                            {num(player.rating)}
                          </td>
                          <td className="numeric">
                            <Delta value={player.delta} />
                          </td>
                          <td className="numeric today-score">
                            {filter === "all" ? (
                              <span
                                className={
                                  scores.length ? "submitted-count" : ""
                                }
                              >
                                {scores.length}
                                <span className="muted">
                                  {" "}
                                  / {supportedGames.length}
                                </span>
                              </span>
                            ) : score ? (
                              num(score.score)
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <aside className="submission-panel">
              <div className="section-toolbar">
                <h2>Submit a score</h2>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="sr-only" htmlFor="share-score">
                  Paste your game’s share text
                </label>
                <div className={`paste-box ${preview ? "detected" : ""}`}>
                  <textarea
                    id="share-score"
                    ref={textarea}
                    value={raw}
                    onChange={(e) => {
                      setRaw(e.target.value);
                      setNotice("");
                      setError("");
                    }}
                    placeholder={"Paste your result here…"}
                    maxLength={4000}
                    disabled={closed || busy}
                    spellCheck={false}
                  />
                  <div className="paste-bottom">
                    {preview ? (
                      <span className="detected-label">
                        {gameNames[preview.game]}
                        <span className="muted">/</span>
                        {num(preview.score)}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="paste-mark">↵</span>
                  </div>
                </div>
                <button
                  className="primary full"
                  disabled={!raw.trim() || busy || closed}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : closed ? (
                    "Day closed"
                  ) : (
                    "Submit score"
                  )}
                  {!busy && !closed && <ArrowUpRight size={18} />}
                </button>
              </form>
              <div aria-live="polite" className="feedback">
                {error ? (
                  <p className="error">{error}</p>
                ) : notice ? (
                  <p className="success">
                    <Check size={14} />
                    {notice}
                  </p>
                ) : null}
              </div>
              {lastScore && (
                <section aria-label="Last submitted score">
                  <div className="submitted-heading">
                    <h3>Last score</h3>
                    <span>{dateLabel}</span>
                  </div>
                  <div className="score-row">
                    <div className="score-game">
                      <span>{gameNames[lastScore.game]}</span>
                    </div>
                    <div className="score-actions">
                      <strong>{num(lastScore.score)}</strong>
                      {lastScore.date === data.date && !closed && (
                        <>
                          <button
                            className="edit-score"
                            onClick={() => {
                              setRaw(lastScore.raw);
                              textarea.current?.focus();
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Remove ${gameNames[lastScore.game]} score`}
                            disabled={busy}
                            onClick={() => remove(lastScore.game)}
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </aside>
          </div>
        ) : (
          <section className="history-section">
            <div className="section-toolbar">
              <h2>Daily results</h2>
            </div>
            {historyRows.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Game</th>
                      <th className="numeric">Score</th>
                      <th className="numeric">Change</th>
                      <th className="numeric">Closing Elo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((h) => (
                      <tr key={`${h.date}-${h.game}`}>
                        <td>
                          {new Date(h.date + "T12:00:00Z").toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", timeZone: "UTC" },
                          )}
                        </td>
                        <td>{gameNames[h.game]}</td>
                        <td className="numeric">{num(h.score)}</td>
                        <td className="numeric">
                          {h.delta === null ? (
                            <span className="muted tiny">Pending</span>
                          ) : (
                            <Delta value={h.delta} />
                          )}
                        </td>
                        <td className="numeric rating">
                          {h.rating === null ? (
                            <span className="muted">—</span>
                          ) : (
                            num(h.rating)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Clock3 size={22} />
                <p>No results yet.</p>
              </div>
            )}
            <button className="back-link" onClick={() => setTab("leaderboard")}>
              <ArrowLeft size={14} />
              Leaderboard
            </button>
          </section>
        )}
      </main>
      {modal === "profile" && (
        <Modal title="Your profile" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              form.set("removeAvatar", String(removePhoto));
              setModalError("");
              setModalNotice("");
              startTransition(async () => {
                if (data.demo) {
                  const name = String(form.get("name")).trim();
                  if (!name || name.length > 30) {
                    setModalError("Use a name with 1–30 characters.");
                    return;
                  }
                  const file = form.get("avatar");
                  let avatar = removePhoto ? null : me.avatar;
                  if (file instanceof File && file.size) {
                    if (
                      file.size > 2 * 1024 * 1024 ||
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        file.type,
                      )
                    ) {
                      setModalError("Choose a PNG, JPG, or WebP under 2 MB.");
                      return;
                    }
                    avatar = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                  }
                  setData((d) => ({
                    ...d,
                    players: d.players.map((p) =>
                      p.id === d.me ? { ...p, name, avatar } : p,
                    ),
                  }));
                } else {
                  const result = await saveProfile(form);
                  if (result.error) {
                    setModalError(result.error);
                    return;
                  }
                  router.refresh();
                }
                setModalNotice("Profile saved");
              });
            }}
          >
            <label>
              Display name
              <input
                name="name"
                defaultValue={me.name}
                required
                maxLength={30}
              />
            </label>
            <label>
              Photo <span className="muted">optional</span>
              <div className="upload-row">
                {me.avatar && !removePhoto && <Avatar player={me} />}
                <Upload size={17} />
                <input
                  name="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={() => setRemovePhoto(false)}
                />
              </div>
            </label>
            {me.avatar && (
              <button
                type="button"
                className="text-link"
                onClick={() => setRemovePhoto(true)}
              >
                {removePhoto ? "Photo will be removed" : "Remove photo"}
              </button>
            )}
            {modalError && (
              <p role="alert" className="error">
                {modalError}
              </p>
            )}
            {modalNotice && (
              <p role="status" className="success">
                {modalNotice}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
              <Check size={16} />
            </button>
          </form>
          <div className="modal-footer">
            <a href="/forgot-password">Reset password</a>
            {data.demo ? (
              <a href="/login">Login screen</a>
            ) : (
              <button
                onClick={() =>
                  startTransition(async () => {
                    await logOut();
                  })
                }
              >
                <LogOut size={14} />
                Log out
              </button>
            )}
          </div>
        </Modal>
      )}
      {modal === "invites" && (
        <Modal title="Invite Member" close={() => setModal(null)}>
          {data.demo && (
            <p className="notice">Connect Supabase to send invitations.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const email = String(new FormData(form).get("email"));
              setModalError("");
              setModalNotice("");
              startTransition(async () => {
                const result = await inviteFriend(email);
                if (result.error) {
                  setModalError(result.error);
                  return;
                }
                form.reset();
                setModalNotice("Invitation sent");
                router.refresh();
              });
            }}
          >
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="friend@example.com"
                required
                disabled={data.demo}
              />
            </label>
            <button className="primary full" disabled={data.demo || busy}>
              Send invitation
              <ArrowUpRight size={16} />
            </button>
          </form>
          {modalError && (
            <p role="alert" className="error">
              {modalError}
            </p>
          )}
          {modalNotice && (
            <p role="status" className="success">
              {modalNotice}
            </p>
          )}
          <div className="member-list">
            {data.invites
              .filter((i) => !i.accepted)
              .map((invite) => (
                <div className="member-row" key={invite.id}>
                  <span>
                    {invite.email}
                    <small className="muted">
                      {new Date(invite.expires) < new Date()
                        ? "Expired"
                        : "Invited"}
                    </small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Revoke invite for ${invite.email}`}
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await revokeInvite(invite.id);
                        if (result.error) setModalError(result.error);
                        else router.refresh();
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                  <button
                    className="edit-score"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await inviteFriend(invite.email);
                        if (result.error) setModalError(result.error);
                        else {
                          setModalNotice("Invitation sent");
                          router.refresh();
                        }
                      })
                    }
                  >
                    Resend
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
