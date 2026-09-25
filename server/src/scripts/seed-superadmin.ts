/**
 * Creates the Super Admin. Never deletes or changes any other account.
 *
 *   npm run seed:superadmin
 *
 * The account comes from these variables (server/.env or the shell):
 *
 *   SUPERADMIN_EMAIL      default superadmin@chillngo.vn
 *   SUPERADMIN_PASSWORD   must meet the password policy; if unset, a random
 *                         one is generated and printed once
 *   SUPERADMIN_NAME       default "Super Admin"
 *   SUPERADMIN_USERNAME   default "superadmin"
 *
 * Safe to run again. If an account with SUPERADMIN_EMAIL already exists, it
 * is made Super Admin again: role, password, active status and verified email
 * are reset to the values above. The run is written to the audit log.
 */

import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

import { connectDb } from '../db.js'
import { duplicateKeyField } from '../lib/errors.js'
import { displayNameSchema, emailSchema, passwordSchema, usernameSchema } from '../lib/schemas.js'
import { AuditLog } from '../models/AuditLog.js'
import { User } from '../models/User.js'

async function main() {
  const email = emailSchema.parse(process.env.SUPERADMIN_EMAIL?.trim() || 'superadmin@chillngo.vn')
  const displayName = displayNameSchema.parse(process.env.SUPERADMIN_NAME?.trim() || 'Super Admin')
  const username = usernameSchema.parse(process.env.SUPERADMIN_USERNAME?.trim() || 'superadmin')

  const givenPassword = process.env.SUPERADMIN_PASSWORD?.trim()
  const password = givenPassword || `Sa-${randomBytes(9).toString('base64url')}9!`
  const checked = passwordSchema.safeParse(password)
  if (!checked.success) {
    throw new Error(`SUPERADMIN_PASSWORD: ${checked.error.issues[0]?.message}`)
  }

  await connectDb()
  const passwordHash = await bcrypt.hash(password, 10)
  const superFields = {
    role: 'superadmin' as const,
    passwordHash,
    emailVerified: true,
    status: 'active' as const,
    lockedReason: '',
    adminPermissions: [] as never[],
  }

  const existing = await User.findOne({ email })
  let created: boolean
  let accountId: string

  if (existing) {
    existing.set({ ...superFields, lockedAt: undefined })
    await existing.save()
    created = false
    accountId = existing._id
  } else {
    try {
      const account = await User.create({ username, displayName, email, ...superFields })
      created = true
      accountId = account._id
    } catch (error) {
      if (duplicateKeyField(error) === 'username') {
        throw new Error(
          `Username "${username}" is already used by another account. Set SUPERADMIN_USERNAME to a different value.`,
        )
      }
      throw error
    }
  }

  await AuditLog.create({
    actorId: 'system',
    actorName: 'seed:superadmin script',
    actorRole: 'system',
    action: 'system.seed_superadmin',
    targetType: 'user',
    targetId: accountId,
    targetLabel: email,
    details: { created },
  })

  const others = await User.countDocuments({ role: 'superadmin', email: { $ne: email } })

  console.log(`Database: ${mongoose.connection.name} on ${mongoose.connection.host}`)
  console.log(created ? 'Created the Super Admin.' : 'The account already existed. It is Super Admin again.')
  console.log(`  Email:    ${email}`)
  console.log(
    givenPassword
      ? '  Password: the value of SUPERADMIN_PASSWORD'
      : `  Password: ${password}   (generated; shown only now, save it)`,
  )
  console.log('No other account was changed.')
  if (others > 0) {
    console.log(`Note: ${others} other Super Admin account(s) exist. They were left as they are.`)
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    // Atlas answers a blocked IP with a TLS alert or a server-selection timeout.
    if (/SSL|TLS|ServerSelection|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(`${(error as Error)?.name} ${message}`)) {
      console.error('Could not connect to MongoDB. Nothing was changed.')
      console.error('Check Atlas > Security > Network Access: add your IP or allow 0.0.0.0/0.')
    } else {
      console.error(message)
    }
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
