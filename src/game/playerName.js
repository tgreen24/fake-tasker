// Every per-player write keys a map by name through a dotted field path
// (`votes.${name}`), so Firestore reads a dot as nesting and refuses the rest
// outright. A name with any of these joins fine and then quietly never counts.
const FORBIDDEN = /[.~*/[\]`]/;

export function playerNameError(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Please enter your name.';
  if (FORBIDDEN.test(trimmed)) return "Names can't use . / ~ * [ ] or `. Try it without them.";
  return null;
}
