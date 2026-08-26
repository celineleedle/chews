import { useNavigate } from "react-router-dom";
import type { RankedResult } from "@chews/shared";
import { useRoomStore } from "../store/roomStore";
import Confetti from "../components/Confetti";
import RestaurantCard from "../components/RestaurantCard";
import { PrimaryButton, Screen } from "../components/ui";

function RankedRow({ item, rank }: { item: RankedResult; rank: number }) {
  const r = item.restaurant;
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-eggshell p-3 shadow-sm">
      <span className="w-6 text-center font-display text-lg font-bold text-ink-soft">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">{r.name}</div>
        <div className="truncate text-sm text-ink-soft">
          {[r.category, r.priceLevel ? "$".repeat(r.priceLevel) : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-leaf/10 px-3 py-1 text-sm font-bold text-leaf-deep">
        {item.likeCount} ♥
      </span>
    </li>
  );
}

export default function Result() {
  const navigate = useNavigate();
  const result = useRoomStore((s) => s.result);
  const members = useRoomStore((s) => s.members);

  if (!result) return null;
  const matched = result.kind === "matched" && result.winner;

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
          <div className="aspect-[3/4] max-h-[46dvh] w-full self-center">
            <RestaurantCard restaurant={result.winner!} />
          </div>
          {result.winner!.mapsUrl && (
            <a
              href={result.winner!.mapsUrl}
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
                  <RankedRow key={item.restaurant.placeId} item={item} rank={i + 1} />
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
            <RankedRow key={item.restaurant.placeId} item={item} rank={i + 1} />
          ))}
        </ul>
      )}

      <div className="mt-auto pt-2">
        <PrimaryButton onClick={() => navigate("/")}>Done — let's eat</PrimaryButton>
      </div>
    </Screen>
  );
}
