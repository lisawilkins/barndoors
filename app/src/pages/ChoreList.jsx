import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import ChoreListRead from '../components/ChoreListRead'
import ChoreListEdit from '../components/ChoreListEdit'
import ChoreListPrint from '../components/ChoreListPrint'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchList, fetchListItems, saveListDetails, saveListItems } from '../lib/choreLists'
import { fromDbRows, restoreNodes, toSavePayload } from '../lib/choreOutline'

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
  const [checked, setChecked] = useState({})
  const [toast, setToast] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const saveTimer = useRef(null)
  const dirty = useRef(false)

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

  async function handleDeleteList() {
    if (!window.confirm(`Delete "${title || 'this list'}" and everything on it?`)) return
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
        <TopNav />
        <main className="p-4">
          <p className="text-lg text-gray-500">Loading…</p>
        </main>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <TopNav />
        <main className="flex flex-col gap-3 p-4">
          <p className="text-lg text-red-600">{error || 'That list no longer exists.'}</p>
          <Link to="/chores" className="text-lg underline">
            Back to chores
          </Link>
        </main>
      </div>
    )
  }

  const isEditing = mode === 'edit' && isManager
  const isPrint = mode === 'print'
  const displayTitle = title.trim() || 'Untitled list'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="print:hidden">
        <TopNav />
      </div>

      {error && !isEditing && (
        <p className="px-4 pt-3 text-lg text-red-600 print:hidden">{error}</p>
      )}

      {isEditing && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F0DDB0] bg-[#FEF7E7] px-4 py-2.5">
          <SaveStatus status={saveStatus} />
          <button
            type="button"
            onClick={handleDone}
            className="h-9 rounded-lg bg-gray-900 px-[18px] text-[15px] font-semibold text-white active:bg-gray-700"
          >
            Done
          </button>
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
          onDeleteList={handleDeleteList}
          onToast={handleToast}
        />
      ) : isPrint ? (
        <main className="flex flex-col gap-3.5 p-4 print:p-0">
          <div className="flex items-center justify-between gap-2.5 print:hidden">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Print preview
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('read')}
                className="h-10 rounded-[9px] border border-gray-200 px-3.5 text-[14.5px] text-gray-700 active:bg-gray-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 rounded-[9px] bg-gray-900 px-4 text-[14.5px] font-semibold text-white active:bg-gray-700"
              >
                Print
              </button>
            </div>
          </div>
          <ChoreListPrint title={displayTitle} description={description} nodes={nodes} />
        </main>
      ) : (
        <main className="flex flex-col gap-3.5 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-[26px] font-bold leading-tight tracking-tight">
              {displayTitle}
            </h1>
            <div className="flex flex-shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setMode('print')}
                aria-label="Print this list"
                className="flex h-11 w-11 items-center justify-center rounded-[9px] border border-gray-200 text-[17px] text-gray-700 active:bg-gray-100"
              >
                ⎙
              </button>
              {isManager && (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="h-11 rounded-[9px] bg-gray-900 px-[18px] text-base font-semibold text-white active:bg-gray-700"
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
    </div>
  )
}
