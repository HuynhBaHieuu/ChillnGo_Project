/**
 * Accounts for trying out reports and moderation by hand.
 *
 *   npm run seed:moderation-test
 *
 * Creates (or resets) one moderator admin and six regular test users, all
 * email-verified, active and with the same password (MODERATION_TEST_PASSWORD,
 * default "Chillngo@123"):
 *
 *   kiemduyet@chillngo.vn            Admin with Reports, Content, Users and Stats
 *   tester1@chillngo.vn … tester6    regular users: one to post, five to report
 *
 * Five testers reporting the same content reach AUTO_HIDE_THRESHOLD. Only
 * these seven accounts are touched; an existing account with one of these
 * emails that is not a test account (another role, say) is left alone.
 */

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

import { connectDb } from '../db.js'
import type { AdminModule } from '../lib/permissions.js'
import { passwordSchema } from '../lib/schemas.js'
import { User } from '../models/User.js'

const PASSWORD = process.env.MODERATION_TEST_PASSWORD?.trim() || 'Chillngo@123'

const ACCOUNTS = [
  {
    email: 'kiemduyet@chillngo.vn',
    username: 'kiemduyet',
    displayName: 'Kiểm duyệt viên (test)',
    role: 'admin' as const,
    adminPermissions: ['reports', 'content', 'users', 'stats'] as AdminModule[],
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    email: `tester${i + 1}@chillngo.vn`,
    username: `tester${i + 1}`,
    displayName: `Tester ${i + 1}`,
    role: 'user' as const,
    adminPermissions: [] as AdminModule[],
  })),
]

async function main() {
  const checked = passwordSchema.safeParse(PASSWORD)
  if (!checked.success) throw new Error(`MODERATION_TEST_PASSWORD: ${checked.error.issues[0]?.message}`)

  await connectDb()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  for (const account of ACCOUNTS) {
    const existing = await User.findOne({ $or: [{ email: account.email }, { username: account.username }] })
    if (existing && (existing.email !== account.email || existing.role !== account.role)) {
      console.log(`  skipped  ${account.email}: another account already uses this email or username`)
      continue
    }
    const fields = {
      ...account,
      passwordHash,
      emailVerified: true,
      status: 'active' as const,
      lockedReason: '',
    }
    if (existing) {
      existing.set({ ...fields, lockedAt: undefined })
      await existing.save()
      console.log(`  reset    ${account.email}`)
    } else {
      await User.create(fields)
      console.log(`  created  ${account.email}`)
    }
  }
  console.log(`\nPassword for all of them: ${PASSWORD}`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void mongoose.disconnect())
