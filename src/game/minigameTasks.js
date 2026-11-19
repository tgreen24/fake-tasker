import { MINIGAME_CATALOG, minigameInfo } from './minigames/catalog';
import { shuffled } from './random';

// A minigame task is stored as plain text, the way a physical task is, so the
// private task list, the completion write, the progress total and leaving
// mid-round all handle it without knowing the difference.
const PREFIX = 'minigame:';

export const TASK_STYLES = ['physical', 'minigames', 'mixed'];
export const DEFAULT_TASK_STYLE = 'physical';
export const DEFAULT_ROOMS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom'];
export const MAX_ROOMS = 20;
export const MAX_ROOM_LENGTH = 24;

export const minigameTask = (gameId, room) => `${PREFIX}${gameId}@${room}`;

export function parseMinigameTask(task) {
  if (typeof task !== 'string' || !task.startsWith(PREFIX)) return null;
  const rest = task.slice(PREFIX.length);
  const at = rest.indexOf('@');
  if (at < 0) return null;
  const info = minigameInfo(rest.slice(0, at));
  return info ? { ...info, gameId: info.id, room: rest.slice(at + 1) } : null;
}

export const isMinigameTask = (task) => !!parseMinigameTask(task);

// What a task says on screen.
export function taskLabel(task) {
  const minigame = parseMinigameTask(task);
  return minigame ? `${minigame.icon} ${minigame.room}: ${minigame.name}` : task;
}

export const normalizeStyle = (style) => (TASK_STYLES.includes(style) ? style : DEFAULT_TASK_STYLE);

// How many of each a player gets. Mixed is an even split, the odd one out
// going either way, so neither kind is always the bigger share.
export function splitFor(style, count, random = Math.random) {
  const kind = normalizeStyle(style);
  if (kind === 'physical') return { physical: count, minigames: 0 };
  if (kind === 'minigames') return { physical: 0, minigames: count };
  const half = count / 2;
  const minigames = Number.isInteger(half) ? half : Math.floor(half) + (random() < 0.5 ? 1 : 0);
  return { physical: count - minigames, minigames };
}

// A room name a host typed, tidied, or null if there is nothing usable. The
// '@' is refused because it separates the minigame from the room.
export function cleanRoom(name) {
  const tidy = String(name || '').replace(/@/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ROOM_LENGTH);
  return tidy || null;
}

// Each player gets different minigames in different rooms where there are
// enough of them. Across the group, games and rooms are drawn from shuffled
// decks so they spread around rather than everyone getting the same few --
// though two players may share a game, sent to different rooms.
export function dealMinigameTasks(players, count, rooms, random = Math.random) {
  const dealt = {};
  players.forEach((player) => { dealt[player] = []; });
  const usable = rooms.map(cleanRoom).filter(Boolean);
  if (!count || !usable.length) return dealt;

  let games = [];
  let places = [];
  const draw = (deck, refill, avoid) => {
    let next = deck.find((entry) => !avoid.includes(entry));
    if (next === undefined) {
      deck.splice(0, deck.length, ...shuffled(refill, random));
      next = deck.find((entry) => !avoid.includes(entry)) ?? deck[0];
    }
    deck.splice(deck.indexOf(next), 1);
    return next;
  };

  const ids = MINIGAME_CATALOG.map((game) => game.id);
  for (let round = 0; round < count; round++) {
    players.forEach((player) => {
      const mine = dealt[player].map(parseMinigameTask);
      const game = draw(games, ids, mine.map((task) => task.gameId));
      const room = draw(places, usable, mine.map((task) => task.room));
      dealt[player].push(minigameTask(game, room));
    });
  }
  return dealt;
}

// Rooms a host starts with when turning minigames on: the chosen pack's rooms
// if there is one, otherwise the usual rooms of a house.
export function startingRooms(packRooms = []) {
  const rooms = packRooms.map(cleanRoom).filter(Boolean);
  return (rooms.length ? rooms : DEFAULT_ROOMS).slice(0, MAX_ROOMS);
}

// Adding a room the list already has, in any capitalisation, changes nothing.
export function roomsWithAdded(rooms, name) {
  const room = cleanRoom(name);
  if (!room || rooms.length >= MAX_ROOMS) return rooms;
  if (rooms.some((existing) => existing.toLowerCase() === room.toLowerCase())) return rooms;
  return [...rooms, room];
}

export const roomsWithout = (rooms, name) => rooms.filter((room) => room !== name);
