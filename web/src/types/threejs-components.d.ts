// threejs-components ships untyped minified builds; this covers the one we use.
declare module 'threejs-components/build/cursors/tubes1.min.js' {
  interface TubesOptions {
    tubes?: {
      colors?: string[]
      lights?: { intensity?: number; colors?: string[] }
    }
  }

  export interface TubesApp {
    tubes: { setLightsColors: (colors: string[]) => void }
    dispose: () => void
  }

  export default function TubesCursor(canvas: HTMLCanvasElement, options?: TubesOptions): TubesApp
}
