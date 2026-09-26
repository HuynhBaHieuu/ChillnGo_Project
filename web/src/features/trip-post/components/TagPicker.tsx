import { X } from 'lucide-react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'

import { TagChip } from '@/components/TagChip'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'

import { qk } from '@/lib/queryKeys'
import { discoveryService } from '@/services'

interface TagPickerProps {
  value: string[]
  onChange: (tags: string[]) => void
  max?: number
}

/**
 * Tag input: suggestions from the tags already in use, plus free entry.
 *
 * Enter or comma commits the typed tag; backspace on an empty field removes the
 * last one.
 */
export function TagPicker({ value, onChange, max = 6 }: TagPickerProps) {
  const [draft, setDraft] = useState('')
  const { data: suggestions } = useQuery({
    queryKey: qk.discover.tags,
    queryFn: () => discoveryService.getAllTags(),
  })

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || value.includes(tag) || value.length >= max) return
    onChange([...value, tag])
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(draft)
      return
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const unused = (suggestions ?? []).filter((s) => !value.includes(s.tag)).slice(0, 10)

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Bỏ thẻ ${tag}`}
                className="-mr-1 rounded-full p-0.5 transition-colors hover:bg-white/5"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        disabled={value.length >= max}
        aria-label={value.length >= max ? `Đã đủ tối đa ${max} thẻ` : 'Thêm thẻ, nhấn Enter để thêm'}
      />

      {unused.length > 0 && value.length < max && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((suggestion) => (
            <TagChip
              key={suggestion.tag}
              tag={suggestion.tag}
              onClick={() => addTag(suggestion.tag)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
