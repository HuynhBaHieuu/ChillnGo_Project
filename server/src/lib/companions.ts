/**
 * Travel companions on a journey: friends (members who follow each other) its
 * author invited along. An invite is 'pending' until the friend accepts;
 * declining removes it.
 */

export const MAX_COMPANIONS = 10

export interface Companion {
  userId: string
  status: 'pending' | 'accepted'
}

/**
 * The companions `viewerId` may see: the author sees every invite, an invitee
 * their own, everyone else only those who accepted.
 */
export function visibleCompanions(companions: Companion[], authorId: string, viewerId: string | undefined): Companion[] {
  const plain = companions.map(({ userId, status }) => ({ userId, status }))
  if (viewerId === authorId) return plain
  return plain.filter((c) => c.status === 'accepted' || c.userId === viewerId)
}
