import type { PrismaClient } from '@prisma/client'

/**
 * Generate the next quote number in format [YY][NNNN], e.g. 260001 for year 2026, first quote.
 */
export async function generateQuoteNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear() % 100
  const prefix = year.toString()

  const quotes = await prisma.quote.findMany({
    where: { quoteNumber: { startsWith: prefix } },
    select: { quoteNumber: true },
  })

  const numbers = quotes
    .map((q) => parseInt(q.quoteNumber.slice(prefix.length), 10))
    .filter((n) => !isNaN(n) && n >= 0)
  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0
  const nextNum = maxNum + 1

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}
