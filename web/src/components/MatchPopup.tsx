import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Restaurant } from "@chews/shared";
import { restaurantSubtitle } from "../lib/format";
import Confetti from "./Confetti";
import { PrimaryButton } from "./ui";

/**
 * Room-wide match popup: dim backdrop, spring-in card, keep-swiping dismiss.
 * Also reused as the "matches so far" list behind the header chip. Backdrop
 * tap and Escape both dismiss — dismissing IS "keep swiping"; nothing is sent.
 * Render inside <AnimatePresence> so the exit animation runs.
 */
export default function MatchPopup({
  matches,
  title,
  subtitle,
  celebrate = false,
  onDismiss,
  dismissLabel = "Keep swiping",
  children,
}: {
  matches: Restaurant[];
  title: string;
  subtitle: string;
  celebrate?: boolean;
  onDismiss: () => void;
  dismissLabel?: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-center bg-black/40 p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      {celebrate && <Confetti />}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 40, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="mx-auto flex max-h-full w-full max-w-md flex-col gap-4 overflow-hidden rounded-3xl bg-cream p-5 shadow-2xl"
      >
        <div className="text-center">
          <h2 className="font-display text-3xl font-black text-ink">{title}</h2>
          <p className="mt-1 text-ink-soft">{subtitle}</p>
        </div>

        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {matches.map((r) => (
            <li
              key={r.placeId}
              className="flex items-center gap-3 rounded-2xl bg-leaf/10 p-3"
            >
              {r.photoUrl ? (
                // The deck already fetched this exact URL — reuse it verbatim so
                // the browser cache serves it (a new width would re-bill Google).
                <img src={r.photoUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-leaf/20 text-2xl">
                  🍽️
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{r.name}</div>
                <div className="truncate text-sm text-ink-soft">{restaurantSubtitle(r)}</div>
              </div>
              <span className="shrink-0 text-xl" aria-hidden>
                🎉
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={onDismiss}>{dismissLabel}</PrimaryButton>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
