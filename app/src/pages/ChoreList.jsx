import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import ChoreListRead from '../components/ChoreListRead'
import ChoreListEdit from '../components/ChoreListEdit'
import ChoreListPrint from '../components/ChoreListPrint'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchList, fetchListItems, saveListDetails, saveListItems } from '../lib/choreLists'
import { fromDbRows, restoreNodes, toSavePayload } from '../lib/choreOutline'
import { printableArea, usePageOrientation } from '../lib/pageSetup'

// One chore list, in whichever mode the reader is entitled to:
//
//   read    manager, before tapping Edit
//   edit    manager only — the live outline
//   worker  a hand: the same read layout plus tick boxes to keep their place
//   print   either role, a sheet to hang in the barn
//
// The prototype exposed all four as tabs so they could be compared; here the
// role picks between read and worker, and Edit/Print are actions.

const SAVE_DEBOUNCE_MS = 700

function SaveStatus({ status }) {
  const map = {
    saving: { dot: 'bg-[#E0A32E]', text: 'Saving…', color: 'text-gray-500' },
    saved: { dot: 'bg-green-600', text: 'All changes saved', color: 'text-gray-500' },
    error: { dot: 'bg-red-600', text: 'Not saved — check your connection', color: 'text-red-700' },
  }
  const state = map[status] ?? map.saved
  return (
    <span className={`flex items-center gap-2 text-[13px] ${state.color}`}>
      <span aria-hidden="true" className={`block h-[7px] w-[7px] rounded-full ${state.dot}`} />
      {state.text}
    </span>
  )
}

