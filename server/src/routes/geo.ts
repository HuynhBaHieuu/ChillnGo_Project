/**
 * GET /api/geo/resolve-maps-link?url=… → { url }
 *
 * Follows a shortened Google Maps link (maps.app.goo.gl/…, goo.gl/maps/…) to
 * the full address it stands for, which carries the place's coordinates. The
 * browser cannot do this itself: Google does not allow cross-origin reads.
 *
 * Only Google Maps hosts are ever fetched, at every hop, so this cannot be
 * used to make the server request arbitrary addresses. Signed-in users only,
 * rate-limited.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { HttpError } from '../lib/errors.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { loadCurrentUser } from '../middleware/staff.js'

export const geoRouter = Router()

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (_req, res) => String(res.locals.userId),
  message: { message: 'Bạn dán link quá nhanh. Vui lòng đợi một chút.' },
})

const MAX_HOPS = 5

/** maps.app.goo.gl, goo.gl, google.com, maps.google.com and Google's country domains (google.com.vn, …). */
function isGoogleMapsHost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'maps.app.goo.gl' ||
    h === 'goo.gl' ||
    /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h)
  )
}

const querySchema = z.object({
  url: z.string().trim().min(1, 'Thiếu link').max(2000, 'Link quá dài').url('Link không hợp lệ'),
})

geoRouter.get('/resolve-maps-link', requireAuth, loadCurrentUser, limiter, async (req, res) => {
  const { url } = querySchema.parse(req.query)
  let current = new URL(url)

  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    // Old goo.gl links still redirect to plain http://maps.google.com.
    if (current.protocol === 'http:' && isGoogleMapsHost(current.hostname)) current.protocol = 'https:'
    if (current.protocol !== 'https:' || !isGoogleMapsHost(current.hostname)) {
      throw new HttpError(400, 'Đây không phải link Google Maps.', 'NOT_GOOGLE_MAPS')
    }

    // Full links already hold the coordinates; nothing to follow.
    if (current.hostname !== 'maps.app.goo.gl' && current.hostname !== 'goo.gl') {
      res.json({ url: current.toString() })
      return
    }

    let response: Response
    try {
      response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
    } catch {
      throw new HttpError(502, 'Không mở được link Google Maps lúc này. Vui lòng thử lại.', 'MAPS_UNREACHABLE')
    }
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) {
      throw new HttpError(400, 'Link Google Maps này không dẫn tới địa điểm nào.', 'MAPS_LINK_DEAD')
    }
    current = new URL(location, current)
  }

  throw new HttpError(400, 'Link Google Maps chuyển hướng quá nhiều lần.', 'MAPS_LINK_LOOP')
})
