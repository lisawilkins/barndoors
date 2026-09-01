import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, TextAreaField, SelectField } from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../lib/AuthContext'
import { optimizeImageForUpload } from '../lib/optimizeImageForUpload'
import {
  WEEKDAYS,
  blankTurnoutRow,
  loadTurnoutRowsForHead,
  saveTurnoutScheduleForHead,
} from '../lib/turnoutSchedule'
import { supabase } from '../lib/supabaseClient'

const BLANK = {
  name: '',
  species: '',
  breed: '',
  sex: '',
  birth_date: '',
  status: 'active',
  acquired_date: '',
  feed_notes: '',
  turnout_notes: '',
  notes: '',
}

const NEW_FEED_ITEM_VALUE = '__new__'

function blankFeedRow() {
  return {
    key: crypto.randomUUID(),
    id: null,
    feed_item_id: '',
    amount_flakes: '',
    amount_lbs: '',
    amount: '',
    unit: 'cup',
    new_feed_name: '',
    new_feed_dual_unit: false,
  }
}

// One-open-at-a-time collapsible section, matching the Herd edit mockup.
// The open section gets an emphasized (ink) border; closed ones stay muted.
function EditSection({ title, summary, isOpen, onToggle, children }) {
  return (
    <div
      className={`overflow-hidden rounded-md border bg-white ${
        isOpen ? 'border-ink-900' : 'border-border-card'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3.5 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold text-ink-900">{title}</span>
          {summary && <span className="text-sm text-ink-400">{summary}</span>}
        </span>
        <span className="material-symbols-outlined text-[16px] text-ink-300">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && <div className="flex flex-col gap-3.5 px-3.5 pb-4">{children}</div>}
    </div>
  )
}

export default function HerdForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [form, setForm] = useState(BLANK)
  const [feedItems, setFeedItems] = useState([])
  const [feedRows, setFeedRows] = useState([])
  const [removedFeedRowIds, setRemovedFeedRowIds] = useState([])
  const [showFeedTypeManager, setShowFeedTypeManager] = useState(false)
  const [allFeedItems, setAllFeedItems] = useState([])
  const [feedTypeManagerLoading, setFeedTypeManagerLoading] = useState(false)
  const [feedTypeManagerError, setFeedTypeManagerError] = useState('')
  const [turnoutLocations, setTurnoutLocations] = useState([])
  const [otherHeads, setOtherHeads] = useState([])
  const [turnoutRows, setTurnoutRows] = useState([])
  const [existingPhoto, setExistingPhoto] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openSection, setOpenSection] = useState(isEdit ? null : 'basics')
  const [openBuddyRow, setOpenBuddyRow] = useState(null)
  const [buddyFilter, setBuddyFilter] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const initialStatusRef = useRef('active')

  function toggleSection(name) {
    setOpenSection((current) => (current === name ? null : name))
  }

  function toggleBuddyPicker(key) {
    setOpenBuddyRow((current) => (current === key ? null : key))
    setBuddyFilter('')
  }

  useEffect(() => {
    let active = true

    async function load() {
      const [feedItemsResult, locationsResult, headsResult, headResult, feedPlanResult, photoResult] =
        await Promise.all([
        supabase.from('feed_items').select('id, name, dual_unit').eq('active', true).order('name'),
        supabase.from('turnout_locations').select('id, name').eq('active', true).order('name'),
        supabase.from('head').select('id, name').eq('status', 'active').order('name'),
        isEdit ? supabase.from('head').select('*').eq('id', id).single() : Promise.resolve({}),
        isEdit
          ? supabase.from('head_feed_plan').select('*').eq('head_id', id)
          : Promise.resolve({ data: [] }),
        isEdit
          ? supabase
              .from('head_photos')
              .select('id, photo_url')
              .eq('head_id', id)
              .order('uploaded_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (!active) return

      if (feedItemsResult.error) {
        setError(feedItemsResult.error.message)
      } else {
        setFeedItems(feedItemsResult.data)
      }

      if (locationsResult.error) {
        setError(locationsResult.error.message)
      } else {
        setTurnoutLocations(locationsResult.data)
      }

      if (headsResult.error) {
        setError(headsResult.error.message)
      } else {
        setOtherHeads((headsResult.data ?? []).filter((animal) => animal.id !== id))
      }

      if (isEdit) {
        if (headResult.error) {
          setError(headResult.error.message)
        } else if (headResult.data) {
          setForm({ ...BLANK, ...headResult.data })
          initialStatusRef.current = headResult.data.status
        }

        if (feedPlanResult.error) {
          setError(feedPlanResult.error.message)
        } else {
          setFeedRows(
            (feedPlanResult.data ?? []).map((row) => ({
              key: row.id,
              id: row.id,
              feed_item_id: row.feed_item_id,
              amount_flakes: row.amount_flakes ?? '',
              amount_lbs: row.amount_lbs ?? '',
              amount: row.amount ?? '',
              unit: row.unit ?? 'cup',
            })),
          )
        }

        if (photoResult.error) {
          setError(photoResult.error.message)
        } else if (photoResult.data) {
          setExistingPhoto(photoResult.data)
        }

        const turnoutResult = await loadTurnoutRowsForHead(supabase, id)
        if (!active) return
        if (turnoutResult.error) {
          setError(turnoutResult.error.message)
        } else {
          setTurnoutRows(turnoutResult.rows)
        }
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [id, isEdit])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateFeedRow(key, field, value) {
    setFeedRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    )
  }

  function addFeedRow() {
    setFeedRows((current) => [...current, blankFeedRow()])
  }

  function removeFeedRow(key) {
    setFeedRows((current) => {
      const row = current.find((item) => item.key === key)
      if (row?.id) {
        setRemovedFeedRowIds((ids) => [...ids, row.id])
      }
      return current.filter((item) => item.key !== key)
    })
  }

  async function loadAllFeedItems() {
    setFeedTypeManagerLoading(true)
    setFeedTypeManagerError('')

    const { data, error: loadError } = await supabase
      .from('feed_items')
      .select('id, name, dual_unit, active')
      .order('name')

    if (loadError) {
      setFeedTypeManagerError(loadError.message)
    } else {
      setAllFeedItems(data ?? [])
    }

    setFeedTypeManagerLoading(false)
  }

  async function handleToggleFeedTypeManager() {
    const opening = !showFeedTypeManager
    setShowFeedTypeManager(opening)
    if (opening) {
      await loadAllFeedItems()
    }
  }

  async function toggleFeedItemActive(item) {
    const { error: updateError } = await supabase
      .from('feed_items')
      .update({ active: !item.active })
      .eq('id', item.id)

    if (updateError) {
      setFeedTypeManagerError(updateError.message)
      return
    }

    setAllFeedItems((current) =>
      current.map((existing) =>
        existing.id === item.id ? { ...existing, active: !existing.active } : existing,
      ),
    )

    setFeedItems((current) => {
      if (item.active) {
        return current.filter((existing) => existing.id !== item.id)
      }
      if (current.some((existing) => existing.id === item.id)) return current
      return [...current, { id: item.id, name: item.name, dual_unit: item.dual_unit }].sort(
        (a, b) => a.name.localeCompare(b.name),
      )
    })
  }

  function updateTurnoutRow(key, field, value) {
    setTurnoutRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    )
  }

  function toggleTurnoutDay(key, day) {
    setTurnoutRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        const days = row.days.includes(day)
          ? row.days.filter((value) => value !== day)
          : [...row.days, day]
        return { ...row, days }
      }),
    )
  }

  function toggleTurnoutBuddy(key, buddyId) {
    setTurnoutRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        const buddyIds = row.buddy_ids.includes(buddyId)
          ? row.buddy_ids.filter((value) => value !== buddyId)
          : [...row.buddy_ids, buddyId]
        return { ...row, buddy_ids: buddyIds }
      }),
    )
  }

  function addTurnoutRow() {
    setTurnoutRows((current) => [...current, blankTurnoutRow()])
  }

  function removeTurnoutRow(key) {
    setTurnoutRows((current) => current.filter((row) => row.key !== key))
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setPhotoProcessing(true)
    setError('')

    try {
      const optimized = await optimizeImageForUpload(file)
      setPhotoPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(optimized)
      })
      setPhotoFile(optimized)
      setRemovePhoto(false)
    } catch (photoError) {
      setError(photoError.message || 'Could not process that image.')
    } finally {
      setPhotoProcessing(false)
      event.target.value = ''
    }
  }

  function handleRemovePhoto() {
    setPhotoFile(null)
    setPhotoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
    setRemovePhoto(true)
  }

  function storagePathFromUrl(url) {
    const marker = '/head-photos/'
    const index = url.indexOf(marker)
    return index === -1 ? null : url.slice(index + marker.length)
  }

  function isArchiving() {
    return isEdit && initialStatusRef.current !== 'archived' && form.status === 'archived'
  }

  function handleFormSubmit(event) {
    event.preventDefault()
    if (isArchiving()) {
      setConfirmingArchive(true)
      return
    }
    performSave()
  }

  async function performSave() {
    setConfirmingArchive(false)
    setSaving(true)
    setError('')

    const payload = {
      ...form,
      birth_date: form.birth_date || null,
      acquired_date: form.acquired_date || null,
    }

    let headId = id

    if (isEdit) {
      const { error: saveError } = await supabase.from('head').update(payload).eq('id', id)
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
    } else {
      const { data: inserted, error: saveError } = await supabase
        .from('head')
        .insert(payload)
        .select('id')
        .single()
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
      headId = inserted.id
    }

    const feedPlanRequests = []

    for (const row of feedRows) {
      if (!row.feed_item_id) continue

      let feedItemId = row.feed_item_id
      let dualUnit

      if (feedItemId === NEW_FEED_ITEM_VALUE) {
        const name = row.new_feed_name.trim()
        if (!name) {
          setError('Enter a name for the new feed type.')
          setSaving(false)
          return
        }

        const { data: newItem, error: newItemError } = await supabase
          .from('feed_items')
          .insert({ name, dual_unit: row.new_feed_dual_unit })
          .select('id, name, dual_unit')
          .single()

        if (newItemError) {
          setError(newItemError.message)
          setSaving(false)
          return
        }

        feedItemId = newItem.id
        dualUnit = newItem.dual_unit
        setFeedItems((current) =>
          [...current, newItem].sort((a, b) => a.name.localeCompare(b.name)),
        )
      } else {
        dualUnit = feedItems.find((item) => item.id === feedItemId)?.dual_unit
      }

      const feedPayload = {
        head_id: headId,
        feed_item_id: feedItemId,
        amount_flakes: dualUnit && row.amount_flakes !== '' ? Number(row.amount_flakes) : null,
        amount_lbs: dualUnit && row.amount_lbs !== '' ? Number(row.amount_lbs) : null,
        amount: !dualUnit && row.amount !== '' ? Number(row.amount) : null,
        unit: !dualUnit ? row.unit : null,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      }

      feedPlanRequests.push(
        row.id
          ? supabase.from('head_feed_plan').update(feedPayload).eq('id', row.id)
          : supabase.from('head_feed_plan').insert(feedPayload),
      )
    }

    for (const rowId of removedFeedRowIds) {
      feedPlanRequests.push(supabase.from('head_feed_plan').delete().eq('id', rowId))
    }

    const feedResults = await Promise.all(feedPlanRequests)

    const feedError = feedResults.find((result) => result.error)
    if (feedError) {
      setError(feedError.error.message)
      setSaving(false)
      return
    }

    if (photoFile) {
      const path = `${headId}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('head-photos')
        .upload(path, photoFile, { upsert: true })

      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }

      if (existingPhoto?.photo_url) {
        const oldPath = storagePathFromUrl(existingPhoto.photo_url)
        if (oldPath) await supabase.storage.from('head-photos').remove([oldPath])
      }

      const { data: publicUrlData } = supabase.storage.from('head-photos').getPublicUrl(path)
      const photoPayload = {
        head_id: headId,
        photo_url: publicUrlData.publicUrl,
        uploaded_by: profile?.id ?? null,
        uploaded_at: new Date().toISOString(),
      }

      const { error: photoSaveError } = existingPhoto
        ? await supabase.from('head_photos').update(photoPayload).eq('id', existingPhoto.id)
        : await supabase.from('head_photos').insert(photoPayload)

      if (photoSaveError) {
        setError(photoSaveError.message)
        setSaving(false)
        return
      }
    } else if (removePhoto && existingPhoto) {
      const oldPath = storagePathFromUrl(existingPhoto.photo_url)
      if (oldPath) await supabase.storage.from('head-photos').remove([oldPath])
      const { error: deleteError } = await supabase
        .from('head_photos')
        .delete()
        .eq('id', existingPhoto.id)
      if (deleteError) {
        setError(deleteError.message)
        setSaving(false)
        return
      }
    }

    const turnoutError = await saveTurnoutScheduleForHead(
      supabase,
      headId,
      turnoutRows,
      profile?.id ?? null,
    )
    if (turnoutError) {
      setError(turnoutError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    navigate(isEdit ? `/herd/${headId}` : '/herd')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-canvas">
        <TopNav backTo="/herd" backLabel="Herd" />
        <p className="px-4 py-6 text-[15px] text-ink-400">Loading…</p>
      </div>
    )
  }

  const dayButtonClass = (selected) =>
    `flex h-10 min-w-10 items-center justify-center rounded-sm border text-[13px] font-bold ${
      selected
        ? 'border-accent-bright bg-accent-bright text-white'
        : 'border-border-input bg-white text-ink-600'
    }`

  const feedNames = feedRows
    .map((row) => feedItems.find((item) => item.id === row.feed_item_id)?.name)
    .filter(Boolean)
  const feedSummary =
    feedRows.length === 0
      ? 'No feed items yet'
      : `${feedRows.length} item${feedRows.length === 1 ? '' : 's'}${
          feedNames.length ? ` · ${feedNames.slice(0, 3).join(', ')}${feedNames.length > 3 ? ` +${feedNames.length - 3}` : ''}` : ''
        }`

  const firstTurnout = turnoutRows[0]
  const turnoutLocationName = turnoutLocations.find(
    (location) => location.id === firstTurnout?.location_id,
  )?.name
  const turnoutSummary =
    turnoutRows.length === 0
      ? 'No turnout schedule yet'
      : [turnoutLocationName, turnoutRows.length > 1 ? `+${turnoutRows.length - 1} more` : null]
          .filter(Boolean)
          .join(' · ') || `${turnoutRows.length} schedule row(s)`

  const basicsSummary = [form.name, form.sex, form.breed, form.birth_date].filter(Boolean).join(' · ') || 'Not filled in yet'

  const photoSummary = photoFile || (existingPhoto && !removePhoto) ? '1 photo on file' : 'No photo yet'

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav backTo="/herd" backLabel="Herd" />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-light text-ink-900">
          {isEdit ? (
            <>
              Edit: <span className="font-body font-bold text-accent-bright">{form.name || 'animal'}</span>
            </>
          ) : (
            'Add animal'
          )}
        </h1>

        <form onSubmit={handleFormSubmit} className="flex flex-col gap-3.5">
          <EditSection
            title="Feed plan"
            summary={feedSummary}
            isOpen={openSection === 'feed'}
            onToggle={() => toggleSection('feed')}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-ink-400">Feed items</span>
              <button
                type="button"
                onClick={handleToggleFeedTypeManager}
                className="text-sm font-medium text-ink-400 underline active:text-ink-900"
              >
                Manage feed types
              </button>
            </div>

            {showFeedTypeManager && (
              <div className="flex flex-col gap-3 rounded-md border border-border-card bg-surface-canvas p-3">
                {feedTypeManagerLoading ? (
                  <p className="text-[15px] text-ink-400">Loading feed types…</p>
                ) : (
                  <>
                    {feedTypeManagerError && (
                      <p className="text-[15px] text-red-600">{feedTypeManagerError}</p>
                    )}
                    {allFeedItems.length === 0 && !feedTypeManagerError && (
                      <p className="text-[15px] text-ink-400">No feed types yet.</p>
                    )}
                    {allFeedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-b border-border-hairline pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-col">
                          <span className="text-[15px] font-medium text-ink-900">{item.name}</span>
                          <span className="text-sm text-ink-400">
                            {item.dual_unit ? 'Flakes + lbs' : 'Amount + unit'} ·{' '}
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFeedItemActive(item)}
                          className="flex h-10 items-center justify-center rounded-md border border-border-input px-3 text-[14px] font-medium text-ink-600 active:bg-white"
                        >
                          {item.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {feedRows.length === 0 && <p className="text-[15px] text-ink-400">No feed items yet.</p>}

            {feedRows.length > 0 && (
              <div className="grid grid-cols-[1fr_60px_72px_28px] gap-2 border-b border-border-hairline pb-1.5">
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-300">Item</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-300">Amt</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-300">Unit</span>
                <span />
              </div>
            )}

            {feedRows.map((row) => {
              const isNewFeedType = row.feed_item_id === NEW_FEED_ITEM_VALUE
              const dualUnit = isNewFeedType
                ? row.new_feed_dual_unit
                : feedItems.find((item) => item.id === row.feed_item_id)?.dual_unit

              return (
                <div key={row.key} className="flex flex-col gap-2 border-b border-border-hairline-2 py-1.5">
                  <div className="grid grid-cols-[1fr_60px_72px_28px] items-center gap-2">
                    <select
                      aria-label="Feed item"
                      value={row.feed_item_id}
                      onChange={(event) => updateFeedRow(row.key, 'feed_item_id', event.target.value)}
                      className="min-w-0 truncate rounded-md border-0 bg-transparent p-0 text-[15px] font-semibold text-ink-900 focus:outline-none"
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {feedItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                      <option value={NEW_FEED_ITEM_VALUE}>+ Add new feed type…</option>
                    </select>

                    {dualUnit ? (
                      <input
                        aria-label="Flakes"
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="flakes"
                        value={row.amount_flakes}
                        onChange={(event) => updateFeedRow(row.key, 'amount_flakes', event.target.value)}
                        className="h-[38px] w-full rounded-md border border-border-input bg-surface-input text-center text-[15px] text-ink-900"
                      />
                    ) : (
                      <input
                        aria-label="Amount"
                        type="number"
                        min="0"
                        step="0.25"
                        value={row.amount}
                        onChange={(event) => updateFeedRow(row.key, 'amount', event.target.value)}
                        className="h-[38px] w-full rounded-md border border-border-input bg-surface-input text-center text-[15px] text-ink-900"
                      />
                    )}

                    {dualUnit ? (
                      <input
                        aria-label="Lbs"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="lbs"
                        value={row.amount_lbs}
                        onChange={(event) => updateFeedRow(row.key, 'amount_lbs', event.target.value)}
                        className="h-[38px] w-full rounded-md border border-border-input bg-surface-input text-center text-[15px] text-ink-900"
                      />
                    ) : (
                      <select
                        aria-label="Unit"
                        value={row.unit}
                        onChange={(event) => updateFeedRow(row.key, 'unit', event.target.value)}
                        className="h-[38px] w-full rounded-md border border-border-input bg-surface-input px-1 text-[13px] text-ink-900"
                      >
                        <option value="cup">cup</option>
                        <option value="scoop">scoop</option>
                        <option value="handful">handful</option>
                        <option value="lbs">lbs</option>
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFeedRow(row.key)}
                      aria-label="Remove feed row"
                      className="flex h-[38px] w-full items-center justify-center text-ink-200 active:text-ink-400"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  {isNewFeedType && (
                    <div className="flex flex-col gap-3 pt-1">
                      <TextField
                        label="New feed type name"
                        value={row.new_feed_name}
                        onChange={(event) =>
                          updateFeedRow(row.key, 'new_feed_name', event.target.value)
                        }
                      />
                      <SelectField
                        label="Measured as"
                        value={row.new_feed_dual_unit ? 'dual' : 'single'}
                        onChange={(event) =>
                          updateFeedRow(row.key, 'new_feed_dual_unit', event.target.value === 'dual')
                        }
                      >
                        <option value="single">Amount + unit (e.g. 2 cups)</option>
                        <option value="dual">Flakes + lbs</option>
                      </SelectField>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addFeedRow}
                className="text-[14px] font-semibold text-accent-bright active:opacity-70"
              >
                + Add feed row
              </button>
            </div>

            <TextAreaField
              label="Feed notes"
              value={form.feed_notes ?? ''}
              onChange={(event) => update('feed_notes', event.target.value)}
            />
          </EditSection>

          <EditSection
            title="Turnout"
            summary={turnoutSummary}
            isOpen={openSection === 'turnout'}
            onToggle={() => toggleSection('turnout')}
          >
            {turnoutRows.length === 0 && (
              <p className="text-[15px] text-ink-400">No turnout schedule yet.</p>
            )}

            {turnoutRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col gap-3 rounded-md border border-border-divider bg-surface-canvas p-3"
              >
                <div className="flex items-center gap-2">
                  <SelectField
                    label="Location"
                    className="flex-1"
                    value={row.location_id}
                    onChange={(event) =>
                      updateTurnoutRow(row.key, 'location_id', event.target.value)
                    }
                  >
                    <option value="" disabled>
                      Select a location
                    </option>
                    {turnoutLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    onClick={() => removeTurnoutRow(row.key)}
                    aria-label="Remove turnout row"
                    className="mb-[1px] flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-border-input bg-white text-ink-300 active:bg-surface-canvas"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-ink-400">Days</span>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((day) => {
                      const selected = row.days.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleTurnoutDay(row.key, day.value)}
                          className={dayButtonClass(selected)}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-ink-400">Buddies</span>

                  {otherHeads.length === 0 ? (
                    <p className="text-[15px] text-ink-400">No other animals to add yet.</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleBuddyPicker(row.key)}
                        className="flex min-h-12 items-center justify-between gap-2 rounded-md border border-border-input bg-white px-2.5 py-1.5"
                      >
                        <span className="flex flex-1 flex-wrap gap-1.5">
                          {row.buddy_ids.length === 0 ? (
                            <span className="text-[15px] text-ink-300">Select buddies</span>
                          ) : (
                            row.buddy_ids.map((buddyId) => {
                              const buddy = otherHeads.find((animal) => animal.id === buddyId)
                              return (
                                <span
                                  key={buddyId}
                                  className="flex h-[30px] items-center gap-1.5 rounded-full bg-chip-bg px-2.5 text-[13px] font-semibold text-chip-fg"
                                >
                                  {buddy?.name || 'Unnamed'}
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Remove ${buddy?.name || 'buddy'}`}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleTurnoutBuddy(row.key, buddyId)
                                    }}
                                    className="material-symbols-outlined text-[14px] text-placeholder-tan-1"
                                  >
                                    close
                                  </span>
                                </span>
                              )
                            })
                          )}
                        </span>
                        <span className="material-symbols-outlined flex-shrink-0 text-[16px] text-ink-300">
                          expand_more
                        </span>
                      </button>

                      {openBuddyRow === row.key && (
                        <div className="overflow-hidden rounded-md border border-border-input bg-white shadow-card">
                          <div className="flex items-center gap-2 border-b border-border-hairline px-2.5 py-2">
                            <span className="material-symbols-outlined text-[16px] text-ink-300">search</span>
                            <input
                              type="text"
                              autoFocus
                              value={buddyFilter}
                              onChange={(event) => setBuddyFilter(event.target.value)}
                              placeholder="Filter animals"
                              className="flex-1 border-0 bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-300"
                            />
                          </div>
                          <div className="fscroll max-h-44 overflow-auto">
                            {otherHeads
                              .filter((animal) =>
                                (animal.name || '').toLowerCase().includes(buddyFilter.toLowerCase()),
                              )
                              .map((animal) => {
                                const selected = row.buddy_ids.includes(animal.id)
                                return (
                                  <div
                                    key={animal.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleTurnoutBuddy(row.key, animal.id)}
                                    className="flex cursor-pointer items-center gap-2.5 border-b border-border-hairline-2 px-2.5 py-2 last:border-0"
                                  >
                                    <span
                                      className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                                        selected
                                          ? 'border-accent-bright bg-accent-bright'
                                          : 'border-ink-200 bg-white'
                                      }`}
                                    >
                                      {selected && (
                                        <span className="material-symbols-outlined text-[14px] text-white">
                                          check
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[15px] text-ink-900">
                                      {animal.name || 'Unnamed'}
                                    </span>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addTurnoutRow}
              className="self-start text-[14px] font-semibold text-accent-bright active:opacity-70"
            >
              + Add turnout group
            </button>

            <TextAreaField
              label="Turnout notes"
              value={form.turnout_notes ?? ''}
              onChange={(event) => update('turnout_notes', event.target.value)}
            />
          </EditSection>

          <EditSection
            title="Notes"
            summary={form.notes ? form.notes.slice(0, 60) : 'No notes yet'}
            isOpen={openSection === 'notes'}
            onToggle={() => toggleSection('notes')}
          >
            <TextAreaField
              label="General notes"
              value={form.notes ?? ''}
              onChange={(event) => update('notes', event.target.value)}
            />
          </EditSection>

          <EditSection
            title="Basics"
            summary={basicsSummary}
            isOpen={openSection === 'basics'}
            onToggle={() => toggleSection('basics')}
          >
            <TextField
              label="Name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
            <div className="flex gap-3">
              <TextField
                label="Sex"
                className="flex-1"
                value={form.sex}
                onChange={(event) => update('sex', event.target.value)}
              />
              <TextField
                label="Breed"
                className="flex-1"
                value={form.breed}
                onChange={(event) => update('breed', event.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <TextField
                label="Birth date"
                type="date"
                className="flex-1"
                value={form.birth_date ?? ''}
                onChange={(event) => update('birth_date', event.target.value)}
              />
              <TextField
                label="Acquired date"
                type="date"
                className="flex-1"
                value={form.acquired_date ?? ''}
                onChange={(event) => update('acquired_date', event.target.value)}
              />
            </div>
            <TextField
              label="Species"
              value={form.species}
              onChange={(event) => update('species', event.target.value)}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(event) => update('status', event.target.value)}
            >
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="deceased">Deceased</option>
              <option value="archived">Archived</option>
            </SelectField>
          </EditSection>

          <EditSection
            title="Photo"
            summary={photoSummary}
            isOpen={openSection === 'photo'}
            onToggle={() => toggleSection('photo')}
          >
            {(photoPreviewUrl || (existingPhoto && !removePhoto)) && (
              <img
                src={photoPreviewUrl || existingPhoto.photo_url}
                alt="Animal"
                className="h-32 w-full rounded-md object-cover"
              />
            )}

            <div className="flex gap-3">
              <label
                className={`flex h-12 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-medium text-ink-600 ${
                  photoProcessing ? 'cursor-wait opacity-50' : 'cursor-pointer active:bg-surface-canvas'
                }`}
              >
                {photoProcessing
                  ? 'Processing photo…'
                  : existingPhoto || photoFile
                    ? 'Replace'
                    : 'Add photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={photoProcessing}
                  className="hidden"
                />
              </label>
              {(photoFile || (existingPhoto && !removePhoto)) && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="flex h-12 items-center justify-center rounded-md border border-border-input bg-white px-4 text-[15px] font-medium text-ink-600 active:bg-surface-canvas"
                >
                  Remove
                </button>
              )}
            </div>
          </EditSection>

          {error && <p className="text-[15px] text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/herd/${id}` : '/herd')}
              className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[16px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 flex-1 items-center justify-center rounded-md bg-accent-bright text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </main>

      <ConfirmDialog
        open={confirmingArchive}
        title={`Archive ${form.name || 'this animal'}?`}
        message="They'll be hidden from the Herd list, but their record stays in the database — you can switch their status back anytime."
        confirmLabel="Archive"
        destructive={false}
        onConfirm={performSave}
        onCancel={() => setConfirmingArchive(false)}
      />
    </div>
  )
}
