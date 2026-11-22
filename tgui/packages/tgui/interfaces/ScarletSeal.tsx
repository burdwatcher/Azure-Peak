import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from 'tgui-core/components';
import type { BooleanLike } from 'tgui-core/react';

import { useBackend } from '../backend';
import { Window } from '../layouts';
import {
  badgeStyle,
  cardStyle,
  FONT_SMALL,
  FONT_TINY,
  FONT_TITLE,
  INK,
  INK_FAINT,
  INK_SOFT,
  SEAL_AMBER,
  SEAL_GREEN,
  SEAL_RED,
  SERIF,
  TITLE,
  TITLE_FONT,
} from './common/parchment';
import { WaxSeal } from './common/WaxSeal';

type Phase = 'lobby' | 'playing' | 'round_end' | 'match_end';

type SeatColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'amber'
  | 'plum'
  | 'teal'
  | 'copper'
  | 'slate';

type Seat = {
  index: number;
  color: SeatColor;
  name: string | null;
  mine: BooleanLike;
  away: BooleanLike;
  seals: number;
  hand: string[];
  hand_count: number;
  discards: string[];
  discard_sum: number;
  seneschals: number;
  has_warden: BooleanLike;
  eliminated: BooleanLike;
  protected: BooleanLike;
  flatterer_marked: BooleanLike;
  fool_marked: BooleanLike;
  is_turn: BooleanLike;
  round_winner: BooleanLike;
  match_winner: BooleanLike;
};

type PrivateIntel = {
  seq: number;
  label: string | null;
  note: string;
  cards: string[];
};

type Data = {
  phase: Phase;
  expanded: BooleanLike;
  round: number;
  seals_to_win: number;
  seated_count: number;
  seats: Seat[];
  my_seat: number;
  my_turn: BooleanLike;
  forced_consort: BooleanLike;
  flatterer_target: number;
  fool_owner_name: string | null;
  pending_prelate_seat: number;
  pending_prelate_name: string | null;
  is_my_prelate_choice: BooleanLike;
  targets_by_card: Record<string, number[]>;
  deck_count: number;
  has_hidden_card: BooleanLike;
  set_aside_open: string[];
  showdown: BooleanLike;
  round_summary: string | null;
  status: string;
  message: string | null;
  history: string[];
  private_intel: PrivateIntel | null;
  can_start: BooleanLike;
  can_next_round: BooleanLike;
  can_pack: BooleanLike;
  reset_name: string | null;
  reset_left: number;
  can_answer_reset: BooleanLike;
  can_cancel_reset: BooleanLike;
};

type TargetMode = 'none' | 'single' | 'one_or_two' | 'swap_two_peek_one';

type CardMeta = {
  id: string;
  value: number;
  name: string;
  copiesClassic: number;
  copiesExpanded: number;
  expansion?: boolean;
  accent: string;
  summary: string;
  targetMode: TargetMode;
  canTargetSelf?: boolean;
  guessMode?: 'watchman' | 'prelate';
};

const CARDS: Record<string, CardMeta> = {
  fool: {
    id: 'fool',
    value: 0,
    name: 'Fool',
    copiesClassic: 0,
    copiesExpanded: 1,
    expansion: true,
    accent: '#8a5a14',
    summary:
      'Place the Fool token on another player. If they win the round, you gain a Seal of Favor.',
    targetMode: 'single',
  },
  cutthroat: {
    id: 'cutthroat',
    value: 0,
    name: 'Cutthroat',
    copiesClassic: 0,
    copiesExpanded: 1,
    expansion: true,
    accent: '#3b242c',
    summary:
      'If targeted by a Watchman while holding this, the Watchman is knocked out instead; discard this and draw.',
    targetMode: 'none',
  },
  watchman: {
    id: 'watchman',
    value: 1,
    name: 'Watchman',
    copiesClassic: 5,
    copiesExpanded: 8,
    accent: '#6b3a2e',
    summary:
      'Choose another player and name a number other than 1. If they hold it, they are knocked out.',
    targetMode: 'single',
    guessMode: 'watchman',
  },
  confessor: {
    id: 'confessor',
    value: 2,
    name: 'Confessor',
    copiesClassic: 2,
    copiesExpanded: 2,
    accent: '#2e4a78',
    summary: 'Choose another player and secretly inspect their hand.',
    targetMode: 'single',
  },
  inquisitor: {
    id: 'inquisitor',
    value: 2,
    name: 'Inquisitor',
    copiesClassic: 0,
    copiesExpanded: 2,
    expansion: true,
    accent: '#5c1f35',
    summary:
      'Choose 2 players (may include yourself) to swap hands, then secretly inspect one of those hands.',
    targetMode: 'swap_two_peek_one',
    canTargetSelf: true,
  },
  knight: {
    id: 'knight',
    value: 3,
    name: 'Knight',
    copiesClassic: 2,
    copiesExpanded: 2,
    accent: '#7a5616',
    summary:
      'Secretly compare hands with another player. The lower card is knocked out of the round.',
    targetMode: 'single',
  },
  spymaster: {
    id: 'spymaster',
    value: 3,
    name: 'Spymaster',
    copiesClassic: 0,
    copiesExpanded: 2,
    expansion: true,
    accent: '#2c4d4a',
    summary: 'Secretly inspect the hands of 1 or 2 other players.',
    targetMode: 'one_or_two',
  },
  attendant: {
    id: 'attendant',
    value: 4,
    name: 'Attendant',
    copiesClassic: 2,
    copiesExpanded: 2,
    accent: '#2f5a2c',
    summary:
      'Until the start of your next turn, you are shielded from the effects of other players’ cards.',
    targetMode: 'none',
  },
  flatterer: {
    id: 'flatterer',
    value: 4,
    name: 'Flatterer',
    copiesClassic: 0,
    copiesExpanded: 2,
    expansion: true,
    accent: '#7d4d1a',
    summary:
      'Choose any player (including yourself). The next card played that chooses a player must choose them.',
    targetMode: 'single',
    canTargetSelf: true,
  },
  steward: {
    id: 'steward',
    value: 5,
    name: 'Steward',
    copiesClassic: 2,
    copiesExpanded: 2,
    accent: '#3b4f7a',
    summary:
      'Choose any player (including yourself) to discard their hand and draw a new card.',
    targetMode: 'single',
    canTargetSelf: true,
  },
  seneschal: {
    id: 'seneschal',
    value: 5,
    name: 'Seneschal',
    copiesClassic: 0,
    copiesExpanded: 2,
    expansion: true,
    accent: '#534378',
    summary:
      'Adds +1 to your hand value at end-of-round showdown for each Seneschal in your discard pile.',
    targetMode: 'none',
  },
  hand: {
    id: 'hand',
    value: 6,
    name: 'Hand',
    copiesClassic: 1,
    copiesExpanded: 1,
    accent: '#8b2620',
    summary: 'Trade the card in your hand with another player’s hand.',
    targetMode: 'single',
  },
  warden: {
    id: 'warden',
    value: 6,
    name: 'Warden',
    copiesClassic: 0,
    copiesExpanded: 1,
    expansion: true,
    accent: '#3d5266',
    summary:
      'If this card is in your discard pile when you are knocked out of the round, gain a Seal of Favor.',
    targetMode: 'none',
  },
  consort: {
    id: 'consort',
    value: 7,
    name: 'Consort',
    copiesClassic: 1,
    copiesExpanded: 1,
    accent: '#5f2d5e',
    summary:
      'If you hold this card with the Hand or Steward, you must discard the Consort.',
    targetMode: 'none',
  },
  matriarch: {
    id: 'matriarch',
    value: 7,
    name: 'Matriarch',
    copiesClassic: 0,
    copiesExpanded: 1,
    expansion: true,
    accent: '#6e2348',
    summary:
      'Secretly compare hands with another player. The higher card is knocked out of the round.',
    targetMode: 'single',
  },
  sovereign: {
    id: 'sovereign',
    value: 8,
    name: 'Sovereign',
    copiesClassic: 1,
    copiesExpanded: 1,
    accent: '#a41e34',
    summary:
      'If you discard this card for any reason, you are immediately knocked out. Beats Prelate at showdown.',
    targetMode: 'none',
  },
  prelate: {
    id: 'prelate',
    value: 9,
    name: 'Prelate',
    copiesClassic: 0,
    copiesExpanded: 1,
    expansion: true,
    accent: '#916316',
    summary:
      'Name any number (0–9) and a player. If right, gain a Seal of Favor and they may discard & redraw. Loses to Sovereign at showdown.',
    targetMode: 'single',
    guessMode: 'prelate',
  },
};

