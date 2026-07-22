import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, TextAreaField, SelectField } from '../components/FormField'
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

export default function HeardForm() {
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

  async function handleSubmit(event) {
    event.preventDefault()
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
    navigate(isEdit ? `/heard/${headId}` : '/heard')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <TopNav />
        <p className="px-4 py-6 text-lg text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold text-gray-900">
          {isEdit ? 'Edit animal' : 'Add animal'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
          />
          <TextField
            label="Sex"
            value={form.sex}
            onChange={(event) => update('sex', event.target.value)}
          />

          <div className="flex flex-col gap-3">
            <span className="text-lg font-medium text-gray-700">Photo</span>

            {(photoPreviewUrl || (existingPhoto && !removePhoto)) && (
              <img
                src={photoPreviewUrl || existingPhoto.photo_url}
                alt="Animal"
                className="h-48 w-full rounded-xl object-cover"
              />
            )}

            <div className="flex gap-3">
              <label
                className={`flex h-14 flex-1 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 ${
                  photoProcessing ? 'cursor-wait opacity-50' : 'cursor-pointer active:bg-gray-100'
                }`}
              >
                {photoProcessing
                  ? 'Processing photo…'
                  : existingPhoto || photoFile
                    ? 'Replace photo'
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
                  className="flex h-14 items-center justify-center rounded-lg border border-gray-300 px-4 text-lg font-medium text-gray-700 active:bg-gray-100"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-medium text-gray-700">Feed plan</span>
              <button
                type="button"
                onClick={handleToggleFeedTypeManager}
                className="text-lg font-medium text-gray-600 underline active:text-gray-900"
              >
                Manage feed types
              </button>
            </div>

            {showFeedTypeManager && (
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                {feedTypeManagerLoading ? (
                  <p className="text-lg text-gray-500">Loading feed types…</p>
                ) : (
                  <>
                    {feedTypeManagerError && (
                      <p className="text-lg text-red-600">{feedTypeManagerError}</p>
                    )}
                    {allFeedItems.length === 0 && !feedTypeManagerError && (
                      <p className="text-lg text-gray-500">No feed types yet.</p>
                    )}
                    {allFeedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-col">
                          <span className="text-lg font-medium text-gray-900">{item.name}</span>
                          <span className="text-base text-gray-500">
                            {item.dual_unit ? 'Flakes + lbs' : 'Amount + unit'} ·{' '}
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFeedItemActive(item)}
                          className="flex h-10 items-center justify-center rounded-lg border border-gray-300 px-3 text-lg font-medium text-gray-700 active:bg-gray-100"
                        >
                          {item.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {feedRows.length === 0 && (
              <p className="text-lg text-gray-500">No feed items yet.</p>
            )}

            {feedRows.map((row) => {
              const isNewFeedType = row.feed_item_id === NEW_FEED_ITEM_VALUE
              const dualUnit = isNewFeedType
                ? row.new_feed_dual_unit
                : feedItems.find((item) => item.id === row.feed_item_id)?.dual_unit

              return (
                <div
                  key={row.key}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex items-end gap-3">
                    <SelectField
                      label="Feed item"
                      className="flex-1"
                      value={row.feed_item_id}
                      onChange={(event) => updateFeedRow(row.key, 'feed_item_id', event.target.value)}
                    >
                      <option value="" disabled>
                        Select a feed item
                      </option>
                      {feedItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                      <option value={NEW_FEED_ITEM_VALUE}>+ Add new feed type…</option>
                    </SelectField>
                    <button
                      type="button"
                      onClick={() => removeFeedRow(row.key)}
                      className="flex h-14 items-center justify-center rounded-lg border border-gray-300 px-4 text-lg font-medium text-gray-700 active:bg-gray-100"
                    >
                      Remove
                    </button>
                  </div>

                  {isNewFeedType && (
                    <div className="flex flex-col gap-3">
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

                  {row.feed_item_id && dualUnit && (
                    <div className="flex gap-3">
                      <TextField
                        label="Flakes"
                        type="number"
                        min="0"
                        step="0.25"
                        className="flex-1"
                        value={row.amount_flakes}
                        onChange={(event) => updateFeedRow(row.key, 'amount_flakes', event.target.value)}
                      />
                      <TextField
                        label="Lbs"
                        type="number"
                        min="0"
                        step="0.1"
                        className="flex-1"
                        value={row.amount_lbs}
                        onChange={(event) => updateFeedRow(row.key, 'amount_lbs', event.target.value)}
                      />
                    </div>
                  )}

                  {row.feed_item_id && !dualUnit && (
                    <div className="flex gap-3">
                      <TextField
                        label="Amount"
                        type="number"
                        min="0"
                        step="0.25"
                        className="flex-1"
                        value={row.amount}
                        onChange={(event) => updateFeedRow(row.key, 'amount', event.target.value)}
                      />
                      <SelectField
                        label="Unit"
                        className="flex-1"
                        value={row.unit}
                        onChange={(event) => updateFeedRow(row.key, 'unit', event.target.value)}
                      >
                        <option value="cup">Cup</option>
                        <option value="scoop">Scoop</option>
                        <option value="handful">Handful</option>
                        <option value="lbs">Lbs</option>
                      </SelectField>
                    </div>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={addFeedRow}
              className="flex h-12 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Add feed item
            </button>
          </div>

          <TextAreaField
            label="Feed notes"
            value={form.feed_notes ?? ''}
            onChange={(event) => update('feed_notes', event.target.value)}
          />

          <div className="flex flex-col gap-3">
            <span className="text-lg font-medium text-gray-700">Turnout schedule</span>

            {turnoutRows.length === 0 && (
              <p className="text-lg text-gray-500">No turnout schedule yet.</p>
            )}

            {turnoutRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-end gap-3">
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
                    className="flex h-14 items-center justify-center rounded-lg border border-gray-300 px-4 text-lg font-medium text-gray-700 active:bg-gray-100"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-lg font-medium text-gray-700">Days</span>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const selected = row.days.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleTurnoutDay(row.key, day.value)}
                          className={`flex h-12 min-w-14 items-center justify-center rounded-lg border px-3 text-lg font-medium ${
                            selected
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-300 bg-white text-gray-700 active:bg-gray-100'
                          }`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-lg font-medium text-gray-700">Buddies</span>
                  {otherHeads.length === 0 ? (
                    <p className="text-lg text-gray-500">No other animals to add yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {otherHeads.map((animal) => {
                        const selected = row.buddy_ids.includes(animal.id)
                        return (
                          <button
                            key={animal.id}
                            type="button"
                            onClick={() => toggleTurnoutBuddy(row.key, animal.id)}
                            className={`flex h-12 items-center justify-between rounded-lg border px-4 text-lg font-medium ${
                              selected
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-300 bg-white text-gray-700 active:bg-gray-100'
                            }`}
                          >
                            <span>{animal.name || 'Unnamed'}</span>
                            <span>{selected ? 'Selected' : 'Add'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addTurnoutRow}
              className="flex h-12 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Add turnout schedule
            </button>
          </div>

          <TextAreaField
            label="Turnout notes"
            value={form.turnout_notes ?? ''}
            onChange={(event) => update('turnout_notes', event.target.value)}
          />

          <TextField
            label="Birth date"
            type="date"
            value={form.birth_date ?? ''}
            onChange={(event) => update('birth_date', event.target.value)}
          />
          <TextField
            label="Species"
            value={form.species}
            onChange={(event) => update('species', event.target.value)}
          />
          <TextField
            label="Acquired date"
            type="date"
            value={form.acquired_date ?? ''}
            onChange={(event) => update('acquired_date', event.target.value)}
          />
          <TextField
            label="Breed"
            value={form.breed}
            onChange={(event) => update('breed', event.target.value)}
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

          {error && <p className="text-lg text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/heard/${id}` : '/heard')}
              className="flex h-14 flex-1 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-14 flex-1 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
