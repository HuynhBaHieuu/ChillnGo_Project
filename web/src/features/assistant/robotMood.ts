import { useCallback, useEffect, useRef, useState } from 'react'

import type { AssistantIntent } from './replyTags'

import { isTalking, replyLength, useAssistantStore } from './assistant.store'
import { parseReply } from './replyTags'

/** What the assistant robot is doing, shown by its eyes and the way it moves. */
export type RobotMood =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error'
  | 'happy'
  | 'love'
  | 'surprised'
  | 'sleepy'
  | 'confused'

/** How long the robot shows how a reply ended before it settles back. */
const FLASH_MS = 1800
/** The happy wiggle when the chat opens. */
const GREET_MS = 1600
/** The start when something wakes it up. */
const WAKE_MS = 1000
/** With nothing happening for this long, it dozes off. */
const SLEEP_AFTER_MS = 30_000

const THANKS = /(cảm ơn|cám ơn|cam on|thank|thx|tks)/i
const GREETING = /^\s*(xin\s+)?(chào|chao|hello|hi|hey|alo)(\s|[!,.?]|$)/i

const ENDING: Partial<Record<AssistantIntent, RobotMood>> = {
  thanks: 'love',
  greet: 'happy',
  celebrate: 'happy',
  uncertain: 'confused',
}

/**
 * How a finished reply shows on its face: by what the model said the reply
 * was doing; failing that, hearts for a thank-you, a happy face for a
 * greeting, else a wink.
 */
function finishedMood(intent: AssistantIntent | null | undefined, question: string | undefined): RobotMood {
  if (intent) return ENDING[intent] ?? 'success'
  if (question && THANKS.test(question)) return 'love'
  if (question && GREETING.test(question)) return 'happy'
  return 'success'
}

interface MoodInput {
  /** The reader has a draft in the box. */
  typing: boolean
  /** The pointer is on the robot. */
  petting: boolean
}

/**
 * The robot's mood. The conversation comes first: thinking until the first
 * words arrive, speaking while it says them, then a short flash for how the
 * reply ended. Otherwise it reacts to the reader (happy when greeted or
 * petted, listening while they type) and dozes off when left alone.
 *
 * `poke` marks activity (wakes it, restarts the sleep countdown); `greet` is
 * for opening the chat. Both are called from event handlers.
 */
export function useRobotMood({ typing, petting }: MoodInput) {
  const talking = useAssistantStore(isTalking)
  const replying = useAssistantStore((s) => isTalking(s) && replyLength(s.messages) > 0)
  const [flash, setFlash] = useState<RobotMood | null>(null)
  const [reaction, setReaction] = useState<'happy' | 'surprised' | null>(null)
  const [asleep, setAsleep] = useState(false)
  const asleepRef = useRef(false)
  const timers = useRef<{ flash?: ReturnType<typeof setTimeout>; reaction?: ReturnType<typeof setTimeout>; sleep?: ReturnType<typeof setTimeout> }>({})

  const react = useCallback((value: 'happy' | 'surprised', ms: number) => {
    setReaction(value)
    clearTimeout(timers.current.reaction)
    timers.current.reaction = setTimeout(() => setReaction(null), ms)
  }, [])

  const poke = useCallback(() => {
    if (asleepRef.current) {
      asleepRef.current = false
      setAsleep(false)
      react('surprised', WAKE_MS)
    }
    clearTimeout(timers.current.sleep)
    timers.current.sleep = setTimeout(() => {
      asleepRef.current = true
      setAsleep(true)
    }, SLEEP_AFTER_MS)
  }, [react])

  const greet = useCallback(() => {
    poke()
    react('happy', GREET_MS)
  }, [poke, react])

  // The conversation moving counts as activity; a reply ending (once all of it has been said) gets its flash.
  useEffect(
    () =>
      useAssistantStore.subscribe((state, previous) => {
        poke()
        if (!isTalking(previous) || isTalking(state)) return
        const question = state.messages.findLast((m) => m.role === 'user')?.content
        const reply = state.messages.findLast((m) => m.role === 'assistant')
        setFlash(state.error ? 'error' : finishedMood(reply && parseReply(reply.content).intent, question))
        clearTimeout(timers.current.flash)
        timers.current.flash = setTimeout(() => setFlash(null), FLASH_MS)
      }),
    [poke],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      clearTimeout(pending.flash)
      clearTimeout(pending.reaction)
      clearTimeout(pending.sleep)
    }
  }, [])

  let mood: RobotMood = 'idle'
  if (talking) mood = replying ? 'speaking' : 'thinking'
  else if (flash) mood = flash
  else if (reaction) mood = reaction
  else if (petting) mood = 'happy'
  else if (typing) mood = 'listening'
  else if (asleep) mood = 'sleepy'

  return { mood, poke, greet }
}