const CLASSIC_ORDER = [
  'sovereign',
  'consort',
  'hand',
  'steward',
  'attendant',
  'knight',
  'confessor',
  'watchman',
];

const EXPANSION_ORDER = [
  'prelate',
  'matriarch',
  'warden',
  'seneschal',
  'flatterer',
  'spymaster',
  'inquisitor',
  'watchman',
  'fool',
  'cutthroat',
];

const NUMBER_LABELS_CLASSIC: Record<number, string> = {
  2: '2 Confessor',
  3: '3 Knight',
  4: '4 Attendant',
  5: '5 Steward',
  6: '6 Hand',
  7: '7 Consort',
  8: '8 Sovereign',
};

const NUMBER_LABELS_EXPANDED: Record<number, string> = {
  0: '0 Fool / Cutthroat',
  1: '1 Watchman',
  2: '2 Confessor / Inquisitor',
  3: '3 Knight / Spymaster',
  4: '4 Attendant / Flatterer',
  5: '5 Steward / Seneschal',
  6: '6 Hand / Warden',
  7: '7 Consort / Matriarch',
  8: '8 Sovereign',
  9: '9 Prelate',
};

const SEAT_SWATCH: Record<SeatColor, string> = {
  red: '#9d2520',
  blue: '#294878',
  green: '#2f5f32',
  amber: '#9c6e1c',
  plum: '#6e2d6b',
  teal: '#246662',
  copper: '#9e4d23',
  slate: '#4f5d6b',
};

const capsStyle: CSSProperties = {
  fontSize: FONT_SMALL,
  color: INK_FAINT,
  letterSpacing: '1px',
  textTransform: 'uppercase',
};

const panelCard: CSSProperties = { ...cardStyle, marginBottom: 0 };

const requestCard: CSSProperties = {
  ...panelCard,
  background: 'rgba(196, 140, 40, 0.18)',
  borderColor: SEAL_AMBER,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginTop: '6px',
};

const MAT_PANEL_BG = '#1c120e';
const MAT_TEXT = '#fff8e8';
const MAT_TEXT_SOFT = '#f3e2c0';
const MAT_LABEL_GOLD = '#f2ca70';

type MatButtonVariant = 'default' | 'selected' | 'primary' | 'danger';

const MatButton = (props: {
  children: ReactNode;
  variant?: MatButtonVariant;
  disabled?: boolean;
  title?: string;
  confirmLabel?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) => {
  const {
    children,
    variant = 'default',
    disabled = false,
    title,
    confirmLabel,
    style,
    onClick,
  } = props;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  let background = '#3f2a1c';
  let borderColor = '#d4af5e';
  let color = '#fff8e8';
  let fontWeight: CSSProperties['fontWeight'] = 'normal';

  if (disabled) {
    background = '#2a1f19';
    borderColor = '#6b5642';
    color = '#b8a58c';
  } else if (confirming || variant === 'danger') {
    background = '#942222';
    borderColor = '#f5a3a3';
    color = '#ffffff';
    fontWeight = 'bold';
  } else if (variant === 'selected') {
    background = '#e5b54f';
    borderColor = '#fff1be';
    color = '#1a0f07';
    fontWeight = 'bold';
  } else if (variant === 'primary') {
    background = '#2b6b33';
    borderColor = '#8ee096';
    color = '#ffffff';
    fontWeight = 'bold';
  }

  const handleClick = () => {
    if (disabled) {
      return;
    }
    if (confirmLabel && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onClick?.();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={handleClick}
      style={{
        fontFamily: SERIF,
        fontSize: '12px',
        lineHeight: 1.35,
        padding: '3px 9px',
        borderRadius: '3px',
        border: `1.5px solid ${borderColor}`,
        background,
        color,
        fontWeight,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color 100ms ease, border-color 100ms ease',
        ...style,
      }}
    >
      {confirming ? confirmLabel : children}
    </button>
  );
};

const matFrameStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '9px',
  padding: '10px',
  background:
    'radial-gradient(ellipse at center, #6c2026 0%, #51151b 68%, #3c0e13 100%)',
  border: '5px solid #4a2e18',
  borderRadius: '5px',
  boxShadow:
    '0 4px 12px rgba(32, 14, 6, 0.5), inset 0 0 0 1px rgba(218, 178, 96, 0.45)',
};

const CardEmblem = (props: { id: string; color: string; size?: number }) => {
  const { id, color, size = 40 } = props;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 48 48"
      width={size}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {id === 'fool' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path
            d="M12 31 C11 21 15 14 21 18 L24 12 L27 18 C33 14 37 21 36 31 Z"
            fill={`${color}24`}
          />
          <circle cx="11" cy="17" r="2.2" fill={color} />
          <circle cx="24" cy="10" r="2.2" fill={color} />
          <circle cx="37" cy="17" r="2.2" fill={color} />
          <path d="M13 35 H35" />
        </g>
      )}
      {id === 'cutthroat' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path d="M35 10 L17 28 L13 36 L21 32 L39 14 Z" fill={`${color}26`} />
          <path d="M13 24 L24 35" />
          <circle cx="15" cy="34" r="1.8" fill={color} />
        </g>
      )}
      {id === 'watchman' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <path
            d="M24 8 L37 13 V25 C37 33 31 38 24 41 C17 38 11 33 11 25 V13 Z"
            fill={`${color}22`}
          />
          <path d="M24 12 V36" />
          <path d="M16 21 H32" />
        </g>
      )}
      {id === 'confessor' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <circle cx="24" cy="18" r="7" fill={`${color}18`} />
          <path d="M24 7 V39" />
          <path d="M14 18 H34" />
          <path d="M18 39 H30" />
        </g>
      )}
      {id === 'inquisitor' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path d="M24 8 V38" />
          <path d="M12 18 H36" />
          <path d="M12 18 L9 27 H15 Z" fill={`${color}26`} />
          <path d="M36 18 L33 27 H39 Z" fill={`${color}26`} />
          <path d="M17 38 H31" />
        </g>
      )}
      {id === 'knight' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <path d="M11 37 L35 11" />
          <path d="M37 37 L13 11" />
          <path d="M10 30 L18 38" />
          <path d="M38 30 L30 38" />
          <circle cx="24" cy="24" r="4" fill={`${color}30`} />
        </g>
      )}
      {id === 'spymaster' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path
            d="M8 24 C13 15 19 13 24 13 C29 13 35 15 40 24 C35 33 29 35 24 35 C19 35 13 33 8 24 Z"
            fill={`${color}20`}
          />
          <circle cx="24" cy="24" r="5.5" fill={`${color}30`} />
          <circle cx="24" cy="24" r="2.2" fill={color} />
        </g>
      )}
      {id === 'attendant' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <path
            d="M24 10 C31 15 35 21 35 28 C35 34 30 38 24 38 C18 38 13 34 13 28 C13 21 17 15 24 10 Z"
            fill={`${color}22`}
          />
          <path d="M24 17 V31" />
          <path d="M18 25 C20 22 28 22 30 25" />
          <circle cx="24" cy="10" r="2" fill={color} />
        </g>
      )}
      {id === 'flatterer' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path
            d="M13 14 H35 V28 C35 34 29 38 24 38 C19 38 13 34 13 28 Z"
            fill={`${color}20`}
          />
          <path d="M18 21 H22 M26 21 H30" />
          <path d="M18 29 C21 32 27 32 30 29" />
        </g>
      )}
      {id === 'steward' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <circle cx="17" cy="18" r="7" fill={`${color}22`} />
          <circle cx="17" cy="18" r="2.2" fill={color} />
          <path d="M22 23 L37 38" />
          <path d="M31 32 L35 28" />
          <path d="M35 36 L39 32" />
        </g>
      )}
      {id === 'seneschal' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path d="M14 11 H34 V37 H14 Z" fill={`${color}20`} />
          <path d="M19 18 H29 M19 24 H29 M19 30 H25" />
          <circle cx="32" cy="32" r="4.5" fill={color} />
        </g>
      )}
      {id === 'hand' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        >
          <path
            d="M15 24 V14 C15 12.5 18 12.5 18 14 V22 V11 C18 9.5 21 9.5 21 11 V22 V10 C21 8.5 24.5 8.5 24.5 10 V22 V12 C24.5 10.5 28 10.5 28 12 V24 L31 20 C32.5 18.5 35 20.5 33.5 22.5 L29 31 C27.5 35 25 38 21 38 C17 38 15 34.5 15 30 Z"
            fill={`${color}24`}
          />
          <circle cx="22.5" cy="29" r="3" fill={color} />
        </g>
      )}
      {id === 'warden' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path d="M12 12 H36 V36 H12 Z" fill={`${color}20`} />
          <path d="M18 12 V36 M24 12 V36 M30 12 V36" />
          <path d="M12 20 H36 M12 28 H36" />
        </g>
      )}
      {id === 'consort' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <path
            d="M29 11 C21 12 16 18 16 25 C16 32 22 38 30 37 C24 35 22 30 22 25 C22 19 25 14 29 11 Z"
            fill={`${color}2a`}
          />
          <path d="M32 16 L34 20 L38 20 L35 23 L36 27 L32 25 L28 27 L29 23 L26 20 L30 20 Z" />
        </g>
      )}
      {id === 'matriarch' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path d="M12 29 L16 17 L24 23 L32 17 L36 29 Z" fill={`${color}26`} />
          <path d="M13 34 H35" />
          <path d="M24 11 V18" />
          <circle cx="24" cy="11" r="2.2" fill={color} />
        </g>
      )}
      {id === 'sovereign' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        >
          <path
            d="M9 32 L12 15 L19 23 L24 11 L29 23 L36 15 L39 32 Z"
            fill={`${color}2a`}
          />
          <rect
            x="10"
            y="32"
            width="28"
            height="5"
            rx="1"
            fill={`${color}35`}
          />
          <circle cx="12" cy="13" r="2" fill={color} />
          <circle cx="24" cy="9" r="2.2" fill={color} />
          <circle cx="36" cy="13" r="2" fill={color} />
        </g>
      )}
      {id === 'prelate' && (
        <g
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        >
          <path
            d="M24 8 C31 13 34 20 33 29 H15 C14 20 17 13 24 8 Z"
            fill={`${color}26`}
          />
          <path d="M14 33 H34 V37 H14 Z" fill={`${color}30`} />
          <path d="M24 15 V25 M20 20 H28" />
        </g>
      )}
    </svg>
  );
};

