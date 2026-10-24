"use client";
/* eslint-disable @next/next/no-img-element -- prize photos come from the organisers' storage */

import { useState, type CSSProperties } from "react";
import { pad2 } from "@/lib/dom";
import { photoStyle, prizeProgress, RARITY_LABEL, ruleText, standing, TASK_TEXT, unlocked, zoneName, type Prize, type Station } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { useProgress } from "@/lib/store";
import { CheckIcon, DexIcon, GiftIcon, ListIcon, LockIcon, MapIcon, ScanIcon } from "./icons";
import { NoCodes } from "./NoCodes";
import { QrTile } from "./QrTile";

const timeFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Layout = "list" | "grid";

/**
 * The collection: all QR codes as floating tiles, found ones lit up, the rest as ghosts with a clue.
 * Codes the organisers have since turned off stay at the end if the player found them. Then the
 * prizes: what each takes, how close they are, and the ones they've won.
 */
export function DexView({
  found,
  onFind,
  onShowOnMap,
  onPrize,
}: {
  found: Record<string, number>;
  /** Open the scanner looking for this code. */
  onFind: (station: Station) => void;
  onShowOnMap: (id: string) => void;
  onPrize: (prize: Prize) => void;
}) {
  const { hunt, known } = useHunt();
  const [layout, setLayout] = useState<Layout>("list"); // always opens as a list
  const [open, setOpen] = useState<string | null>(null);
  const me = standing(hunt, known, found);
  const { count, total, kept } = me;
  const codes = [...hunt.stations, ...kept];
  const off = new Set(kept.map((s) => s.id));
  const sel = codes.find((s) => s.id === open);
  const toggle = (id: string) => setOpen(open === id ? null : id);

  if (!hunt.stations.length)
    return (
      <div className="dex">
        <div className="view-head view-head--center">
          <h1>QR Collection</h1>
        </div>
        <NoCodes inline />
      </div>
    );

  return (
    <div className="dex">
      <div className="view-head view-head--center">
        <h1>QR Collection</h1>
        <div className="seg" role="group" aria-label="Layout">
          {(
            [
              ["list", "List", <ListIcon key="i" />],
              ["grid", "Grid", <DexIcon key="i" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={layout === id ? "seg__btn is-on" : "seg__btn"}
              aria-pressed={layout === id}
              onClick={() => setLayout(id)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="dex__count">
        {count}/{total} found
      </p>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}>
        <span style={{ width: `${total ? (count / total) * 100 : 0}%` }}></span>
      </div>

      {layout === "list" ? (
        <ul className="qlist">
          {codes.map((s, i) => {
            const got = Boolean(found[s.id]);
            const isOpen = open === s.id;
            return (
              <li key={s.id} className={`qlist__item qlist__item--${s.rarity}${got ? " is-found" : ""}`}>
                <button type="button" className="qlist__row" onClick={() => toggle(s.id)} aria-expanded={isOpen}>
                  <QrTile station={s} state={got ? "found" : "locked"} size="sm" i={i} />
                  <span className="qlist__text">
                    <span className="label">
                      #{pad2(s.num)} · <span className={`rarity rarity--${s.rarity}`}>{RARITY_LABEL[s.rarity]}</span>
                    </span>
                    <span className="qlist__title">{got ? s.name : "Not found yet"}</span>
                    <span className="qlist__sub">
                      {off.has(s.id)
                        ? "No longer in the hunt: still yours"
                        : got
                          ? `${zoneName(hunt, s.zone)} · ${s.spot}`
                          : `Somewhere in the ${zoneName(hunt, s.zone)}`}
                    </span>
                  </span>
                  <span className="qlist__end">
                    {got ? (
                      <span className="qlist__check" aria-label="Found">
                        <CheckIcon />
                      </span>
                    ) : (
                      <span className="qlist__pts">+{s.points}</span>
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="qlist__more">
                    <Details station={s} foundAt={found[s.id]} onFind={onFind} onShowOnMap={onShowOnMap} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className="dex__grid">
            {codes.map((s, i) => {
              const got = Boolean(found[s.id]);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`dex__cell dex__cell--${s.rarity}${got ? " is-found" : ""}${open === s.id ? " is-open" : ""}`}
                  style={{ "--i": i } as CSSProperties}
                  onClick={() => toggle(s.id)}
                  aria-expanded={open === s.id}
                  aria-label={got ? `QR code #${s.num}, ${s.name}, found` : `QR code #${s.num}, not found yet`}
                >
                  <QrTile station={s} state={got ? "found" : "locked"} size="sm" i={i} />
                  <span className="dex__num">#{pad2(s.num)}</span>
                </button>
              );
            })}
          </div>

          {sel && (
            <div className="card dex__detail">
              <QrTile station={sel} state={found[sel.id] ? "found" : "locked"} size="md" />
              <div className="dex__info">
                <p className="label">
                  #{pad2(sel.num)} · <span className={`rarity rarity--${sel.rarity}`}>{RARITY_LABEL[sel.rarity]}</span>{" "}
                  · {sel.points} pts
                </p>
                <h2>{found[sel.id] ? sel.name : "Not found yet"}</h2>
                <p className="dex__where">
                  {off.has(sel.id)
                    ? "No longer in the hunt: still yours"
                    : found[sel.id]
                      ? `${zoneName(hunt, sel.zone)} · ${sel.spot}`
                      : `Somewhere in the ${zoneName(hunt, sel.zone)}`}
                </p>
                <Details station={sel} foundAt={found[sel.id]} onFind={onFind} onShowOnMap={onShowOnMap} />
              </div>
            </div>
          )}
        </>
      )}

      {hunt.prizes.length > 0 && (
        <section className="dex__prizes" aria-labelledby="dex-prizes">
          <h2 id="dex-prizes" className="dex__prizes-title">
            Prizes
          </h2>
          <ul className="quest-list">
            {hunt.prizes.map((pr) => {
              const { part, won } = prizeProgress(pr, me);
              return (
                <li key={pr.id} className={won ? "card quest prizeq is-done" : "card quest prizeq"}>
                  <span className="prizeq__photo" aria-hidden="true">
                    {pr.photo ? <img src={pr.photo} alt="" loading="lazy" decoding="async" style={photoStyle(pr)} /> : <GiftIcon />}
                  </span>
                  <div className="quest__body">
                    <h2>{pr.name}</h2>
                    <p>{won ? "You won it!" : ruleText(pr, total)}</p>
                    {!won && (
                      <div className="bar bar--thin">
                        <span style={{ width: `${part * 100}%` }}></span>
                      </div>
                    )}
                  </div>
                  {won ? (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => onPrize(pr)}>
                      Claim
                    </button>
                  ) : (
                    <span className="quest__count">{Math.round(part * 100)}%</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Found: the description and when. Not found: the clue, a way to go find it, and its spot on the map. */
function Details({
  station,
  foundAt,
  onFind,
  onShowOnMap,
}: {
  station: Station;
  foundAt?: number;
  onFind: (station: Station) => void;
  onShowOnMap: (id: string) => void;
}) {
  const { tasks } = useProgress();
  if (foundAt) {
    return (
      <>
        <p>{station.blurb}</p>
        <p className="dex__when">Found {timeFmt.format(foundAt)}</p>
      </>
    );
  }
  const open = unlocked(station, tasks);
  return (
    <>
      <p>“{station.clue}”</p>
      {station.task !== "none" && (
        <p className={open ? "taskline is-done" : "taskline"}>
          {open ? <CheckIcon /> : <LockIcon />}
          {open ? "Extra task done" : TASK_TEXT[station.task]}
        </p>
      )}
      <div className="dex__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onFind(station)}>
          {open ? <ScanIcon /> : <LockIcon />}
          {open ? "Find it" : "Do the task"}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onShowOnMap(station.id)}>
          <MapIcon />
          Show on map
        </button>
      </div>
    </>
  );
}
