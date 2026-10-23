import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ImageUp, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n'
import { ACCEPTED_LABEL, ACCEPT_ATTRIBUTE } from '@/lib/images'
import { travelAvatar, travelBanner } from '@/lib/photos'
import { cn } from '@/lib/utils'
import { authService, profileService } from '@/services'
import type { ImageKind, ProfileUpdate } from '@/services/profile.service'
import type { User } from '@/services/types'
import { useAuthStore } from '@/store'

const BIO_MAX = 300
const LOCATION_MAX = 80

/** What the user picked for one image, before saving. */
interface ImageDraft {
  file: File | null
  /** Object URL of `file`, for the preview. */
  preview: string | null
  /** Go back to the default travel photo. */
  remove: boolean
}

const NO_CHANGE: ImageDraft = { file: null, preview: null, remove: false }

/** /profile/edit — the signed-in user's own profile. */
export function EditProfilePage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  // Re-mount when the account changes, so the form always starts from it.
  return <EditProfileForm key={user._id} user={user} />
}

function EditProfileForm({ user }: { user: User }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const patchUser = useAuthStore((s) => s.patchUser)

  const [displayName, setDisplayName] = useState(user.displayName)
  const [username, setUsername] = useState(user.username)
  const [bio, setBio] = useState(user.bio)
  const [location, setLocation] = useState(user.location)
  const [avatar, setAvatar] = useState<ImageDraft>(NO_CHANGE)
  const [cover, setCover] = useState<ImageDraft>(NO_CHANGE)
  const [progress, setProgress] = useState<string | null>(null)

  // Free the preview images when they are replaced or the page closes.
  useEffect(() => () => void (avatar.preview && URL.revokeObjectURL(avatar.preview)), [avatar.preview])
  useEffect(() => () => void (cover.preview && URL.revokeObjectURL(cover.preview)), [cover.preview])

  const changed = {
    displayName: displayName.trim() !== user.displayName,
    username: username.trim().toLowerCase() !== user.username,
    bio: bio.trim() !== user.bio,
    location: location.trim() !== user.location,
  }
  const dirty =
    Object.values(changed).some(Boolean) || avatar.file !== null || avatar.remove || cover.file !== null || cover.remove

  const save = useMutation({
    mutationFn: async () => {
      const uploads: [ImageKind, File | null, string][] = [
        ['avatar', avatar.file, t('ảnh đại diện')],
        ['cover', cover.file, t('ảnh bìa')],
      ]
      for (const [kind, file, name] of uploads) {
        if (!file) continue
        setProgress(t('Đang tải {name} lên… {progress}%', { name, progress: 0 }))
        await profileService.uploadImage(kind, file, (p) => setProgress(t('Đang tải {name} lên… {progress}%', { name, progress: p })))
      }
      setProgress(t('Đang lưu hồ sơ…'))

      const update: ProfileUpdate = {}
      if (changed.displayName) update.displayName = displayName.trim()
      if (changed.username) update.username = username.trim()
      if (changed.bio) update.bio = bio.trim()
      if (changed.location) update.location = location.trim()
      if (avatar.file) update.avatar = 'uploaded'
      else if (avatar.remove) update.avatar = 'remove'
      if (cover.file) update.cover = 'uploaded'
      else if (cover.remove) update.cover = 'remove'

      return authService.adoptUser(await profileService.updateProfile(update))
    },
    onSuccess: (fresh) => {
      patchUser(fresh)
      void queryClient.invalidateQueries()
      void navigate(`/users/${fresh._id}`, { replace: true })
    },
    onSettled: () => setProgress(null),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (dirty) save.mutate()
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
      <PageHeader title={t('Chỉnh sửa hồ sơ')} description={t('Thông tin này hiện trên trang cá nhân của bạn.')} />

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4 rounded-2xl border border-foreground/15 bg-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">{t('Ảnh')}</h2>

          <ImagePicker
            kind="cover"
            label={t('Ảnh bìa')}
            hint={t('Ảnh ngang, tỉ lệ khoảng 3:1. {formats}, tối đa 15 MB. Ảnh được tự nén trước khi tải lên.', { formats: ACCEPTED_LABEL })}
            currentUrl={user.coverUrl}
            defaultUrl={travelBanner(user.username)}
            draft={cover}
            onChange={setCover}
            disabled={save.isPending}
          />

          <ImagePicker
            kind="avatar"
            label={t('Ảnh đại diện')}
            hint={t('Ảnh vuông sẽ đẹp nhất. {formats}, tối đa 15 MB. Ảnh được tự nén trước khi tải lên.', { formats: ACCEPTED_LABEL })}
            currentUrl={user.avatarUrl}
            defaultUrl={travelAvatar(user.username)}
            draft={avatar}
            onChange={setAvatar}
            disabled={save.isPending}
          />
        </section>

        <section className="space-y-5 rounded-2xl border border-foreground/15 bg-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">{t('Thông tin')}</h2>

          <div className="space-y-2">
            <Label htmlFor="displayName">{t('Tên hiển thị')}</Label>
            <Input
              id="displayName"
              required
              maxLength={60}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">{t('Tên người dùng')}</Label>
            <Input
              id="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9._]+"
              title={t('Chữ không dấu, số, dấu chấm hoặc gạch dưới')}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-describedby="username-hint"
            />
            <p id="username-hint" className="text-xs text-muted-foreground">
              {t('3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới. Hiện là @{username}', { username: username.trim().toLowerCase() || '…' })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t('Giới thiệu')}</Label>
            <Textarea
              id="bio"
              rows={4}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              aria-describedby="bio-count"
            />
            <p id="bio-count" className="text-right text-xs text-muted-foreground">
              {bio.length}/{BIO_MAX}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">{t('Nơi sống')}</Label>
            <Input
              id="location"
              maxLength={LOCATION_MAX}
              autoComplete="address-level1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </section>

        <div className="space-y-3">
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {(save.error as Error).message}
            </p>
          )}
          {progress && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {progress}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="outline" className="rounded-full">
              <Link to={`/users/${user._id}`}>{t('Huỷ')}</Link>
            </Button>
            <GlassButton type="submit" tone="sunset" size="lg" disabled={!dirty || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {t('Lưu thay đổi')}
            </GlassButton>
          </div>
        </div>
      </form>
      </div>
    </PageContainer>
  )
}

interface ImagePickerProps {
  kind: ImageKind
  label: string
  hint: string
  currentUrl: string
  /** The travel photo shown when the user has no image of their own. */
  defaultUrl: string
  draft: ImageDraft
  onChange: (draft: ImageDraft) => void
  disabled: boolean
}

function ImagePicker({ kind, label, hint, currentUrl, defaultUrl, draft, onChange, disabled }: ImagePickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const hasOwnImage = currentUrl !== defaultUrl
  const shown = draft.preview ?? (draft.remove ? defaultUrl : currentUrl)
  const changedHere = draft.file !== null || draft.remove

  function pick(file: File | undefined) {
    if (!file) return
    const problem = profileService.checkImageFile(file)
    setError(problem)
    if (problem) return
    onChange({ file, preview: URL.createObjectURL(file), remove: false })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <div className={cn('flex gap-4', kind === 'cover' ? 'flex-col' : 'items-center')}>
        <div
          className={cn(
            'relative shrink-0 overflow-hidden border border-foreground/15 bg-muted',
            kind === 'cover' ? 'aspect-[3/1] w-full rounded-2xl' : 'size-24 rounded-full',
          )}
        >
          <img src={shown} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          {changedHere && (
            <span className="absolute left-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
              {t('Chưa lưu')}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={disabled}
              onClick={() => input.current?.click()}
            >
              {kind === 'avatar' ? <Camera className="size-4" aria-hidden /> : <ImageUp className="size-4" aria-hidden />}
              {t('Chọn ảnh mới')}
            </Button>
            {changedHere ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                disabled={disabled}
                onClick={() => {
                  setError(null)
                  onChange(NO_CHANGE)
                }}
              >
                <RotateCcw className="size-4" aria-hidden />
                {t('Hoàn tác')}
              </Button>
            ) : (
              hasOwnImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  disabled={disabled}
                  onClick={() => onChange({ file: null, preview: null, remove: true })}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t('Dùng ảnh mặc định')}
                </Button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-label={t('Chọn {thing}', { thing: label.toLowerCase() })}
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
