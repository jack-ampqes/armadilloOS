/**
 * One-off script to migrate existing user roles to the new role set:
 * - Admin       -> Admin
 * - Rep         -> Sales Rep
 * - Tech        -> Technician
 * - user/other  -> Distributor
 *
 * Usage (from project root):
 *   npx ts-node scripts/migrate-roles.ts
 *
 * Make sure SUPABASE_SERVICE_ROLE_KEY is set so we can bypass RLS.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { normalizeRole } from '@/lib/permissions'

async function migrateRoles() {
  console.log('Starting role migration...')

  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role')

  if (error) {
    console.error('Error fetching users:', error)
    process.exit(1)
  }

  if (!users || users.length === 0) {
    console.log('No users found to migrate.')
    return
  }

  let updatedCount = 0

  for (const user of users as Array<{ id: string; email: string; role: string | null }>) {
    const currentRole = user.role
    const normalized = normalizeRole(currentRole)

    // If normalizeRole already maps to the same semantic value, we still want to
    // ensure the exact string in DB matches our canonical values.
    let targetRole = normalized as string

    // Explicit mapping for legacy short codes
    const lower = (currentRole || '').toLowerCase()
    if (lower === 'rep') {
      targetRole = 'Sales Rep'
    } else if (lower === 'tech') {
      targetRole = 'Technician'
    } else if (lower === 'admin') {
      targetRole = 'Admin'
    } else if (!currentRole || lower === 'user') {
      targetRole = 'Distributor'
    }

    if (currentRole === targetRole) {
      continue
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role: targetRole })
      .eq('id', user.id)

    if (updateError) {
      console.error(`Failed to update role for ${user.email}:`, updateError)
      continue
    }

    updatedCount++
    console.log(`Updated ${user.email}: ${currentRole ?? 'null'} -> ${targetRole}`)
  }

  console.log(`Role migration complete. Updated ${updatedCount} user(s).`)
}

migrateRoles()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })

