/**
 * Seeds AI clone's demo data from scripts/data/aiSeed.ts: two destinations
 * (Đà Lạt, Hội An) with about 30 places each, the preparation checklist
 * templates, and four published sample journeys linked to those places.
 *
 *   npm run seed:places
 *
 * DEMO DATA: positions are approximate; prices, opening hours and ratings are
 * illustrative. Check them before real use.
 *
 * The journeys' authors are demo accounts (web/src/mocks/users.json). One
 * that does not exist yet is created without a password, so nobody can sign
 * in as it; `npm run seed` gives the demo accounts their password. Safe to re-run: every record has a fixed id and is updated in place; a
 * journey's like and clone counts are only set when it is first created.
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import mongoose from 'mongoose'

import { connectDb } from '../db.js'
import { addDays } from '../lib/journeys.js'
import { ChecklistTemplate } from '../models/ChecklistTemplate.js'
import { Destination } from '../models/Destination.js'
import { Place } from '../models/Place.js'
import { TripPost } from '../models/TripPost.js'
import { User } from '../models/User.js'
import { CHECKLIST, DESTINATIONS, JOURNEYS, PLACE_TAGS } from './data/aiSeed.js'

/** The same ObjectId for the same name, every run. */
function fixedId(name: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(createHash('md5').update(`chillngo-ai-seed:${name}`).digest('hex').slice(0, 24))
}

function hoursOf(hours: string | null) {
  if (!hours) return null
  const [open, close] = hours.split('-')
  return { open, close }
}

async function main() {
  await connectDb()

  const placesByName = new Map<string, { _id: mongoose.Types.ObjectId; name: string; address: string; lat: number; lng: number }>()
  for (const { places, ...destination } of DESTINATIONS) {
    const destinationId = fixedId(`destination:${destination.slug}`)
    await Destination.updateOne({ _id: destinationId }, { $set: destination }, { upsert: true })
    for (const { hours, ...place } of places) {
      const _id = fixedId(`place:${destination.slug}:${place.name}`)
      await Place.updateOne(
        { _id },
        {
          $set: {
            ...place,
            destinationId,
            openingHours: hoursOf(hours),
            priceLevel: place.priceLevel ?? null,
            tags: PLACE_TAGS[place.name] ?? [],
          },
        },
        { upsert: true },
      )
      placesByName.set(`${destination.slug}:${place.name}`, { _id, ...place })
    }
    console.log(`  ${destination.name}: ${places.length} places`)
  }

  for (const [order, item] of CHECKLIST.entries()) {
    await ChecklistTemplate.updateOne({ _id: fixedId(`checklist:${item.text}`) }, { $set: { ...item, order } }, { upsert: true })
  }
  console.log(`  checklist: ${CHECKLIST.length} templates`)

  const fixtureUsers = JSON.parse(await readFile(new URL('../../../web/src/mocks/users.json', import.meta.url), 'utf8')) as {
    _id: string
    username: string
    displayName: string
    email: string
    avatarUrl: string
    coverUrl: string
    bio: string
    location: string
  }[]
  for (const authorId of new Set(JOURNEYS.map((j) => j.authorId))) {
    if (await User.exists({ _id: authorId })) continue
    const fixture = fixtureUsers.find((u) => u._id === authorId)
    if (!fixture) throw new Error(`No demo account ${authorId} in web/src/mocks/users.json`)
    const { _id, username, displayName, email, avatarUrl, coverUrl, bio, location } = fixture
    await User.create({ _id, username, displayName, email, avatarUrl, coverUrl, bio, location, role: 'user', emailVerified: true })
    console.log(`  author ${username} created, without a password`)
  }

  for (const journey of JOURNEYS) {
    const postId = fixedId(`journey:${journey.key}`)
    const days = journey.days.map((day, i) => ({
      _id: `${postId}_d${i + 1}`,
      dayNumber: i + 1,
      date: addDays(journey.startDate, i),
      title: day.title,
      photos: [],
      locations: day.stops.map((stop, j) => {
        const _id = `${postId}_d${i + 1}_l${j + 1}`
        if ('own' in stop) return { _id, ...stop.own, note: stop.note, estCost: stop.estCost, photoUrl: null }
        const place = placesByName.get(`${journey.destination}:${stop.place}`)
        if (!place) throw new Error(`${journey.key}: no place named "${stop.place}"`)
        return {
          _id,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          placeId: String(place._id),
          note: stop.note,
          estCost: stop.estCost,
          photoUrl: null,
        }
      }),
    }))
    const totalEstCost = days.reduce((sum, d) => sum + d.locations.reduce((s, l) => s + l.estCost, 0), 0)

    const result = await TripPost.updateOne(
      { _id: postId },
      {
        $set: {
          authorId: journey.authorId,
          title: journey.title,
          summary: journey.summary,
          region: DESTINATIONS.find((d) => d.slug === journey.destination)?.region ?? 'central',
          season: journey.season,
          startDate: journey.startDate,
          endDate: addDays(journey.startDate, days.length - 1),
          days,
          tags: journey.tags,
          budgetLevel: journey.budgetLevel,
          totalEstCost,
          status: 'published',
          deletedAt: null,
        },
        $setOnInsert: { likeCount: journey.likeCount, cloneCount: journey.cloneCount, publishedAt: new Date() },
      },
      { upsert: true },
    )
    if (result.upsertedCount) await User.updateOne({ _id: journey.authorId }, { $inc: { postCount: 1 } })
    console.log(`  journey ${String(postId)}  ${journey.title}`)
  }

  console.log(`Seeded ${DESTINATIONS.length} destinations and ${JOURNEYS.length} sample journeys (demo data).`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
