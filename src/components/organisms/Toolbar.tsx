import { useRef, type ReactNode } from 'react'
import type { OcrLanguage, OcrStatus, Tool } from '../../types'
import { AppLink } from '../atoms/AppLink'
import { Button } from '../atoms/Button'
import { Icon } from '../atoms/Icon'
import { ProgressBar } from '../atoms/ProgressBar'
import { Select, type SelectOption } from '../atoms/Select'
import { ToolbarGroup } from '../molecules/ToolbarGroup'

const LANGUAGES: SelectOption<OcrLanguage>[] = [
  { value: 'eng+hin', label: 'English + Hindi' },
  { value: 'eng', label: 'English' },
  { value: 'hin', label: 'Hindi' },
]


interface ToolbarProps {
  lang: OcrLanguage
  ocr: OcrStatus
  tool: Tool
  editedCount: number
  onLangChange: (lang: OcrLanguage) => void
  onUpload: (file: File) => void
  onRotate: (clockwise: boolean) => void
  onDetect: () => void
  onToolChange: (tool: Tool) => void
  onDownload: () => void
  onDownloadPdf: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  account: ReactNode
}

export function Toolbar(props: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { ocr } = props

  return (
    <div className="toolbar">
      <AppLink href="/" className="brand brand--small toolbar__brand" title="Home">Image <span>Text</span> Editor</AppLink>
      <ToolbarGroup className="toolbar-group--file">
        <Button onClick={() => fileRef.current?.click()} title="Open another image (or paste one with Ctrl/⌘+V)">
          <Icon name="upload" /> Open
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) props.onUpload(file)
            e.target.value = ''
          }}
        />
        <Button title="Rotate left" aria-label="Rotate left" onClick={() => props.onRotate(false)}><Icon name="rotateLeft" /></Button>
        <Button title="Rotate right" aria-label="Rotate right" onClick={() => props.onRotate(true)}><Icon name="rotateRight" /></Button>
        <Button title="Undo (Ctrl/⌘+Z)" aria-label="Undo" onClick={props.onUndo} disabled={!props.canUndo}><Icon name="undo" /></Button>
        <Button title="Redo (Ctrl/⌘+Shift+Z)" aria-label="Redo" onClick={props.onRedo} disabled={!props.canRedo}><Icon name="redo" /></Button>
      </ToolbarGroup>

      <ToolbarGroup className="toolbar-group--detect">
        <Select value={props.lang} options={LANGUAGES} onChange={props.onLangChange} disabled={ocr.running} aria-label="Text language" />
        <Button variant="primary" onClick={props.onDetect} disabled={ocr.running}>
          <Icon name="scan" /> {ocr.running ? 'Finding text…' : 'Detect text'}
        </Button>
        {ocr.running && <ProgressBar value={ocr.progress} />}
      </ToolbarGroup>

      <ToolbarGroup className="toolbar-group--tools">
        <Button active={props.tool === 'select'} onClick={() => props.onToolChange('select')} title="Click a box to edit (V)">Select</Button>
        <Button active={props.tool === 'draw'} onClick={() => props.onToolChange('draw')} title="Drag over text the detector missed (B)">+ Box</Button>
        <Button active={props.tool === 'crop'} onClick={() => props.onToolChange('crop')} title="Crop the image (C)"><Icon name="crop" /> Crop</Button>
      </ToolbarGroup>

      <ToolbarGroup className="toolbar-group--output">
        <Button variant="primary" onClick={props.onDownload} title="Download as PNG">
          <Icon name="download" /> Download{props.editedCount > 0 ? ` (${props.editedCount})` : ''}
        </Button>
        <Button onClick={props.onDownloadPdf} title="Download as PDF">PDF</Button>
      </ToolbarGroup>

      <div className="toolbar__account">{props.account}</div>

      {ocr.error && <p className="error toolbar-error">{ocr.error}</p>}
    </div>
  )
}
