import React, { useEffect, useMemo, useState } from 'react';
import { WORDS_PER_GAME, nextHintTile, pickGroceryList } from '../../game/minigames/groceries';
import { useOnSolved } from './useOnSolved';

const WRONG_SHOWN_MS = 700;
const NEXT_WORD_MS = 600;
const HINT_COOLDOWN_SECONDS = 3;

const lettersOf = (ids, tiles) => ids.map((id) => tiles.find((tile) => tile.id === id).letter).join('');

function useHintCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((now) => now - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  return [secondsLeft, () => setSecondsLeft(HINT_COOLDOWN_SECONDS)];
}

// One word: tap the letters in order. Tapping a placed letter sends it back,
// and a hint places the next right letter, clearing any wrong ones first.
function Word({ word, tiles, number, onDone }) {
  const [placed, setPlaced] = useState([]);
  const [wrong, setWrong] = useState(false);
  const [hintIn, startHintCooldown] = useHintCooldown();

  const full = placed.length === word.length;
  const solved = full && lettersOf(placed, tiles) === word;
  useOnSolved(solved, onDone);

  useEffect(() => {
    if (!full || solved) return undefined;
    setWrong(true);
    const timer = setTimeout(() => {
      setPlaced([]);
      setWrong(false);
    }, WRONG_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [full, solved]);

  const place = (id) => {
    if (full || placed.includes(id)) return;
    setPlaced((now) => [...now, id]);
  };
  const unplace = (id) => {
    if (solved || wrong) return;
    setPlaced((now) => now.filter((entry) => entry !== id));
  };
  const hint = () => {
    if (hintIn > 0 || solved || wrong) return;
    let keep = 0;
    while (keep < placed.length && lettersOf(placed.slice(0, keep + 1), tiles) === word.slice(0, keep + 1)) keep++;
    const kept = placed.slice(0, keep);
    const next = nextHintTile(word, tiles, kept);
    if (next) setPlaced([...kept, next]);
    startHintCooldown();
  };

  return (
    <>
      <p className="minigame-step">Item {number} of {WORDS_PER_GAME}</p>
      <div
        className={`unscramble-slots ${wrong ? 'missed' : ''} ${solved ? 'solved' : ''}`}
        style={{ '--letters': word.length }}
      >
        {Array.from({ length: word.length }, (_, i) => {
          const id = placed[i];
          const tile = id && tiles.find((entry) => entry.id === id);
          return (
            <button
              key={i}
              type="button"
              className={`letter-slot ${tile ? 'filled' : ''}`}
              aria-label={tile ? `Remove ${tile.letter}` : `Empty slot ${i + 1}`}
              onClick={() => tile && unplace(id)}
            >
              {tile ? tile.letter : ''}
            </button>
          );
        })}
      </div>
      <div className="unscramble-tiles" style={{ '--letters': word.length }}>
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={`letter-tile ${placed.includes(tile.id) ? 'used' : ''}`}
            aria-label={`Letter ${tile.letter}`}
            data-letter={tile.letter}
            disabled={placed.includes(tile.id)}
            onClick={() => place(tile.id)}
          >
            {tile.letter}
          </button>
        ))}
      </div>
      <button type="button" className="leave-game unscramble-hint" onClick={hint} disabled={hintIn > 0 || solved}>
        {hintIn > 0 ? `Hint in ${hintIn}s` : 'Hint'}
      </button>
      {wrong && <p className="minigame-hint">Not quite, try again</p>}
    </>
  );
}

function UnscrambleGroceries({ onSolved }) {
  const list = useMemo(() => pickGroceryList(), []);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  useOnSolved(finished, onSolved);

  const wordDone = () => {
    if (index === list.length - 1) {
      setFinished(true);
      return;
    }
    setTimeout(() => setIndex((now) => now + 1), NEXT_WORD_MS);
  };

  const { word, tiles } = list[index];
  return (
    <div className="minigame unscramble">
      <p className="minigame-instructions">{finished ? 'List complete!' : 'Spell each item on the list'}</p>
      <Word key={word} word={word} tiles={tiles} number={index + 1} onDone={wordDone} />
    </div>
  );
}

export default UnscrambleGroceries;
