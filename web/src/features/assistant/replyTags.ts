/**
 * The tags the model writes into a reply for the robot (the system prompt in
 * server/src/routes/assistant.ts asks for them), read off and hidden from the
 * reader:
 *
 *   <<g:explain>>   at the very start: what the reply is doing (INTENTS below)
 *   <<g:stress>>    right before the word it stresses: a beat gesture lands on that word
 *   <<g:thumbsup>>  before something it warmly recommends
 *   <<n:2>>         at the start of point 2 of a short list: it counts on its fingers
 *
 * Bold is a stress too: asked for plain text, the model still bolds the words
 * that matter most (<b>…</b>, **…**), so a bold word gets a beat and loses its
 * markup. Any other <<…>>, and stray <i>/<em>/<u>, are dropped.
 *
 * The stored reply keeps its tags, so the model sees them in the history it
 * gets back and keeps writing them.
 */

/** What a reply is doing, as the model tags its opening. The robot's gestures follow it. */
export const INTENTS = ['greet', 'explain', 'agree', 'disagree', 'uncertain', 'celebrate', 'thanks'] as const
export type AssistantIntent = (typeof INTENTS)[number]

export type Cue =
  | { at: number; kind: 'beat' | 'thumbsup' | 'sentence' }
  | { at: number; kind: 'count'; n: number }

export interface ParsedReply {
  /** What the reply's opening tag says it is doing; null without one. */
  intent: AssistantIntent | null
  /** The text to show. */
  text: string
  /** Where in `text` each gesture cue falls, in order. */
  cues: Cue[]
}

/** A gesture tag, an inline HTML tag, or Markdown bold. */
const MARK = /<<\s*([a-z]+)\s*(?::\s*([a-z0-9]+)\s*)?>>|<(\/?)(b|strong|i|em|u)>|\*\*/gi
/** The start of a mark still arriving at the end of a streamed reply ("<", "<<g:expl", "</str", "*"). */
const PARTIAL = /<(<[^<>\n]{0,20}>?|\/?[a-z]{0,6})?$|\*$/i
const SENTENCE_END = /[.!?…](?=\s|$)|\n+/g
/** `<<b>>` was the stress tag before <<g:stress>>; older replies in a conversation may carry it. */
const STRESS = new Set(['g:stress', 'g:beat', 'b:'])

export function parseReply(raw: string): ParsedReply {
  const source = raw.replace(PARTIAL, '')
  let text = ''
  let intent: AssistantIntent | null = null
  const cues: Cue[] = []
  let bold = false
  let last = 0
  for (const match of source.matchAll(MARK)) {
    const before = source.slice(last, match.index)
    last = match.index + match[0].length
    const [tag, value, closing, html] = [match[1]?.toLowerCase(), match[2]?.toLowerCase(), match[3], match[4]?.toLowerCase()]
    if (tag === 'g' && !text && !before.trim() && INTENTS.includes(value as AssistantIntent)) {
      intent = value as AssistantIntent
      // Its own space or line break goes with it.
      last += /^\s*/.exec(source.slice(last))![0].length
      continue
    }
    text += before

    if (!tag) {
      // Bold opening: the bolded words are stressed. Closing and other inline tags just go.
      const opens = html ? !closing && (html === 'b' || html === 'strong') : (bold = !bold)
      if (opens) cues.push({ at: text.length, kind: 'beat' })
      continue
    }
    // A tag between two spaces leaves one; the cue points at the start of the word after it.
    if (/\s$/.test(text) || !text) {
      const spaces = /^[ \t]+/.exec(source.slice(last))
      if (spaces) last += spaces[0].length
    }
    if (STRESS.has(`${tag}:${value ?? ''}`)) cues.push({ at: text.length, kind: 'beat' })
    else if (tag === 'g' && value === 'thumbsup') cues.push({ at: text.length, kind: 'thumbsup' })
    else if (tag === 'n' && value && /^\d+$/.test(value)) cues.push({ at: text.length, kind: 'count', n: Number(value) })
  }
  text += source.slice(last)
  for (const match of text.matchAll(SENTENCE_END)) cues.push({ at: match.index, kind: 'sentence' })
  cues.sort((a, b) => a.at - b.at)
  return { intent, text, cues }
}
