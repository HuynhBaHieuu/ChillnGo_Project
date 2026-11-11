import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canonicalUrl,
  channelIdInPage,
  googleNewsUrl,
  imageLink,
  parseFeed,
  passesKeywords,
  plainText,
  titleKey,
  usefulExcerpt,
  youtubeChannelId,
  youtubeFeedUrl,
} from './feeds.js'
import { extractArticle, imagesInHtml, looksLikePhoto, pickImages, readablePage } from './article.js'
import { MAX_HEADLINE, MAX_PARAGRAPHS, MAX_PARAGRAPH_CHARS, initialStatus, parseWritten, statusAfterAi, verifyCronSecret } from './pipeline.js'

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

  it('reads the post inside an AI answer and drops bad fields', () => {
    const post = parseWritten(
      'Đây là kết quả:\n{"relevant":true,"headline":"Mùa <b>dã quỳ</b> Đà Lạt","summary":"Tóm tắt","content":["Đoạn một.","   ","Đoạn hai."],"region":"mars","destinations":["Đà Lạt"]}\nHết.',
    )
    assert.deepEqual(post, {
      relevant: true,
      headline: 'Mùa dã quỳ Đà Lạt',
      summary: 'Tóm tắt',
      content: ['Đoạn một.', 'Đoạn hai.'],
      region: null,
      destinations: ['Đà Lạt'],
    })
    assert.equal(parseWritten('không có JSON'), null)
    assert.equal(parseWritten('{"headline":"thiếu relevant"}'), null)
  })

  it('keeps a post within its limits', () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => `Đoạn ${i} ${'x'.repeat(2000)}`)
    const post = parseWritten(JSON.stringify({ relevant: true, headline: 'h'.repeat(400), content: paragraphs, destinations: ['a', 'b', 'c', 'd', 'e', 'f'] }))!
    assert.equal(post.headline.length, MAX_HEADLINE)
    assert.equal(post.content.length, MAX_PARAGRAPHS)
    assert.ok(post.content.every((paragraph) => paragraph.length <= MAX_PARAGRAPH_CHARS))
    assert.equal(post.destinations.length, 5)
    // An item the AI finds unrelated carries no post.
    assert.deepEqual(parseWritten('{"relevant":false}')?.content, [])
  })

  it('accepts only the exact cron secret', () => {
    assert.doesNotThrow(() => verifyCronSecret('Bearer s3cret-value', 's3cret-value'))
    assert.throws(() => verifyCronSecret('Bearer wrong', 's3cret-value'))
    assert.throws(() => verifyCronSecret(undefined, 's3cret-value'))
    assert.throws(() => verifyCronSecret('Bearer anything', null))
  })
})

describe('news articles', () => {
  it('repairs picture links feeds get wrong', () => {
    assert.equal(imageLink('//cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg')
    assert.equal(imageLink('https://saigoneer.com///media.example.net/img/28.webp'), 'https://media.example.net/img/28.webp')
    assert.equal(imageLink('http://example.com/a.jpg#top'), 'https://example.com/a.jpg')
    assert.equal(imageLink('/files/a.jpg', 'https://example.com/tin/1'), 'https://example.com/files/a.jpg')
    assert.equal(imageLink('/files/a.jpg'), '')
    assert.equal(imageLink('data:image/png;base64,AAAA'), '')
    assert.equal(imageLink('javascript:alert(1)'), '')
  })

  it('tells photographs from decorations and thumbnails', () => {
    assert.ok(looksLikePhoto('https://example.com/2026/11/hoi-an.jpg'))
    assert.ok(looksLikePhoto('https://example.com/zoom/1200_630/hoi-an.jpg'))
    assert.ok(!looksLikePhoto('https://example.com/static/logo.png'))
    assert.ok(!looksLikePhoto('https://example.com/img/loading.gif'))
    assert.ok(!looksLikePhoto('https://example.com/zoom/80_80/author.jpg'))
    assert.ok(!looksLikePhoto('https://example.com/a-150x150.jpg'))
  })

  it('keeps each picture once, in order, up to the limit', () => {
    const picked = pickImages(
      ['', 'https://example.com/a.jpg', 'https://example.com/a.jpg?w=600', 'https://example.com/icon-x.png', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
      2,
    )
    assert.deepEqual(picked, ['https://example.com/a.jpg', 'https://example.com/b.jpg'])
  })

  it('finds pictures behind lazy-loading attributes and skips small ones', () => {
    const html = `
      <img src="placeholder.gif" data-src="/img/one.jpg">
      <img srcset="/img/two-480.jpg 480w, /img/two-1200.jpg 1200w">
      <img src="/img/tiny.jpg" width="60" height="60">
      <img loading="lazy" src="//cdn.example.com/three.jpg" alt="">`
    assert.deepEqual(imagesInHtml(html, 'https://example.com/tin/1'), [
      'https://example.com/img/one.jpg',
      'https://example.com/img/two-1200.jpg',
      'https://cdn.example.com/three.jpg',
    ])
  })

  it('reads the text and pictures of an article page, cover first', () => {
    const paragraph = 'Tháng 11, đồi núi Đà Lạt rực vàng hoa dã quỳ, du khách kéo về săn mây từ sáng sớm ở Cầu Đất và đồi chè. '
    const page = `<!doctype html><html><head><title>Đà Lạt mùa hoa</title>
      <meta property="og:image" content="https://img.example.com/cover.jpg"></head>
      <body><nav><a href="/">Trang chủ</a><img src="/logo.png"></nav>
      <article><h1>Đà Lạt mùa hoa dã quỳ</h1>
        <p>${paragraph.repeat(3)}</p><img src="/img/doi-che.jpg">
        <p>${paragraph.repeat(3)}</p><img src="/img/cau-dat.jpg">
        <p>${paragraph.repeat(3)}</p>
      </article><footer>Bản quyền thuộc về báo</footer></body></html>`
    const article = extractArticle(page, 'https://bao.example.com/da-lat')
    assert.ok(article.text.includes('săn mây'))
    assert.ok(!article.text.includes('Bản quyền'))
    assert.deepEqual(article.images, ['https://img.example.com/cover.jpg', 'https://bao.example.com/img/doi-che.jpg', 'https://bao.example.com/img/cau-dat.jpg'])
    assert.deepEqual(extractArticle('', 'https://bao.example.com/x'), { text: '', images: [] })
  })

  it('opens only public article pages', () => {
    assert.ok(readablePage('https://vnexpress.net/da-lat-123.html'))
    assert.ok(!readablePage('https://news.google.com/rss/articles/CBMi'))
    assert.ok(!readablePage('http://localhost:3000/x'))
    assert.ok(!readablePage('http://169.254.169.254/latest'))
    assert.ok(!readablePage('not a link'))
  })
})
