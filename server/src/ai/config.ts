/**
 * Tunable numbers for AI clone. Change them here; nothing else hard-codes them.
 */
export const AI_CONFIG = {
  /**
   * valueScore of a place: likes, clones and uses of the published journeys
   * that visit it (log-scaled) plus its rating, weighted as below, then scaled
   * so the best candidate of a request scores 100.
   */
  valueWeights: { likes: 1, clones: 2, uses: 1, rating: 2 },

  /**
   * Stops per day for each pace (the model is told the range), and the hours
   * from a day's first start to its last end past which the day is flagged.
   */
  pace: {
    relaxed: { label: 'Thong thả', minStops: 2, maxStops: 4, activeHours: 8 },
    moderate: { label: 'Vừa phải', minStops: 3, maxStops: 6, activeHours: 10 },
    packed: { label: 'Dày đặc', minStops: 5, maxStops: 8, activeHours: 13 },
  },

  /** At most this many places are offered to the model, best valueScore first. */
  maxCandidates: 60,
  /** Offered whatever the chosen interests: everybody eats. */
  alwaysCategories: ['food'] as string[],

  /** No stop starts earlier or ends later than this. */
  dayStart: '06:00',
  dayEnd: '23:30',
  /** A restored stop with no time of its own starts after the day's last stop and lasts this long. */
  restoredDurationMin: 60,

  /**
   * Average door-to-door speed, km/h, for travel-time estimates (straight-line
   * distance ÷ speed, rounded up to 5 minutes). Shown as an estimate.
   */
  travelSpeedKmh: 25,
  /** Stops the route optimiser keeps in their place: meals and the hotel. */
  anchorCategories: ['food', 'stay'] as string[],
  /** A Plan B farther than this from its stop is no Plan B. */
  planBMaxKm: 15,

  /** Model tries per request: the first answer plus this many corrections. */
  retries: 2,
  /**
   * How long Gemini thinks before answering, per task (minimal, low, medium,
   * high). Measured on a 3-day clone with a budget: "medium" took ~40 s and
   * fitted the budget at once; "low" took ~10 s a call but missed it, so the
   * budget round ran too. A chat edit is a few patches: "low" answers in seconds.
   */
  geminiReasoning: { clone: 'medium', chat: 'low', checklist: 'low' } as Record<string, string>,
}

export type Pace = keyof typeof AI_CONFIG.pace
