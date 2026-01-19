/**
 * Script to import products from inventory_list.csv into Supabase
 * 
 * Usage:
 *   npx tsx scripts/import-products.ts
 * 
 * Or with Node.js:
 *   node --loader ts-node/esm scripts/import-products.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Product {
  name: string
  sku: string
  category: string | null
  price: number
}

function parseCSV(filePath: string): Product[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const products: Product[] = []
  
  let currentCategory: string | null = null
  let currentProductName: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Parse CSV line (handle quoted values)
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    parts.push(current.trim())

    const [namePart, skuPart] = parts

    // Check if this is a category header (has name but no SKU, or name ends with comma)
    if (namePart && !skuPart && namePart.endsWith(',')) {
      currentCategory = namePart.replace(/,$/, '').trim()
      currentProductName = null
      continue
    }

    // Check if this is a product name with SKU
    if (namePart && skuPart) {
      currentProductName = namePart.replace(/^"|"$/g, '') // Remove quotes
      products.push({
        name: currentProductName,
        sku: skuPart,
        category: currentCategory,
        price: 0 // Default price, can be updated later
      })
    }
    // Check if this is a continuation (empty name, has SKU)
    else if (!namePart && skuPart && currentProductName) {
      products.push({
        name: currentProductName,
        sku: skuPart,
        category: currentCategory,
        price: 0
      })
    }
  }

  return products
}

async function importProducts() {
  const csvPath = path.join(process.cwd(), 'inventory_list.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`)
    process.exit(1)
  }

  console.log('Parsing CSV file...')
  const products = parseCSV(csvPath)
  console.log(`Found ${products.length} products to import`)

  // Insert products in batches
  const batchSize = 100
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(products.length / batchSize)
    
    console.log(`Importing batch ${batchNum}/${totalBatches} (${batch.length} products)...`)

    const { data, error } = await supabase
      .from('products')
      .insert(
        batch.map(p => ({
          name: p.name,
          sku: p.sku,
          category: p.category,
          price: p.price,
          description: null
        }))
      )
      .select()

    if (error) {
      console.error(`Error in batch ${batchNum}:`, error.message)
      failed += batch.length
      errors.push(`Batch ${batchNum}: ${error.message}`)
      
      // If it's a unique constraint error, try inserting individually to find duplicates
      if (error.code === '23505') {
        console.log('  Attempting individual inserts to identify duplicates...')
        for (const product of batch) {
          const { error: individualError } = await supabase
            .from('products')
            .insert({
              name: product.name,
              sku: product.sku,
              category: product.category,
              price: product.price,
              description: null
            })
          
          if (individualError) {
            if (individualError.code === '23505') {
              console.log(`  Skipping duplicate SKU: ${product.sku}`)
            } else {
              console.error(`  Error inserting ${product.sku}:`, individualError.message)
            }
            failed++
          } else {
            success++
          }
        }
      }
    } else {
      success += data?.length || 0
      console.log(`  ✓ Successfully imported ${data?.length || 0} products`)
    }
  }

  console.log('\n=== Import Summary ===')
  console.log(`Total products: ${products.length}`)
  console.log(`Successfully imported: ${success}`)
  console.log(`Failed: ${failed}`)
  
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(err => console.log(`  - ${err}`))
  }
}

// Run the import
importProducts()
  .then(() => {
    console.log('\nImport completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

