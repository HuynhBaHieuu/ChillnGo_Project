/**
 * The assistant's robot for the phone app, which shows it in a WebView above
 * its own chat (mobile/lib/features/assistant/robot_view.dart). The same robot
 * as AssistantButton: same model, mood, gestures and speaking pace. Built into
 * one HTML file by scripts/export-robot.mjs.
 *
 * The app drives it through `window.robot`:
 *   follow(messages, busy, error)   the conversation, after every change
 *   typing(boolean)                 the reader has a draft in the box
 * and hears back on the RobotChannel: `{"ready":true}` once the model is on
 * screen, then `{"spoken":n}` (characters of the newest reply said so far, -1
 * for all of it) so its text appears at the robot's pace, as on the web.
 */

import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import AssistantRobot from './AssistantRobot'
import { follow, useAssistantStore } from './assistant.store'
import { useRobotCues, useRobotMood } from './robotMood'

declare global {
  interface Window {
    /** The model as a data URL, put in the page by the export script. */
    ROBOT_MODEL?: string
    RobotChannel?: { postMessage: (message: string) => void }
    robot?: { follow: typeof follow; typing: (value: boolean) => void }
  }
}

const tell = (message: object) => window.RobotChannel?.postMessage(JSON.stringify(message))

function RobotEmbed() {
  const [typing, setTyping] = useState(false)
  const [petting, setPetting] = useState(false)
  const { mood, poke, greet } = useRobotMood({ typing, petting })
  const { replyId, intent, cues, due } = useRobotCues()
  // Stable: the robot calls it from an effect on it.
  const ready = useCallback(() => {
    greet()
    tell({ ready: true })
  }, [greet])

  useEffect(() => {
    window.robot = {
      follow,
      typing(value) {
        setTyping(value)
        poke()
      },
    }
    return useAssistantStore.subscribe((state, previous) => {
      if (state.spoken !== previous.spoken) tell({ spoken: Number.isFinite(state.spoken) ? Math.floor(state.spoken) : -1 })
    })
  }, [poke])

  return (
    <div
      style={{ position: 'fixed', inset: 0 }}
      // Touching it is petting it, as the pointer is on the web.
      onPointerDown={() => {
        setPetting(true)
        poke()
      }}
      onPointerUp={() => setPetting(false)}
      onPointerCancel={() => setPetting(false)}
    >
      <AssistantRobot
        mood={mood}
        replyId={replyId}
        intent={intent}
        cues={cues}
        due={due}
        modelUrl={window.ROBOT_MODEL}
        onReady={ready}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<RobotEmbed />)
