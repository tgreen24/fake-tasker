import React from 'react';

// Types the sentence out in plain text, colouring only the word that carries
// the reveal -- and only when it is the damning one. Highlighting "Imposter"
// inside "They were not the Imposter" would say the opposite of the truth.
function TypedVerdict({ text, revealed, highlightWord, highlight }) {
  const shown = text.slice(0, revealed);
  const at = highlight ? text.lastIndexOf(highlightWord) : -1;

  if (at === -1) return <>{shown}</>;

  const end = at + highlightWord.length;
  return (
    <>
      {text.slice(0, Math.min(revealed, at))}
      {revealed > at && (
        <span className="verdict-highlight">{text.slice(at, Math.min(revealed, end))}</span>
      )}
      {revealed > end && text.slice(end, revealed)}
    </>
  );
}

export default TypedVerdict;
