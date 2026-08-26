import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import type { Restaurant } from "@chews/shared";
import RestaurantCard, { CardOverlay, CardPhoto } from "./RestaurantCard";
import RestaurantDetails from "./RestaurantDetails";

const SWIPE_OFFSET = 100;
const SWIPE_VELOCITY = 600;
/** Lift this far (or flick this fast) to commit to the expanded card. */
const EXPAND_OFFSET = 80;
const EXPAND_VELOCITY = 500;
/** Pull the expanded card's header back down past this (or flick it) to collapse. */
const COLLAPSE_OFFSET = 120;
const COLLAPSE_VELOCITY = 600;
/** Height the photo compresses to once the card is fully open (Tailwind h-56). */
const HEADER_HEIGHT = 224;
/** Resistance applied to drag past either end of the gesture's travel range. */
const RUBBER = 0.35;
/** Floor on the travel distance, so a very short viewport can't make the drag twitchy. */
const MIN_TRAVEL = 240;
const HEIGHT_SPRING = { type: "spring", stiffness: 260, damping: 32 } as const;

interface SwipeDeckProps {
  deck: Restaurant[];
  index: number;
  onSwipe: (restaurant: Restaurant, liked: boolean) => void;
  /** While true (e.g. reconnecting) the card drags elastically but can't be swiped away. */
  disabled?: boolean;
}

