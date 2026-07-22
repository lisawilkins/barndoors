// Creates a new Manager account (real Supabase Auth login) from inside the
// app. Callable only by an existing manager.
//
// Why this has to be an Edge Function rather than a plain client call:
// `supabase.auth.signUp()` run from the browser swaps the *caller's own*
// session over to the newly created user — fine for public self-signup, but
// it would sign the calling manager out of their own session the moment they
// tried to create a teammate's account. The service-role Admin API
// (`auth.admin.createUser`) creates an account without touching any existing
// session, but it requires the service role key, which must never reach the
// browser — hence doing it here, server-side, instead.
//
// This implements the "in-app invite flow ... planned as a Supabase Edge
// Function" noted in AGENTS.md.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server is missing Supabase configuration.' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '')

  if (!callerJwt) {
    return jsonResponse({ error: 'Missing Authorization header.' }, 401)
  }

  // Service-role client: bypasses RLS, used for verifying the caller and for
  // the actual account-creation admin call below.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerData, error: callerError } = await adminClient.auth.getUser(callerJwt)
  if (callerError || !callerData?.user) {
    return jsonResponse({ error: 'Invalid or expired session.' }, 401)
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (callerProfileError || callerProfile?.role !== 'manager') {
    return jsonResponse({ error: 'Only managers can create new manager accounts.' }, 403)
  }

  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400)
  }

  const email = body.email?.trim()
  const password = body.password
  const name = body.name?.trim()

  if (!email || !password || !name) {
    return jsonResponse({ error: 'Name, email, and password are all required.' }, 400)
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400)
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (createError || !created?.user) {
    return jsonResponse({ error: createError?.message ?? 'Could not create account.' }, 400)
  }

  // handle_new_user() (see supabase/migrations) always inserts the new
  // profiles row with role = 'hand' — promote it now that the account is a
  // manager account.
  const { error: promoteError } = await adminClient
    .from('profiles')
    .update({ role: 'manager' })
    .eq('id', created.user.id)

  if (promoteError) {
    return jsonResponse(
      { error: `Account created, but could not set the manager role: ${promoteError.message}` },
      500,
    )
  }

  return jsonResponse({ id: created.user.id, email: created.user.email })
})
