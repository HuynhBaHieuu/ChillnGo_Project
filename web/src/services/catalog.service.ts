/**
 * The AI catalog (server/src/routes/adminCatalog.ts): destinations, places
 * and the preparation checklist. Needs an admin with the Danh mục module.
 * Saving replaces the whole record, so forms send every field.
 */

import type { Page } from './admin.service'
import { http } from './http'

export interface CatalogMeta {
  /** `label` is the Vietnamese source text; translate it with tx(). */
  categories: { key: string; label: string }[]
  placeTags: string[]
  checklistTags: string[]
}

export interface DestinationInput {
  slug: string
  name: string
  region: string
  lat: number
  lng: number
  radiusKm: number
  rainyMonths: number[]
  peakMonths: number[]
  festivals: { name: string; month: number }[]
}

export interface Destination extends DestinationInput {
  _id: string
  placeCount: number
  updatedAt: string | null
}

export interface PlaceInput {
  destinationId: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  category: string | null
  avgCost: number | null
  priceLevel: number | null
  openingHours: { open: string; close: string } | null
  isOutdoor: boolean | null
  requiresBooking: boolean | null
  rating: number | null
  photoUrl: string | null
  tags: string[]
}

export interface Place extends PlaceInput {
  _id: string
  updatedAt: string | null
}

export interface ChecklistInput {
  text: string
  group: string
  tags: string[]
  order: number
}

export interface ChecklistItem extends ChecklistInput {
  _id: string
}

const BASE = '/api/admin/catalog'

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getMeta(): Promise<CatalogMeta> {
  return http(`${BASE}/meta`)
}

export function listDestinations(): Promise<{ items: Destination[] }> {
  return http(`${BASE}/destinations`)
}

export function saveDestination(id: string | null, input: DestinationInput): Promise<{ destination: Destination }> {
  return id
    ? http(`${BASE}/destinations/${id}`, { method: 'PUT', body: input })
    : http(`${BASE}/destinations`, { method: 'POST', body: input })
}

export function deleteDestination(id: string): Promise<{ ok: true }> {
  return http(`${BASE}/destinations/${id}`, { method: 'DELETE' })
}

export function listPlaces(params: { q?: string; destinationId?: string; category?: string; page?: number }): Promise<Page<Place>> {
  return http(`${BASE}/places${query(params)}`)
}

export function savePlace(id: string | null, input: PlaceInput): Promise<{ place: Place }> {
  return id
    ? http(`${BASE}/places/${id}`, { method: 'PUT', body: input })
    : http(`${BASE}/places`, { method: 'POST', body: input })
}

export function deletePlace(id: string): Promise<{ ok: true }> {
  return http(`${BASE}/places/${id}`, { method: 'DELETE' })
}

export function listChecklist(): Promise<{ items: ChecklistItem[] }> {
  return http(`${BASE}/checklist`)
}

export function saveChecklistItem(id: string | null, input: ChecklistInput): Promise<{ item: ChecklistItem }> {
  return id
    ? http(`${BASE}/checklist/${id}`, { method: 'PUT', body: input })
    : http(`${BASE}/checklist`, { method: 'POST', body: input })
}

export function deleteChecklistItem(id: string): Promise<{ ok: true }> {
  return http(`${BASE}/checklist/${id}`, { method: 'DELETE' })
}
