"use client";

import { useEffect, useState } from "react";
import { loadBoard, type Board, type BoardRow } from "@/lib/hunter";
import { CloseIcon, TrophyIcon } from "./icons";

/** How often the leaderboard is fetched again while the game is open */
const EVERY_MS = 45_000;

/**
 * The leaderboard, kept fresh: fetched now, every 45 s while the game is on screen, when it comes back
 * on screen, after this player finds a code (`found` changes) and when the leaderboard is opened.
 * Null until it's arrived (no signal, no hunter ID yet, or a database without the leaderboard update:
 * then the game has no leaderboard). Without a signal it keeps the last one.
 */
export function useBoard(name: string, province: string, on: boolean, found: number, open: boolean) {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void loadBoard(name, province).then((b) => {
        if (alive && b) setBoard(b);
      });
    };
    load();
    const t = window.setInterval(load, EVERY_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [on, name, province, found, open]);
  return board;
}

/** The trophy chip in the top bar: the player's rank ("#12"), or just the trophy until they're on the board. */
export function RankChip({ board, onOpen }: { board: Board; onOpen: () => void }) {
  const me = board.me;
  return (
    <button
      type="button"
      className="chip chip--btn chip--rank"
      onClick={onOpen}
      aria-label={me ? `Leaderboard: you're number ${me.rank} of ${board.players}` : "Leaderboard"}
    >
      <TrophyIcon />
      {me && `#${me.rank}`}
    </button>
  );
}

/**
 * The leaderboard, over the game: the top 20 hunters (rank, name and province, points, codes found),
 * the player's own row lit up, and below the list their own place when it's further down. "Final
 * results" once the hunt has ended.
 */
export function LeaderboardSheet({
  board,
  you,
  onClose,
}: {
  board: Board;
  /** This player's name and province (for their own row below the top 20) */
  you: { name: string; province: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);
  // Further down than the top 20: their own row under the list
  const below = board.me && !board.top.some((r) => r.me) ? { ...board.me, ...you, me: true } : null;
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="board">
        <button type="button" className="icon-btn board__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="board__head">
          <span className="board__icon" aria-hidden="true">
            <TrophyIcon />
          </span>
          <p className="board__eyebrow">{board.final ? "Final results" : "Leaderboard"}</p>
          <h2 id="board-title">Top hunters</h2>
          <p className="board__sub">
            {board.players === 1 ? "1 hunter" : `${board.players.toLocaleString("en-PH")} hunters`} on the board · points, then codes found
          </p>
        </div>

        {board.top.length ? (
          <ol className="board__list">
            {board.top.map((r) => (
              <Row key={r.rank} r={r} />
            ))}
          </ol>
        ) : (
          <p className="board__empty">Nobody&apos;s on the board yet. Find a QR code to be the first!</p>
        )}

        {below && (
          <ol className="board__list board__list--you" aria-label="Your place">
            <Row r={below} />
          </ol>
        )}
        {!board.me && board.top.length > 0 && <p className="board__note">Find a QR code to get on the board.</p>}
      </div>
    </div>
  );
}

function Row({ r }: { r: BoardRow }) {
  return (
    <li className={`board__row${r.me ? " is-me" : ""}${r.rank <= 3 ? ` is-top is-${r.rank}` : ""}`}>
      <span className="board__rank">{r.rank}</span>
      <span className="board__who">
        <b>
          {r.name}
          {r.me && <span className="board__you">You</span>}
        </b>
        <small>{r.province}</small>
      </span>
      <span className="board__score">
        <b>{r.score.toLocaleString("en-PH")}</b>
        <small>
          pts · {r.codes} code{r.codes === 1 ? "" : "s"}
        </small>
      </span>
    </li>
  );
}
