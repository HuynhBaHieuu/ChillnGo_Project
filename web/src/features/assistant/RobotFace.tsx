import { cn } from '@/lib/utils'

import type { RobotMood } from './robotMood'

const EYE = '#eafcff'

/**
 * The robot's screen face, flat: the floating button, and the stand-in while
 * the 3D robot loads or when the browser has no WebGL. Same eyes as the 3D one.
 */
export function RobotFace({ mood = 'idle', blink = false, className }: { mood?: RobotMood; blink?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 54" aria-hidden className={cn('block', className)}>
      <rect x="1" y="1" width="62" height="52" rx="16" fill="#f1e3a3" />
      <rect x="6" y="6" width="52" height="42" rx="12" fill="#07080b" />
      <g fill={EYE} stroke={EYE} strokeWidth="3.4" strokeLinecap="round" className={cn(blink && 'robot-blink')}>
        {eyes(mood)}
      </g>
    </svg>
  )
}

function eyes(mood: RobotMood) {
  switch (mood) {
    case 'listening':
      return (
        <>
          <circle cx="22" cy="27" r="5.6" stroke="none" />
          <circle cx="42" cy="27" r="5.6" stroke="none" />
        </>
      )
    case 'thinking':
      return (
        <>
          <ellipse cx="25" cy="22" rx="3.4" ry="4.4" stroke="none" />
          <ellipse cx="45" cy="22" rx="3.4" ry="4.4" stroke="none" />
          <circle cx="27" cy="37" r="1.4" stroke="none" />
          <circle cx="32" cy="37" r="1.4" stroke="none" />
          <circle cx="37" cy="37" r="1.4" stroke="none" />
        </>
      )
    case 'success':
      return (
        <>
          <path d="M16.5 29a5.5 5.5 0 0 1 11 0" fill="none" />
          <circle cx="42" cy="27" r="5.2" stroke="none" />
        </>
      )
    case 'error':
      return (
        <path d="M17 22l7 5-7 5M47 22l-7 5 7 5" fill="none" strokeLinejoin="round" />
      )
    case 'happy':
      return <path d="M16.5 29a5.5 5.5 0 0 1 11 0M36.5 29a5.5 5.5 0 0 1 11 0" fill="none" />
    case 'love':
      return (
        <g fill="#ff7aa8" stroke="none">
          <path d="M22 31l-5.2-5a3.1 3.1 0 0 1 5.2-3.9 3.1 3.1 0 0 1 5.2 3.9zM42 31l-5.2-5a3.1 3.1 0 0 1 5.2-3.9 3.1 3.1 0 0 1 5.2 3.9z" />
          {/* Blushing cheeks. */}
          <ellipse cx="15" cy="37" rx="4.4" ry="2.3" opacity="0.6" />
          <ellipse cx="49" cy="37" rx="4.4" ry="2.3" opacity="0.6" />
        </g>
      )
    case 'surprised':
      return (
        <>
          <circle cx="22" cy="25" r="6" stroke="none" />
          <circle cx="42" cy="25" r="6" stroke="none" />
          <circle cx="32" cy="38.5" r="2.4" fill="none" strokeWidth="1.6" />
        </>
      )
    case 'confused':
      return (
        <>
          <ellipse cx="22" cy="26" rx="4.8" ry="5.4" stroke="none" />
          <ellipse cx="42" cy="28" rx="3.8" ry="2.3" stroke="none" />
          <text x="49" y="19" fontSize="9" fontWeight="700" stroke="none">
            ?
          </text>
        </>
      )
    case 'sleepy':
      return (
        <>
          <path d="M17 28h10M37 28h10" fill="none" />
          <text x="47" y="18" fontSize="8" fontWeight="700" stroke="none">
            z
          </text>
        </>
      )
    default:
      return (
        <>
          <ellipse cx="22" cy="27" rx="3.6" ry="6.2" stroke="none" />
          <ellipse cx="42" cy="27" rx="3.6" ry="6.2" stroke="none" />
        </>
      )
  }
}