export default function SwipeDeck({ deck, index, onSwipe, disabled = false }: SwipeDeckProps) {
  const flingRef = useRef<((dir: 1 | -1) => void) | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  // The card grows from its own box to the full column — measured, not guessed.
  // The card is absolutely positioned, so opening it never resizes either box.
  const [{ collapsedH, expandedH }, setMetrics] = useState({ collapsedH: 0, expandedH: 0 });
  const visible = deck.slice(index, index + 3);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const deck = deckRef.current;
    if (!root || !deck) return;
    const measure = () =>
      setMetrics((prev) => {
        const next = { collapsedH: deck.offsetHeight, expandedH: root.offsetHeight };
        return prev.collapsedH === next.collapsedH && prev.expandedH === next.expandedH
          ? prev
          : next;
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(deck);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="relative flex h-full flex-col gap-5">
      <div ref={deckRef} className="relative flex-1">
        {visible
          .map((restaurant, depth) => {
            if (depth === 0) {
              return (
                <TopCard
                  key={restaurant.placeId}
                  restaurant={restaurant}
                  flingRef={flingRef}
                  disabled={disabled}
                  collapsedH={collapsedH}
                  expandedH={expandedH}
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

/** Drag past either end of the travel range and the card resists instead of stopping dead. */
function rubberBand(value: number, min: number, max: number) {
  if (value < min) return min - (min - value) * RUBBER;
  if (value > max) return max + (value - max) * RUBBER;
  return value;
}

/**
 * The top card, which is also the detail view: there is no second component and
 * no discrete transition between the two. A single `cardHeight` motion value is
 * the source of truth — the finger drives it directly during a vertical drag,
 * and a spring drives it on release. Everything else (photo height, how much of
 * the details show, which chrome is visible) is derived from it, so the card
 * reads as one object morphing rather than two views swapping.
 *
 * The card's outer height only grows by the height of the buttons it covers;
 * the room for the details comes from the photo compressing to a header strip
 * under its own overlay. Details are revealed by clipping, never by fading.
 */
function TopCard({
  restaurant,
  onDone,
  flingRef,
  disabled,
  collapsedH,
  expandedH,
}: {
  restaurant: Restaurant;
  onDone: (liked: boolean) => void;
  flingRef: React.MutableRefObject<((dir: 1 | -1) => void) | null>;
  disabled: boolean;
  /** Height of the collapsed card — where the growth starts and returns to. */
  collapsedH: number;
  /** Height of the whole deck column, buttons included. */
  expandedH: number;
}) {
  const [expanded, setExpanded] = useState(false);
  // Scrolling the details is only enabled at full rest: an active scroll
  // container mid-gesture swallows the drag that is still driving the height.
  const [scrollable, setScrollable] = useState(false);
  const measured = collapsedH > 0 && expandedH > collapsedH;
  const restH = measured ? collapsedH : 1;
  const fullH = measured ? expandedH : 2;
  // The gesture is measured in finger pixels, not card height. The card's outer
  // height only grows ~84px, but over that span the photo compresses ~412px —
  // so driving height 1:1 with the finger ran the visuals about 5x finger speed.
  // `travel` is that photo-compression distance: the bottom edge of the photo,
  // which is the thing sliding up under the finger, now tracks it 1:1.
  const travel = Math.max(restH - HEADER_HEIGHT, MIN_TRAVEL);
  const heightPerTravel = (fullH - restH) / travel;

  const x = useMotionValue(0);
  const cardHeight = useMotionValue(restH);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);

  // At rest the photo fills the card exactly; as the card grows the photo
  // compresses toward the header strip, freeing the space the details occupy.
  const photoHeight = useTransform(cardHeight, (h) => {
    if (h <= restH) return h;
    const t = Math.min((h - restH) / (fullH - restH), 1);
    return restH + t * (HEADER_HEIGHT - restH);
  });
  // The hint gets out of the way as soon as the card starts growing, and during
  // a left/right swipe so it never fights the YUM/NOPE stamps.
  const hintOpacity = useTransform([x, cardHeight], ([xv, h]: number[]) => {
    const sideways = Math.min(Math.abs(xv ?? 0) / 70, 1);
    const grown = Math.min(Math.max((h ?? restH) - restH, 0) / ((fullH - restH) * 0.15), 1);
    return 0.9 * (1 - sideways) * (1 - grown);
  });
  // ✕ and the drag handle only belong to the open card, so they arrive last.
  const chromeOpacity = useTransform(cardHeight, [restH + (fullH - restH) * 0.6, fullH], [0, 1], {
    clamp: true,
  });
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const nopeOpacity = useTransform(x, [-130, -30], [1, 0]);

  const dragControls = useDragControls();
  const detailsRef = useRef<HTMLDivElement>(null);
  const flying = useRef(false);
  const heightAnim = useRef<ReturnType<typeof animate> | null>(null);
  // Bumped by every expand/collapse so a superseded animation's completion
  // can't flip state back on behind the current gesture's back.
  const gen = useRef(0);
  // How far into the travel range the card sat when the drag started — the
  // finger offset is added to this.
  const dragStartTravel = useRef(0);
  // Mirrors motion's own direction lock (via onDirectionLock) so height and
  // translation can never disagree about a gesture's axis. Preset to "y" when
  // expanded, where the lock is off and only the header drags.
  const axis = useRef<"x" | "y" | null>(null);
  // These closures are captured once on mount — read live values via refs.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  // collapse() is captured by the long-lived Escape listener — read the rest
  // height through a ref so a resize while open can't leave it stale.
  const restHRef = useRef(restH);
  restHRef.current = restH;

  // Keep the card pinned to whichever end it is resting at when the deck is
  // measured or the viewport changes underneath it.
  useLayoutEffect(() => {
    if (!measured) return;
    heightAnim.current?.stop();
    cardHeight.set(expandedRef.current ? fullH : restH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, restH, fullH]);

  const fling = (dir: 1 | -1) => {
    if (flying.current || disabledRef.current || expandedRef.current) return;
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

  function expand() {
    const mine = ++gen.current;
    setExpanded(true);
    heightAnim.current?.stop();
    heightAnim.current = animate(cardHeight, fullH, {
      ...HEIGHT_SPRING,
      onComplete: () => {
        if (gen.current === mine) setScrollable(true);
      },
    });
  }

  function collapse() {
    const mine = ++gen.current;
    setScrollable(false);
    heightAnim.current?.stop();
    heightAnim.current = animate(cardHeight, restHRef.current, {
      ...HEIGHT_SPRING,
      // Only once the card is back in its box is it a swipeable card again —
      // flipping sooner would hand the drag listener back mid-shrink.
      onComplete: () => {
        if (gen.current !== mine) return;
        setExpanded(false);
        if (detailsRef.current) detailsRef.current.scrollTop = 0;
      },
    });
  }

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  function handleDragStart() {
    gen.current++;
    heightAnim.current?.stop();
    dragStartTravel.current = (cardHeight.get() - restH) / heightPerTravel;
    axis.current = expanded ? "y" : null;
    setScrollable(false);
  }

  // Vertical finger travel is spent growing the card, never translating it —
  // the details are already appearing while the finger is still down.
  function handleDrag(_: unknown, info: PanInfo) {
    const { offset } = info;
    if (axis.current !== "y") return;
    const t = rubberBand(dragStartTravel.current - offset.y, 0, travel);
    cardHeight.set(restH + t * heightPerTravel);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (axis.current === "y") {
      if (expanded) {
        if (offset.y > COLLAPSE_OFFSET || velocity.y > COLLAPSE_VELOCITY) collapse();
        else expand();
        return;
      }
      // Reading stays available while disconnected — only the vote is locked.
      if (offset.y < -EXPAND_OFFSET || velocity.y < -EXPAND_VELOCITY) expand();
      else {
        gen.current++;
        heightAnim.current?.stop();
        heightAnim.current = animate(cardHeight, restH, HEIGHT_SPRING);
      }
      return;
    }
    if (expanded) return;
    // A drag that started mid-spring-back stopped that spring — re-home the
    // height so the card can't fling away (or rest) partially expanded.
    if (cardHeight.get() !== restH) {
      heightAnim.current = animate(cardHeight, restH, HEIGHT_SPRING);
    }
    if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) fling(1);
    else if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) fling(-1);
  }

  return (
    <motion.div
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? `${restaurant.name} details` : undefined}
      className={`absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-3xl bg-cream shadow-xl select-none ${
        expanded ? "" : "cursor-grab touch-none active:cursor-grabbing"
      }`}
      // Expanded, only the photo header drags: the body is a scroll container
      // and a drag listener there would fight every scroll gesture.
      drag={expanded ? "y" : true}
      dragListener={!expanded}
      dragControls={dragControls}
      dragDirectionLock={!expanded}
      onDirectionLock={(lockedAxis) => (axis.current = lockedAxis)}
      dragSnapToOrigin
      // y is pinned at both ends with zero elastic: vertical travel is consumed
      // by the height, so the card must never translate. While disconnected the
      // horizontal drag is pinned too — the card stretches a little and snaps
      // back instead of swiping away.
      dragConstraints={disabled || expanded ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 0, bottom: 0 }}
      dragElastic={{
        top: 0,
        bottom: 0,
        left: disabled || expanded ? 0.15 : 0.9,
        right: disabled || expanded ? 0.15 : 0.9,
      }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{
        x,
        rotate,
        height: measured ? cardHeight : "100%",
        zIndex: expanded ? 50 : 10,
      }}
    >
      <motion.div
        onPointerDown={expanded ? (e) => dragControls.start(e) : undefined}
        className={`relative shrink-0 bg-ink ${
          expanded ? "cursor-grab touch-none active:cursor-grabbing" : ""
        }`}
        style={{ height: measured ? photoHeight : "100%" }}
      >
        <CardPhoto restaurant={restaurant} />
        <CardOverlay restaurant={restaurant} />

        <motion.button
          type="button"
          onClick={expand}
          style={{ opacity: hintOpacity }}
          className={`absolute inset-x-0 top-4 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm ${
            expanded ? "pointer-events-none" : ""
          }`}
        >
          <span aria-hidden>↑</span> Swipe up for details
        </motion.button>
        <motion.button
          type="button"
          onClick={collapse}
          aria-label="Back to swiping"
          style={{ opacity: chromeOpacity }}
          className={`absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/45 text-xl font-bold text-white backdrop-blur ${
            expanded ? "" : "pointer-events-none"
          }`}
        >
          ✕
        </motion.button>
        {/* Drag affordance — the card also collapses by flicking the header down. */}
        <motion.div
          style={{ opacity: chromeOpacity }}
          className="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
        >
          <div className="h-1.5 w-10 rounded-full bg-white/60 shadow-sm" />
        </motion.div>

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

      {/* Always mounted, just clipped: the card's height is what decides how
          much of it you can see, so there is nothing to fade in. */}
      <div
        ref={detailsRef}
        // Clipped content must not be reachable: without inert, tabbing to a
        // hidden link force-scrolls the zero-height region and screen readers
        // read the whole tree.
        inert={!expanded}
        className={`min-h-0 flex-1 ${
          expanded && scrollable
            ? "touch-pan-y overflow-y-auto overscroll-contain"
            : "overflow-hidden"
        }`}
      >
        <RestaurantDetails restaurant={restaurant} onCollapse={collapse} />
      </div>
    </motion.div>
  );
}
