/**
 * Seeds the demo accounts from web/src/mocks/users.json.
 *
 *   npm run seed
 *
 * Each account keeps its fixture `_id` so the mock posts and follows in the web
 * app still belong to it. Every seed account gets the same password, taken from
 * SEED_PASSWORD (default: chillngo). Safe to re-run: existing accounts are
 * updated, never duplicated.
 */

import { readFile } from 'node:fs/promises'

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

import { connectDb } from '../db.js'
import { ADMIN_MODULES } from '../lib/permissions.js'
import { User } from '../models/User.js'

interface FixtureUser {
  _id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string
  coverUrl: string
  bio: string
  location: string
  followerCount: number
  followingCount: number
  postCount: number
  role: 'user' | 'admin'
  createdAt: string
}

const fixturePath = new URL('../../../web/src/mocks/users.json', import.meta.url)
const password = process.env.SEED_PASSWORD?.trim() || 'chillngo'

async function main() {
  const users = JSON.parse(await readFile(fixturePath, 'utf8')) as FixtureUser[]
  await connectDb()

  const passwordHash = await bcrypt.hash(password, 10)

  for (const { _id, createdAt, ...fields } of users) {
    await User.updateOne(
      { _id },
      {
        $set: {
          ...fields,
          email: fields.email.toLowerCase(),
          passwordHash,
          emailVerified: true,
          status: 'active',
          // The demo admin gets every admin module.
          adminPermissions: fields.role === 'admin' ? [...ADMIN_MODULES] : [],
        },
        $setOnInsert: { createdAt: new Date(createdAt) },
      },
      { upsert: true, timestamps: false },
    )
    console.log(`  ${fields.role === 'admin' ? 'admin' : 'user '}  ${fields.email}`)
  }

  console.log(`Seeded ${users.length} accounts. Password for all of them: ${password}`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
