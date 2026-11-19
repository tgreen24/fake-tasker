import React, { useId } from 'react';
import { sockStyle } from '../../game/minigames/socks';

// A sock seen from the side: ribbed cuff, leg, heel at the back, foot running
// forward to a rounded toe.
const BODY = 'M10 2H26V29C26 33 28 35 32 35H39C44 35 47 39 47 43.5S44 52 39 52H15C9 52 5 48 5 43.5S7 36 10 32Z';
const CUFF = 'M10 2H26V10H10Z';
const HEEL = 'M5 43.5C5 39 7 36 10 32L15 35C15 41 14 47 16 52H15C9 52 5 48 5 43.5Z';
const TOE = 'M39 35C44 35 47 39 47 43.5S44 52 39 52C37 47 37 40 39 35Z';
const RIBS = [13, 16, 19, 22];

function Fill({ id, pattern, color }) {
  const ink = color === '#e7eef6' ? '#2f6bff' : '#ffffff';
  if (pattern === 'stripes') {
    return (
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={color} />
        <rect width="8" height="3" fill={ink} opacity=".85" />
      </pattern>
    );
  }
  if (pattern === 'dots') {
    return (
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill={color} />
        <circle cx="3.5" cy="3.5" r="1.6" fill={ink} />
      </pattern>
    );
  }
  if (pattern === 'checks') {
    return (
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={color} />
        <rect width="5" height="5" fill="#7a5600" />
        <rect x="5" y="5" width="5" height="5" fill="#7a5600" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill={color} />
    </pattern>
  );
}

export function SockShape({ color, pattern = 'solid', className = 'sock' }) {
  const id = useId().replace(/:/g, '');
  const accent = pattern === 'heel' ? '#e5484d' : 'rgba(0,0,0,.22)';
  const cuff = pattern === 'band' ? '#ffffff' : pattern === 'heel' ? '#e5484d' : 'rgba(0,0,0,.18)';
  return (
    <svg viewBox="0 0 52 56" className={className} aria-hidden="true">
      <defs><Fill id={id} pattern={pattern} color={color} /></defs>
      <path d={BODY} fill={`url(#${id})`} />
      <path d={HEEL} fill={accent} />
      <path d={TOE} fill={accent} />
      <path d={CUFF} fill={cuff} />
      {RIBS.map((x) => <path key={x} d={`M${x} 3V9`} stroke="rgba(0,0,0,.25)" strokeWidth="1" />)}
      <path d={BODY} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function Sock({ style: styleId }) {
  const { color, pattern } = sockStyle(styleId);
  return <SockShape color={color} pattern={pattern} />;
}

export default Sock;
