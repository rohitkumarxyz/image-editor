export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type FontWeight = 'normal' | 'bold'
export type TextAlign = 'left' | 'center' | 'right'
export type EraseMode = 'smart' | 'solid'

export interface TextStyle {
  fontFamily: string
  fontSize: number
  fontWeight: FontWeight
  letterSpacing: number
  /** Clockwise, in degrees, around the box centre. */
  rotation: number
  color: string
  bgColor: string
  align: TextAlign
  eraseMode: EraseMode
  padding: number
  offsetX: number
  offsetY: number
  fitWidth: boolean
}

/** AI-redrawn pixels for a region, valid only while the region keeps this text and box. */
export interface AiPatch {
  canvas: HTMLCanvasElement
  rect: Rect
  text: string
}

export interface TextRegion {
  id: string
  rect: Rect
  originalText: string
  text: string
  confidence: number | null
  source: 'ocr' | 'manual'
  style: TextStyle
  initialStyle: TextStyle
  edited: boolean
  aiPatch: AiPatch | null
}

export type OcrLanguage = 'eng' | 'hin' | 'eng+hin'
export type OcrLevel = 'line' | 'word'
export type Tool = 'select' | 'draw' | 'crop'

export interface Point {
  x: number
  y: number
}

export type CropShape = 'rect' | 'square' | 'rounded' | 'circle' | 'ellipse' | 'polygon' | 'freehand'
export type CropAspect = 'free' | 'original' | '1:1' | '4:5' | '3:2' | '16:9' | '9:16'

export interface CropState {
  shape: CropShape
  aspect: CropAspect
  /** Corner radius for the rounded shape, as a percentage of the shorter side (0–50). */
  radius: number
  /** Box for rect / square / rounded / circle / ellipse. */
  rect: Rect | null
  /** Outline for polygon / freehand. */
  points: Point[]
  closed: boolean
}

export interface AiStatus {
  regionId: string | null
  running: boolean
  error: string | null
}

export interface OcrStatus {
  running: boolean
  message: string
  progress: number
  error: string | null
}
