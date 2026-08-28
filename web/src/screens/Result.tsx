import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import type { RankedResult, Restaurant } from "@chews/shared";
import { useRoomStore } from "../store/roomStore";
import { restaurantSubtitle } from "../lib/format";
import Confetti from "../components/Confetti";
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

function MatchRow({ restaurant, onSelect }: { restaurant: Restaurant; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 rounded-2xl bg-leaf/15 p-3 text-left shadow-sm transition active:scale-[0.98]"
      >
        {restaurant.photoUrl ? (
          // Reuse the deck's exact photo URL so the browser cache serves it.
          <img src={restaurant.photoUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-leaf/20 text-2xl">
            🍽️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-bold text-ink">{restaurant.name}</div>
          <div className="truncate text-sm text-ink-soft">{restaurantSubtitle(restaurant)}</div>
        </div>
        <span className="shrink-0 text-xl" aria-hidden>
          🎉
        </span>
      </button>
    </li>
  );
}

export default function Result() {
  const navigate = useNavigate();
  const result = useRoomStore((s) => s.result);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  if (!result) return null;
  const { matches, ranked } = result;

  // Copy keys off the match count — matches are a list the group picks from
  // in person, so nothing here declares dinner "decided".
  const title =
    matches.length === 0
      ? "The votes are in"
      : matches.length === 1
        ? "It's a match! 🎉"
        : `${matches.length} matches! 🎉`;
  const subtitle =
    matches.length === 0
      ? "No unanimous pick this time — here's how the crew voted."
      : matches.length === 1
        ? "Everyone said yes. Enjoy!"
        : "Everyone said yes to all of these — pick your favorite together.";

  return (
    <Screen className="gap-5">
      {matches.length > 0 && <Confetti />}

      <div className="text-center">
        <h1 className="font-display text-4xl font-black text-ink">{title}</h1>
        <p className="mt-1 text-ink-soft">{subtitle}</p>
      </div>

      {matches.length > 0 && (
        <section>
          <ul className="flex flex-col gap-2">
            {matches.map((r) => (
              <MatchRow key={r.placeId} restaurant={r} onSelect={() => setSelected(r)} />
            ))}
          </ul>
        </section>
      )}

      {ranked.length > 0 ? (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-ink">
            {matches.length > 0 ? "Backup plans" : "How the crew voted"}
          </h2>
          <ul className="flex flex-col gap-2">
            {ranked.slice(0, matches.length > 0 ? 3 : 8).map((item, i) => (
              <RankedRow
                key={item.restaurant.placeId}
                item={item}
                rank={i + 1}
                onSelect={() => setSelected(item.restaurant)}
              />
            ))}
          </ul>
        </section>
      ) : (
        matches.length === 0 && (
          <p className="py-10 text-center text-ink-soft">Nobody liked anything?! Tough crowd. 🫠</p>
        )
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
