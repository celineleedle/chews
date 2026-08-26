import { useEffect } from "react";
import { motion, useDragControls, type PanInfo } from "motion/react";
import type { Restaurant } from "@chews/shared";
import { CardPhoto, CardOverlay } from "./RestaurantCard";
import RestaurantDetails from "./RestaurantDetails";

/** Same thresholds as the deck card's collapse gesture, so the dismiss feels identical. */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

/**
 * Detail card for contexts outside the swipe deck (e.g. the Result screen):
 * a rounded card over a dimmed backdrop, slid up on mount. Tap-to-open is the
 * caller's job; this handles drag-down / backdrop-tap / Escape / ✕ dismissal.
 * Unlike the deck's expanded card, the photo scrolls away with the content.
 * Render inside <AnimatePresence> so the exit slide runs.
 */
export default function RestaurantDetailSheet({
  restaurant,
  onClose,
  closeLabel = "Back to swiping",
}: {
  restaurant: Restaurant;
  onClose: () => void;
  closeLabel?: string;
}) {
  const dragControls = useDragControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-center bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${restaurant.name} details`}
        className="mx-auto flex max-h-full min-h-0 w-full max-w-md flex-col overflow-hidden rounded-3xl bg-cream shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        drag="y"
        // The drag starts from the photo header only: the body is a scroll
        // container and a drag listener there would fight every scroll gesture.
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0 }}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
      >
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
          {/* Scrolls away with the content — only the deck's expanded card pins its photo. */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="relative h-56 cursor-grab touch-none bg-ink active:cursor-grabbing"
          >
            <CardPhoto restaurant={restaurant} />
            <CardOverlay restaurant={restaurant} />
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
              <div className="h-1.5 w-10 rounded-full bg-white/60 shadow-sm" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/45 text-xl font-bold text-white backdrop-blur"
            >
              ✕
            </button>
          </div>
          <RestaurantDetails restaurant={restaurant} onCollapse={onClose} collapseLabel={closeLabel} />
        </div>
      </motion.div>
    </motion.div>
  );
}
