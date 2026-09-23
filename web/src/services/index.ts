/**
 * Barrel for the service layer.
 *
 * Components import from `@/services` only — never from `@/mocks` directly.
 * That is what makes the eventual swap to the Express API a change confined to
 * this folder.
 */

export * from './types'
export { ApiError } from './client'

export * as authService from './auth.service'
export * as postService from './post.service'
export * as socialService from './social.service'
export * as itineraryService from './itinerary.service'
export * as discoveryService from './discovery.service'
export * as landingService from './landing.service'
