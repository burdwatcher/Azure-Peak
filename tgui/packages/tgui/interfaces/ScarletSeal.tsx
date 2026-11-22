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
import { WaxSeal, type WaxSealColor } from './common/WaxSeal';

type Phase = 'lobby' | 'playing' | 'round_end' | 'match_end';

type Seat = {
  index: number;
  color: WaxSealColor;
  name: string | null;
  mine: BooleanLike;
  away: BooleanLike;
  seals: number;
  hand: number[];
  hand_count: number;
  discards: number[];
  discard_sum: number;
  eliminated: BooleanLike;
  protected: BooleanLike;
  is_turn: BooleanLike;
  round_winner: BooleanLike;
  match_winner: BooleanLike;
};

type PrivateIntel = {
  seq: number;
  label: string | null;
  note: string;
  card: number;
  target: string | null;
};

type Data = {
  phase: Phase;
  round: number;
  seals_to_win: number;
  seated_count: number;
  seats: Seat[];
  my_seat: number;
  my_turn: BooleanLike;
  forced_consort: BooleanLike;
  targets_by_card: Record<string, number[]>;
  deck_count: number;
  has_hidden_card: BooleanLike;
  set_aside_open: number[];
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

type CardMeta = {
  value: number;
  name: string;
  copies: number;
  accent: string;
  summary: string;
  needsTarget: boolean;
  canTargetSelf?: boolean;
  needsGuess?: boolean;
};

const CARDS: Record<number, CardMeta> = {
  1: {
    value: 1,
    name: 'Watchman',
    copies: 5,
    accent: '#6b3a2e',
    summary:
      'Choose another player and name a role other than Watchman. If they hold it, they are knocked out.',
    needsTarget: true,
    needsGuess: true,
  },
  2: {
    value: 2,
    name: 'Confessor',
    copies: 2,
    accent: '#2e4a78',
    summary: 'Choose another player and secretly inspect their hand.',
    needsTarget: true,
  },
  3: {
    value: 3,
    name: 'Knight',
    copies: 2,
    accent: '#7a5616',
    summary:
      'Secretly compare hands with another player. The lower card is knocked out of the round.',
    needsTarget: true,
  },
  4: {
    value: 4,
    name: 'Attendant',
    copies: 2,
    accent: '#2f5a2c',
    summary:
      'Until the start of your next turn, you are shielded from the effects of other players’ cards.',
    needsTarget: false,
  },
  5: {
    value: 5,
    name: 'Steward',
    copies: 2,
    accent: '#3b4f7a',
    summary:
      'Choose any player (including yourself) to discard their hand and draw a new card.',
    needsTarget: true,
    canTargetSelf: true,
  },
  6: {
    value: 6,
    name: 'Hand',
    copies: 1,
    accent: '#8b2620',
    summary: 'Trade the card in your hand with another player’s hand.',
    needsTarget: true,
  },
  7: {
    value: 7,
    name: 'Consort',
    copies: 1,
    accent: '#5f2d5e',
    summary:
      'If you hold this card with the Hand or Steward, you must discard the Consort.',
    needsTarget: false,
  },
  8: {
    value: 8,
    name: 'Sovereign',
    copies: 1,
    accent: '#a41e34',
    summary:
      'If you discard this card for any reason, you are immediately knocked out of the round.',
    needsTarget: false,
  },
};

const WATCHMAN_GUESSES = [2, 3, 4, 5, 6, 7, 8];
const REFERENCE_ORDER = [8, 7, 6, 5, 4, 3, 2, 1];

const SEAT_SWATCH: Record<WaxSealColor, string> = {
  red: '#9d2520',
  blue: '#294878',
  green: '#2f5f32',
  amber: '#9c6e1c',
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
  gap: '10px',
  padding: '12px',
  background:
    'radial-gradient(ellipse at center, #6c2026 0%, #51151b 68%, #3c0e13 100%)',
  border: '5px solid #4a2e18',
  borderRadius: '5px',
  boxShadow:
    '0 4px 12px rgba(32, 14, 6, 0.5), inset 0 0 0 1px rgba(218, 178, 96, 0.45)',
};

const CardEmblem = (props: { value: number; color: string; size?: number }) => {
  const { value, color, size = 40 } = props;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 48 48"
      width={size}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* 1: Watchman — Heater shield & crossbar */}
      {value === 1 && (
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
      {/* 2: Confessor — Sacred cross & halo */}
      {value === 2 && (
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
      {/* 3: Knight — Crossed longswords */}
      {value === 3 && (
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
      {/* 4: Attendant — Shielded lantern */}
      {value === 4 && (
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
      {/* 5: Steward — Keep key & signet */}
      {value === 5 && (
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
      {/* 6: Hand — Heraldic open hand & signet ring */}
      {value === 6 && (
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
      {/* 7: Consort — Crescent moon & star */}
      {value === 7 && (
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
      {/* 8: Sovereign — Royal crown */}
      {value === 8 && (
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
    </svg>
  );
};

const FavorSeal = (props: { filled: boolean; size?: number }) => {
  const { filled, size = 15 } = props;
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
          width: `${Math.max(16, Math.round(width * 0.46))}px`,
          height: `${Math.max(16, Math.round(width * 0.46))}px`,
          borderRadius: '50%',
          background: '#a62624',
          border: '1px solid #f0c975',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.max(10, Math.round(width * 0.24))}px`,
          fontWeight: 'bold',
        }}
      >
        {label ?? '✦'}
      </div>
    </div>
  );
};

const MiniCardFace = (props: { value: number; highlight?: boolean }) => {
  const { value, highlight } = props;
  const meta = CARDS[value];
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
      <CardEmblem value={meta.value} color={meta.accent} size={28} />
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
  value: number;
  tag?: string;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  interactive: boolean;
  onClick?: () => void;
}) => {
  const {
    value,
    tag,
    selected,
    disabled,
    disabledReason,
    interactive,
    onClick,
  } = props;
  const meta = CARDS[value];
  if (!meta) {
    return null;
  }

  return (
    <div
      onClick={!disabled && interactive ? onClick : undefined}
      title={disabledReason || meta.summary}
      style={{
        position: 'relative',
        width: '154px',
        minHeight: '188px',
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
        <span style={{ fontSize: FONT_TINY, color: '#6b5128' }}>
          ×{meta.copies}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '4px 0 6px 0',
        }}
      >
        <CardEmblem value={meta.value} color={meta.accent} size={46} />
      </div>

      <div
        style={{
          fontSize: '11px',
          lineHeight: 1.32,
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

const DiscardRow = (props: { discards: number[]; dark?: boolean }) => {
  const { discards, dark } = props;
  if (!discards.length) {
    return (
      <div
        style={{
          fontSize: FONT_TINY,
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
      {discards.map((val, i) => {
        const meta = CARDS[val];
        return (
          <span
            key={i}
            title={meta ? `${meta.value} ${meta.name}: ${meta.summary}` : ''}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '1px 5px',
              borderRadius: '2px',
              background: '#f5e8ce',
              border: `1px solid ${meta?.accent || INK_FAINT}`,
              color: '#2a1a0e',
              fontSize: '10px',
              fontWeight: 'bold',
              lineHeight: 1.2,
            }}
          >
            <span style={{ color: meta?.accent || '#2a1a0e' }}>{val}</span>
            <span>{meta?.name || '?'}</span>
          </span>
        );
      })}
    </div>
  );
};

const SeatTile = (props: { seat: Seat; compact?: boolean }) => {
  const { act, data } = useBackend<Data>();
  const { seat, compact } = props;
  const active = !!seat.is_turn;
  const isLobby = data.phase === 'lobby' || data.phase === 'match_end';
  const showHandFace = seat.hand.length > 0;

  let seatAction: ReactNode = null;
  if (!seat.name && isLobby && !data.my_seat) {
    seatAction = (
      <MatButton
        onClick={() => act('sit', { seat: seat.index })}
        style={{ fontSize: '11px', padding: '2px 8px' }}
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
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={() => act('stand', { seat: seat.index })}
        >
          Leave
        </MatButton>
      ) : (
        <MatButton
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={() => act('stand', { seat: seat.index })}
        >
          Get up
        </MatButton>
      );
  } else if (seat.name && seat.away && (isLobby || !!data.my_seat)) {
    seatAction = (
      <MatButton
        title="They have walked away from the table."
        style={{ fontSize: '11px', padding: '2px 8px' }}
        onClick={() => act('stand', { seat: seat.index })}
      >
        Clear
      </MatButton>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: compact ? '155px' : '180px',
        padding: '7px 9px',
        borderRadius: '4px',
        background: active
          ? 'rgba(222, 174, 74, 0.24)'
          : seat.eliminated
            ? 'rgba(24, 10, 12, 0.5)'
            : 'rgba(34, 12, 15, 0.55)',
        border: `1px solid ${
          seat.match_winner || seat.round_winner
            ? '#f0c45d'
            : active
              ? '#e5b54f'
              : 'rgba(218, 184, 126, 0.32)'
        }`,
        borderLeft: `4px solid ${SEAT_SWATCH[seat.color]}`,
        color: '#f6ebd4',
        opacity: seat.eliminated ? 0.72 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            width: '10px',
            height: '10px',
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
            fontSize: '12px',
          }}
        >
          {seat.name || `Seat ${seat.index} (Empty)`}
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
              gap: '4px',
            }}
          >
            <span
              title={`${seat.seals} of ${data.seals_to_win} Seals of Favor`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {Array.from({ length: data.seals_to_win }, (_, i) => (
                <FavorSeal key={i} filled={i < seat.seals} size={14} />
              ))}
            </span>
            {!!seat.protected && (
              <span
                style={{
                  ...badgeStyle(SEAL_GREEN),
                  fontSize: '10px',
                  padding: '0 5px',
                  marginLeft: '2px',
                }}
              >
                Protected
              </span>
            )}
            {!!seat.eliminated && (
              <span
                style={{
                  ...badgeStyle(SEAL_RED),
                  fontSize: '10px',
                  padding: '0 5px',
                  marginLeft: '2px',
                }}
              >
                Out
              </span>
            )}
            {active && (
              <span
                style={{
                  ...badgeStyle(SEAL_AMBER),
                  fontSize: '10px',
                  padding: '0 5px',
                  marginLeft: '2px',
                }}
              >
                Turn
              </span>
            )}
            {!!seat.away && !seat.mine && (
              <span
                style={{
                  ...badgeStyle(INK_FAINT),
                  fontSize: '10px',
                  padding: '0 5px',
                  marginLeft: '2px',
                }}
              >
                Away
              </span>
            )}
            {!!seat.round_winner && data.phase === 'round_end' && (
              <span
                style={{
                  ...badgeStyle(SEAL_AMBER),
                  fontSize: '10px',
                  padding: '0 5px',
                  marginLeft: '2px',
                }}
              >
                Round Winner
              </span>
            )}
            {!!seat.match_winner && data.phase === 'match_end' && (
              <span
                style={{
                  ...badgeStyle(SEAL_AMBER),
                  fontSize: '10px',
                  padding: '0 5px',
                  marginLeft: '2px',
                }}
              >
                Champion
              </span>
            )}
          </div>

          {data.phase !== 'lobby' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {showHandFace ? (
                  seat.hand.map((val, i) => (
                    <MiniCardFace
                      key={i}
                      value={val}
                      highlight={!!seat.round_winner && !!data.showdown}
                    />
                  ))
                ) : seat.hand_count > 0 ? (
                  Array.from({ length: seat.hand_count }, (_, i) => (
                    <CardBack key={i} width={38} height={54} />
                  ))
                ) : (
                  <div
                    style={{
                      width: '38px',
                      height: '54px',
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
                    fontSize: '10px',
                    color: 'rgba(242, 222, 186, 0.68)',
                    marginBottom: '2px',
                  }}
                >
                  Discards
                  {seat.discards.length > 0 && ` (sum ${seat.discard_sum})`}
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
  const [showRef, setShowRef] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedTarget, setSelectedTarget] = useState<number>(0);
  const [selectedGuess, setSelectedGuess] = useState<number>(0);
  const [dismissedSeq, setDismissedSeq] = useState<number>(0);

  const mySeat = data.my_seat
    ? data.seats.find((s) => s.index === data.my_seat) || null
    : null;
  const handKey = mySeat ? mySeat.hand.join(',') : '';

  // Reset pending play selection whenever turn, round, or hand changes
  useEffect(() => {
    setSelectedSlot(0);
    setSelectedTarget(0);
    setSelectedGuess(0);
  }, [data.phase, data.round, data.my_turn, handKey]);

  // Auto-select Consort if forced
  useEffect(() => {
    if (!data.my_turn || !mySeat) {
      return;
    }
    if (data.forced_consort && selectedSlot === 0) {
      const idx = mySeat.hand.indexOf(7);
      if (idx !== -1) {
        setSelectedSlot(idx + 1);
      }
    }
  }, [data.my_turn, data.forced_consort, handKey, selectedSlot]);

  const selectedCardVal =
    mySeat && selectedSlot > 0 ? mySeat.hand[selectedSlot - 1] || 0 : 0;
  const selectedMeta = selectedCardVal ? CARDS[selectedCardVal] : null;
  const validTargets = selectedCardVal
    ? data.targets_by_card[String(selectedCardVal)] || []
    : [];

  useEffect(() => {
    if (!selectedMeta?.needsTarget) {
      setSelectedTarget(0);
      setSelectedGuess(0);
      return;
    }
    if (validTargets.length === 1) {
      setSelectedTarget(validTargets[0]);
    } else if (!validTargets.includes(selectedTarget)) {
      setSelectedTarget(0);
    }
    if (!selectedMeta.needsGuess) {
      setSelectedGuess(0);
    }
  }, [selectedSlot, selectedCardVal, validTargets.join(',')]);

  const canCommitPlay =
    !!data.my_turn &&
    !!selectedMeta &&
    (!selectedMeta.needsTarget ||
      validTargets.length === 0 ||
      validTargets.includes(selectedTarget)) &&
    (!selectedMeta.needsGuess ||
      validTargets.length === 0 ||
      (selectedGuess >= 2 && selectedGuess <= 8));

  const submitPlay = () => {
    if (!canCommitPlay) {
      return;
    }
    act('play', {
      slot: selectedSlot,
      target: selectedTarget || 0,
      guess: selectedGuess || 0,
    });
    setSelectedSlot(0);
    setSelectedTarget(0);
    setSelectedGuess(0);
  };

  const otherSeats = mySeat
    ? data.seats.filter((s) => s.index !== mySeat.index)
    : data.seats;

  const visibleOtherSeats =
    data.phase === 'lobby' || data.phase === 'match_end'
      ? otherSeats
      : otherSeats.filter((s) => !!s.name);

  const intel = data.private_intel;
  const showIntel = !!intel && dismissedSeq !== intel.seq;

  return (
    <Window width={920} height={680} title="Scarlet Seal" theme="parchment">
      <Window.Content scrollable>
        <div
          style={{
            display: 'flex',
            gap: '14px',
            padding: '12px 14px',
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
              gap: '10px',
            }}
          >
            <div style={matFrameStyle}>
              {/* Top Opponents (or all 4 seats for spectators) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: mySeat
                    ? `repeat(${Math.max(1, visibleOtherSeats.length)}, minmax(0, 1fr))`
                    : 'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                }}
              >
                {visibleOtherSeats.map((seat) => (
                  <SeatTile key={seat.index} seat={seat} compact={!!mySeat} />
                ))}
              </div>

              {/* Center Table Area: Deck, Set-Aside Cards, Private Note, Round Banner */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '6px 4px',
                }}
              >
                {data.phase === 'lobby' ? (
                  <div
                    style={{
                      textAlign: 'center',
                      color: '#f5e7cb',
                      padding: '14px 18px',
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
                      <WaxSeal label="Scarlet Seal" royal size={54} />
                    </div>
                    <div
                      style={{
                        fontFamily: TITLE_FONT,
                        fontSize: '22px',
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
                      A game of court intrigue for 2 to 4 players. Hold the
                      highest courtier when the deck runs dry, or outlast every
                      rival at the table.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: '18px',
                      padding: '8px 12px',
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
                        gap: '4px',
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        {data.deck_count > 0 ? (
                          <CardBack
                            width={52}
                            height={72}
                            label={String(data.deck_count)}
                          />
                        ) : (
                          <div
                            style={{
                              width: '52px',
                              height: '72px',
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
                      </div>
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
                        gap: '4px',
                      }}
                      title="One card is removed face-down each round. Drawn only if a Steward empties the deck."
                    >
                      {data.has_hidden_card ? (
                        <CardBack width={48} height={68} label="?" />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '68px',
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
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {data.set_aside_open.map((val, i) => (
                            <MiniCardFace key={i} value={val} />
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

                {/* Round / Match Result Banner on Table */}
                {(data.phase === 'round_end' || data.phase === 'match_end') && (
                  <div
                    style={{
                      padding: '10px 14px',
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
                      <div style={{ marginTop: '8px' }}>
                        <MatButton
                          variant="primary"
                          onClick={() => act('next_round')}
                        >
                          Deal Round {data.round + 1}
                        </MatButton>
                      </div>
                    )}
                    {!!data.can_start && data.phase === 'match_end' && (
                      <div style={{ marginTop: '8px' }}>
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
                      padding: '8px 11px',
                      borderRadius: '4px',
                      background: MAT_PANEL_BG,
                      border: '1.5px solid #7aa8e8',
                      color: MAT_TEXT,
                      boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {intel.card > 0 ? (
                      <MiniCardFace value={intel.card} />
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
                          marginTop: '3px',
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
                    padding: '9px 10px',
                    color: '#f6ebd4',
                  }}
                >
                  {/* Own Header Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
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
                        marginLeft: '4px',
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
                          mySeat.hand.map((val, i) => {
                            const slot = i + 1;
                            const blockedByConsort =
                              !!data.my_turn &&
                              !!data.forced_consort &&
                              val !== 7;
                            return (
                              <HandCard
                                key={`${slot}-${val}`}
                                value={val}
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
                              padding: '12px',
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
                            padding: '9px 11px',
                            borderRadius: '4px',
                            background: MAT_PANEL_BG,
                            border: '1.5px solid #e5b54f',
                            color: MAT_TEXT,
                            marginBottom: '8px',
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
                                {selectedMeta.value === 8 ? (
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
                                    {selectedMeta.needsTarget &&
                                    validTargets.length === 0
                                      ? `Discard ${selectedMeta.name} (No Effect)`
                                      : `Play ${selectedMeta.name}`}
                                  </MatButton>
                                )}
                              </div>

                              {selectedMeta.needsTarget &&
                                (validTargets.length === 0 ? (
                                  <div
                                    style={{
                                      fontSize: FONT_SMALL,
                                      fontStyle: 'italic',
                                      color: MAT_TEXT_SOFT,
                                    }}
                                  >
                                    All other active courtiers are shielded by
                                    the Attendant — this card will be discarded
                                    without effect.
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
                                      Choose Target
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
                                          return (
                                            <MatButton
                                              key={s.index}
                                              variant={
                                                selectedTarget === s.index
                                                  ? 'selected'
                                                  : 'default'
                                              }
                                              disabled={!allowed}
                                              title={
                                                allowed
                                                  ? undefined
                                                  : 'Shielded by Attendant until their next turn.'
                                              }
                                              onClick={() =>
                                                setSelectedTarget(s.index)
                                              }
                                            >
                                              {s.name}
                                              {s.index === mySeat.index
                                                ? ' (Yourself)'
                                                : ''}
                                              {!allowed ? ' [Protected]' : ''}
                                            </MatButton>
                                          );
                                        })}
                                    </div>
                                  </div>
                                ))}

                              {selectedMeta.needsGuess &&
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
                                      Name a Role (Not Watchman)
                                    </div>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '5px',
                                      }}
                                    >
                                      {WATCHMAN_GUESSES.map((g) => (
                                        <MatButton
                                          key={g}
                                          variant={
                                            selectedGuess === g
                                              ? 'selected'
                                              : 'default'
                                          }
                                          onClick={() => setSelectedGuess(g)}
                                        >
                                          {g} {CARDS[g].name}
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
          <SidePanel openReference={() => setShowRef(true)} />
        </div>

        {showRef && <ReferenceModal onClose={() => setShowRef(false)} />}
      </Window.Content>
    </Window>
  );
};

const SidePanel = (props: { openReference: () => void }) => {
  const { act, data } = useBackend<Data>();
  const { openReference } = props;
  const logRef = useRef<HTMLDivElement>(null);
  const history = data.history || [];

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [history.length]);

  let tone = INK_SOFT;
  if (data.phase === 'match_end') {
    tone = SEAL_RED;
  } else if (data.my_turn) {
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
        width: '286px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header Card */}
      <div style={panelCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={capsStyle}>Card Game · 2–4 Players</div>
            <div
              style={{ fontFamily: TITLE_FONT, color: TITLE, fontSize: '18px' }}
            >
              Scarlet Seal
            </div>
          </div>
          <Button icon="book-open" onClick={openReference}>
            Cards
          </Button>
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

const ReferenceModal = (props: { onClose: () => void }) => {
  const { onClose } = props;
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
          width: '540px',
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
            Court Reference Card (16 Cards)
          </div>
          <Button icon="times" onClick={onClose}>
            Close
          </Button>
        </div>

        <div
          style={{
            fontSize: FONT_SMALL,
            color: INK_SOFT,
            marginBottom: '8px',
            lineHeight: 1.4,
          }}
        >
          Each round, 1 card is set aside face-down (plus 3 face-up in a
          2-player game). On your turn, draw 1 card and discard 1 of your 2
          cards, applying its effect. Win a round by being the last courtier
          standing or holding the highest card when the deck empties (ties break
          by highest sum of discarded cards). Seals of Favor to win:{' '}
          <b>2P: 7</b> · <b>3P: 5</b> · <b>4P: 4</b>.
        </div>

        {REFERENCE_ORDER.map((val) => {
          const meta = CARDS[val];
          return (
            <div
              key={val}
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
                <CardEmblem value={meta.value} color={meta.accent} size={26} />
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
                    (×{meta.copies})
                  </span>
                </div>
                <div style={{ fontSize: FONT_SMALL, color: INK_SOFT }}>
                  {meta.summary}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
