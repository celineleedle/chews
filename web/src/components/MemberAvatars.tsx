import type { MemberInfo } from "@chews/shared";
import { hashPick } from "../lib/hash";

const COLORS = ["#ff8a65", "#4db6ac", "#7986cb", "#f06292", "#9575cd", "#4fc3f7", "#aed581", "#ffb74d"];

function Avatar({ member }: { member: MemberInfo }) {
  return (
    <div className={`relative ${member.connected ? "" : "opacity-40"}`}>
      <div
        className="flex size-11 items-center justify-center rounded-full font-display text-lg font-bold text-white shadow-sm"
        style={{ backgroundColor: hashPick(member.name, COLORS) }}
      >
        {member.name.trim().charAt(0).toUpperCase()}
      </div>
      {member.isHost && (
        <span className="absolute -top-1.5 -right-1.5 text-sm" title="Host">
          👑
        </span>
      )}
    </div>
  );
}

export default function MemberAvatars({ members }: { members: MemberInfo[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3">
          <Avatar member={m} />
          <span className="font-medium text-ink">
            {m.name}
            {!m.connected && <span className="ml-2 text-sm text-ink-soft">(reconnecting…)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
