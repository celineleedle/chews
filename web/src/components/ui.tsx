import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useRoomStore } from "../store/roomStore";

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] ${className}`}
    >
      {children}
    </div>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-baseline gap-1 no-underline">
      <span className={`font-display font-black text-ink ${small ? "text-2xl" : "text-5xl"}`}>
        chews
      </span>
      <span className={small ? "text-xl" : "text-4xl"}>🍜</span>
    </Link>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-h-14 w-full rounded-2xl bg-primary px-6 font-display text-lg font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-14 w-full rounded-2xl border-2 border-ink/15 bg-eggshell px-6 font-display text-lg font-bold text-ink transition active:scale-[0.98] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
  center,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  autoFocus?: boolean;
  center?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      className={`min-h-14 w-full rounded-2xl border-2 border-ink/15 bg-eggshell px-4 text-lg text-ink outline-none placeholder:text-ink-soft/50 focus:border-primary ${center ? "text-center font-display text-2xl font-bold tracking-[0.3em] uppercase" : ""}`}
    />
  );
}

export function Toast() {
  const toast = useRoomStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-6">
      <div className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-cream shadow-xl">
        {toast}
      </div>
    </div>
  );
}

export function ReconnectBanner() {
  const connection = useRoomStore((s) => s.connection);
  if (connection !== "reconnecting") return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-butter px-4 py-2 text-center text-sm font-semibold text-ink">
      Reconnecting…
    </div>
  );
}
