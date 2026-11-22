import React from 'react';

// Line icons for the round screen. Never emoji: an emoji is a splash of color
// somebody could read from across the room.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const Svg = ({ size = 22, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
    {children}
  </svg>
);

export const EyeIcon = (props) => (
  <Svg size={16} {...props}><g {...stroke}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></g></Svg>
);

export const MoreIcon = (props) => (
  <Svg {...props}><g fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></g></Svg>
);

export const HelpIcon = (props) => (
  <Svg {...props}><g {...stroke}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" /><path d="M12 17.5h.01" /></g></Svg>
);

export const LockIcon = (props) => (
  <Svg {...props}><g {...stroke}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></g></Svg>
);

export const SirenIcon = (props) => (
  <Svg size={20} {...props}><g {...stroke} strokeWidth="2.2"><path d="M12 3v2" /><path d="M5 19h14" /><path d="M7 19v-6a5 5 0 0 1 10 0v6" /><path d="M4.2 7.2l1.4 1.4M19.8 7.2l-1.4 1.4" /></g></Svg>
);

export const PlayIcon = (props) => (
  <Svg size={14} {...props}><path fill="currentColor" d="M7 4l13 8-13 8z" /></Svg>
);

export const CheckIcon = (props) => (
  <Svg {...props}><path {...stroke} strokeWidth="3" d="M5 12l5 5L20 7" /></Svg>
);

export const CloseIcon = (props) => (
  <Svg size={18} {...props}><path {...stroke} strokeWidth="2.2" d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const WrenchIcon = (props) => (
  <Svg {...props}><path {...stroke} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></Svg>
);

export const DaggerIcon = (props) => (
  <Svg {...props}><g {...stroke}><path d="M12 1.5l2.2 3.3v9.7H9.8V4.8z" /><path d="M12 5v8.5" /><path d="M6.5 14.5h11" /><path d="M12 14.5v5" /><circle cx="12" cy="21" r="1.5" /></g></Svg>
);

export const SearchIcon = (props) => (
  <Svg {...props}><g {...stroke}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></g></Svg>
);

export const InfoIcon = (props) => (
  <Svg size={20} {...props}><g {...stroke}><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16.5h.01" /></g></Svg>
);

export const PeopleIcon = (props) => (
  <Svg size={20} {...props}><g {...stroke}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15 14.5c3 0 6 1.8 6 5" /></g></Svg>
);

export const BarIcon = (props) => (
  <Svg size={20} {...props}><g {...stroke}><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M7 12h6" /></g></Svg>
);

export const GhostIcon = ({ size = 30, eyes = 'var(--surface)', ...rest }) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 40 48" aria-hidden="true" focusable="false" {...rest}>
    <path fill="currentColor" d="M20 2C10 2 4 9.5 4 19v26l5-4 5 4 6-4 6 4 5-4 5 4V19C36 9.5 30 2 20 2z" />
    <circle cx="14" cy="20" r="3" fill={eyes} />
    <circle cx="26" cy="20" r="3" fill={eyes} />
  </svg>
);

const GUIDE_ICONS = {
  tasks: WrenchIcon,
  win: BarIcon,
  meeting: SirenIcon,
  'meeting-wait': SirenIcon,
  ghost: GhostIcon,
  'ghost-stay': GhostIcon,
  'ghost-tasks': WrenchIcon,
  'ghost-no-meetings': SirenIcon,
  watch: EyeIcon,
  group: PeopleIcon,
  find: SearchIcon,
  lockdown: LockIcon,
  'lockdown-lose': InfoIcon,
  targets: DaggerIcon,
  cover: WrenchIcon,
  sabotage: SearchIcon,
  quiet: InfoIcon
};

export const guideIcon = (id) => GUIDE_ICONS[id] || InfoIcon;
