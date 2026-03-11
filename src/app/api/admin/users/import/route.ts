import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'
import type { Role } from '@/lib/permissions'

const VALID_ROLES: Role[] = ['Admin', 'Sales Rep', 'Distributor', 'Technician']

/** Parse a single CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      current += c
    } else if (c === ',') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

/** POST /api/admin/users/import — bulk add users from CSV (Admin only). */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const formData = await request.formData()
    const file = formData.get('csv') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No CSV file provided. Use form field "csv".' },
        { status: 400 }
      )
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV must have a header row and at least one data row.' },
        { status: 400 }
      )
    }

    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
    const emailIdx = header.indexOf('email')
    if (emailIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must have an "email" column.' },
        { status: 400 }
      )
    }
    const nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : -1
    const roleIdx = header.indexOf('role') >= 0 ? header.indexOf('role') : -1
    const companyIdx = header.indexOf('company') >= 0 ? header.indexOf('company') : -1

    // One temporary password for the whole batch (admin shares with new users)
    const temporaryPassword = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
    const passwordHash = crypto.createHash('sha256').update(temporaryPassword).digest('hex')

    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name')
    const companyByName = new Map<string, string>()
    ;(companies || []).forEach((c) => {
      companyByName.set((c.name || '').toLowerCase().trim(), c.id)
    })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let added = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i])
      const email = (row[emailIdx] || '').toLowerCase().trim()
      if (!email) {
        errors.push(`Row ${i + 1}: missing email`)
        continue
      }
      if (!emailRegex.test(email)) {
        errors.push(`Row ${i + 1}: invalid email "${email}"`)
        continue
      }

      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (existing) {
        skipped++
        continue
      }

      let role: Role = 'Distributor'
      if (roleIdx >= 0 && row[roleIdx]) {
        const r = (row[roleIdx] || '').trim()
        if (VALID_ROLES.includes(r as Role)) role = r as Role
      }

      let company_id: string | null = null
      if (companyIdx >= 0 && row[companyIdx]) {
        const name = (row[companyIdx] || '').trim()
        company_id = companyByName.get(name.toLowerCase()) ?? null
      }

      const name = nameIdx >= 0 ? (row[nameIdx] || '').trim() || null : null

      const { error: insertError } = await supabaseAdmin.from('users').insert({
        email,
        name: name || null,
        role,
        company_id,
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })

      if (insertError) {
        errors.push(`Row ${i + 1} (${email}): ${insertError.message}`)
        continue
      }
      added++
    }

    return NextResponse.json({
      added,
      skipped,
      temporaryPassword,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
