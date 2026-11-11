import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canonicalUrl,
  channelIdInPage,
  googleNewsUrl,
  parseFeed,
  passesKeywords,
  plainText,
  titleKey,
  usefulExcerpt,
  youtubeChannelId,
  youtubeFeedUrl,
} from './feeds.js'
import { initialStatus, parseAiAnswer, statusAfterAi, verifyCronSecret } from './pipeline.js'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Du lịch</title>
  <item>
    <title><![CDATA[Đà Lạt mùa hoa dã quỳ &amp; săn mây]]></title>
    <link>https://vnexpress.net/da-lat-mua-hoa-123.html?utm_source=rss&amp;id=5</link>
    <description><![CDATA[<a href="x"><img src="https://img.example/hoa.jpg"></a>Tháng 11, đồi núi <b>Đà Lạt</b> rực vàng.]]></description>
    <pubDate>Mon, 09 Nov 2026 08:00:00 +0700</pubDate>
    <dc:creator>Phóng viên A</dc:creator>
  </item>
  <item>
    <title>Hội An đón khách</title>
    <link>https://example.com/hoi-an</link>
    <enclosure url="https://img.example/hoian.jpg" type="image/jpeg" length="1"/>
    <description>Phố cổ đông vui</description>
    <pubDate>Sun, 08 Nov 2026 10:00:00 +0700</pubDate>
  </item>
  <item><title>No link</title></item>
</channel></rss>`

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Kênh du lịch</title>
  <author><name>Travel Channel</name></author>
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <title>3 ngày ở Phú Quốc</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-11-07T12:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i4.ytimg.com/vi/abc123/hqdefault.jpg" width="480" height="360"/>
      <media:description>Lịch trình Phú Quốc chi tiết</media:description>
    </media:group>
  </entry>
</feed>`

describe('news feeds', () => {
  it('reads RSS: title, canonical link, image from the description, text, date, author', () => {
    const items = parseFeed(RSS)
    assert.equal(items.length, 2)
    const [first, second] = items
    assert.equal(first.title, 'Đà Lạt mùa hoa dã quỳ & săn mây')
    assert.equal(first.url, 'https://vnexpress.net/da-lat-mua-hoa-123.html?id=5')
    assert.equal(first.imageUrl, 'https://img.example/hoa.jpg')
    assert.equal(first.excerpt, 'Tháng 11, đồi núi Đà Lạt rực vàng.')
    assert.equal(first.author, 'Phóng viên A')
    assert.equal(first.publishedAt.toISOString(), '2026-11-09T01:00:00.000Z')
    assert.equal(second.imageUrl, 'https://img.example/hoian.jpg')
  })

  it('reads a YouTube channel feed as videos with thumbnails', () => {
    const [video] = parseFeed(ATOM)
    assert.equal(video.kind, 'video')
    assert.equal(video.url, 'https://youtube.com/watch?v=abc123')
    assert.equal(video.imageUrl, 'https://i4.ytimg.com/vi/abc123/hqdefault.jpg')
    assert.equal(video.excerpt, 'Lịch trình Phú Quốc chi tiết')
    assert.equal(video.author, 'Travel Channel')
  })

  it('gives nothing for something that is not a feed', () => {
    assert.deepEqual(parseFeed('<html><body>hi</body></html>'), [])
    assert.deepEqual(parseFeed('not xml at all <<<'), [])
  })

  it('makes canonical links', () => {
    assert.equal(canonicalUrl('http://www.Example.com/a/?utm_medium=x&fbclid=1&p=2#top'), 'https://example.com/a?p=2')
    assert.equal(canonicalUrl('https://m.facebook.com/page/posts/1/'), 'https://facebook.com/page/posts/1')
    assert.equal(canonicalUrl('javascript:alert(1)'), null)
    assert.equal(canonicalUrl('not a url'), null)
  })

  it('filters by keywords, ignoring accents and case', () => {
    assert.equal(passesKeywords('Lễ hội hoa Đà Lạt', ['da lat'], []), true)
    assert.equal(passesKeywords('Tin bóng đá', ['du lịch'], []), false)
    assert.equal(passesKeywords('Du lịch Sapa giá rẻ khuyến mãi', [], ['khuyến mãi']), false)
    assert.equal(passesKeywords('Bất kỳ tin nào', [], []), true)
  })

  it('turns HTML into plain text', () => {
    assert.equal(plainText('<p>Phố&nbsp;cổ <b>Hội&#32;An</b></p><script>x()</script>'), 'Phố cổ Hội An')
  })

  it('builds Google News and YouTube feed addresses', () => {
    assert.match(googleNewsUrl('du lịch Đà Lạt'), /^https:\/\/news\.google\.com\/rss\/search\?q=du%20l%E1%BB%8Bch/)
    assert.equal(youtubeChannelId('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'), 'UCabcdefghijklmnopqrstuv')
    assert.equal(youtubeChannelId('https://www.youtube.com/@travel'), null)
    assert.equal(channelIdInPage('..."externalId":"UCabcdefghijklmnopqrstuv"...'), 'UCabcdefghijklmnopqrstuv')
    assert.equal(youtubeFeedUrl('UCx'), 'https://www.youtube.com/feeds/videos.xml?channel_id=UCx')
  })

  it('treats the same title from another publisher link as the same story', () => {
    assert.equal(titleKey('Giang Nam có gì đẹp? - Dulichvietnam.com.vn'), titleKey('giang nam co gi dep'))
    assert.notEqual(titleKey('Đà Lạt mùa hoa'), titleKey('Hội An mùa hoa'))
  })

  it('drops an excerpt that only repeats the title', () => {
    assert.equal(usefulExcerpt('Rà soát dự thảo - Báo Văn Hóa', 'Rà soát dự thảo  Báo Văn Hóa'), '')
    const long = 'Rà soát dự thảo. Bộ Văn hoá cho biết sẽ lấy ý kiến các địa phương về chính sách đặc thù cho du lịch trong tháng tới.'
    assert.equal(usefulExcerpt('Rà soát dự thảo', long), long)
    assert.equal(usefulExcerpt('Tiêu đề', 'Một đoạn khác hẳn'), 'Một đoạn khác hẳn')
  })
})

