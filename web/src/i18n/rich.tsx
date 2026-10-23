import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'

/**
 * Like `t()`, but placeholders may be React elements, for sentences with a
 * link or bold word inside:
 *
 *     tr('Gửi tới {email} rồi bấm {button}.', { email: <b>{email}</b>, button: <b>{t('Xác nhận')}</b> })
 *
 * Each language puts the elements wherever its sentence needs them.
 */
export function tr(key: MessageKey, values: Record<string, ReactNode>): ReactNode {
  const numbers = Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  )
  const text = t(key, numbers)
  return text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={i}>{name && name in values ? values[name] : part}</Fragment>
  })
}