export default function ChoreList() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isManager } = useAuth()

  const [list, setList] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [nodes, setNodes] = useState([])
  // A freshly created list arrives as ?edit=1 so the manager lands on the
  // cursor rather than an empty read view.
  const [mode, setMode] = useState(searchParams.get('edit') ? 'edit' : 'read')
  // Hoisted above the hooks below, which depend on it — the loading/missing
  // early returns sit between here and where the rest of the view is derived.
  const isPrintMode = mode === 'print'
  const [checked, setChecked] = useState({})
  const [toast, setToast] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const saveTimer = useRef(null)
  const dirty = useRef(false)

  // Portrait by default: it's the shape most people have loaded, and a chore
  // list is a tall narrow thing. Landscape gives wider lines and two columns,
  // which cuts the page count on a long list.
  const [orientation, setOrientation] = useState('portrait')
  const previewRef = useRef(null)
  const sheetRef = useRef(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [sheetHeight, setSheetHeight] = useState(0)

  const sheet = printableArea(orientation)

  // Only takes effect while this page is mounted — index.css sets `landscape`
  // globally for the feed schedule report, which must keep it.
  usePageOrientation(isPrintMode ? orientation : null)

  // Shrink the true-size sheet to whatever width the screen has. Print resets
  // the transform, so this only affects the on-screen preview.
  useEffect(() => {
    if (!isPrintMode) return undefined

    function fit() {
      const available = previewRef.current?.clientWidth
      if (!available) return
      setPreviewScale(Math.min(1, available / sheet.width))
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [isPrintMode, sheet.width])

  // A CSS transform doesn't change layout, so the scaled-down preview would
  // otherwise reserve its full unscaled height and leave a long blank gap
  // beneath. Measuring the sheet — which may now be several pages tall — lets
  // the container collapse to what's actually visible.
  useEffect(() => {
    if (!isPrintMode) return
    setSheetHeight(sheetRef.current?.scrollHeight ?? 0)
  }, [isPrintMode, orientation, nodes, title, description, previewScale])

  useEffect(() => {
    let active = true

    async function load() {
      const [listResult, itemsResult] = await Promise.all([
        fetchList(listId),
        fetchListItems(listId),
      ])
      if (!active) return

      const firstError = listResult.error || itemsResult.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setList(listResult.data)
      setTitle(listResult.data.name ?? '')
      setDescription(listResult.data.description ?? '')
      setNodes(fromDbRows(itemsResult.data ?? []))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [listId])

  // Drop ?edit=1 once consumed, so a refresh or a shared link doesn't reopen
  // the editor unexpectedly.
  useEffect(() => {
    if (searchParams.get('edit')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const persist = useCallback(
    async (nextTitle, nextDescription, nextNodes) => {
      setSaveStatus('saving')
      const [detailsResult, itemsResult] = await Promise.all([
        saveListDetails(listId, { name: nextTitle, description: nextDescription }),
        saveListItems(listId, toSavePayload(nextNodes)),
      ])
      const failed = detailsResult.error || itemsResult.error
      setSaveStatus(failed ? 'error' : 'saved')
      if (failed) setError(failed.message)
      else {
        setError('')
        dirty.current = false
      }
    },
    [listId],
  )

  // Saves as you type, per the design's "Editing · saves as you type" header.
  // Debounced so a fast typist isn't issuing a write per keystroke.
  function queueSave(nextTitle, nextDescription, nextNodes) {
    dirty.current = true
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(
      () => persist(nextTitle, nextDescription, nextNodes),
      SAVE_DEBOUNCE_MS,
    )
  }

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  function handleTitleChange(value) {
    setTitle(value)
    queueSave(value, description, nodes)
  }

  function handleDescriptionChange(value) {
    setDescription(value)
    queueSave(title, value, nodes)
  }

  function handleNodesChange(next) {
    setNodes(next)
    queueSave(title, description, next)
  }

  function handleToast(message, undoPayload) {
    setToast({ message, undoPayload })
  }

  function handleUndo() {
    if (!toast?.undoPayload) return setToast(null)
    const { index, removed } = toast.undoPayload
    const next = restoreNodes(nodes, index, removed)
    setNodes(next)
    queueSave(title, description, next)
    setToast(null)
  }

  async function performDeleteList() {
    setConfirmingDelete(false)
    const { error: deleteError } = await supabase.from('chore_lists').delete().eq('id', listId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    navigate('/chores', { replace: true })
  }

  async function handleDone() {
    clearTimeout(saveTimer.current)
    if (dirty.current) await persist(title, description, nodes)
    setMode('read')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <TopNav backTo="/chores" backLabel="Chores" />
        <main className="mx-auto w-full max-w-[800px] p-4">
          <p className="text-lg text-gray-500">Loading…</p>
        </main>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <TopNav backTo="/chores" backLabel="Chores" />
        <main className="mx-auto flex w-full max-w-[800px] flex-col gap-3 p-4">
          <p className="text-lg text-red-600">{error || 'That list no longer exists.'}</p>
          <Link to="/chores" className="text-lg font-semibold text-accent-bright active:opacity-70">
            Back to chores
          </Link>
        </main>
      </div>
    )
  }

  const isEditing = mode === 'edit' && isManager
  const isPrint = isPrintMode
  const displayTitle = title.trim() || 'Untitled list'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="print:hidden">
        <TopNav backTo="/chores" backLabel="Chores" />
      </div>

      {error && !isEditing && (
        <p className="px-4 pt-3 text-lg text-red-600 print:hidden">{error}</p>
      )}

      {isEditing && (
        <div className="sticky top-0 z-10 border-b border-[#F0DDB0] bg-[#FEF7E7]">
          <div className="mx-auto flex w-full max-w-[800px] items-center justify-between px-4 py-2.5">
            <SaveStatus status={saveStatus} />
            <button
              type="button"
              onClick={handleDone}
              className="h-9 rounded-md bg-accent-bright px-[18px] text-[15px] font-semibold text-white active:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {isEditing ? (
        <ChoreListEdit
          title={title}
          description={description}
          nodes={nodes}
          onTitleChange={handleTitleChange}
          onDescriptionChange={handleDescriptionChange}
          onNodesChange={handleNodesChange}
          onDeleteList={() => setConfirmingDelete(true)}
          onToast={handleToast}
        />
      ) : isPrint ? (
        <main className="mx-auto flex w-full max-w-[800px] flex-col gap-3.5 p-4 print:max-w-none print:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5 print:hidden">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Print preview
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('read')}
                className="h-10 rounded-md border border-border-input px-3.5 text-[14.5px] text-ink-600 active:bg-surface-canvas"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 rounded-md bg-accent-bright px-4 text-[14.5px] font-semibold text-white active:opacity-90"
              >
                Print
              </button>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label="Page orientation"
            className="flex gap-1 self-start rounded-md bg-surface-canvas p-1 print:hidden"
          >
            {['portrait', 'landscape'].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={orientation === value}
                onClick={() => setOrientation(value)}
                className={`h-10 rounded-sm px-4 text-[14.5px] font-semibold capitalize ${
                  orientation === value
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-400 active:bg-white/60'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          {/* The sheet is rendered at true page size so the preview matches the
              printer. On screen it's scaled down to fit the viewport; the
              transform is dropped for print by .chore-sheet-preview. */}
          <div ref={previewRef} className="overflow-hidden print:overflow-visible">
            <div
              ref={sheetRef}
              className="chore-sheet-preview origin-top-left"
              style={{
                transform: `scale(${previewScale})`,
                height: previewScale < 1 && sheetHeight ? sheetHeight * previewScale : undefined,
              }}
            >
              <ChoreListPrint
                title={displayTitle}
                description={description}
                nodes={nodes}
                orientation={orientation}
              />
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-[800px] flex-col gap-3.5 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-[26px] font-bold leading-tight tracking-tight">
              {displayTitle}
            </h1>
            <div className="flex flex-shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setMode('print')}
                aria-label="Print this list"
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border-input text-[17px] text-ink-600 active:bg-surface-canvas"
              >
                ⎙
              </button>
              {isManager && (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="h-11 rounded-md bg-accent-bright px-[18px] text-base font-semibold text-white active:opacity-90"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {description.trim() ? (
            <p className="m-0 text-[15.5px] leading-relaxed text-gray-600">{description}</p>
          ) : (
            <p className="m-0 text-[15px] italic text-gray-400">No description</p>
          )}

          <ChoreListRead
            nodes={nodes}
            isWorker={!isManager}
            checked={checked}
            onToggleCheck={(id) => setChecked((c) => ({ ...c, [id]: !c[id] }))}
          />
        </main>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-[18px] rounded-[10px] bg-gray-900 px-4 py-[13px] shadow-[0_10px_30px_rgba(0,0,0,0.3)] print:hidden">
          <span className="text-[14.5px] text-white">{toast.message}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-[14.5px] font-semibold text-[#E0A32E]"
          >
            Undo
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${displayTitle}"?`}
        message="Are you sure? This can't be undone — once deleted, you can't get this list back."
        confirmLabel="Delete"
        destructive
        onConfirm={performDeleteList}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
