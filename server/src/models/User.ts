import { Schema, Types, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

import { ADMIN_MODULES, ROLES, effectivePermissions } from '../lib/permissions.js'

/**
 * User collection. Field names match `User` in web/src/services/types.ts.
 *
 * `_id` is a string, not an ObjectId. New users get an ObjectId's hex string,
 * but the seed users keep their fixture ids (`u_001`, ...) so the posts,
 * follows and comments the web app still serves from mock JSON point at real
 * accounts.
 */
const userSchema = new Schema(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /**
     * bcrypt hash. Never selected unless a query asks for it explicitly.
     * Absent for accounts created through Google, which have no password.
     */
    passwordHash: { type: String, select: false },
    /** Google's stable account id (`sub`), once the account has used Google sign-in. */
    googleId: { type: String, unique: true, sparse: true },
    /** Empty means "use the default travel photo"; the web app picks one. */
    avatarUrl: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    bio: { type: String, default: 'Thành viên mới của ChillnGo.' },
    location: { type: String, default: 'Việt Nam' },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    role: { type: String, enum: ROLES, default: 'user' },
    /** Modules an admin may use. Ignored for other roles (superadmin has all). */
    adminPermissions: { type: [{ type: String, enum: ADMIN_MODULES }], default: [] },

    /** A locked account cannot sign in, and its existing sessions stop working. */
    status: { type: String, enum: ['active', 'locked'], default: 'active' },
    lockedReason: { type: String, default: '' },
    lockedAt: { type: Date },
    lastLoginAt: { type: Date },

    /** Login is refused until the address is confirmed through the emailed link. */
    emailVerified: { type: Boolean, default: false },
    /** SHA-256 of the pending verification token; the token itself is never stored. */
    emailVerifyTokenHash: { type: String, select: false, index: { sparse: true } },
    emailVerifyExpiresAt: { type: Date, select: false },
    /** When the last verification email went out, to throttle resends. */
    emailVerifySentAt: { type: Date, select: false },
  },
  { timestamps: true, versionKey: false },
)

export type UserFields = InferSchemaType<typeof userSchema>
/** Anything carrying the stored fields: a hydrated document or a lean object. */
export type UserRecord = UserFields & { _id: string; createdAt: Date }

export const User = model('User', userSchema)

/** The JSON the API sends for a user. Never includes the password hash. */
export function toPublicUser(user: UserRecord) {
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    location: user.location,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    postCount: user.postCount,
    role: user.role,
    permissions: effectivePermissions(user),
    createdAt: user.createdAt.toISOString(),
  }
}

/** The per-account counters kept on the user record. */
export type UserCounter = 'followerCount' | 'followingCount' | 'postCount'

/** Adds `delta` to a counter of these accounts, never letting it go below zero. */
export async function adjustCount(userIds: string | string[], field: UserCounter, delta: number): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds]
  if (ids.length === 0 || delta === 0) return
  await User.updateMany({ _id: { $in: ids } }, { $inc: { [field]: delta } })
  await User.updateMany({ _id: { $in: ids }, [field]: { $lt: 0 } }, { $set: { [field]: 0 } })
}

/** A loaded user document (the result of `User.findById` and friends). */
export type UserDocument = InstanceType<typeof User>