describe('news pipeline rules', () => {
  it('waits for the AI when there is one; else follows the source', () => {
    assert.equal(initialStatus(true, true), 'queued')
    assert.equal(initialStatus(true, false), 'published')
    assert.equal(initialStatus(false, false), 'pending')
  })

  it('rejects what the AI finds unrelated; publishes or queues the rest by source', () => {
    assert.equal(statusAfterAi(true, false), 'rejected')
    assert.equal(statusAfterAi(true, true), 'published')
    assert.equal(statusAfterAi(false, true), 'pending')
  })

  it('reads the JSON array inside an AI answer and drops bad fields', () => {
    const answer = parseAiAnswer('Đây là kết quả:\n[{"id":"1","relevant":true,"summary":"Tóm tắt","region":"mars","destinations":["Đà Lạt"]}]\nHết.')
    assert.deepEqual(answer, [{ id: '1', relevant: true, summary: 'Tóm tắt', region: null, destinations: ['Đà Lạt'] }])
    assert.equal(parseAiAnswer('không có JSON'), null)
    assert.equal(parseAiAnswer('[{"id": 1}]'), null)
  })

  it('fills in the ids by position when the model leaves them out but answers every item', () => {
    const text = '{"results": [{"relevant":true,"summary":"A","region":"north","destinations":[]},{"relevant":false,"summary":"","region":null,"destinations":[]}]}'
    assert.deepEqual(parseAiAnswer(text, ['a', 'b']), [
      { id: 'a', relevant: true, summary: 'A', region: 'north', destinations: [] },
      { id: 'b', relevant: false, summary: '', region: null, destinations: [] },
    ])
    // A count that does not match cannot be trusted by position.
    assert.equal(parseAiAnswer(text, ['a']), null)
    // Ids the model did give win over the position.
    assert.deepEqual(parseAiAnswer('[{"id":"z","relevant":true}]', ['a'])?.map((a) => a.id), ['z'])
  })

  it('accepts only the exact cron secret', () => {
    assert.doesNotThrow(() => verifyCronSecret('Bearer s3cret-value', 's3cret-value'))
    assert.throws(() => verifyCronSecret('Bearer wrong', 's3cret-value'))
    assert.throws(() => verifyCronSecret(undefined, 's3cret-value'))
    assert.throws(() => verifyCronSecret('Bearer anything', null))
  })
})
