export function getInitials(name: string): string {
  const trimmed = name.trim();
  const chars = [...trimmed];
  if (!chars.length) return "??";

  if (/\p{Script=Han}/u.test(chars[0])) {
    return chars[0];
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const a = words[0]?.[0] ?? "";
  const b = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (a + b).toUpperCase() || "??";
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 48%)`;
}

