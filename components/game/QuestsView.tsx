"use client";

import { STATIONS, TOTAL, ZONES } from "@/lib/hunt";
import { I8Mark } from "./I8Mark";

type Quest = { id: string; title: string; desc: string; have: number; need: number };

function questsFor(found: Record<string, number>): Quest[] {
  const caught = STATIONS.filter((s) => found[s.id]);
  const rares = STATIONS.filter((s) => s.rarity === "rare");
  const legendary = STATIONS.filter((s) => s.rarity === "legendary");
  const zones = new Set(caught.map((s) => s.zone));
  return [
    { id: "first", title: "First contact", desc: "Scan your first QR code.", have: caught.length, need: 1 },
    { id: "half", title: "Halfway there", desc: `Collect ${TOTAL / 2} QR codes.`, have: caught.length, need: TOTAL / 2 },
    {
      id: "rare",
      title: "Rare hunter",
      desc: "Find every rare QR code.",
      have: caught.filter((s) => s.rarity === "rare").length,
      need: rares.length,
    },
    {
      id: "legend",
      title: "Legend",
      desc: "Find the legendary gold QR code.",
      have: caught.filter((s) => s.rarity === "legendary").length,
      need: legendary.length,
    },
    { id: "explorer", title: "Explorer", desc: "Find a QR code in every zone.", have: zones.size, need: ZONES.length },
    { id: "all", title: "Completionist", desc: `Collect all ${TOTAL} QR codes to unlock the prize.`, have: caught.length, need: TOTAL },
  ];
}

export function QuestsView({ found }: { found: Record<string, number> }) {
  const quests = questsFor(found);
  const done = quests.filter((q) => q.have >= q.need).length;

  return (
    <div className="quests">
      <div className="view-head">
        <h1>Quests</h1>
        <span className="view-head__meta">
          {done}/{quests.length} done
        </span>
      </div>

      <ul className="quest-list">
        {quests.map((q) => {
          const complete = q.have >= q.need;
          return (
            <li key={q.id} className={complete ? "card quest is-done" : "card quest"}>
              <span className="quest__badge" aria-hidden="true">
                <I8Mark />
              </span>
              <div className="quest__body">
                <h2>{q.title}</h2>
                <p>{q.desc}</p>
                <div className="bar bar--thin">
                  <span style={{ width: `${Math.min(1, q.have / q.need) * 100}%` }}></span>
                </div>
              </div>
              <span className="quest__count">
                {Math.min(q.have, q.need)}/{q.need}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
