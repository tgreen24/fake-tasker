// Distinct hues so no two players in a lobby look alike. Assigned by position
// in the shared roster rather than hashed from the name, so everyone sees the
// same colours and nobody collides -- a hash gives duplicates well before it
// runs out of colours.
const PALETTE = [
  '#3b82f6', '#a855f7', '#22c55e', '#f97316',
  '#eab308', '#ef4444', '#06b6d4', '#ec4899',
  '#14b8a6', '#8b5cf6', '#84cc16', '#f43f5e'
];

export function assignColors(players = []) {
  const colors = {};
  players.forEach((player, index) => {
    colors[player] = PALETTE[index % PALETTE.length];
  });
  return colors;
}

export function initials(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
