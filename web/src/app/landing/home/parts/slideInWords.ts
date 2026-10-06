import { SCRUB } from '@/app/landing/home/config'
import { SplitText, gsap } from '@/app/landing/home/gsap'

/**
 * Section headings: words slide in sideways out of masks, tied to the scroll
 * position, and slide back out when you scroll up.
 *
 * Call it inside a gsap.matchMedia() branch: SplitText and its tween register
 * with that context, so reverting the branch restores the original text.
 */
export function slideInWords(target: Element) {
  return SplitText.create(target, {
    type: 'words',
    mask: 'words',
    wordsClass: 'split',
    autoSplit: true,
    onSplit: (self) =>
      gsap.from(self.words, {
        xPercent: 60,
        yPercent: 40,
        autoAlpha: 0,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: { trigger: target, start: 'top 88%', end: 'top 45%', scrub: SCRUB },
      }),
  })
}