const FavorSeal = (props: { filled: boolean; size?: number }) => {
  const { filled, size = 14 } = props;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 20 20"
      width={size}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle
        cx="10"
        cy="10"
        r="7.4"
        fill={filled ? '#b82424' : 'rgba(255, 232, 196, 0.12)'}
        stroke={filled ? '#f4c76b' : 'rgba(218, 184, 126, 0.45)'}
        strokeWidth="1.4"
      />
      <path
        d="M10 5.3 L11.3 8.5 L14.7 10 L11.3 11.5 L10 14.7 L8.7 11.5 L5.3 10 L8.7 8.5 Z"
        fill={filled ? '#f7d98b' : 'rgba(218, 184, 126, 0.3)'}
      />
    </svg>
  );
};

const CardBack = (props: {
  width?: number;
  height?: number;
  label?: string;
}) => {
  const { width = 46, height = 64, label } = props;
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '4px',
        background:
          'linear-gradient(145deg, #7e1c22 0%, #581116 65%, #3d0a0e 100%)',
        border: '1px solid #d4af5e',
        boxShadow:
          '0 2px 5px rgba(0, 0, 0, 0.45), inset 0 0 0 2px rgba(212, 175, 94, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f2d388',
        fontFamily: TITLE_FONT,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: `${Math.max(15, Math.round(width * 0.46))}px`,
          height: `${Math.max(15, Math.round(width * 0.46))}px`,
          borderRadius: '50%',
          background: '#a62624',
          border: '1px solid #f0c975',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.max(9, Math.round(width * 0.24))}px`,
          fontWeight: 'bold',
        }}
      >
        {label ?? '✦'}
      </div>
    </div>
  );
};

const MiniCardFace = (props: { id: string; highlight?: boolean }) => {
  const { id, highlight } = props;
  const meta = CARDS[id];
  if (!meta) {
    return null;
  }
  return (
    <div
      title={`${meta.value} — ${meta.name}: ${meta.summary}`}
      style={{
        width: '54px',
        height: '72px',
        borderRadius: '4px',
        background: 'linear-gradient(180deg, #f6ead2 0%, #e9d7b5 100%)',
        border: `1.5px solid ${highlight ? '#e5b54f' : meta.accent}`,
        boxShadow: highlight
          ? '0 0 8px rgba(242, 200, 96, 0.7)'
          : '0 2px 4px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3px 2px',
        color: '#2a1a0e',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 3px',
          fontWeight: 'bold',
          fontSize: '12px',
          color: meta.accent,
          lineHeight: 1,
        }}
      >
        <span>{meta.value}</span>
      </div>
      <CardEmblem id={meta.id} color={meta.accent} size={28} />
      <div
        style={{
          fontSize: '9px',
          fontWeight: 'bold',
          color: '#2c1c10',
          textAlign: 'center',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%',
        }}
      >
        {meta.name}
      </div>
    </div>
  );
};

const HandCard = (props: {
  id: string;
  expanded: boolean;
  tag?: string;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  interactive: boolean;
  onClick?: () => void;
}) => {
  const {
    id,
    expanded,
    tag,
    selected,
    disabled,
    disabledReason,
    interactive,
    onClick,
  } = props;
  const meta = CARDS[id];
  if (!meta) {
    return null;
  }
  const copies = expanded ? meta.copiesExpanded : meta.copiesClassic;

  return (
    <div
      onClick={!disabled && interactive ? onClick : undefined}
      title={disabledReason || meta.summary}
      style={{
        position: 'relative',
        width: '164px',
        minHeight: '192px',
        borderRadius: '6px',
        background: disabled
          ? 'linear-gradient(180deg, #dfd2bc 0%, #cfc0a5 100%)'
          : 'linear-gradient(180deg, #fbf1dc 0%, #eddcb9 100%)',
        border: `2px solid ${selected ? '#e5b54f' : meta.accent}`,
        boxShadow: selected
          ? '0 0 0 2px rgba(242, 200, 96, 0.85), 0 6px 14px rgba(0, 0, 0, 0.5)'
          : '0 3px 8px rgba(0, 0, 0, 0.45)',
        transform: selected ? 'translateY(-6px)' : 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        cursor: interactive && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.62 : 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '7px 8px 8px 8px',
        boxSizing: 'border-box',
        color: '#2a1a0e',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${meta.accent}55`,
          paddingBottom: '4px',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: meta.accent,
            color: '#fdf3dc',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            fontFamily: TITLE_FONT,
            boxShadow: 'inset 0 0 0 1px rgba(255, 224, 150, 0.5)',
          }}
        >
          {meta.value}
        </span>
        <span
          style={{
            fontFamily: TITLE_FONT,
            fontWeight: 'bold',
            fontSize: '14px',
            color: meta.accent,
            flex: 1,
            textAlign: 'center',
          }}
        >
          {meta.name}
        </span>
        <span style={{ fontSize: FONT_TINY, color: '#6b5128' }}>×{copies}</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '4px 0 6px 0',
        }}
      >
        <CardEmblem id={meta.id} color={meta.accent} size={46} />
      </div>

      <div
        style={{
          fontSize: '11px',
          lineHeight: 1.3,
          color: '#3a2618',
          textAlign: 'center',
          flex: 1,
        }}
      >
        {meta.summary}
      </div>

      {!!tag && (
        <div
          style={{
            position: 'absolute',
            top: '-9px',
            right: '8px',
            background: '#b38224',
            color: '#fff6df',
            fontSize: '10px',
            fontWeight: 'bold',
            padding: '1px 6px',
            borderRadius: '2px',
            border: '1px solid #f4d382',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </div>
      )}
    </div>
  );
};

const DiscardRow = (props: { discards: string[]; dark?: boolean }) => {
  const { discards, dark } = props;
  if (!discards.length) {
    return (
      <div
        style={{
          fontSize: '10px',
          fontStyle: 'italic',
          color: dark ? 'rgba(242, 222, 186, 0.55)' : INK_FAINT,
        }}
      >
        No discards
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
      {discards.map((id, i) => {
        const meta = CARDS[id];
        return (
          <span
            key={i}
            title={meta ? `${meta.value} ${meta.name}: ${meta.summary}` : ''}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '1px 4px',
              borderRadius: '2px',
              background: '#f5e8ce',
              border: `1px solid ${meta?.accent || INK_FAINT}`,
              color: '#2a1a0e',
              fontSize: '10px',
              fontWeight: 'bold',
              lineHeight: 1.15,
            }}
          >
            <span style={{ color: meta?.accent || '#2a1a0e' }}>
              {meta?.value ?? '?'}
            </span>
            <span>{meta?.name || '?'}</span>
          </span>
        );
      })}
    </div>
  );
};

