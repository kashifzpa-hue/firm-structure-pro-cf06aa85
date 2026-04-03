// Deterministic color palette for entity initials
const AVATAR_COLORS = [
  "#1E40AF", // blue-800
  "#9333EA", // purple-600
  "#0891B2", // cyan-600
  "#059669", // emerald-600
  "#D97706", // amber-600
  "#DC2626", // red-600
  "#4F46E5", // indigo-600
  "#0D9488", // teal-600
];

function hashEntityId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getAvatarColor(entityId: string): string {
  return AVATAR_COLORS[hashEntityId(entityId) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
