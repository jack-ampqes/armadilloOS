/**
 * Shopify API Client for armadilloOS
 * Handles orders, inventory, and product synchronization
 */

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2026-01';

// ============================================
// Base Fetch Helper
// ============================================

async function shopifyFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error(
      'Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in .env.local'
    );
  }

  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ============================================
// Types
// ============================================

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
  fulfillment_status: 'fulfilled' | 'partial' | 'unfulfilled' | null;
  line_items: ShopifyLineItem[];
  customer: ShopifyCustomer | null;
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  note: string | null;
  tags: string;
  order_number: number;
  processed_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  variant_id: number;
  product_id: number;
  variant_title: string;
  vendor: string;
  fulfillment_status: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
  name: string;
  properties: Array<{ name: string; value: string }>;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
  tags: string;
  default_address: ShopifyAddress | null;
}

export interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
  company: string | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string | null;
  status: 'active' | 'archived' | 'draft';
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_item_id: number;
  inventory_quantity: number;
  inventory_management: string | null;
  inventory_policy: 'deny' | 'continue';
  barcode: string | null;
  weight: number;
  weight_unit: string;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  alt: string | null;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
  active: boolean;
  legacy: boolean;
}

export interface InventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

// ============================================
// Orders API
// ============================================

export async function getOrders(params?: {
  limit?: number;
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any';
  financial_status?: 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any';
  created_at_min?: string;
  created_at_max?: string;
}): Promise<ShopifyOrder[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.fulfillment_status) queryParams.set('fulfillment_status', params.fulfillment_status);
  if (params?.financial_status) queryParams.set('financial_status', params.financial_status);
  if (params?.created_at_min) queryParams.set('created_at_min', params.created_at_min);
  if (params?.created_at_max) queryParams.set('created_at_max', params.created_at_max);

  const query = queryParams.toString();
  const endpoint = `orders.json${query ? `?${query}` : ''}`;
  
  const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(endpoint);
  return data.orders;
}

export async function getOrder(orderId: string | number): Promise<ShopifyOrder> {
  const data = await shopifyFetch<{ order: ShopifyOrder }>(`orders/${orderId}.json`);
  return data.order;
}

export async function getOrderCount(params?: {
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  financial_status?: string;
  fulfillment_status?: string;
}): Promise<number> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.financial_status) queryParams.set('financial_status', params.financial_status);
  if (params?.fulfillment_status) queryParams.set('fulfillment_status', params.fulfillment_status);

  const query = queryParams.toString();
  const endpoint = `orders/count.json${query ? `?${query}` : ''}`;
  
  const data = await shopifyFetch<{ count: number }>(endpoint);
  return data.count;
}

// ============================================
// Products API
// ============================================

export async function getProducts(params?: {
  limit?: number;
  status?: 'active' | 'archived' | 'draft';
  collection_id?: string;
  product_type?: string;
  vendor?: string;
}): Promise<ShopifyProduct[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.collection_id) queryParams.set('collection_id', params.collection_id);
  if (params?.product_type) queryParams.set('product_type', params.product_type);
  if (params?.vendor) queryParams.set('vendor', params.vendor);

  const query = queryParams.toString();
  const endpoint = `products.json${query ? `?${query}` : ''}`;
  
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(endpoint);
  return data.products;
}

export async function getProduct(productId: string | number): Promise<ShopifyProduct> {
  const data = await shopifyFetch<{ product: ShopifyProduct }>(`products/${productId}.json`);
  return data.product;
}

// ============================================
// Inventory API
// ============================================

export async function getLocations(): Promise<ShopifyLocation[]> {
  const data = await shopifyFetch<{ locations: ShopifyLocation[] }>('locations.json');
  return data.locations;
}

export async function getInventoryLevels(params: {
  location_ids?: string;
  inventory_item_ids?: string;
  limit?: number;
}): Promise<InventoryLevel[]> {
  const queryParams = new URLSearchParams();
  
  if (params.location_ids) queryParams.set('location_ids', params.location_ids);
  if (params.inventory_item_ids) queryParams.set('inventory_item_ids', params.inventory_item_ids);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const query = queryParams.toString();
  const endpoint = `inventory_levels.json${query ? `?${query}` : ''}`;
  
  const data = await shopifyFetch<{ inventory_levels: InventoryLevel[] }>(endpoint);
  return data.inventory_levels;
}

export async function adjustInventory(
  inventoryItemId: string | number,
  locationId: string | number,
  adjustment: number
): Promise<InventoryLevel> {
  const data = await shopifyFetch<{ inventory_level: InventoryLevel }>(
    'inventory_levels/adjust.json',
    {
      method: 'POST',
      body: JSON.stringify({
        location_id: Number(locationId),
        inventory_item_id: Number(inventoryItemId),
        available_adjustment: adjustment,
      }),
    }
  );
  return data.inventory_level;
}

export async function setInventory(
  inventoryItemId: string | number,
  locationId: string | number,
  available: number
): Promise<InventoryLevel> {
  const data = await shopifyFetch<{ inventory_level: InventoryLevel }>(
    'inventory_levels/set.json',
    {
      method: 'POST',
      body: JSON.stringify({
        location_id: Number(locationId),
        inventory_item_id: Number(inventoryItemId),
        available: available,
      }),
    }
  );
  return data.inventory_level;
}

export async function getInventoryItem(inventoryItemId: string | number) {
  const data = await shopifyFetch<{ inventory_item: { id: number; sku: string; tracked: boolean } }>(
    `inventory_items/${inventoryItemId}.json`
  );
  return data.inventory_item;
}

// ============================================
// Utility Functions
// ============================================

export function formatShopifyPrice(price: string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(parseFloat(price));
}

export function getOrderStatusColor(status: ShopifyOrder['financial_status']): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    authorized: 'bg-blue-100 text-blue-800',
    partially_paid: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    partially_refunded: 'bg-purple-100 text-purple-800',
    refunded: 'bg-gray-100 text-gray-800',
    voided: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getFulfillmentStatusColor(status: ShopifyOrder['fulfillment_status']): string {
  const colors: Record<string, string> = {
    fulfilled: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    unfulfilled: 'bg-red-100 text-red-800',
  };
  return colors[status || 'unfulfilled'] || 'bg-gray-100 text-gray-800';
}

