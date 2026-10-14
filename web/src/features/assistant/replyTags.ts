/**
 * The tags the model writes into a reply for the robot (the system prompt in
 * server/src/routes/assistant.ts asks for them), read off and hidden from the
 * reader:
 *
 *   <<g:explain>>   at the very start: what the reply is doing (INTENTS below)
 *   <<g:stress>>    right before the word it stresses: a beat gesture lands on that word
 *   <<g:thumbsup>>  before something it warmly recommends
 *   <<n:2>>         at the start of point 2 of a short list: it counts on its fingers
 *   <<j:…id…>>      right after the title of a journey it looked up: becomes a link to it
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
  /** Journeys it named: each one's id and where in `text` its title ends, in order, once per journey. */
  links: { at: number; id: string }[]
}

/** A tag (anything between << and >>), an inline HTML tag, or Markdown bold. */
const MARK = /<<([^<>\n]{0,60})>>|<(\/?)(b|strong|i|em|u)>|\*\*/gi
/** Inside a tag: a name, then maybe a value ("g:explain", "n:2", "b"). */
const TAG = /^\s*([a-z]+)\s*(?::\s*(.*?)\s*)?$/i
/** The start of a mark still arriving at the end of a streamed reply ("<", "<<g:expl", "<<j:65f0…", "</str", "*"). */
const PARTIAL = /<(<[^<>\n]{0,40}>?|\/?[a-z]{0,6})?$|\*$/i
/** A journey's id as the API gives it (a MongoDB ObjectId): nothing else becomes a link. */
const JOURNEY_ID = /^[a-f0-9]{24}$/
const SENTENCE_END = /[.!?…](?=\s|$)|\n+/g
/** `<<b>>` was the stress tag before <<g:stress>>; older replies in a conversation may carry it. */
const STRESS = new Set(['g:stress', 'g:beat', 'b:'])

export function parseReply(raw: string): ParsedReply {
  const source = raw.replace(PARTIAL, '')
  let text = ''
  let intent: AssistantIntent | null = null
  const cues: Cue[] = []
  const links: ParsedReply['links'] = []
  let bold = false
  let last = 0
  for (const match of source.matchAll(MARK)) {
    const before = source.slice(last, match.index)
    last = match.index + match[0].length
    const [closing, html] = [match[2], match[3]?.toLowerCase()]
    const isTag = match[1] !== undefined
    // A tag that does not read as name:value is still a tag: it goes, and does nothing.
    const [, tag = '', value] = (isTag && TAG.exec(match[1].toLowerCase())) || []
    if (tag === 'g' && !text && !before.trim() && INTENTS.includes(value as AssistantIntent)) {
      intent = value as AssistantIntent
      // Its own space or line break goes with it.
      last += /^\s*/.exec(source.slice(last))![0].length
      continue
    }
    text += before

    if (!isTag) {
      // Bold opening: the bolded words are stressed. Closing and other inline tags just go.
      const opens = html ? !closing && (html === 'b' || html === 'strong') : (bold = !bold)
      if (opens) cues.push({ at: text.length, kind: 'beat' })
      continue
    }
    // A tag between two spaces leaves one; a cue points at the start of the word after it.
    if (/\s$/.test(text) || !text) {
      const spaces = /^[ \t]+/.exec(source.slice(last))
      if (spaces) last += spaces[0].length
    }
    if (tag === 'j') {
      // The link sits at the end of the title it follows, before any space.
      if (value && JOURNEY_ID.test(value) && !links.some((link) => link.id === value)) links.push({ at: text.trimEnd().length, id: value })
    } else if (STRESS.has(`${tag}:${value ?? ''}`)) cues.push({ at: text.length, kind: 'beat' })
    else if (tag === 'g' && value === 'thumbsup') cues.push({ at: text.length, kind: 'thumbsup' })
    else if (tag === 'n' && value && /^\d+$/.test(value)) cues.push({ at: text.length, kind: 'count', n: Number(value) })
  }
  text += source.slice(last)
  for (const match of text.matchAll(SENTENCE_END)) cues.push({ at: match.index, kind: 'sentence' })
  cues.sort((a, b) => a.at - b.at)
  return { intent, text, cues, links }
}
