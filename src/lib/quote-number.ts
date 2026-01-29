import { supabaseAdmin } from './supabase'

/**
 * Generate the next quote number in format [YY][NNNN], e.g. 260001 for year 2026, first quote.
 */
export async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear() % 100
  const prefix = year.toString()

  const { data: rows } = await supabaseAdmin
    .from('quotes')
    .select('quote_number')
    .ilike('quote_number', `${prefix}%`)

  const numbers = (rows || [])
    .map((q) => parseInt((q.quote_number || '').slice(prefix.length), 10))
    .filter((n) => !isNaN(n) && n >= 0)
  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0
  const nextNum = maxNum + 1

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}
