import { NextRequest, NextResponse } from 'next/server';
import { getInventoryLevels, adjustInventory, setInventory } from '@/lib/shopify';

// GET inventory levels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const locationIds = searchParams.get('location_ids');
    const inventoryItemIds = searchParams.get('inventory_item_ids');
    const limit = searchParams.get('limit');

    if (!locationIds && !inventoryItemIds) {
      return NextResponse.json(
        { error: 'Either location_ids or inventory_item_ids is required' },
        { status: 400 }
      );
    }

    const inventoryLevels = await getInventoryLevels({
      location_ids: locationIds || undefined,
      inventory_item_ids: inventoryItemIds || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({ inventory_levels: inventoryLevels });
  } catch (error) {
    console.error('Shopify inventory error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

// POST to adjust or set inventory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inventory_item_id, location_id, adjustment, set_quantity } = body;

    if (!inventory_item_id || !location_id) {
      return NextResponse.json(
        { error: 'inventory_item_id and location_id are required' },
        { status: 400 }
      );
    }

    let result;

    if (typeof set_quantity === 'number') {
      // Set inventory to exact quantity
      result = await setInventory(inventory_item_id, location_id, set_quantity);
    } else if (typeof adjustment === 'number') {
      // Adjust inventory by delta
      result = await adjustInventory(inventory_item_id, location_id, adjustment);
    } else {
      return NextResponse.json(
        { error: 'Either adjustment or set_quantity is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({ inventory_level: result });
  } catch (error) {
    console.error('Shopify inventory update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update inventory' },
      { status: 500 }
    );
  }
}

