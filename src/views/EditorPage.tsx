'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ApiError } from '../api/client'
import { AccountBar } from '../components/organisms/AccountBar'
import { CanvasControls } from '../components/organisms/CanvasControls'
import { useUndoable } from '../hooks/useUndoable'
import { useSession } from '../state/sessionContext'
import { useToast } from '../state/toastContext'
import { useApp } from '../state/appContext'
import { useRouter } from '../state/routerContext'
import { EXAMPLES, type Example } from '../lib/examples'
import { AppLink } from '../components/atoms/AppLink'
import { EditorCanvas } from '../components/organisms/EditorCanvas'
import { RegionInspector, type RegionPatch } from '../components/organisms/RegionInspector'
import { RegionList } from '../components/organisms/RegionList'
import { CropPanel } from '../components/organisms/CropPanel'
import { Toolbar } from '../components/organisms/Toolbar'
import { UploadDropzone } from '../components/organisms/UploadDropzone'
import { PanelSection } from '../components/molecules/PanelSection'
import { aiDetectText } from '../lib/aiDetect'
import { AiDraftRejectedError, aiReplaceText } from '../lib/aiEdit'
import { applyCrop, cropBounds, initialCrop, updateCrop } from '../lib/crop'
import { unifyBlockFonts } from '../lib/fontGroups'
import { loadWebFonts } from '../lib/fonts'
import { loadImageFile, rotateCanvas, sampleColors } from '../lib/image'
import { detectText, mergeWithAi } from '../lib/ocr'
import { createRegion, resetRegion } from '../lib/regions'
import { exportPdf } from '../lib/pdf'
import { createCanvas } from '../lib/image'
import { estimateFontSize, exportPng, renderComposite, uprightRect } from '../lib/render'
import type { AiStatus, CropState, OcrLanguage, OcrLevel, OcrStatus, Rect, TextRegion, Tool } from '../types'

