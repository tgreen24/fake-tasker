import React from 'react';
import { SockShape } from './Sock';

const SHAPES = {
  shirt: 'M14 6l-10 6 4 9 5-3v26h24V18l5 3 4-9-10-6c-2 4-6 6-11 6s-9-2-11-6z',
  pants: 'M12 6h28l3 40h-10l-6-26-6 26H10z',
  towel: 'M8 8h36v36H8z'
};

function Clothing({ kind, color }) {
  if (kind === 'sock') return <SockShape color={color} className="clothing" />;
  return (
    <svg viewBox="0 0 52 52" className="clothing" aria-hidden="true">
      <path d={SHAPES[kind]} fill={color} stroke="rgba(0,0,0,.4)" strokeWidth="1.5" strokeLinejoin="round" />
      {kind === 'towel' && <path d="M8 36h36M8 40h36" stroke="rgba(0,0,0,.2)" strokeWidth="2" />}
    </svg>
  );
}

export default Clothing;
