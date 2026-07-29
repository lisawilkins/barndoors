import { supabase } from './supabaseClient'

// Queries for chore lists. A list owns its rows directly (chore_items.list_id);
// there is no section layer.

export function fetchLists() {
  return supabase
    .from('chore_lists')
    .select('id, name, description, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
}

export function fetchList(listId) {
  return supabase
    .from('chore_lists')
    .select('id, name, description, status')
    .eq('id', listId)
    .single()
}

export function fetchListItems(listId) {
  return supabase
    .from('chore_items')
    .select('id, parent_id, depth, body, note, sort_order')
    .eq('list_id', listId)
}

export function saveListItems(listId, items) {
  return supabase.rpc('save_chore_list_items', { p_list_id: listId, p_items: items })
}

export function saveListDetails(listId, { name, description }) {
  return supabase
    .from('chore_lists')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
}
