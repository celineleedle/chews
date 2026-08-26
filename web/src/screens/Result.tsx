import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import type { RankedResult, Restaurant } from "@chews/shared";
import { useRoomStore } from "../store/roomStore";
import { restaurantSubtitle } from "../lib/format";
import Confetti from "../components/Confetti";
import RestaurantCard from "../components/RestaurantCard";
import RestaurantDetailSheet from "../components/RestaurantDetailSheet";
import { PrimaryButton, Screen } from "../components/ui";

function RankedRow({ item, rank, onSelect }: { item: RankedResult; rank: number; onSelect: () => void }) {
  const r = item.restaurant;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 rounded-2xl bg-eggshell p-3 text-left shadow-sm transition active:scale-[0.98]"
      >
        <span className="w-6 text-center font-display text-lg font-bold text-ink-soft">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{r.name}</div>
          <div className="truncate text-sm text-ink-soft">{restaurantSubtitle(r)}</div>
        </div>
        <span className="shrink-0 rounded-full bg-leaf/10 px-3 py-1 text-sm font-bold text-leaf-deep">
          {item.likeCount} ♥
        </span>
      </button>
    </li>
  );
}

export default function Result() {
  const navigate = useNavigate();
  const result = useRoomStore((s) => s.result);
  const members = useRoomStore((s) => s.members);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  if (!result) return null;
  const matched = result.kind === "matched";

  return (
    <Screen className="gap-5">
      {matched && <Confetti />}

      <div className="text-center">
        <h1 className="font-display text-4xl font-black text-ink">
          {matched ? "It's a match! 🎉" : "The votes are in"}
        </h1>
        <p className="mt-1 text-ink-soft">
          {matched
            ? `All ${members.length > 1 ? `${members.length} of you` : "of you"} said yes. Dinner is decided.`
            : "No unanimous pick this time — here's how the crew voted."}
        </p>
      </div>

      {matched ? (
        <>
          {/* The outer box owns the height so the flex column never has to derive a
              flex item's main size from aspect-ratio (WebKit gets that wrong and lets
              the card paint over the backup plans below it — see #3). */}
          <div className="flex h-[46dvh] shrink-0 justify-center">
            <div className="aspect-[3/4] h-full max-w-full">
              <button
                type="button"
                onClick={() => setSelected(result.winner)}
                aria-label={`View ${result.winner.name} details`}
                className="block h-full w-full rounded-3xl transition active:scale-[0.98]"
              >
                <RestaurantCard restaurant={result.winner} />
              </button>
            </div>
          </div>
          {result.winner.mapsUrl && (
            <a
              href={result.winner.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-center font-semibold text-primary-deep underline underline-offset-4"
            >
              Open in Google Maps
            </a>
          )}
          {result.ranked.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-lg font-bold text-ink">Backup plans</h2>
              <ul className="flex flex-col gap-2">
                {result.ranked.slice(0, 3).map((item, i) => (
                  <RankedRow
                    key={item.restaurant.placeId}
                    item={item}
                    rank={i + 1}
                    onSelect={() => setSelected(item.restaurant)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.ranked.length === 0 && (
            <p className="py-10 text-center text-ink-soft">
              Nobody liked anything?! Tough crowd. 🫠
            </p>
          )}
          {result.ranked.slice(0, 8).map((item, i) => (
            <RankedRow
              key={item.restaurant.placeId}
              item={item}
              rank={i + 1}
              onSelect={() => setSelected(item.restaurant)}
            />
          ))}
        </ul>
      )}

      <div className="mt-auto pt-2">
        <PrimaryButton onClick={() => navigate("/")}>Done — let's eat</PrimaryButton>
      </div>

      <AnimatePresence>
        {selected && (
          <RestaurantDetailSheet
            restaurant={selected}
            onClose={() => setSelected(null)}
            closeLabel="Back to results"
          />
        )}
      </AnimatePresence>
    </Screen>
  );
}