const SeatTile = (props: { seat: Seat; dense?: boolean }) => {
  const { act, data } = useBackend<Data>();
  const { seat, dense } = props;
  const active = !!seat.is_turn;
  const isLobby = data.phase === 'lobby' || data.phase === 'match_end';
  const showHandFace = seat.hand.length > 0;

  let seatAction: ReactNode = null;
  if (!seat.name && isLobby && !data.my_seat) {
    seatAction = (
      <MatButton
        onClick={() => act('sit', { seat: seat.index })}
        style={{ fontSize: '10px', padding: '1px 7px' }}
      >
        Sit
      </MatButton>
    );
  } else if (seat.mine) {
    seatAction =
      data.phase === 'playing' || data.phase === 'round_end' ? (
        <MatButton
          confirmLabel="Leave?"
          title="Stand up and forfeit the current match."
          style={{ fontSize: '10px', padding: '1px 7px' }}
          onClick={() => act('stand', { seat: seat.index })}
        >
          Leave
        </MatButton>
      ) : (
        <MatButton
          style={{ fontSize: '10px', padding: '1px 7px' }}
          onClick={() => act('stand', { seat: seat.index })}
        >
          Get up
        </MatButton>
      );
  } else if (seat.name && seat.away && (isLobby || !!data.my_seat)) {
    seatAction = (
      <MatButton
        title="They have walked away from the table."
        style={{ fontSize: '10px', padding: '1px 7px' }}
        onClick={() => act('stand', { seat: seat.index })}
      >
        Clear
      </MatButton>
    );
  }

  return (
    <div
      style={{
        minWidth: 0,
        padding: dense ? '5px 7px' : '7px 9px',
        borderRadius: '4px',
        background: active
          ? 'rgba(222, 174, 74, 0.24)'
          : seat.eliminated
            ? 'rgba(24, 10, 12, 0.5)'
            : 'rgba(34, 12, 15, 0.55)',
        border: `1px solid ${
          seat.match_winner || seat.round_winner
            ? '#f0c45d'
            : seat.flatterer_marked
              ? '#f2a640'
              : active
                ? '#e5b54f'
                : 'rgba(218, 184, 126, 0.32)'
        }`,
        borderLeft: `4px solid ${SEAT_SWATCH[seat.color]}`,
        color: '#f6ebd4',
        opacity: seat.eliminated ? 0.72 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? '4px' : '5px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span
          style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: SEAT_SWATCH[seat.color],
            border: '1px solid #f0d7a0',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: seat.name ? 'bold' : 'normal',
            fontStyle: seat.name ? 'normal' : 'italic',
            color: seat.name ? '#fbf0d9' : 'rgba(242, 222, 186, 0.55)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: dense ? '11px' : '12px',
          }}
        >
          {seat.name || `Seat ${seat.index}`}
        </div>
        {seatAction}
      </div>

      {!!seat.name && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '3px',
            }}
          >
            <span
              title={`${seat.seals} of ${data.seals_to_win} Seals of Favor`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
              }}
            >
              {Array.from({ length: data.seals_to_win }, (_, i) => (
                <FavorSeal
                  key={i}
                  filled={i < seat.seals}
                  size={dense ? 12 : 14}
                />
              ))}
            </span>
            {!!seat.protected && (
              <span
                style={{
                  ...badgeStyle(SEAL_GREEN),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Protected
              </span>
            )}
            {!!seat.flatterer_marked && (
              <span
                title="Flatterer mark: the next targeting card must choose this courtier."
                style={{
                  ...badgeStyle('#b56614'),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Must Target
              </span>
            )}
            {!!seat.fool_marked && (
              <span
                title={
                  data.fool_owner_name
                    ? `Fool token placed by ${data.fool_owner_name}`
                    : 'Fool token'
                }
                style={{
                  ...badgeStyle('#7a4b94'),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Fool
              </span>
            )}
            {seat.seneschals > 0 && (
              <span
                title={`+${seat.seneschals} to hand value at showdown (Seneschal)`}
                style={{
                  ...badgeStyle('#534378'),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                +{seat.seneschals}
              </span>
            )}
            {!!seat.has_warden && !seat.eliminated && (
              <span
                title="Has Warden in discards — gains a Seal of Favor if knocked out."
                style={{
                  ...badgeStyle('#3d5266'),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Warden
              </span>
            )}
            {!!seat.eliminated && (
              <span
                style={{
                  ...badgeStyle(SEAL_RED),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Out
              </span>
            )}
            {active && (
              <span
                style={{
                  ...badgeStyle(SEAL_AMBER),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Turn
              </span>
            )}
            {!!seat.away && !seat.mine && (
              <span
                style={{
                  ...badgeStyle(INK_FAINT),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Away
              </span>
            )}
            {!!seat.round_winner && data.phase === 'round_end' && (
              <span
                style={{
                  ...badgeStyle(SEAL_AMBER),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Winner
              </span>
            )}
            {!!seat.match_winner && data.phase === 'match_end' && (
              <span
                style={{
                  ...badgeStyle(SEAL_AMBER),
                  fontSize: '9px',
                  padding: '0 4px',
                  marginLeft: '1px',
                }}
              >
                Champion
              </span>
            )}
          </div>

          {data.phase !== 'lobby' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {showHandFace ? (
                  seat.hand.map((id, i) => (
                    <MiniCardFace
                      key={i}
                      id={id}
                      highlight={!!seat.round_winner && !!data.showdown}
                    />
                  ))
                ) : seat.hand_count > 0 ? (
                  Array.from({ length: seat.hand_count }, (_, i) => (
                    <CardBack
                      key={i}
                      width={dense ? 30 : 36}
                      height={dense ? 42 : 50}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      width: dense ? '30px' : '36px',
                      height: dense ? '42px' : '50px',
                      borderRadius: '4px',
                      border: '1px dashed rgba(218, 184, 126, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: 'rgba(242, 222, 186, 0.4)',
                    }}
                  >
                    —
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '9px',
                    color: 'rgba(242, 222, 186, 0.68)',
                    marginBottom: '2px',
                  }}
                >
                  Discards
                  {seat.discards.length > 0 && ` (${seat.discard_sum})`}
                </div>
                <DiscardRow discards={seat.discards} dark />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const ScarletSeal = () => {
  const { act, data } = useBackend<Data>();
  const [refTab, setRefTab] = useState<'rules' | 'classic' | 'expanded' | null>(
    null,
  );
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [selectedPeek, setSelectedPeek] = useState<number>(0);
  const [selectedGuess, setSelectedGuess] = useState<number>(-1);
  const [dismissedSeq, setDismissedSeq] = useState<number>(0);

  const mySeat = data.my_seat
    ? data.seats.find((s) => s.index === data.my_seat) || null
    : null;
  const handKey = mySeat ? mySeat.hand.join(',') : '';

  // Reset pending play selection whenever turn, round, or hand changes
  useEffect(() => {
    setSelectedSlot(0);
    setSelectedTargets([]);
    setSelectedPeek(0);
    setSelectedGuess(-1);
  }, [data.phase, data.round, data.my_turn, handKey]);

  // Auto-select Consort if forced
  useEffect(() => {
    if (!data.my_turn || !mySeat) {
      return;
    }
    if (data.forced_consort && selectedSlot === 0) {
      const idx = mySeat.hand.indexOf('consort');
      if (idx !== -1) {
        setSelectedSlot(idx + 1);
      }
    }
  }, [data.my_turn, data.forced_consort, handKey, selectedSlot]);

  const selectedCardId =
    mySeat && selectedSlot > 0 ? mySeat.hand[selectedSlot - 1] || '' : '';
  const selectedMeta = selectedCardId ? CARDS[selectedCardId] : null;
  const validTargets = selectedCardId
    ? data.targets_by_card[selectedCardId] || []
    : [];

  const forcedFlatterer =
    data.flatterer_target > 0 && validTargets.includes(data.flatterer_target)
      ? data.flatterer_target
      : 0;

  useEffect(() => {
    if (!selectedMeta || selectedMeta.targetMode === 'none') {
      setSelectedTargets([]);
      setSelectedPeek(0);
      setSelectedGuess(-1);
      return;
    }
    if (selectedMeta.targetMode === 'single') {
      if (validTargets.length === 1) {
        setSelectedTargets([validTargets[0]]);
      } else {
        setSelectedTargets((prev) =>
          prev.length === 1 && validTargets.includes(prev[0]) ? prev : [],
        );
      }
    } else {
      // Multi-target (one_or_two or swap_two_peek_one): keep valid + enforce Flatterer
      setSelectedTargets((prev) => {
        const next = prev.filter((id) => validTargets.includes(id));
        if (forcedFlatterer && !next.includes(forcedFlatterer)) {
          next.unshift(forcedFlatterer);
        }
        return next.slice(0, 2);
      });
    }
    if (!selectedMeta.guessMode) {
      setSelectedGuess(-1);
    }
  }, [selectedSlot, selectedCardId, validTargets.join(','), forcedFlatterer]);

  // Auto-default Inquisitor peek target when 2 targets are chosen
  useEffect(() => {
    if (
      selectedMeta?.targetMode !== 'swap_two_peek_one' ||
      selectedTargets.length !== 2
    ) {
      setSelectedPeek(0);
      return;
    }
    if (!selectedTargets.includes(selectedPeek)) {
      const other = selectedTargets.find((t) => t !== data.my_seat);
      setSelectedPeek(other ?? selectedTargets[0]);
    }
  }, [selectedMeta?.targetMode, selectedTargets.join(','), data.my_seat]);

  const toggleTarget = (seatIdx: number) => {
    if (!selectedMeta || !validTargets.includes(seatIdx)) {
      return;
    }
    if (selectedMeta.targetMode === 'single') {
      setSelectedTargets([seatIdx]);
      return;
    }
    setSelectedTargets((prev) => {
      if (prev.includes(seatIdx)) {
        if (seatIdx === forcedFlatterer) {
          return prev;
        }
        return prev.filter((id) => id !== seatIdx);
      }
      if (prev.length < 2) {
        return [...prev, seatIdx];
      }
      // Replace the non-forced entry
      if (forcedFlatterer) {
        return [forcedFlatterer, seatIdx];
      }
      return [prev[1], seatIdx];
    });
  };

  const guessNumbers = (() => {
    if (!selectedMeta?.guessMode) {
      return [];
    }
    if (selectedMeta.guessMode === 'prelate') {
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
    return data.expanded ? [0, 2, 3, 4, 5, 6, 7, 8, 9] : [2, 3, 4, 5, 6, 7, 8];
  })();

  const guessLabels = data.expanded
    ? NUMBER_LABELS_EXPANDED
    : NUMBER_LABELS_CLASSIC;

  const targetSatisfied = (() => {
    if (!selectedMeta || selectedMeta.targetMode === 'none') {
      return true;
    }
    if (validTargets.length === 0) {
      return true;
    }
    if (selectedMeta.targetMode === 'single') {
      return selectedTargets.length === 1;
    }
    if (selectedMeta.targetMode === 'one_or_two') {
      return (
        selectedTargets.length >= 1 &&
        selectedTargets.length <= 2 &&
        (!forcedFlatterer || selectedTargets.includes(forcedFlatterer))
      );
    }
    if (selectedMeta.targetMode === 'swap_two_peek_one') {
      return (
        selectedTargets.length === 2 &&
        selectedTargets.includes(selectedPeek) &&
        (!forcedFlatterer || selectedTargets.includes(forcedFlatterer))
      );
    }
    return false;
  })();

  const guessSatisfied =
    !selectedMeta?.guessMode ||
    validTargets.length === 0 ||
    guessNumbers.includes(selectedGuess);

  const canCommitPlay =
    !!data.my_turn && !!selectedMeta && targetSatisfied && guessSatisfied;

  const submitPlay = () => {
    if (!canCommitPlay) {
      return;
    }
    act('play', {
      slot: selectedSlot,
      target: selectedTargets[0] || 0,
      target2: selectedTargets[1] || 0,
      peek: selectedPeek || 0,
      guess: selectedGuess,
    });
    setSelectedSlot(0);
    setSelectedTargets([]);
    setSelectedPeek(0);
    setSelectedGuess(-1);
  };

  const otherSeats = mySeat
    ? data.seats.filter((s) => s.index !== mySeat.index)
    : data.seats;

  const visibleOtherSeats =
    data.phase === 'lobby' || data.phase === 'match_end'
      ? otherSeats
      : otherSeats.filter((s) => !!s.name);

  const gridCols = mySeat
    ? Math.min(4, Math.max(1, visibleOtherSeats.length))
    : visibleOtherSeats.length > 4
      ? 4
      : 2;
  const denseSeats = visibleOtherSeats.length >= 4;

  const intel = data.private_intel;
  const showIntel = !!intel && dismissedSeq !== intel.seq;
  const myPrelateCardId =
    data.is_my_prelate_choice && mySeat?.hand[0] ? mySeat.hand[0] : '';
  const myPrelateCard = myPrelateCardId ? CARDS[myPrelateCardId] : null;

  return (
    <Window width={1060} height={740} title="Scarlet Seal" theme="parchment">
      <Window.Content scrollable>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '10px 12px',
            height: '100%',
            boxSizing: 'border-box',
            fontFamily: SERIF,
            color: INK,
          }}
        >
          {/* Main Table Mat */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={matFrameStyle}>
              {/* Top Opponents (or all seats for spectators) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  gap: '6px',
                }}
              >
                {visibleOtherSeats.map((seat) => (
                  <SeatTile key={seat.index} seat={seat} dense={denseSeats} />
                ))}
              </div>

              {/* Center Table Area: Deck, Set-Aside, Pending Prelate Choice, Round Banner, Private Intel */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '4px 2px',
                }}
              >
                {data.phase === 'lobby' ? (
                  <div
                    style={{
                      textAlign: 'center',
                      color: '#f5e7cb',
                      padding: '12px 16px',
                      background: 'rgba(28, 10, 12, 0.45)',
                      border: '1px dashed rgba(224, 188, 118, 0.45)',
                      borderRadius: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <WaxSeal label="Scarlet Seal" royal size={50} />
                    </div>
                    <div
                      style={{
                        fontFamily: TITLE_FONT,
                        fontSize: '21px',
                        color: '#f7d996',
                      }}
                    >
                      Scarlet Seal
                    </div>
                    <div
                      style={{
                        fontSize: FONT_SMALL,
                        color: 'rgba(246, 232, 202, 0.85)',
                        fontStyle: 'italic',
                        marginTop: '4px',
                      }}
                    >
                      Court intrigue for 2–8 players. Uses the classic 16-card
                      deck for 2–4 courtiers, and expands to all 32 cards for
                      5–8 courtiers.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: '16px',
                      padding: '7px 10px',
                      background: 'rgba(24, 8, 10, 0.36)',
                      border: '1px solid rgba(218, 184, 126, 0.25)',
                      borderRadius: '4px',
                    }}
                  >
                    {/* Draw Deck */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      {data.deck_count > 0 ? (
                        <CardBack
                          width={48}
                          height={66}
                          label={String(data.deck_count)}
                        />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '66px',
                            borderRadius: '4px',
                            border: '1px dashed rgba(218, 184, 126, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(242, 222, 186, 0.65)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          Empty
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#f2d9a2',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                        }}
                      >
                        Deck ({data.deck_count})
                      </div>
                    </div>

                    {/* Hidden Set-Aside Card */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                      title="One card is removed face-down each round. Drawn only if the deck is empty when a redraw occurs."
                    >
                      {data.has_hidden_card ? (
                        <CardBack width={44} height={62} label="?" />
                      ) : (
                        <div
                          style={{
                            width: '44px',
                            height: '62px',
                            borderRadius: '4px',
                            border: '1px dashed rgba(218, 184, 126, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(242, 222, 186, 0.5)',
                            fontSize: '10px',
                          }}
                        >
                          Used
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'rgba(242, 222, 186, 0.78)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                        }}
                      >
                        Set Aside
                      </div>
                    </div>

                    {/* 2-Player Face-Up Set-Aside Cards */}
                    {data.set_aside_open.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {data.set_aside_open.map((id, i) => (
                            <MiniCardFace key={i} id={id} />
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            color: 'rgba(242, 222, 186, 0.78)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}
                        >
                          Removed Face-Up (2P)
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pending Prelate Optional Redraw Prompt */}
                {data.phase === 'playing' && data.pending_prelate_seat > 0 && (
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: '4px',
                      background: MAT_PANEL_BG,
                      border: '2px solid #e5b54f',
                      color: MAT_TEXT,
                      textAlign: 'center',
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {data.is_my_prelate_choice ? (
                      <>
                        <div
                          style={{
                            fontFamily: TITLE_FONT,
                            fontWeight: 'bold',
                            fontSize: '15px',
                            color: '#ffd97d',
                          }}
                        >
                          The Prelate Exposed Your Hand!
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: MAT_TEXT,
                            marginTop: '3px',
                          }}
                        >
                          Your{' '}
                          <b>
                            {myPrelateCard
                              ? `${myPrelateCard.name} (${myPrelateCard.value})`
                              : 'card'}
                          </b>{' '}
                          was correctly named. You may keep it, or discard it
                          and draw a new card.
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '8px',
                          }}
                        >
                          <MatButton
                            variant="default"
                            onClick={() =>
                              act('prelate_choice', { choice: 'keep' })
                            }
                          >
                            Keep{' '}
                            {myPrelateCard
                              ? myPrelateCard.name
                              : 'Current Card'}
                          </MatButton>
                          {myPrelateCardId === 'sovereign' ? (
                            <MatButton
                              variant="danger"
                              confirmLabel="Really discard Sovereign?"
                              onClick={() =>
                                act('prelate_choice', { choice: 'redraw' })
                              }
                            >
                              Discard Sovereign (Eliminate Self)
                            </MatButton>
                          ) : (
                            <MatButton
                              variant="primary"
                              onClick={() =>
                                act('prelate_choice', { choice: 'redraw' })
                              }
                            >
                              Discard & Draw New Card
                            </MatButton>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: MAT_TEXT_SOFT }}>
                        Waiting for <b>{data.pending_prelate_name}</b> to decide
                        whether to keep or redraw their exposed card…
                      </div>
                    )}
                  </div>
                )}

                {/* Round / Match Result Banner on Table */}
                {(data.phase === 'round_end' || data.phase === 'match_end') && (
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: '4px',
                      background: MAT_PANEL_BG,
                      border: '2px solid #e5b54f',
                      color: MAT_TEXT,
                      textAlign: 'center',
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: TITLE_FONT,
                        fontWeight: 'bold',
                        fontSize: '16px',
                        color: '#ffd97d',
                      }}
                    >
                      {data.phase === 'match_end'
                        ? 'Match Complete'
                        : `Round ${data.round} Complete`}
                    </div>
                    <div
                      style={{
                        fontSize: FONT_SMALL,
                        color: MAT_TEXT,
                        marginTop: '3px',
                      }}
                    >
                      {data.phase === 'match_end'
                        ? data.message
                        : data.round_summary}
                    </div>
                    {!!data.can_next_round && (
                      <div style={{ marginTop: '7px' }}>
                        <MatButton
                          variant="primary"
                          onClick={() => act('next_round')}
                        >
                          Deal Round {data.round + 1}
                        </MatButton>
                      </div>
                    )}
                    {!!data.can_start && data.phase === 'match_end' && (
                      <div style={{ marginTop: '7px' }}>
                        <MatButton
                          variant="primary"
                          onClick={() => act('start')}
                        >
                          Play New Match
                        </MatButton>
                      </div>
                    )}
                  </div>
                )}

                {/* Private Secret Intel Note (Visible ONLY to this player) */}
                {showIntel && intel && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 10px',
                      borderRadius: '4px',
                      background: MAT_PANEL_BG,
                      border: '1.5px solid #7aa8e8',
                      color: MAT_TEXT,
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {intel.cards.length > 0 ? (
                      <div
                        style={{ display: 'flex', gap: '4px', flexShrink: 0 }}
                      >
                        {intel.cards.map((id, i) => (
                          <MiniCardFace key={i} id={id} />
                        ))}
                      </div>
                    ) : (
                      <WaxSeal color="blue" label="Intel" mark="!" size={38} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: FONT_TINY,
                          color: '#96c5ff',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                        }}
                      >
                        {intel.label || 'Secret Note'} (Only You Can See This)
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: MAT_TEXT,
                          marginTop: '2px',
                          lineHeight: 1.35,
                        }}
                      >
                        {intel.note}
                      </div>
                    </div>
                    <MatButton
                      title="Hide this note"
                      onClick={() => setDismissedSeq(intel.seq)}
                      style={{ padding: '2px 7px', fontWeight: 'bold' }}
                    >
                      ✕
                    </MatButton>
                  </div>
                )}
              </div>

              {/* Bottom Player Hand & Play Controls */}
              {mySeat && (
                <div
                  style={{
                    background: 'rgba(26, 9, 12, 0.62)',
                    border: `1px solid ${
                      data.my_turn ? '#e5b54f' : 'rgba(218, 184, 126, 0.35)'
                    }`,
                    borderLeft: `4px solid ${SEAT_SWATCH[mySeat.color]}`,
                    borderRadius: '4px',
                    padding: '8px 10px',
                    color: '#f6ebd4',
                  }}
                >
                  {/* Own Header Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginBottom: '7px',
                    }}
                  >
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: SEAT_SWATCH[mySeat.color],
                        border: '1px solid #f0d7a0',
                      }}
                    />
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      {mySeat.name}
                    </span>
                    <span style={badgeStyle(SEAL_GREEN)}>You</span>
                    <span
                      title={`${mySeat.seals} of ${data.seals_to_win} Seals of Favor`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        marginLeft: '2px',
                      }}
                    >
                      {Array.from({ length: data.seals_to_win }, (_, i) => (
                        <FavorSeal
                          key={i}
                          filled={i < mySeat.seals}
                          size={15}
                        />
                      ))}
                    </span>
                    {!!mySeat.protected && (
                      <span style={badgeStyle(SEAL_GREEN)}>Protected</span>
                    )}
                    {!!mySeat.flatterer_marked && (
                      <span style={badgeStyle('#b56614')}>Must Target</span>
                    )}
                    {!!mySeat.fool_marked && (
                      <span style={badgeStyle('#7a4b94')}>Fool Bet</span>
                    )}
                    {mySeat.seneschals > 0 && (
                      <span style={badgeStyle('#534378')}>
                        +{mySeat.seneschals} Showdown
                      </span>
                    )}
                    {!!mySeat.has_warden && !mySeat.eliminated && (
                      <span style={badgeStyle('#3d5266')}>Warden Active</span>
                    )}
                    {!!mySeat.eliminated && (
                      <span style={badgeStyle(SEAL_RED)}>Knocked Out</span>
                    )}
                    {!!data.my_turn && (
                      <span style={badgeStyle(SEAL_AMBER)}>Your Turn</span>
                    )}
                    <div style={{ flex: 1 }} />
                    {data.phase === 'playing' || data.phase === 'round_end' ? (
                      <MatButton
                        confirmLabel="Forfeit?"
                        title="Stand up and forfeit the match."
                        onClick={() => act('stand', { seat: mySeat.index })}
                      >
                        Leave
                      </MatButton>
                    ) : (
                      <MatButton
                        onClick={() => act('stand', { seat: mySeat.index })}
                      >
                        Get up
                      </MatButton>
                    )}
                  </div>

                  {/* Hand Cards */}
                  {data.phase !== 'lobby' && (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'stretch',
                          gap: '14px',
                          flexWrap: 'wrap',
                          marginBottom: '8px',
                        }}
                      >
                        {mySeat.hand.length > 0 ? (
                          mySeat.hand.map((id, i) => {
                            const slot = i + 1;
                            const blockedByConsort =
                              !!data.my_turn &&
                              !!data.forced_consort &&
                              id !== 'consort';
                            return (
                              <HandCard
                                key={`${slot}-${id}`}
                                id={id}
                                expanded={!!data.expanded}
                                tag={
                                  data.my_turn && slot === 2
                                    ? 'Drawn'
                                    : undefined
                                }
                                selected={selectedSlot === slot}
                                disabled={blockedByConsort}
                                disabledReason={
                                  blockedByConsort
                                    ? 'You must discard the Consort when holding the Hand or Steward.'
                                    : undefined
                                }
                                interactive={!!data.my_turn}
                                onClick={() =>
                                  setSelectedSlot(
                                    selectedSlot === slot ? 0 : slot,
                                  )
                                }
                              />
                            );
                          })
                        ) : (
                          <div
                            style={{
                              padding: '10px',
                              fontStyle: 'italic',
                              color: 'rgba(242, 222, 186, 0.78)',
                              fontSize: FONT_SMALL,
                            }}
                          >
                            {mySeat.eliminated
                              ? 'You are knocked out for this round.'
                              : 'No cards in hand.'}
                          </div>
                        )}
                      </div>

                      {/* Turn Action Tray */}
                      {!!data.my_turn && (
                        <div
                          style={{
                            padding: '8px 10px',
                            borderRadius: '4px',
                            background: MAT_PANEL_BG,
                            border: '1.5px solid #e5b54f',
                            color: MAT_TEXT,
                            marginBottom: '7px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
                          }}
                        >
                          {!selectedMeta ? (
                            <div
                              style={{
                                fontSize: '13px',
                                textAlign: 'center',
                                color: MAT_TEXT_SOFT,
                              }}
                            >
                              {data.forced_consort
                                ? 'You hold the Consort alongside the Hand or Steward — click the Consort to discard it.'
                                : 'Click one of your two cards above to play it.'}
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '7px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    color: MAT_TEXT,
                                  }}
                                >
                                  Playing {selectedMeta.name} (
                                  {selectedMeta.value})
                                </div>
                                {selectedMeta.id === 'sovereign' ? (
                                  <MatButton
                                    variant="danger"
                                    confirmLabel="Really discard Sovereign?"
                                    onClick={submitPlay}
                                  >
                                    Discard Sovereign (Eliminate Self)
                                  </MatButton>
                                ) : (
                                  <MatButton
                                    variant="primary"
                                    disabled={!canCommitPlay}
                                    onClick={submitPlay}
                                  >
                                    {selectedMeta.targetMode !== 'none' &&
                                    validTargets.length === 0
                                      ? `Discard ${selectedMeta.name} (No Effect)`
                                      : `Play ${selectedMeta.name}`}
                                  </MatButton>
                                )}
                              </div>

                              {selectedMeta.targetMode !== 'none' &&
                                (validTargets.length === 0 ? (
                                  <div
                                    style={{
                                      fontSize: FONT_SMALL,
                                      fontStyle: 'italic',
                                      color: MAT_TEXT_SOFT,
                                    }}
                                  >
                                    {data.flatterer_target
                                      ? 'No legal targeting combination satisfies the Flatterer mark — this card will be discarded without effect.'
                                      : 'Not enough unprotected courtiers to target — this card will be discarded without effect.'}
                                  </div>
                                ) : (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: MAT_LABEL_GOLD,
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.6px',
                                        marginBottom: '4px',
                                      }}
                                    >
                                      {selectedMeta.targetMode ===
                                      'swap_two_peek_one'
                                        ? `Choose 2 Players to Swap (${selectedTargets.length}/2)`
                                        : selectedMeta.targetMode ===
                                            'one_or_two'
                                          ? `Choose 1 or 2 Players to Inspect (${selectedTargets.length}/2)`
                                          : 'Choose Target'}
                                      {forcedFlatterer
                                        ? ' · Flatterer Target Required'
                                        : ''}
                                    </div>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '5px',
                                      }}
                                    >
                                      {data.seats
                                        .filter(
                                          (s) =>
                                            !!s.name &&
                                            !s.eliminated &&
                                            (selectedMeta.canTargetSelf ||
                                              s.index !== mySeat.index),
                                        )
                                        .map((s) => {
                                          const allowed = validTargets.includes(
                                            s.index,
                                          );
                                          const picked =
                                            selectedTargets.includes(s.index);
                                          const locked =
                                            s.index === forcedFlatterer &&
                                            selectedMeta.targetMode !==
                                              'single';
                                          return (
                                            <MatButton
                                              key={s.index}
                                              variant={
                                                picked ? 'selected' : 'default'
                                              }
                                              disabled={!allowed}
                                              title={
                                                !allowed
                                                  ? s.protected
                                                    ? 'Shielded by Attendant until their next turn.'
                                                    : 'Must choose the Flatterer’s marked target.'
                                                  : locked
                                                    ? 'Required by Flatterer.'
                                                    : undefined
                                              }
                                              onClick={() =>
                                                toggleTarget(s.index)
                                              }
                                            >
                                              {s.name}
                                              {s.index === mySeat.index
                                                ? ' (Yourself)'
                                                : ''}
                                              {s.index === forcedFlatterer
                                                ? ' ★'
                                                : ''}
                                              {!allowed && s.protected
                                                ? ' [Protected]'
                                                : ''}
                                            </MatButton>
                                          );
                                        })}
                                    </div>
                                  </div>
                                ))}

                              {/* Inquisitor: choose which swapped hand to inspect */}
                              {selectedMeta.targetMode ===
                                'swap_two_peek_one' &&
                                selectedTargets.length === 2 && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: MAT_LABEL_GOLD,
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.6px',
                                        marginBottom: '4px',
                                      }}
                                    >
                                      Inspect One Swapped Hand
                                    </div>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '5px',
                                      }}
                                    >
                                      {selectedTargets.map((idx) => {
                                        const s = data.seats.find(
                                          (seat) => seat.index === idx,
                                        );
                                        if (!s) {
                                          return null;
                                        }
                                        return (
                                          <MatButton
                                            key={idx}
                                            variant={
                                              selectedPeek === idx
                                                ? 'selected'
                                                : 'default'
                                            }
                                            onClick={() => setSelectedPeek(idx)}
                                          >
                                            {s.name}
                                            {s.index === mySeat.index
                                              ? ' (Yourself)'
                                              : ''}
                                          </MatButton>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                              {/* Watchman / Prelate number guess */}
                              {selectedMeta.guessMode &&
                                validTargets.length > 0 && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: MAT_LABEL_GOLD,
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.6px',
                                        marginBottom: '4px',
                                      }}
                                    >
                                      {selectedMeta.guessMode === 'prelate'
                                        ? 'Name Any Number (0–9)'
                                        : data.expanded
                                          ? 'Name a Number (Other Than 1)'
                                          : 'Name a Role (Not Watchman)'}
                                    </div>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '5px',
                                      }}
                                    >
                                      {guessNumbers.map((n) => (
                                        <MatButton
                                          key={n}
                                          variant={
                                            selectedGuess === n
                                              ? 'selected'
                                              : 'default'
                                          }
                                          onClick={() => setSelectedGuess(n)}
                                        >
                                          {guessLabels[n] || String(n)}
                                        </MatButton>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Own Discards */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'rgba(242, 222, 186, 0.72)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Your Discards
                          {mySeat.discards.length > 0 &&
                            ` (sum ${mySeat.discard_sum})`}
                          :
                        </span>
                        <DiscardRow discards={mySeat.discards} dark />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side Panel */}
          <SidePanel
            openRules={() => setRefTab('rules')}
            openCards={() => setRefTab(data.expanded ? 'expanded' : 'classic')}
          />
        </div>

        {refTab && (
          <ReferenceModal initialTab={refTab} onClose={() => setRefTab(null)} />
        )}
      </Window.Content>
    </Window>
  );
};

const SidePanel = (props: { openRules: () => void; openCards: () => void }) => {
  const { act, data } = useBackend<Data>();
  const { openRules, openCards } = props;
  const logRef = useRef<HTMLDivElement>(null);
  const history = data.history || [];

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [history.length]);

  let tone = INK_SOFT;
  if (data.phase === 'match_end') {
    tone = SEAL_RED;
  } else if (data.my_turn || data.is_my_prelate_choice) {
    tone = SEAL_GREEN;
  } else if (data.phase === 'round_end') {
    tone = SEAL_AMBER;
  }

  let startHint: string | undefined;
  if (!data.can_start) {
    if (!data.my_seat) {
      startHint = 'Take a seat to start the match.';
    } else if (data.seated_count < 2) {
      startHint = 'At least two courtiers must be seated.';
    }
  }

  return (
    <div
      style={{
        width: '276px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header Card */}
      <div style={panelCard}>
        <div style={capsStyle}>
          Card Game · {data.expanded ? '32 Cards (5–8P)' : '16 Cards (2–4P)'}
        </div>
        <div style={{ fontFamily: TITLE_FONT, color: TITLE, fontSize: '18px' }}>
          Scarlet Seal
        </div>
        <div
          style={{
            fontSize: FONT_SMALL,
            color: INK_SOFT,
            fontStyle: 'italic',
            marginTop: '2px',
          }}
        >
          First to {data.seals_to_win} Seals of Favor wins
          {data.round > 0 ? ` · Round ${data.round}` : ''}.
        </div>
        <div style={rowStyle}>
          <Button icon="scroll" onClick={openRules}>
            Rules
          </Button>
          <Button icon="book-open" onClick={openCards}>
            Cards
          </Button>
        </div>
      </div>

      {/* Status & Controls Card */}
      <div style={{ ...panelCard, borderLeft: `4px solid ${tone}` }}>
        <div style={{ fontWeight: 'bold', fontSize: FONT_TITLE, color: tone }}>
          {data.status}
        </div>
        {!!data.message && data.message !== data.status && (
          <div
            style={{
              fontSize: FONT_SMALL,
              color: INK_SOFT,
              fontStyle: 'italic',
              marginTop: '2px',
            }}
          >
            {data.message}
          </div>
        )}
        <div style={rowStyle}>
          {(data.phase === 'lobby' || data.phase === 'match_end') && (
            <Button
              icon="play"
              disabled={!data.can_start}
              tooltip={startHint}
              onClick={() => act('start')}
            >
              {data.phase === 'match_end' ? 'New Match' : 'Start Match'}
            </Button>
          )}
          {data.phase === 'round_end' && (
            <Button
              icon="forward"
              disabled={!data.can_next_round}
              onClick={() => act('next_round')}
            >
              Deal Next Round
            </Button>
          )}
        </div>
      </div>

      {/* Reset Request Banner */}
      {!!data.reset_name && (
        <div style={requestCard}>
          <div>
            <b>{data.reset_name}</b>
            {data.reset_left
              ? ` will reset the table and clear all seats in ${data.reset_left}s.`
              : ' asks to reset the match.'}
          </div>
          <div style={rowStyle}>
            {!!data.can_answer_reset && (
              <Button icon="check" onClick={() => act('reset')}>
                Agree
              </Button>
            )}
            {!!data.can_cancel_reset && (
              <Button icon="times" onClick={() => act('cancel_reset')}>
                {data.can_answer_reset ? 'Decline' : 'Cancel'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Chronicle / Event Log */}
      <div
        style={{
          ...panelCard,
          flex: 1,
          minHeight: '120px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            ...capsStyle,
            padding: '5px 10px',
            borderBottom: `1px solid ${INK_FAINT}`,
          }}
        >
          Chronicle
        </div>
        <div
          ref={logRef}
          style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
        >
          {history.length ? (
            history.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: '3px 10px',
                  fontSize: FONT_SMALL,
                  lineHeight: 1.35,
                  background: i % 2 ? 'transparent' : 'rgba(122, 86, 22, 0.08)',
                }}
              >
                {entry}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: '6px 10px',
                color: INK_FAINT,
                fontStyle: 'italic',
                fontSize: FONT_SMALL,
              }}
            >
              No plays yet.
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <Button.Confirm
          icon="undo"
          confirmContent="Reset table?"
          tooltip="Reset the match. Mid-match, another seated courtier must agree."
          onClick={() => act('reset')}
        >
          Reset
        </Button.Confirm>
        <Button
          icon="box"
          disabled={!data.can_pack}
          tooltip={
            data.can_pack
              ? 'Pack the cards back into their velvet case.'
              : 'Finish or reset the match first.'
          }
          onClick={() => act('pack')}
        >
          Pack up
        </Button>
      </div>
    </div>
  );
};

const ruleSectionTitle: CSSProperties = {
  fontWeight: 'bold',
  color: TITLE,
  fontSize: FONT_TITLE,
  marginTop: '10px',
  marginBottom: '3px',
};

const ruleText: CSSProperties = {
  fontSize: FONT_SMALL,
  color: INK,
  lineHeight: 1.45,
};

const ReferenceModal = (props: {
  initialTab: 'rules' | 'classic' | 'expanded';
  onClose: () => void;
}) => {
  const { initialTab, onClose } = props;
  const [tab, setTab] = useState<'rules' | 'classic' | 'expanded'>(initialTab);
  const order = tab === 'expanded' ? EXPANSION_ORDER : CLASSIC_ORDER;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(40, 24, 8, 0.6)',
        fontFamily: SERIF,
        color: INK,
      }}
    >
      <div
        style={{
          ...panelCard,
          width: '600px',
          maxHeight: '90%',
          overflowY: 'auto',
          padding: '14px 18px',
          background: 'var(--p-bg)',
          boxShadow: '0 8px 28px rgba(30, 15, 0, 0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              fontFamily: TITLE_FONT,
              color: TITLE,
              fontSize: '20px',
            }}
          >
            {tab === 'rules'
              ? 'How to Play Scarlet Seal'
              : 'Court Reference Card'}
          </div>
          <Button icon="times" onClick={onClose}>
            Close
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          <Button selected={tab === 'rules'} onClick={() => setTab('rules')}>
            How to Play
          </Button>
          <Button
            selected={tab === 'classic'}
            onClick={() => setTab('classic')}
          >
            Classic 16 Cards (2–4P)
          </Button>
          <Button
            selected={tab === 'expanded'}
            onClick={() => setTab('expanded')}
          >
            Expanded +16 Cards (5–8P)
          </Button>
        </div>

        {tab === 'rules' ? (
          <div
            style={{
              borderTop: `1px dashed ${INK_FAINT}`,
              paddingTop: '4px',
            }}
          >
            <div style={ruleSectionTitle}>Goal</div>
            <div style={ruleText}>
              Outlast every rival or hold the highest-ranking courtier when the
              deck runs dry to claim a <b>Seal of Favor</b>. Collect enough
              Seals of Favor to win the match: <b>2 Players: 7</b> ·{' '}
              <b>3 Players: 5</b> · <b>4–8 Players: 4</b>.
            </div>

            <div style={ruleSectionTitle}>Round Setup</div>
            <div style={ruleText}>
              With <b>2–4 players</b>, the 16-card classic deck is shuffled;
              with <b>5–8 players</b>, all 32 cards are used automatically. One
              card is set aside face-down (drawn only if the deck is empty when
              a redraw occurs). In a <b>2-player</b> game, 3 additional cards
              are placed face-up for both players to examine. Each courtier
              starts with <b>1 secret card</b> in hand.
            </div>

            <div style={ruleSectionTitle}>On Your Turn</div>
            <div style={ruleText}>
              1. You automatically draw 1 card, giving you <b>2 cards</b> in
              hand.
              <br />
              2. Pick 1 card to discard face-up in front of you and resolve its
              effect—even if it hurts you.
              <br />
              3. <b>Consort (7) Rule:</b> If you hold Consort together with{' '}
              <b>Hand (6)</b> or <b>Steward (5)</b>, you must discard Consort.
              <br />
              4. <b>Protected / Forced Targets:</b> If no legal target is
              available due to <b>Attendant (4)</b> or <b>Flatterer (4)</b>,
              your card is discarded without effect (<b>Steward</b> must choose
              yourself if all rivals are shielded).
            </div>

            <div style={ruleSectionTitle}>Knocked Out & Round End</div>
            <div style={ruleText}>
              When knocked out, you discard your remaining card face-up (no
              effect) and wait for the next round. A round ends when only{' '}
              <b>1 courtier remains</b> or when the <b>deck empties</b> at the
              end of a turn:
              <br />• <b>Showdown:</b> Remaining players reveal their hands; the
              highest card wins (<b>+1</b> per <b>Seneschal</b> in your discards
              in 5–8P; <b>Sovereign</b> beats <b>Prelate</b>).
              <br />• <b>Ties:</b> Broken by the highest total value of cards in
              your discard pile. If still tied, all tied players claim a Seal of
              Favor.
              <br />• <b>5–8P Extras:</b> Naming a number (<b>Watchman</b> /{' '}
              <b>Prelate</b>) matches <i>all</i> roles with that number. If
              multiple players tie at 4+ Seals, play a tiebreaker round.
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: FONT_SMALL,
                color: INK_SOFT,
                marginBottom: '8px',
                lineHeight: 1.4,
              }}
            >
              {tab === 'classic' ? (
                <>
                  Used alone for 2–4 players (and combined with the expansion
                  for 5–8 players). Seals of Favor to win: <b>2P: 7</b> ·{' '}
                  <b>3P: 5</b> · <b>4–8P: 4</b>. Showdown ties break by highest
                  sum of discarded cards.
                </>
              ) : (
                <>
                  Added automatically for 5–8 players (32 cards total). Naming a
                  number (Watchman or Prelate) matches <b>all</b> roles with
                  that number. Multiple players tying at 4+ Seals play a
                  tiebreaker round.
                </>
              )}
            </div>

            {order.map((id) => {
              const meta = CARDS[id];
              const copies =
                tab === 'expanded'
                  ? id === 'watchman'
                    ? '+3 (8 total)'
                    : `×${meta.copiesExpanded}`
                  : `×${meta.copiesClassic}`;
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 0',
                    borderTop: `1px dashed ${INK_FAINT}`,
                  }}
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: meta.accent,
                      color: '#fdf3dc',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontFamily: TITLE_FONT,
                      flexShrink: 0,
                    }}
                  >
                    {meta.value}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      borderRadius: '4px',
                      background: '#f5e8ce',
                      border: `1px solid ${meta.accent}`,
                      flexShrink: 0,
                    }}
                  >
                    <CardEmblem id={meta.id} color={meta.accent} size={26} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: INK }}>
                      {meta.name}{' '}
                      <span
                        style={{
                          fontWeight: 'normal',
                          fontSize: FONT_SMALL,
                          color: INK_SOFT,
                        }}
                      >
                        ({copies})
                      </span>
                    </div>
                    <div style={{ fontSize: FONT_SMALL, color: INK_SOFT }}>
                      {meta.summary}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
