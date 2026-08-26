import { useEffect, useState } from "react";
import { motion, type PanInfo } from "motion/react";
import type { Restaurant, ServiceOptions } from "@chews/shared";
import { priceDollars } from "../lib/format";

/** Drag the sheet down past this (or flick it) to dismiss. */
const DISMISS_OFFSET = 140;
const DISMISS_VELOCITY = 600;

const SERVICE_LABELS: Array<[keyof ServiceOptions, string]> = [
  ["dineIn", "Dine-in"],
  ["takeout", "Takeout"],
  ["delivery", "Delivery"],
  ["vegetarian", "Vegetarian options"],
  ["outdoorSeating", "Outdoor seating"],
  ["reservable", "Takes reservations"],
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-ink/5 px-3 py-1 text-sm font-semibold text-ink-soft">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function LocationPreview({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [failed, setFailed] = useState(false);
  // The server returns 404 when Maps Static isn't enabled on the key — that's a
  // sheet without a map, not a broken sheet.
  if (failed) return null;
  return (
    <img
      src={`/api/staticmap?lat=${lat}&lng=${lng}&w=640`}
      alt={`Map showing the location of ${name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-40 w-full rounded-2xl object-cover"
    />
  );
}

export default function RestaurantDetailSheet({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant;
  onClose: () => void;
}) {
  const details = restaurant.details ?? null;
  // Today's line gets emphasised in the hours list. Places starts its week on
  // Monday; Date.getDay() starts on Sunday.
  const todayIndex = (new Date().getDay() + 6) % 7;

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

  const services = details
    ? SERVICE_LABELS.filter(([key]) => details.serves[key] === true).map(([, label]) => label)
    : [];

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${restaurant.name} details`}
      className="fixed inset-0 z-50 flex flex-col bg-cream"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      drag="y"
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="relative shrink-0">
          {restaurant.photoUrl ? (
            <img
              src={restaurant.photoUrl}
              alt={restaurant.name}
              className="h-56 w-full object-cover"
            />
          ) : (
            <div className="h-56 w-full bg-ink/10" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pt-16 pb-4">
            <h2 className="font-display text-3xl font-black text-white">{restaurant.name}</h2>
            <p className="text-sm font-medium text-white/85">{restaurant.address}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to swiping"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/45 text-xl font-bold text-white backdrop-blur"
          >
            ✕
          </button>
          {/* Drag affordance — the sheet also closes by flicking it down. */}
          <div className="absolute inset-x-0 top-2 flex justify-center">
            <div className="h-1.5 w-10 rounded-full bg-white/60" />
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap gap-2">
            {restaurant.openNow != null && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  restaurant.openNow ? "bg-leaf/10 text-leaf-deep" : "bg-primary/10 text-primary-deep"
                }`}
              >
                {restaurant.openNow ? "Open now" : "Closed"}
              </span>
            )}
            {restaurant.rating != null && (
              <Chip>
                <span className="text-butter">★</span> {restaurant.rating.toFixed(1)}
                {restaurant.ratingCount != null && ` (${restaurant.ratingCount})`}
              </Chip>
            )}
            {details?.priceRange ? (
              <Chip>{details.priceRange}</Chip>
            ) : (
              restaurant.priceLevel != null && <Chip>{priceDollars(restaurant.priceLevel)}</Chip>
            )}
            {(details?.cuisines.length ? details.cuisines : [restaurant.category])
              .filter((c): c is string => Boolean(c))
              .map((cuisine) => (
                <Chip key={cuisine}>{cuisine}</Chip>
              ))}
          </div>

          {details?.summary && <p className="text-ink-soft">{details.summary}</p>}

          <div className="flex flex-col gap-2">
            {details?.websiteUrl && (
              <a
                href={details.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 font-display text-lg font-bold text-white shadow-lg shadow-primary/25"
              >
                View menu &amp; website
              </a>
            )}
            <div className="flex gap-2">
              {restaurant.mapsUrl && (
                <a
                  href={restaurant.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-ink/15 bg-eggshell px-4 font-semibold text-ink"
                >
                  Directions
                </a>
              )}
              {details?.phone && (
                <a
                  href={`tel:${details.phone.replace(/[^+\d]/g, "")}`}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-ink/15 bg-eggshell px-4 font-semibold text-ink"
                >
                  Call
                </a>
              )}
            </div>
          </div>

          {details?.lat != null && details.lng != null && (
            <LocationPreview lat={details.lat} lng={details.lng} name={restaurant.name} />
          )}

          {services.length > 0 && (
            <Section title="Good to know">
              <ul className="flex flex-wrap gap-2">
                {services.map((label) => (
                  <li
                    key={label}
                    className="rounded-full bg-leaf/10 px-3 py-1 text-sm font-semibold text-leaf-deep"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {details && details.photoUrls.length > 0 && (
            <Section title="Photos">
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {details.photoUrls.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-32 w-44 shrink-0 rounded-2xl object-cover"
                  />
                ))}
              </div>
            </Section>
          )}

          {details && details.hours.length > 0 && (
            <Section title="Hours">
              <ul className="flex flex-col gap-1 text-sm">
                {details.hours.map((line, i) => (
                  <li
                    key={line}
                    className={i === todayIndex ? "font-bold text-ink" : "text-ink-soft"}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {details && details.reviews.length > 0 && (
            <Section title="What people say">
              <ul className="flex flex-col gap-3">
                {details.reviews.map((review, i) => (
                  <li key={`${review.author}-${i}`} className="rounded-2xl bg-eggshell p-4 shadow-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-ink">{review.author}</span>
                      {review.rating != null && (
                        <span className="shrink-0 text-sm text-ink-soft">
                          <span className="text-butter">★</span> {review.rating}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{review.text}</p>
                    {review.relativeTime && (
                      <p className="mt-1 text-xs text-ink-soft/70">{review.relativeTime}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {!details && (
            <p className="text-ink-soft">
              No extra details came back for this one — swipe on the photo and vibes.
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-14 w-full rounded-2xl border-2 border-ink/15 bg-eggshell px-6 font-display text-lg font-bold text-ink"
          >
            Back to swiping
          </button>
        </div>
      </div>
    </motion.div>
  );
}
