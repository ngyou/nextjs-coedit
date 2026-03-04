import { Avatar } from "@/components/presence/Avatar";
import type { PresenceUser } from "@/lib/types";

export function AvatarStack({ users }: { users: PresenceUser[] }) {
  const visible = users.slice(0, 5);
  const overflow = Math.max(0, users.length - visible.length);

  return (
    <div className="flex items-center gap-1">
      {visible.map((user) => (
        <Avatar key={user.clientId} user={user} />
      ))}
      {overflow > 0 ? (
        <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-700 px-2 text-xs font-semibold text-white">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
