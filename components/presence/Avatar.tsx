import { getAvatarColor, getInitials } from "@/lib/avatar";

export function Avatar({ name }: { name: string }) {
  return (
    <div
      title={name}
      style={{ backgroundColor: getAvatarColor(name) }}
      className="flex h-8 w-8 select-none items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white"
    >
      {getInitials(name)}
    </div>
  );
}

