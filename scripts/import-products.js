/**
 * Script to import products from CSV into Supabase
 * 
 * Usage:
 *   node scripts/import-products.js [csv-file-path]
 * 
 * Default CSV file: "Armadillo Product Line Card - Copy of Product Line.csv"
 * 
 * Make sure your .env.local file has:
 *   NEXT_PUBLIC_SUPABASE_URL=your_url
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function parseCSVLine(line) {
  // Parse CSV line handling quoted values
  const parts = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
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
  return parts
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const products = []
  
  // Skip header row
  if (lines.length === 0) return products
  
  const headerLine = lines[0].trim()
  if (!headerLine) return products
  
  // Parse header to get column indices
  const headers = parseCSVLine(headerLine)
  const skuIdx = headers.indexOf('sku')
  const nameIdx = headers.indexOf('name')
  const descIdx = headers.indexOf('description')
  const priceIdx = headers.indexOf('price')
  const colorIdx = headers.indexOf('color')
  const leadtimeIdx = headers.indexOf('leadtime')

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = parseCSVLine(line)
    
    // Extract values based on header positions
    const sku = parts[skuIdx]?.replace(/^"|"$/g, '') || ''
    const name = parts[nameIdx]?.replace(/^"|"$/g, '') || ''
    const description = parts[descIdx]?.replace(/^"|"$/g, '') || null
    const price = parseFloat(parts[priceIdx]?.replace(/^"|"$/g, '') || '0') || 0
    const color = parts[colorIdx]?.replace(/^"|"$/g, '') || null
    const leadtime = parts[leadtimeIdx]?.replace(/^"|"$/g, '') || null

    if (sku && name) {
      products.push({
        sku,
        name,
        description,
        price,
        color,
        leadtime
      })
    }
  }

  return products
}

async function importProducts() {
  // Use command line argument or default CSV file
  const csvFileName = process.argv[2] || "Armadillo Product Line Card - Copy of Product Line.csv"
  const csvPath = path.join(process.cwd(), csvFileName)
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`)
    console.error(`Usage: node scripts/import-products.js [csv-file-path]`)
    process.exit(1)
  }

  console.log('Parsing CSV file...')
  const products = parseCSV(csvPath)
  console.log(`Found ${products.length} products to import\n`)

  // Insert products in batches
  const batchSize = 100
  let success = 0
  let failed = 0
  const errors = []

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(products.length / batchSize)
    
    console.log(`Importing batch ${batchNum}/${totalBatches} (${batch.length} products)...`)

    // Use RPC function to insert into armadillo_inventory.products
    const productsJson = batch.map(p => ({
      sku: p.sku,
      name: p.name,
      description: p.description || null,
      price: p.price || 0,
      color: p.color || null,
      leadtime: p.leadtime || null
    }))

    const { data, error } = await supabase.rpc('insert_products_bulk', {
      products_json: productsJson
    })

    if (error) {
      console.error(`  ✗ Error in batch ${batchNum}:`, error.message)
      failed += batch.length
      errors.push(`Batch ${batchNum}: ${error.message}`)
    } else {
      // Count successful and failed inserts
      const successful = (data || []).filter(r => r.success === true)
      const failedItems = (data || []).filter(r => r.success === false)
      
      success += successful.length
      failed += failedItems.length
      
      if (failedItems.length > 0) {
        console.log(`  ⚠ Imported ${successful.length} products, ${failedItems.length} failed`)
        failedItems.forEach(item => {
          console.log(`    - ${item.sku}: ${item.error_message}`)
        })
      } else {
        console.log(`  ✓ Successfully imported ${successful.length} products`)
      }
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
    console.log('\n✓ Import completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

