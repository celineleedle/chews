import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Restaurant } from "@chews/shared";
import Confetti from "./Confetti";
import MatchListItem from "./MatchListItem";
import { PrimaryButton } from "./ui";

// Ref-counted so overlapping instances (AnimatePresence keeps the exiting
// popup mounted while the next one enters) can't strand the lock on or off.
let bodyScrollLocks = 0;
function lockBodyScroll() {
  if (bodyScrollLocks++ === 0) document.body.style.overflow = "hidden";
}
function unlockBodyScroll() {
  if (--bodyScrollLocks === 0) document.body.style.overflow = "";
}

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

  // Body scroll locks while any popup instance is mounted, like the detail
  // sheet's behavior on the results screen.
  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);

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
            <MatchListItem key={r.placeId} restaurant={r} />
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