const IDLE_OCR: OcrStatus = { running: false, message: '', progress: 0, error: null }
const IDLE_AI: AiStatus = { regionId: null, running: false, error: null }
/** Without the AI finder (guests), Tesseract boxes below this confidence are mostly noise (plants, textures). */
const GUEST_MIN_CONFIDENCE = 60
const LEAVE_WARNING = 'You have edits you haven’t downloaded yet. Leave and lose them?'

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function EditorPage() {
  const [base, setBase] = useState<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('image')
  const [loadError, setLoadError] = useState<string | null>(null)
  const regionHistory = useUndoable<TextRegion[]>([])
  const regions = regionHistory.value
  const setRegions = regionHistory.set
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [lang, setLang] = useState<OcrLanguage>('eng+hin')
  const [level, setLevel] = useState<OcrLevel>('line')
  const [ocr, setOcr] = useState<OcrStatus>(IDLE_OCR)
  const [ai, setAi] = useState<AiStatus>(IDLE_AI)
  const [crop, setCrop] = useState<CropState | null>(null)
  const [showBoxes, setShowBoxes] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)
  const [zoom, setZoom] = useState(1)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const session = useSession()
  const toast = useToast()
  const { config: publicConfig, openAccount: setDialog, takePendingFile } = useApp()
  const { setLeaveGuard } = useRouter()
  /** The boxes as they were at the last download; edits made after that are unsaved. */
  const [downloadedRegions, setDownloadedRegions] = useState<TextRegion[] | null>(null)
  /** Crop / rotate changed the picture itself since the last download. */
  const [imageChanged, setImageChanged] = useState(false)
  const autoDetect = useRef(false)
  const guestTipShown = useRef(false)

  const selected = regions.find((r) => r.id === selectedId) ?? null
  const unsaved = imageChanged || (regions !== downloadedRegions && regions.some((r) => r.edited))

  useEffect(() => {
    loadWebFonts()
  }, [])


  const fitZoom = useCallback((canvas: HTMLCanvasElement) => {
    const ws = workspaceRef.current
    const availW = (ws?.clientWidth ?? window.innerWidth - 380) - 48
    const availH = (ws?.clientHeight ?? window.innerHeight - 120) - 48
    setZoom(Math.max(0.1, Math.min(3, availW / canvas.width, availH / canvas.height)))
  }, [])

  // Fit a new image once the workspace exists on screen (its size depends on the layout), and on resize.
  useEffect(() => {
    if (!base) return
    const refit = () => fitZoom(base)
    // oxlint-disable-next-line react(set-state-in-effect) -- zoom is derived from the measured workspace size
    refit()
    window.addEventListener('resize', refit)
    return () => window.removeEventListener('resize', refit)
  }, [base, fitZoom])

  const replaceImage = (canvas: HTMLCanvasElement) => {
    setBase(canvas)
    setCrop(null)
    setTool('select')
    regionHistory.reset([])
    setSelectedId(null)
    setOcr(IDLE_OCR)
  }

  const handleFile = async (file: File) => {
    if (unsaved && !window.confirm(LEAVE_WARNING)) return
    try {
      const canvas = await loadImageFile(file)
      setLoadError(null)
      setImageChanged(false)
      autoDetect.current = true
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
      replaceImage(canvas)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not open this file')
    }
  }

  // Opens a file chosen on the home page, once on mount (taking the file also clears it).
  useEffect(() => {
    const file = takePendingFile()
    if (file) void handleFile(file)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- mount-only; handleFile changes every render
  }, [])

  const markDownloaded = () => {
    setDownloadedRegions(regions)
    setImageChanged(false)
  }

  const openExample = async (example: Example) => {
    try {
      const blob = await fetch(example.before).then((r) => r.blob())
      await handleFile(new File([blob], `${example.id}.jpg`, { type: blob.type || 'image/jpeg' }))
    } catch {
      setLoadError('Could not load the example. Check your connection and try again.')
    }
  }

  // Warn before closing the tab or leaving through an in-app link while edits aren't downloaded.
  useEffect(() => {
    if (!unsaved) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    setLeaveGuard(() => window.confirm(LEAVE_WARNING))
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      setLeaveGuard(null)
    }
  }, [unsaved, setLeaveGuard])

  // Detect text automatically after a new image opens (not after rotate / crop of the same image).
  useEffect(() => {
    if (!base || !autoDetect.current) return
    autoDetect.current = false
    void handleDetect()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs when a new image is set; handleDetect changes every render
  }, [base])

  // Paste an image (Ctrl/⌘+V) anywhere except into a text field.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      void handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const handleRotate = (clockwise: boolean) => {
    if (!base) return
    if (regions.some((r) => r.edited) && !window.confirm('Rotating removes all boxes and edits. Continue?')) return
    replaceImage(rotateCanvas(base, clockwise))
    setImageChanged(true)
  }

  const handleDetect = async () => {
    if (!base) return
    setOcr({ running: true, message: 'Starting…', progress: 0, error: null })
    try {
      await loadWebFonts()
      // The AI finder runs alongside Tesseract and only adds words Tesseract missed (brush, script, tilted text).
      const [boxes, aiWords] = await Promise.all([
        detectText(base, lang, level, (_message, progress) => setOcr((s) => ({ ...s, message: 'Finding text…', progress }))),
        session.user ? aiDetectText(base).catch((err: unknown) => (err instanceof Error ? err : new Error(String(err)))) : Promise.resolve(null),
      ])
      const tesseractOnly = aiWords === null ? boxes.filter((b) => b.confidence >= GUEST_MIN_CONFIDENCE) : boxes
      const { kept, added } = !aiWords || aiWords instanceof Error ? { kept: tesseractOnly, added: [] } : mergeWithAi(boxes, aiWords)
      const detected = unifyBlockFonts(base, [
        ...kept.map((b) => createRegion(base, b.rect, b.text, 'ocr', b.confidence)),
        ...added.map((w) => createRegion(base, w.rect, w.text, 'ocr')),
      ])
      setRegions((prev) => [...prev.filter((r) => r.edited || r.source === 'manual'), ...detected])
      setSelectedId(null)
      const aiNote = aiWords instanceof Error ? `${aiWords.message} Brush or script text may be missing.` : null
      setOcr({ ...IDLE_OCR, error: detected.length === 0 ? 'No text found. Try rotating the image upright, or draw a box with “+ Box”.' : aiNote })
      if (!session.user && detected.length > 0 && !guestTipShown.current) {
        guestTipShown.current = true
        toast.notify('info', 'Missing some text? Sign in to also find brush, script and tilted lettering with AI.')
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setOcr({ ...IDLE_OCR, error: `Text detection failed: ${reason}. It needs internet the first time to download language data.` })
    }
  }

  const updateRegion = useCallback((id: string, patch: RegionPatch, markEdited = true) => {
    setRegions(
      (prev) =>
      prev.map((r) =>
        r.id !== id
          ? r
          : {
              ...r,
              text: patch.text ?? r.text,
              rect: patch.rect ?? r.rect,
              style: { ...r.style, ...patch.style },
              edited: markEdited || r.edited,
              aiPatch: patch.text !== undefined || patch.rect ? null : r.aiPatch,
            },
      ),
      `region:${id}`,
    )
  }, [setRegions])

  const deleteRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [setRegions])

  const handleDrawRect = (rect: Rect) => {
    if (!base) return
    const region = createRegion(base, rect, '', 'manual')
    setRegions((prev) => [...prev, region])
    setSelectedId(region.id)
    setTool('select')
  }

  const handleResample = () => {
    if (!base || !selected) return
    const { bg, ink } = sampleColors(base, selected.rect)
    updateRegion(selected.id, { style: { color: ink, bgColor: bg } })
  }

  const handleAutoSize = () => {
    if (!selected) return
    const { style, rect } = selected
    const fontSize = estimateFontSize(selected.originalText || selected.text, style.fontFamily, style.fontWeight, uprightRect(rect, style.rotation).h)
    updateRegion(selected.id, { style: { fontSize } })
  }

  const handleAiEdit = async () => {
    if (!base || !selected) return
    if (!session.user) {
      toast.notify('info', `Create a free account to use AI exact match. You get ${publicConfig.signupCredits} free edits.`)
      // Continue this edit as soon as the account exists.
      setDialog('signup', () => aiEditRef.current())
      return
    }
    if (session.user.credits < publicConfig.aiEditCost) {
      setDialog('credits')
      return
    }
    const target = selected
    setAi({ regionId: target.id, running: true, error: null })
    try {
      const { patch: aiPatch, credits } = await aiReplaceText(base, target)
      session.setCredits(credits)
      // Skip if the user changed the text or moved the box while the AI was working.
      setRegions((prev) =>
        prev.map((r) => (r.id === target.id && r.text === target.text && r.rect === target.rect ? { ...r, aiPatch, edited: true } : r)),
      )
      setAi(IDLE_AI)
      toast.notify('success', `AI edit done. ${credits} credit${credits === 1 ? '' : 's'} left.`)
    } catch (err) {
      if (err instanceof AiDraftRejectedError && err.credits !== null) session.setCredits(err.credits)
      if (err instanceof ApiError && err.code === 'insufficient_credits') setDialog('credits')
      if (err instanceof ApiError && err.code === 'unauthorized') setDialog('signin')
      setAi({ regionId: target.id, running: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const aiEditRef = useRef(handleAiEdit)
  useEffect(() => {
    aiEditRef.current = handleAiEdit
  })

  const handleReset = () => {
    if (!selected) return
    setRegions((prev) => prev.map((r) => (r.id === selected.id ? resetRegion(r) : r)))
  }

  const changeTool = (next: Tool) => {
    if (!base) return
    if (next === 'crop') {
      setSelectedId(null)
      setCrop((c) => c ?? initialCrop())
    }
    setTool(next)
  }

  const handleCropChange = (patch: Partial<CropState>) => {
    if (!base) return
    setCrop((c) => (c ? updateCrop(c, patch, base.width, base.height) : c))
  }

  const handleApplyCrop = () => {
    if (!base || !crop || !cropBounds(crop)) return
    const hasEdits = regions.some((r) => r.edited)
    if (hasEdits && !window.confirm('Cropping saves your text edits into the image and removes all boxes. Continue?')) return
    // Crop the edited picture, so text edits are kept as pixels.
    const composite = createCanvas(base.width, base.height)
    renderComposite(composite, base, regions)
    const cropped = applyCrop(composite, crop)
    if (cropped) {
      replaceImage(cropped)
      setImageChanged(true)
    }
  }

  const handleCancelCrop = () => {
    setCrop(null)
    setTool('select')
  }

  const handleClearBoxes = () => {
    if (regions.some((r) => r.edited) && !window.confirm('Remove all boxes, including your edits?')) return
    setRegions(() => [])
    setSelectedId(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!base || isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) regionHistory.redo()
        else regionHistory.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        regionHistory.redo()
        return
      }
      if (mod) return
      if (tool === 'crop') {
        if (e.key === 'Escape') handleCancelCrop()
        if (e.key === 'Enter') {
          if (crop?.shape === 'polygon' && !crop.closed) handleCropChange({ closed: crop.points.length >= 3 })
          else handleApplyCrop()
        }
        if (e.key === 'v') changeTool('select')
        return
      }
      if (e.key === 'Escape') setSelectedId(null)
      if (e.key === 'v') setTool('select')
      if (e.key === 'b') setTool('draw')
      if (e.key === 'c') changeTool('crop')
      if (!selected) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteRegion(selected.id)
      }
      const step = e.shiftKey ? 10 : 1
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const delta = nudge[e.key]
      if (delta) {
        e.preventDefault()
        updateRegion(selected.id, { style: { offsetX: selected.style.offsetX + delta[0], offsetY: selected.style.offsetY + delta[1] } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const accountBar = (
    <AccountBar
      user={session.user}
      loading={session.loading}
      onSignIn={() => setDialog('signin')}
      onSignUp={() => setDialog('signup')}
      onBuy={() => setDialog('credits')}
      onHistory={() => setDialog('history')}
      onSignOut={() => session.signOut().then(() => toast.notify('info', 'Signed out.')).catch(() => undefined)}
    />
  )

  if (!base) {
    return (
      <div className="app app--empty">
        <header className="empty-header">
          <AppLink href="/" className="brand">Image <span>Text</span> Editor</AppLink>
          {accountBar}
        </header>
        <UploadDropzone onFile={handleFile} error={loadError} examples={EXAMPLES} onExample={openExample} />
      </div>
    )
  }

  return (
    <div className="app">
      <Toolbar
        lang={lang}
        ocr={ocr}
        tool={tool}
        editedCount={regions.filter((r) => r.edited).length}
        onLangChange={setLang}
        onUpload={handleFile}
        onRotate={handleRotate}
        onDetect={handleDetect}
        onToolChange={changeTool}
        onDownload={() => {
          exportPng(base, regions, `${fileName}-edited.png`)
          markDownloaded()
        }}
        onDownloadPdf={() => {
          exportPdf(base, regions, `${fileName}-edited.pdf`)
          markDownloaded()
        }}
        canUndo={regionHistory.canUndo}
        canRedo={regionHistory.canRedo}
        onUndo={regionHistory.undo}
        onRedo={regionHistory.redo}
        account={accountBar}
      />
      <div className="layout">
        <div className="workspace-wrap" style={{ '--image-aspect': base.height / base.width } as CSSProperties}>
          <main ref={workspaceRef} className="workspace">
            <EditorCanvas
              base={base}
              regions={regions}
              selectedId={selectedId}
              tool={tool}
              showBoxes={showBoxes}
              showOriginal={showOriginal}
              zoom={zoom}
              crop={crop ?? initialCrop()}
              onCropChange={handleCropChange}
              onSelect={setSelectedId}
              onDrawRect={handleDrawRect}
              onMoveRect={(id, rect) => updateRegion(id, { rect }, false)}
            />
          </main>
          <CanvasControls
            zoom={zoom}
            showBoxes={showBoxes}
            onZoomChange={setZoom}
            onFit={() => fitZoom(base)}
            onShowBoxesChange={setShowBoxes}
            onCompare={setShowOriginal}
          />
        </div>
        <aside className="sidebar">
          {tool === 'crop' && crop ? (
            <CropPanel
              crop={crop}
              bounds={cropBounds(crop)}
              onChange={handleCropChange}
              onApply={handleApplyCrop}
              onReset={() => setCrop(initialCrop())}
              onCancel={handleCancelCrop}
            />
          ) : selected ? (
            <RegionInspector
              key={selected.id}
              region={selected}
              ai={ai.regionId === selected.id ? ai : IDLE_AI}
              aiCost={publicConfig.aiEditCost}
              signedIn={!!session.user}
              onChange={(patch) => updateRegion(selected.id, patch)}
              onAiEdit={handleAiEdit}
              onResample={handleResample}
              onAutoSize={handleAutoSize}
              onReset={handleReset}
              onDelete={() => deleteRegion(selected.id)}
            />
          ) : (
            <PanelSection title="How to edit">
              <ol className="steps">
                <li>Text is found automatically. Sideways photo? Rotate it first.</li>
                <li>Click a box (or pick a line below) and type the new words. They're drawn in a matching font.</li>
                <li>For a pixel-perfect result, use <strong>AI exact match</strong> ({publicConfig.aiEditCost} credit per edit).</li>
                <li>Text missed? Use <strong>+ Box</strong> and drag over it.</li>
                <li>Press <strong>Hold to compare</strong> under the image, then <strong>Download</strong> (PNG) or PDF.</li>
              </ol>
              <p className="muted small">Shortcuts: Ctrl/⌘+Z undo · Ctrl/⌘+Shift+Z redo · Ctrl/⌘+V paste an image</p>
            </PanelSection>
          )}
          <RegionList regions={regions} selectedId={selectedId} level={level} onSelect={setSelectedId} onLevelChange={setLevel} onClearAll={handleClearBoxes} />
        </aside>
      </div>
    </div>
  )
}
