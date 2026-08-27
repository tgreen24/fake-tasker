export const MAX_PLAYERS = 25;
// Three, not two. With two players the single traitor already equals the
// single tasker, so the round is won by the traitors on its first snapshot --
// the host taps Start and everybody lands on the game over screen.
export const MIN_PLAYERS = 3;
export const GAME_LIFETIME_MS = 24 * 60 * 60 * 1000;
