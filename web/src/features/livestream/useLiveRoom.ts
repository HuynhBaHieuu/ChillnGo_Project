/**
 * The livestream's video connection. This is the only file in the web app
 * that talks to LiveKit (livekit-client); the screens use this hook alone.
 *
 * Host:   publishes camera + microphone, shows its own camera.
 * Viewer: plays the host's camera and microphone.
 * Both:   live viewer count (people, not tabs), server messages (comments,
 *         removed comments, reactions, stream ended), reconnecting /
 *         disconnected states.
 */

import { DisconnectReason, LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client'
import type { RemoteParticipant, RemoteTrack, VideoCaptureOptions } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { mediaErrorMessage } from '@/features/livestream/media'
import type { DevicePick } from '@/features/livestream/media'
import type { LiveComment, LiveConnection, ReactionKind } from '@/services/livestream.service'
import { t } from '@/i18n'

/** Same topic the server sends on (server/src/lib/livekit.ts). */
const DATA_TOPIC = 'chillngo'

export type LinkState = 'connecting' | 'live' | 'reconnecting' | 'disconnected'

/** Everything the server sends into the room (server/src/routes/livestreams.ts). */
type ServerMessage =
  | { type: 'comment'; comment: LiveComment }
  | { type: 'comment_removed'; commentIds: string[] }
  | { type: 'reaction'; kind: ReactionKind; count: number; userId: string }
  | { type: 'ended' }

/** A viewer's identity is "<userId>~<tab>"; the host's is their user id. */
function userIdOf(identity: string): string {
  return identity.split('~')[0]
}

type Facing = 'user' | 'environment'

function cameraTrack(room: Room): LocalVideoTrack | undefined {
  const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
  return track instanceof LocalVideoTrack ? track : undefined
}

/** Front or back, on phones. Laptop webcams report nothing: null. */
function facingOf(track: LocalVideoTrack | undefined): Facing | null {
  const facing = track?.mediaStreamTrack.getSettings().facingMode
  return facing === 'user' || facing === 'environment' ? facing : null
}

/** A camera stream at the same size LiveKit publishes by default (720p). */
async function openCamera(constraints: MediaTrackConstraints = {}): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...constraints },
  })
  return stream.getVideoTracks()[0]
}

interface Options {
  connection: LiveConnection | null
  hostId: string
  /** Host only: devices chosen in the setup dialog. */
  devices?: DevicePick
  onComment: (comment: LiveComment) => void
  onCommentsRemoved: (ids: string[]) => void
  onReaction: (kind: ReactionKind, count: number, userId: string) => void
  onEnded: () => void
  /** The host removed this viewer from the stream. */
  onRemoved: () => void
}

