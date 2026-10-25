import { Link } from 'react-router-dom'

import { formatShortDate } from '@/lib/format'
import type { TripPostWithAuthor } from '@/services/types'
import { t } from '@/i18n'

/** A trip read as a journal entry: photo, title, date and length, byline. */
export function StoryCard({ post }: { post: TripPostWithAuthor }) {
  return (
    <Link to={`/posts/${post._id}`} className="group block">
      <div className="np-media aspect-[11/10] overflow-hidden rounded-xl">
        <img
          src={post.coverUrl}
          alt=""
          loading="lazy"
          className="size-full rounded-[inherit] object-cover transition-opacity duration-100 ease-linear group-hover:opacity-90"
        />
      </div>
      <h3 className="mt-4 font-display text-lg leading-snug group-hover:underline">
        {post.title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatShortDate(post.startDate)} • {t('{n} ngày', { n: post.days.length })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t('Bởi {name}', { name: post.author.displayName })}</p>
    </Link>
  )
}
