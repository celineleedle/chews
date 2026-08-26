import { useState } from "react";
import type { Restaurant, ServiceOptions } from "@chews/shared";
import { priceDollars } from "../lib/format";

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
  // card without a map, not a broken card.
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

/**
 * Everything below the photo once a card is expanded. Presentation-only: the
 * card that owns it handles the drag, the growth and the scrolling.
 */
export default function RestaurantDetails({
  restaurant,
  onCollapse,
}: {
  restaurant: Restaurant;
  onCollapse: () => void;
}) {
  const details = restaurant.details ?? null;
  // Today's line gets emphasised in the hours list. Places starts its week on
  // Monday; Date.getDay() starts on Sunday.
  const todayIndex = (new Date().getDay() + 6) % 7;

  const services = details
    ? SERVICE_LABELS.filter(([key]) => details.serves[key] === true).map(([, label]) => label)
    : [];

  return (
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
              <li key={line} className={i === todayIndex ? "font-bold text-ink" : "text-ink-soft"}>
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
        onClick={onCollapse}
        className="min-h-14 w-full rounded-2xl border-2 border-ink/15 bg-eggshell px-6 font-display text-lg font-bold text-ink"
      >
        Back to swiping
      </button>
    </div>
  );
}