export function useLiveRoom({ connection, hostId, devices, ...handlers }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioBox = useRef<HTMLDivElement | null>(null)
  const roomRef = useRef<Room | null>(null)
  const callbacks = useRef(handlers)
  useEffect(() => {
    callbacks.current = handlers
  })

  const [state, setState] = useState<LinkState>('connecting')
  const [viewerCount, setViewerCount] = useState(0)
  const [hasVideo, setHasVideo] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [facing, setFacing] = useState<Facing | null>(null)
  /** The camera to reopen after it was turned off (device id). */
  const lastCamera = useRef<string | undefined>(undefined)
  /** One camera operation at a time: taps during a switch are ignored. */
  const busy = useRef(false)
  /** Viewer rewinding: the live sound is silenced so it does not play over the rewound part. */
  const liveAudioMuted = useRef(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHost = connection?.role === 'host'

  /** After any camera change: show it, and remember which camera it is. */
  const cameraChanged = useCallback((track: LocalVideoTrack) => {
    if (videoRef.current) track.attach(videoRef.current)
    lastCamera.current = track.mediaStreamTrack.getSettings().deviceId
    setFacing(facingOf(track))
  }, [])

  /**
   * Publishes the camera track once. From then on the same publication is
   * kept for the whole stream: turning the camera off and on, and switching
   * cameras, only swap the camera feed inside it (replaceTrack). Publishing a
   * second camera track mid-stream needs a WebRTC renegotiation, which can
   * stall and leave viewers without video; letting LiveKit reopen a stopped
   * camera by itself is what failed on phones.
   */
  const publishCamera = useCallback(
    async (room: Room, options?: VideoCaptureOptions) => {
      const local = room.localParticipant
      await local.setCameraEnabled(true, options).catch((e: unknown) => {
        if (!options) throw e
        return local.setCameraEnabled(true)
      })
      const track = cameraTrack(room)
      if (!track) throw new Error('camera')
      cameraChanged(track)
      setCamOn(true)
      setHasVideo(true)
    },
    [cameraChanged],
  )

  useEffect(() => {
    if (!connection) return
    const room = new Room({ adaptiveStream: true, dynacast: true, stopLocalTrackOnUnpublish: true })
    roomRef.current = room
    let disposed = false

    // Everyone in the room except the host is a viewer; two tabs of one account count once.
    const countViewers = () => {
      const everyone = [room.localParticipant, ...room.remoteParticipants.values()]
      setViewerCount(new Set(everyone.map((p) => userIdOf(p.identity)).filter((id) => id && id !== hostId)).size)
    }

    const showHostTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
      if (participant.identity !== hostId) return
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current)
        setHasVideo(true)
      }
      if (track.kind === Track.Kind.Audio && audioBox.current) {
        const element = track.attach()
        element.muted = liveAudioMuted.current
        audioBox.current.appendChild(element)
      }
    }

    room
      .on(RoomEvent.ParticipantConnected, countViewers)
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        countViewers()
        if (p.identity === hostId) setHasVideo(false)
      })
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => showHostTrack(track, participant))
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach()
        if (track.kind === Track.Kind.Video) setHasVideo(false)
      })
      .on(RoomEvent.TrackMuted, (pub, participant) => {
        if (participant.identity === hostId && pub.kind === Track.Kind.Video) setHasVideo(false)
      })
      .on(RoomEvent.TrackUnmuted, (pub, participant) => {
        if (participant.identity === hostId && pub.kind === Track.Kind.Video) setHasVideo(true)
      })
      .on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        if (topic !== DATA_TOPIC) return
        try {
          const message = JSON.parse(new TextDecoder().decode(payload)) as ServerMessage
          const on = callbacks.current
          if (message.type === 'comment') on.onComment(message.comment)
          if (message.type === 'comment_removed') on.onCommentsRemoved(message.commentIds)
          if (message.type === 'reaction') on.onReaction(message.kind, message.count, message.userId)
          if (message.type === 'ended') on.onEnded()
        } catch {
          // not ours
        }
      })
      .on(RoomEvent.Reconnecting, () => setState('reconnecting'))
      .on(RoomEvent.Reconnected, () => setState('live'))
      .on(RoomEvent.Disconnected, (reason) => {
        setState('disconnected')
        if (reason === DisconnectReason.ROOM_DELETED) callbacks.current.onEnded()
        else if (reason === DisconnectReason.PARTICIPANT_REMOVED) callbacks.current.onRemoved()
        else if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          // Only the host has a fixed identity: viewers can watch from as many tabs as they like.
          setError(t('Bạn đang phát livestream này ở một thẻ hoặc thiết bị khác.'))
        } else if (reason !== DisconnectReason.CLIENT_INITIATED) {
          setError(t('Mất kết nối tới livestream. Kiểm tra mạng rồi tải lại trang.'))
        }
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
      .on(RoomEvent.MediaDevicesError, (e) => setError(mediaErrorMessage(e)))
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        // The device went away (unplugged, taken by another app).
        if (pub.source === Track.Source.Camera) setCamOn(false)
        if (pub.source === Track.Source.Microphone) setMicOn(false)
      })

    const start = async () => {
      try {
        await room.connect(connection.url, connection.token)
        if (disposed) return
        setState('live')
        countViewers()
        setAudioBlocked(!room.canPlaybackAudio)
        for (const p of room.remoteParticipants.values()) {
          for (const pub of p.trackPublications.values()) if (pub.track) showHostTrack(pub.track, p)
        }

        if (connection.role === 'host') {
          const wantCamera = devices?.videoDeviceId !== null
          await room.localParticipant
            .setMicrophoneEnabled(true, devices?.audioDeviceId ? { deviceId: devices.audioDeviceId } : undefined)
            .catch((e: unknown) => {
              setMicOn(false)
              setError(mediaErrorMessage(e))
            })
          if (wantCamera) {
            await publishCamera(room, devices?.videoDeviceId ? { deviceId: devices.videoDeviceId } : undefined).catch(
              (e: unknown) => {
                setCamOn(false)
                setError(`${mediaErrorMessage(e)} ${t('Livestream tiếp tục với âm thanh.')}`)
              },
            )
          } else setCamOn(false)
          setCameras(await Room.getLocalDevices('videoinput', false).catch(() => []))
        }
      } catch {
        if (!disposed) {
          setState('disconnected')
          setError(t('Không kết nối được tới livestream. Vui lòng thử lại.'))
        }
      }
    }
    void start()

    return () => {
      disposed = true
      // Stops the camera and microphone too (stopLocalTrackOnUnpublish).
      void room.disconnect(true)
      roomRef.current = null
    }
    // One connection per token; devices only matter at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.token, hostId])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isMicrophoneEnabled
    await room.localParticipant.setMicrophoneEnabled(next).then(
      () => setMicOn(next),
      (e: unknown) => setError(mediaErrorMessage(e)),
    )
  }, [])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room || busy.current) return
    busy.current = true
    setError(null)
    const track = cameraTrack(room)
    try {
      if (!track) {
        // Went live without a camera, or it was lost: publish one now.
        await publishCamera(room, lastCamera.current ? { deviceId: lastCamera.current } : undefined)
      } else if (!track.isMuted) {
        // Off: viewers see "camera off", and the camera itself is released (its light goes out).
        lastCamera.current = track.mediaStreamTrack.getSettings().deviceId
        await track.mute()
        track.mediaStreamTrack.stop()
        setCamOn(false)
        setHasVideo(false)
      } else {
        // On: open the same camera again (any camera if it is gone) into the same publication.
        const feed = await openCamera(lastCamera.current ? { deviceId: { exact: lastCamera.current } } : {}).catch(() =>
          openCamera(),
        )
        await track.replaceTrack(feed, true)
        await track.unmute()
        cameraChanged(track)
        setCamOn(true)
        setHasVideo(true)
      }
    } catch (e) {
      setError(mediaErrorMessage(e))
    } finally {
      busy.current = false
    }
  }, [publishCamera, cameraChanged])

  /**
   * Front ↔ back on phones (by facing mode, which is what phones understand);
   * the next webcam in the list elsewhere. The camera in use is read from the
   * live feed itself, never from a remembered id.
   */
  const switchCamera = useCallback(async () => {
    const room = roomRef.current
    const track = room ? cameraTrack(room) : undefined
    if (!track || track.isMuted || busy.current) return
    busy.current = true
    setError(null)

    const current = track.mediaStreamTrack.getSettings().deviceId
    const before = facingOf(track)
    const attempts: MediaTrackConstraints[] = []
    if (before) attempts.push({ facingMode: { exact: before === 'user' ? 'environment' : 'user' } })
    const index = cameras.findIndex((c) => c.deviceId === current)
    for (const c of [...cameras.slice(index + 1), ...cameras.slice(0, index + 1)]) {
      if (c.deviceId && c.deviceId !== current) attempts.push({ deviceId: { exact: c.deviceId } })
    }

    try {
      // Most phones cannot open two cameras at once: let go of this one first.
      track.mediaStreamTrack.stop()
      let feed: MediaStreamTrack | undefined
      for (const constraints of attempts) {
        feed = await openCamera(constraints).catch(() => undefined)
        if (feed && feed.getSettings().deviceId !== current) break
        feed?.stop()
        feed = undefined
      }
      if (!feed) {
        setError(t('Không chuyển được sang camera khác.'))
        feed = await openCamera(current ? { deviceId: { exact: current } } : {}).catch(() => openCamera())
      }
      await track.replaceTrack(feed, true)
      cameraChanged(track)
    } catch (e) {
      // Not even the old camera would reopen.
      setError(mediaErrorMessage(e))
      await track.mute().catch(() => undefined)
      setCamOn(false)
      setHasVideo(false)
    } finally {
      busy.current = false
    }
  }, [cameras, cameraChanged])

  const startAudio = useCallback(async () => {
    await roomRef.current?.startAudio()
    setAudioBlocked(false)
  }, [])

  /** Silence (or restore) the live sound, e.g. while the viewer rewinds. */
  const muteLiveAudio = useCallback((muted: boolean) => {
    liveAudioMuted.current = muted
    audioBox.current?.querySelectorAll('audio').forEach((el) => {
      el.muted = muted
    })
  }, [])

  const leave = useCallback(async () => {
    await roomRef.current?.disconnect(true)
  }, [])

  return {
    videoRef,
    audioBox,
    state,
    isHost,
    viewerCount,
    hasVideo,
    micOn,
    camOn,
    canSwitchCamera: cameras.length > 1,
    /** Mirror the host's own view like a selfie, except for a back camera. */
    mirror: isHost && facing !== 'environment',
    audioBlocked,
    error,
    toggleMic,
    toggleCamera,
    switchCamera,
    startAudio,
    muteLiveAudio,
    leave,
  }
}
