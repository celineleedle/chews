import type { MemberInfo } from "@chews/shared";

const COLORS = ["#ff8a65", "#4db6ac", "#7986cb", "#f06292", "#9575cd", "#4fc3f7", "#aed581", "#ffb74d"];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ member, showDone = false }: { member: MemberInfo; showDone?: boolean }) {
  return (
    <div className={`relative ${member.connected ? "" : "opacity-40"}`}>
      <div
        className="flex size-11 items-center justify-center rounded-full font-display text-lg font-bold text-white shadow-sm"
        style={{ backgroundColor: colorFor(member.name) }}
      >
        {member.name.trim().charAt(0).toUpperCase()}
      </div>
      {member.isHost && (
        <span className="absolute -top-1.5 -right-1.5 text-sm" title="Host">
          👑
        </span>
      )}
      {showDone && member.deckDone && (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-leaf text-[10px] font-bold text-white">
          ✓
        </span>
      )}
    </div>
  );
}

export default function MemberAvatars({
  members,
  showDone = false,
}: {
  members: MemberInfo[];
  showDone?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3">
          <Avatar member={m} showDone={showDone} />
          <span className="font-medium text-ink">
            {m.name}
            {!m.connected && <span className="ml-2 text-sm text-ink-soft">(reconnecting…)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
