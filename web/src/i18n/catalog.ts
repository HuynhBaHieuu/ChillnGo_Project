/**
 * Every translated string, keyed by its Vietnamese source text. Split by area
 * of the site; a key repeated in two files keeps the later file's entry.
 */

import { common } from './messages/common'
import { landing } from './messages/landing'
import { lib } from './messages/lib'
import { auth } from './messages/auth'
import { activity } from './messages/activity'
import { admin } from './messages/admin'
import { ai } from './messages/ai'
import { assistant } from './messages/assistant'
import { checkin } from './messages/checkin'
import { discover } from './messages/discover'
import { itinerary } from './messages/itinerary'
import { live } from './messages/live'
import { post } from './messages/post'
import { tags } from './messages/tags'
import { server } from './messages/server'

export const catalog = {
  ...common,
  ...landing,
  ...lib,
  ...auth,
  ...activity,
  ...admin,
  ...ai,
  ...assistant,
  ...checkin,
  ...discover,
  ...itinerary,
  ...live,
  ...post,
  ...tags,
  ...server,
}
