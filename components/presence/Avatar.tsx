import { getAvatarColor, getInitials } from "@/lib/avatar";
import type { PresenceUser } from "@/lib/types";

export function Avatar({ user }: { user: PresenceUser }) {
  const shortPeerId = user.peerId ? `${user.peerId.slice(0, 8)}...` : "unknown";
  const avatarClass = user.isSelf
    ? "flex h-9 w-9 select-none items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-amber-500 ring-offset-1 ring-offset-white"
    : "flex h-8 w-8 select-none items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white";

  return (
    <div className="group relative">
      <div
        title={user.name}
        style={{ backgroundColor: getAvatarColor(user.name) }}
        className={avatarClass}
      >
        {getInitials(user.name)}
      </div>
      {user.isSelf ? (
        <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-amber-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
          You
        </span>
      ) : null}
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-52 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700 shadow-lg group-hover:block">
        <p className="font-semibold text-slate-900">{user.name}</p>
        <p>{user.isSelf ? "You" : "Connected user"}</p>
        <p>Client ID: {user.clientId}</p>
        <p>Peer ID: {shortPeerId}</p>
      </div>
    </div>
  );
}
