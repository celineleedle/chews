import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import type { Restaurant } from "@chews/shared";
import RestaurantCard from "./RestaurantCard";
import RestaurantDetailSheet from "./RestaurantDetailSheet";

const SWIPE_OFFSET = 100;
const SWIPE_VELOCITY = 600;
const EXPAND_OFFSET = 80;
const EXPAND_VELOCITY = 500;
/** How far the card lifts before it rubber-bands — a peek, not a drag-away. */
const EXPAND_LIMIT = 130;

interface SwipeDeckProps {
  deck: Restaurant[];
  index: number;
  onSwipe: (restaurant: Restaurant, liked: boolean) => void;
  /** While true (e.g. reconnecting) the card drags elastically but can't be swiped away. */
  disabled?: boolean;
}

export default function SwipeDeck({ deck, index, onSwipe, disabled = false }: SwipeDeckProps) {
  const flingRef = useRef<((dir: 1 | -1) => void) | null>(null);
  const [expanded, setExpanded] = useState<Restaurant | null>(null);
  const visible = deck.slice(index, index + 3);
  const top = visible[0] ?? null;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="relative flex-1">
        {visible
          .map((restaurant, depth) => {
            if (depth === 0) {
              return (
                <TopCard
                  key={restaurant.placeId}
                  restaurant={restaurant}
                  flingRef={flingRef}
                  disabled={disabled}
                  onDone={(liked) => onSwipe(restaurant, liked)}
                  onExpand={() => setExpanded(restaurant)}
                />
              );
            }
            return (
              <motion.div
                key={restaurant.placeId}
                className="absolute inset-0"
                initial={false}
                animate={{ scale: 1 - depth * 0.045, y: depth * 14 }}
                style={{ zIndex: -depth }}
              >
                <RestaurantCard restaurant={restaurant} />
              </motion.div>
            );
          })
          .reverse()}
      </div>

      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          aria-label="Pass"
          disabled={disabled}
          onClick={() => flingRef.current?.(-1)}
          className="flex size-16 items-center justify-center rounded-full border-2 border-primary/30 bg-eggshell text-3xl text-primary-deep shadow-md transition active:scale-90 disabled:opacity-40"
        >
          ✕
        </button>
        <button
          type="button"
          aria-label="Like"
          disabled={disabled}
          onClick={() => flingRef.current?.(1)}
          className="flex size-16 items-center justify-center rounded-full bg-leaf text-3xl text-white shadow-md shadow-leaf/30 transition active:scale-90 disabled:opacity-40"
        >
          ♥
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <RestaurantDetailSheet restaurant={expanded} onClose={() => setExpanded(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TopCard({
  restaurant,
  onDone,
  onExpand,
  flingRef,
  disabled,
}: {
  restaurant: Restaurant;
  onDone: (liked: boolean) => void;
  onExpand: () => void;
  flingRef: React.MutableRefObject<((dir: 1 | -1) => void) | null>;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  // The hint brightens as the card lifts, and gets out of the way during a
  // left/right swipe so it never fights the YUM/NOPE stamps.
  const hintOpacity = useTransform([x, y], ([xv, yv]: number[]) => {
    const sideways = Math.min(Math.abs(xv ?? 0) / 70, 1);
    const lift = Math.min(Math.max(-(yv ?? 0), 0) / EXPAND_OFFSET, 1);
    return (0.8 + 0.2 * lift) * (1 - sideways);
  });
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const nopeOpacity = useTransform(x, [-130, -30], [1, 0]);
  const flying = useRef(false);
  // The fling closure is captured once on mount — read the live value via a ref.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const fling = (dir: 1 | -1) => {
    if (flying.current || disabledRef.current) return;
    flying.current = true;
    animate(x, dir * (window.innerWidth + 200), {
      duration: 0.3,
      ease: "easeIn",
      onComplete: () => onDone(dir > 0),
    });
  };

  useEffect(() => {
    flingRef.current = fling;
    return () => {
      flingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    // Vertical intent opens the details sheet; dragSnapToOrigin walks the card
    // back either way. Reading stays available while disconnected — only the
    // vote is locked.
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y < -EXPAND_OFFSET || velocity.y < -EXPAND_VELOCITY) onExpand();
      return;
    }
    if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) fling(1);
    else if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) fling(-1);
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      drag
      dragDirectionLock
      dragSnapToOrigin
      // Up is a bounded peek, down does nothing, and while disconnected the
      // horizontal drag is pinned to origin with rubber-band resistance — the
      // card stretches a little and snaps back instead of swiping away.
      dragConstraints={
        disabled
          ? { left: 0, right: 0, top: -EXPAND_LIMIT, bottom: 0 }
          : { top: -EXPAND_LIMIT, bottom: 0 }
      }
      dragElastic={{
        top: 0.5,
        bottom: 0,
        left: disabled ? 0.15 : 0.9,
        right: disabled ? 0.15 : 0.9,
      }}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotate, zIndex: 10 }}
    >
      <RestaurantCard restaurant={restaurant} />
      <motion.button
        type="button"
        onClick={onExpand}
        style={{ opacity: hintOpacity }}
        className="absolute inset-x-0 top-4 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
      >
        <span aria-hidden>↑</span> Swipe up for details
      </motion.button>
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-6 left-5 -rotate-12 rounded-lg border-4 border-leaf px-3 py-1 font-display text-3xl font-black text-leaf"
      >
        YUM
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-6 right-5 rotate-12 rounded-lg border-4 border-primary px-3 py-1 font-display text-3xl font-black text-primary"
      >
        NOPE
      </motion.div>
    </motion.div>
  );
}
