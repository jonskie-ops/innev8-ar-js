"use client";

import type { Hunt } from "@/lib/hunt";
import { useHunt } from "@/lib/huntStore";
import { I8Mark } from "./I8Mark";

type Quest = { id: string; title: string; desc: string; have: number; need: number };

/** Goals among the codes that are on (the zones counted are the ones that have codes). */
function questsFor(hunt: Hunt, found: Record<string, number>): Quest[] {
  const all = hunt.stations;
  const TOTAL = all.length;
  const caught = all.filter((s) => found[s.id]);
  const rares = all.filter((s) => s.rarity === "rare");
  const legendary = all.filter((s) => s.rarity === "legendary");
  const zones = new Set(caught.map((s) => s.zone));
  const zonesWithCodes = new Set(all.map((s) => s.zone)).size;
  const half = Math.max(1, Math.ceil(TOTAL / 2));
  const prized = hunt.prizes.some((p) => p.rule === "all");
  const quests: Quest[] = [
    { id: "first", title: "First contact", desc: "Scan your first QR code.", have: caught.length, need: 1 },
    { id: "half", title: "Halfway there", desc: `Collect ${half} QR codes.`, have: caught.length, need: half },
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
    { id: "explorer", title: "Explorer", desc: "Find a QR code in every zone.", have: zones.size, need: zonesWithCodes },
    {
      id: "all",
      title: "Completionist",
      desc: prized ? `Collect all ${TOTAL} QR codes to unlock the prize.` : `Collect all ${TOTAL} QR codes.`,
      have: caught.length,
      need: TOTAL,
    },
  ];
  // A goal with nothing to find (no rare code in the hunt, say) is left out
  return quests.filter((q) => q.need > 0);
}

export function QuestsView({ found }: { found: Record<string, number> }) {
  const { hunt } = useHunt();
  const quests = questsFor(hunt, found);
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
