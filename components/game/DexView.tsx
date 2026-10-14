"use client";

import { useState, type CSSProperties } from "react";
import { pad2 } from "@/lib/dom";
import { POINTS, RARITY_LABEL, STATIONS, TOTAL, zoneName, type Station } from "@/lib/hunt";
import { CheckIcon, DexIcon, ListIcon, MapIcon } from "./icons";
import { QrTile } from "./QrTile";

const timeFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Layout = "list" | "grid";

/** The collection: all QR codes as floating tiles, found ones lit up, the rest as ghosts with a clue. */
export function DexView({
  found,
  onShowOnMap,
  onPrize,
}: {
  found: Record<string, number>;
  onShowOnMap: (id: string) => void;
  onPrize: () => void;
}) {
  const [layout, setLayout] = useState<Layout>("list"); // always opens as a list
  const [open, setOpen] = useState<string | null>(null);
  const count = STATIONS.filter((s) => found[s.id]).length;
  const complete = count === TOTAL;
  const sel = STATIONS.find((s) => s.id === open);
  const toggle = (id: string) => setOpen(open === id ? null : id);

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
        {count}/{TOTAL} found
      </p>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={count}>
        <span style={{ width: `${(count / TOTAL) * 100}%` }}></span>
      </div>

      {layout === "list" ? (
        <ul className="qlist">
          {STATIONS.map((s, i) => {
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
                      {got ? `${zoneName(s.zone)} · ${s.spot}` : `Somewhere in the ${zoneName(s.zone)}`}
                    </span>
                  </span>
                  <span className="qlist__end">
                    {got ? (
                      <span className="qlist__check" aria-label="Found">
                        <CheckIcon />
                      </span>
                    ) : (
                      <span className="qlist__pts">+{POINTS[s.rarity]}</span>
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="qlist__more">
                    <Details station={s} foundAt={found[s.id]} onShowOnMap={onShowOnMap} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className="dex__grid">
            {STATIONS.map((s, i) => {
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
                  · {POINTS[sel.rarity]} pts
                </p>
                <h2>{found[sel.id] ? sel.name : "Not found yet"}</h2>
                <p className="dex__where">
                  {found[sel.id] ? `${zoneName(sel.zone)} · ${sel.spot}` : `Somewhere in the ${zoneName(sel.zone)}`}
                </p>
                <Details station={sel} foundAt={found[sel.id]} onShowOnMap={onShowOnMap} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="dex__prize">
        <button type="button" className="btn btn--primary" disabled={!complete} onClick={onPrize}>
          {complete ? "Claim your prize" : `Prize unlocks at ${TOTAL}/${TOTAL}`}
        </button>
      </div>
    </div>
  );
}

/** Found: the description and when. Not found: the clue and a link to its spot on the map. */
function Details({
  station,
  foundAt,
  onShowOnMap,
}: {
  station: Station;
  foundAt?: number;
  onShowOnMap: (id: string) => void;
}) {
  if (foundAt) {
    return (
      <>
        <p>{station.blurb}</p>
        <p className="dex__when">Found {timeFmt.format(foundAt)}</p>
      </>
    );
  }
  return (
    <>
      <p>“{station.clue}”</p>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onShowOnMap(station.id)}>
        <MapIcon />
        Show on map
      </button>
    </>
  );
}
