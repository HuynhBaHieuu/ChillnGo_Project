import { Schema, model } from 'mongoose'

/** `userId` likes journey `postId`. The pair is unique. */
const postLikeSchema = new Schema(
  {
    postId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true })
postLikeSchema.index({ userId: 1, createdAt: -1 })

export const PostLike = model('PostLike', postLikeSchema)

/**
 * A comment on a journey. One level of replies: a reply to a reply is stored
 * under the same root, which is how the web app shows it anyway.
 */
const postCommentSchema = new Schema(
  {
    postId: { type: String, required: true },
    authorId: { type: String, required: true },
    /** `null` for a root comment; otherwise the root comment it answers. */
    parentId: { type: String, default: null },
    content: { type: String, required: true },
    /**
     * Hidden by the journey's author: everyone else stops seeing it, while its
     * writer and the journey's author still do. Not counted in `commentCount`.
     */
    hidden: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

postCommentSchema.index({ postId: 1, createdAt: 1 })
postCommentSchema.index({ authorId: 1, createdAt: -1 })

export const PostComment = model('PostComment', postCommentSchema)
