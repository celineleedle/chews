import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { Restaurant } from "@chews/shared";
import RestaurantCard from "./RestaurantCard";

const SWIPE_OFFSET = 100;
const SWIPE_VELOCITY = 600;

interface SwipeDeckProps {
  deck: Restaurant[];
  index: number;
  onSwipe: (restaurant: Restaurant, liked: boolean) => void;
  /** While true (e.g. reconnecting) the card drags elastically but can't be swiped away. */
  disabled?: boolean;
}

export default function SwipeDeck({ deck, index, onSwipe, disabled = false }: SwipeDeckProps) {
  const flingRef = useRef<((dir: 1 | -1) => void) | null>(null);
  const visible = deck.slice(index, index + 3);

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
    </div>
  );
}

function TopCard({
  restaurant,
  onDone,
  flingRef,
  disabled,
}: {
  restaurant: Restaurant;
  onDone: (liked: boolean) => void;
  flingRef: React.MutableRefObject<((dir: 1 | -1) => void) | null>;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
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
    if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) fling(1);
    else if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) fling(-1);
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      drag="x"
      dragSnapToOrigin
      // Disconnected: pin the drag to origin with rubber-band resistance — the
      // card stretches a little and snaps back instead of swiping away.
      dragConstraints={disabled ? { left: 0, right: 0 } : undefined}
      dragElastic={disabled ? 0.15 : 0.9}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, zIndex: 10 }}
    >
      <RestaurantCard restaurant={restaurant} />
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
