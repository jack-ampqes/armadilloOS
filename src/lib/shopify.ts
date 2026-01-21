/**
 * Shopify GraphQL Admin API Client for armadilloOS
 * Handles orders, inventory, and product synchronization
 * Migrated from REST Admin API to GraphQL Admin API (2026-01)
 */

const API_VERSION = '2026-01';

// ============================================
// GraphQL Admin API Helper
// ============================================

export type ShopifyApiCredentials = {
  shopDomain: string;
  accessToken: string;
};

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: {
      code?: string;
      [key: string]: any;
    };
  }>;
}

async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, any>,
  credentials?: ShopifyApiCredentials
): Promise<T> {
  const shopDomain = credentials?.shopDomain || process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = credentials?.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shopDomain || !accessToken) {
    throw new Error(
      'Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in .env.local'
    );
  }

  const url = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      query,
      variables: variables || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${errorText}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join(', ');
    throw new Error(`Shopify GraphQL error: ${errorMessages}`);
  }

  if (!result.data) {
    throw new Error('Shopify GraphQL response missing data');
  }

  return result.data;
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
// Orders API (GraphQL)
// ============================================

export async function getOrders(params?: {
  limit?: number;
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any';
  financial_status?: 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any';
  created_at_min?: string;
  created_at_max?: string;
  name?: string;
}, credentials?: ShopifyApiCredentials): Promise<ShopifyOrder[]> {
  const limit = params?.limit || 50;
  
  // Build query filter
  const queryParts: string[] = [];
  if (params?.name) {
    // Search by order name (e.g., "#1001" or "1001")
    const orderName = params.name.startsWith('#') ? params.name : `#${params.name}`;
    queryParts.push(`name:${orderName}`);
  }
  if (params?.status && params.status !== 'any') {
    queryParts.push(`status:${params.status}`);
  }
  if (params?.financial_status && params.financial_status !== 'any') {
    queryParts.push(`financial_status:${params.financial_status}`);
  }
  if (params?.fulfillment_status && params.fulfillment_status !== 'any') {
    const fulfillmentMap: Record<string, string> = {
      'shipped': 'fulfilled',
      'partial': 'partial',
      'unshipped': 'unfulfilled',
    };
    queryParts.push(`fulfillment_status:${fulfillmentMap[params.fulfillment_status] || params.fulfillment_status}`);
  }
  if (params?.created_at_min) {
    queryParts.push(`created_at:>='${params.created_at_min}'`);
  }
  if (params?.created_at_max) {
    queryParts.push(`created_at:<='${params.created_at_max}'`);
  }
  
  const queryString = queryParts.length > 0 ? queryParts.join(' AND ') : undefined;

  const query = `
    query getOrders($first: Int!, $query: String) {
      orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            email
            createdAt
            updatedAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
              }
            }
            totalTaxSet {
              shopMoney {
                amount
              }
            }
            currencyCode
            displayFinancialStatus
            displayFulfillmentStatus
            lineItems(first: 250) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                  variant {
                    id
                    sku
                    product {
                      id
                    }
                  }
                  vendor
                  fulfillmentStatus
                  requiresShipping
                  taxable
                  name
                  customAttributes {
                    key
                    value
                  }
                }
              }
            }
            customer {
              id
              email
              firstName
              lastName
              phone
              numberOfOrders
              createdAt
              updatedAt
              tags
              defaultAddress {
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
                company
              }
            }
            shippingAddress {
              firstName
              lastName
              address1
              address2
              city
              province
              country
              zip
              phone
              company
            }
            billingAddress {
              firstName
              lastName
              address1
              address2
              city
              province
              country
              zip
              phone
              company
            }
            note
            tags
            processedAt
            cancelledAt
            cancelReason
          }
        }
      }
    }
  `;

  interface GraphQLOrdersResponse {
    orders: {
      edges: Array<{
        node: any;
      }>;
    };
  }

  const data = await shopifyGraphQL<GraphQLOrdersResponse>(query, {
    first: limit,
    query: queryString,
  }, credentials);

  // Transform GraphQL response to match existing interface
  return data.orders.edges.map(({ node }) => ({
    id: parseInt(node.id.split('/').pop() || '0'),
    name: node.name,
    email: node.email || '',
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    total_price: node.totalPriceSet.shopMoney.amount,
    subtotal_price: node.subtotalPriceSet.shopMoney.amount,
    total_tax: node.totalTaxSet.shopMoney.amount,
    currency: node.currencyCode,
    financial_status: mapFinancialStatus(node.displayFinancialStatus),
    fulfillment_status: mapFulfillmentStatus(node.displayFulfillmentStatus),
    line_items: node.lineItems.edges.map(({ node: item }: any) => ({
      id: parseInt(item.id.split('/').pop() || '0'),
      title: item.title,
      quantity: item.quantity,
      price: item.originalUnitPriceSet.shopMoney.amount,
      sku: item.variant?.sku || '',
      variant_id: item.variant ? parseInt(item.variant.id.split('/').pop() || '0') : 0,
      product_id: item.variant?.product ? parseInt(item.variant.product.id.split('/').pop() || '0') : 0,
      variant_title: item.variant?.title || '',
      vendor: item.vendor || '',
      fulfillment_status: item.fulfillmentStatus,
      requires_shipping: item.requiresShipping,
      taxable: item.taxable,
      gift_card: false,
      name: item.name,
      properties: item.customAttributes?.map((attr: any) => ({
        name: attr.key,
        value: attr.value,
      })) || [],
    })),
    customer: node.customer ? {
      id: parseInt(node.customer.id.split('/').pop() || '0'),
      email: node.customer.email || '',
      first_name: node.customer.firstName || '',
      last_name: node.customer.lastName || '',
      phone: node.customer.phone,
      orders_count: node.customer.numberOfOrders || 0,
      total_spent: '0',
      created_at: node.customer.createdAt,
      updated_at: node.customer.updatedAt,
      tags: node.customer.tags?.join(',') || '',
      default_address: node.customer.defaultAddress ? {
        first_name: node.customer.defaultAddress.firstName || '',
        last_name: node.customer.defaultAddress.lastName || '',
        address1: node.customer.defaultAddress.address1 || '',
        address2: node.customer.defaultAddress.address2,
        city: node.customer.defaultAddress.city || '',
        province: node.customer.defaultAddress.province || '',
        country: node.customer.defaultAddress.country || '',
        zip: node.customer.defaultAddress.zip || '',
        phone: node.customer.defaultAddress.phone,
        company: node.customer.defaultAddress.company,
      } : null,
    } : null,
    shipping_address: node.shippingAddress ? {
      first_name: node.shippingAddress.firstName || '',
      last_name: node.shippingAddress.lastName || '',
      address1: node.shippingAddress.address1 || '',
      address2: node.shippingAddress.address2,
      city: node.shippingAddress.city || '',
      province: node.shippingAddress.province || '',
      country: node.shippingAddress.country || '',
      zip: node.shippingAddress.zip || '',
      phone: node.shippingAddress.phone,
      company: node.shippingAddress.company,
    } : null,
    billing_address: node.billingAddress ? {
      first_name: node.billingAddress.firstName || '',
      last_name: node.billingAddress.lastName || '',
      address1: node.billingAddress.address1 || '',
      address2: node.billingAddress.address2,
      city: node.billingAddress.city || '',
      province: node.billingAddress.province || '',
      country: node.billingAddress.country || '',
      zip: node.billingAddress.zip || '',
      phone: node.billingAddress.phone,
      company: node.billingAddress.company,
    } : null,
    note: node.note,
    tags: node.tags?.join(',') || '',
    order_number: parseInt((node.name || '').replace(/\D/g, '') || '0'),
    processed_at: node.processedAt,
    cancelled_at: node.cancelledAt,
    cancel_reason: node.cancelReason,
  }));
}

// Helper functions to map GraphQL status values
function mapFinancialStatus(status: string): ShopifyOrder['financial_status'] {
  const statusMap: Record<string, ShopifyOrder['financial_status']> = {
    'PENDING': 'pending',
    'AUTHORIZED': 'authorized',
    'PARTIALLY_PAID': 'partially_paid',
    'PAID': 'paid',
    'PARTIALLY_REFUNDED': 'partially_refunded',
    'REFUNDED': 'refunded',
    'VOIDED': 'voided',
  };
  return statusMap[status.toUpperCase()] || 'pending';
}

function mapFulfillmentStatus(status: string | null): ShopifyOrder['fulfillment_status'] {
  if (!status) return null;
  const statusMap: Record<string, ShopifyOrder['fulfillment_status']> = {
    'FULFILLED': 'fulfilled',
    'PARTIAL': 'partial',
    'PARTIALLY_FULFILLED': 'partial',
    'UNFULFILLED': 'unfulfilled',
  };
  return statusMap[status.toUpperCase()] || null;
}

export async function getOrder(
  orderId: string | number,
  credentials?: ShopifyApiCredentials
): Promise<ShopifyOrder> {
  // Convert numeric ID to Global ID format
  const gid = typeof orderId === 'number' 
    ? `gid://shopify/Order/${orderId}` 
    : orderId.startsWith('gid://') 
      ? orderId 
      : `gid://shopify/Order/${orderId}`;

  const query = `
    query getOrder($id: ID!) {
      order(id: $id) {
        id
        name
        email
        createdAt
        updatedAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
          }
        }
        totalTaxSet {
          shopMoney {
            amount
          }
        }
        currencyCode
        displayFinancialStatus
        displayFulfillmentStatus
        lineItems(first: 250) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                }
              }
              variant {
                id
                sku
                product {
                  id
                }
              }
              vendor
              fulfillmentStatus
              requiresShipping
              taxable
              name
              customAttributes {
                key
                value
              }
            }
          }
        }
        customer {
          id
          email
          firstName
          lastName
          phone
          numberOfOrders
          createdAt
          updatedAt
          tags
          defaultAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
            phone
            company
          }
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
          phone
          company
        }
        billingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
          phone
          company
        }
        note
        tags
        processedAt
        cancelledAt
        cancelReason
      }
    }
  `;

  interface GraphQLOrderResponse {
    order: any;
  }

  const data = await shopifyGraphQL<GraphQLOrderResponse>(query, { id: gid }, credentials);

  if (!data.order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const node = data.order;
  
  // Transform to match interface (same as getOrders)
  return {
    id: parseInt(node.id.split('/').pop() || '0'),
    name: node.name,
    email: node.email || '',
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    total_price: node.totalPriceSet.shopMoney.amount,
    subtotal_price: node.subtotalPriceSet.shopMoney.amount,
    total_tax: node.totalTaxSet.shopMoney.amount,
    currency: node.currencyCode,
    financial_status: mapFinancialStatus(node.displayFinancialStatus),
    fulfillment_status: mapFulfillmentStatus(node.displayFulfillmentStatus),
    line_items: node.lineItems.edges.map(({ node: item }: any) => ({
      id: parseInt(item.id.split('/').pop() || '0'),
      title: item.title,
      quantity: item.quantity,
      price: item.originalUnitPriceSet.shopMoney.amount,
      sku: item.variant?.sku || '',
      variant_id: item.variant ? parseInt(item.variant.id.split('/').pop() || '0') : 0,
      product_id: item.variant?.product ? parseInt(item.variant.product.id.split('/').pop() || '0') : 0,
      variant_title: item.variant?.title || '',
      vendor: item.vendor || '',
      fulfillment_status: item.fulfillmentStatus,
      requires_shipping: item.requiresShipping,
      taxable: item.taxable,
      gift_card: false,
      name: item.name,
      properties: item.customAttributes?.map((attr: any) => ({
        name: attr.key,
        value: attr.value,
      })) || [],
    })),
    customer: node.customer ? {
      id: parseInt(node.customer.id.split('/').pop() || '0'),
      email: node.customer.email || '',
      first_name: node.customer.firstName || '',
      last_name: node.customer.lastName || '',
      phone: node.customer.phone,
      orders_count: node.customer.numberOfOrders || 0,
      total_spent: '0',
      created_at: node.customer.createdAt,
      updated_at: node.customer.updatedAt,
      tags: node.customer.tags?.join(',') || '',
      default_address: node.customer.defaultAddress ? {
        first_name: node.customer.defaultAddress.firstName || '',
        last_name: node.customer.defaultAddress.lastName || '',
        address1: node.customer.defaultAddress.address1 || '',
        address2: node.customer.defaultAddress.address2,
        city: node.customer.defaultAddress.city || '',
        province: node.customer.defaultAddress.province || '',
        country: node.customer.defaultAddress.country || '',
        zip: node.customer.defaultAddress.zip || '',
        phone: node.customer.defaultAddress.phone,
        company: node.customer.defaultAddress.company,
      } : null,
    } : null,
    shipping_address: node.shippingAddress ? {
      first_name: node.shippingAddress.firstName || '',
      last_name: node.shippingAddress.lastName || '',
      address1: node.shippingAddress.address1 || '',
      address2: node.shippingAddress.address2,
      city: node.shippingAddress.city || '',
      province: node.shippingAddress.province || '',
      country: node.shippingAddress.country || '',
      zip: node.shippingAddress.zip || '',
      phone: node.shippingAddress.phone,
      company: node.shippingAddress.company,
    } : null,
    billing_address: node.billingAddress ? {
      first_name: node.billingAddress.firstName || '',
      last_name: node.billingAddress.lastName || '',
      address1: node.billingAddress.address1 || '',
      address2: node.billingAddress.address2,
      city: node.billingAddress.city || '',
      province: node.billingAddress.province || '',
      country: node.billingAddress.country || '',
      zip: node.billingAddress.zip || '',
      phone: node.billingAddress.phone,
      company: node.billingAddress.company,
    } : null,
    note: node.note,
    tags: node.tags?.join(',') || '',
    order_number: parseInt((node.name || '').replace(/\D/g, '') || '0'),
    processed_at: node.processedAt,
    cancelled_at: node.cancelledAt,
    cancel_reason: node.cancelReason,
  };
}

export async function getOrderCount(params?: {
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  financial_status?: 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any';
  fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any';
}, credentials?: ShopifyApiCredentials): Promise<number> {
  // Note: GraphQL Admin API doesn't have a direct count query
  // We fetch a limited set to get an approximate count
  // For exact counts, you may need to paginate through all results
  // or use a cached value updated periodically
  
  const orders = await getOrders({
    limit: 250, // Maximum allowed in a single query
    status: params?.status,
    financial_status: params?.financial_status,
    fulfillment_status: params?.fulfillment_status,
  }, credentials);

  // If we got 250 results, there might be more (would need pagination for exact count)
  // For now, return the count of what we fetched
  return orders.length;
}

// ============================================
// Products API
// NOTE: Still using REST API - can be migrated to GraphQL Admin API if needed
// ============================================

// Legacy REST fetch helper (for products/inventory that haven't been migrated yet)
async function shopifyFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  credentials?: ShopifyApiCredentials
): Promise<T> {
  const shopDomain = credentials?.shopDomain || process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = credentials?.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shopDomain || !accessToken) {
    throw new Error(
      'Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in .env.local'
    );
  }

  const url = `https://${shopDomain}/admin/api/${API_VERSION}/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getProducts(params?: {
  limit?: number;
  status?: 'active' | 'archived' | 'draft';
  collection_id?: string;
  product_type?: string;
  vendor?: string;
}, credentials?: ShopifyApiCredentials): Promise<ShopifyProduct[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.collection_id) queryParams.set('collection_id', params.collection_id);
  if (params?.product_type) queryParams.set('product_type', params.product_type);
  if (params?.vendor) queryParams.set('vendor', params.vendor);

  const query = queryParams.toString();
  const endpoint = `products.json${query ? `?${query}` : ''}`;
  
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(endpoint, {}, credentials);
  return data.products;
}

export async function getProduct(
  productId: string | number,
  credentials?: ShopifyApiCredentials
): Promise<ShopifyProduct> {
  const data = await shopifyFetch<{ product: ShopifyProduct }>(
    `products/${productId}.json`,
    {},
    credentials
  );
  return data.product;
}

// ============================================
// Inventory API
// ============================================

export async function getLocations(credentials?: ShopifyApiCredentials): Promise<ShopifyLocation[]> {
  const data = await shopifyFetch<{ locations: ShopifyLocation[] }>(
    'locations.json',
    {},
    credentials
  );
  return data.locations;
}

export async function getInventoryLevels(params: {
  location_ids?: string;
  inventory_item_ids?: string;
  limit?: number;
}, credentials?: ShopifyApiCredentials): Promise<InventoryLevel[]> {
  const queryParams = new URLSearchParams();
  
  if (params.location_ids) queryParams.set('location_ids', params.location_ids);
  if (params.inventory_item_ids) queryParams.set('inventory_item_ids', params.inventory_item_ids);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const query = queryParams.toString();
  const endpoint = `inventory_levels.json${query ? `?${query}` : ''}`;
  
  const data = await shopifyFetch<{ inventory_levels: InventoryLevel[] }>(
    endpoint,
    {},
    credentials
  );
  return data.inventory_levels;
}

export async function adjustInventory(
  inventoryItemId: string | number,
  locationId: string | number,
  adjustment: number,
  credentials?: ShopifyApiCredentials
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
    },
    credentials
  );
  return data.inventory_level;
}

export async function setInventory(
  inventoryItemId: string | number,
  locationId: string | number,
  available: number,
  credentials?: ShopifyApiCredentials
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
    },
    credentials
  );
  return data.inventory_level;
}

export async function getInventoryItem(
  inventoryItemId: string | number,
  credentials?: ShopifyApiCredentials
) {
  const data = await shopifyFetch<{ inventory_item: { id: number; sku: string; tracked: boolean } }>(
    `inventory_items/${inventoryItemId}.json`,
    {},
    credentials
  );
  return data.inventory_item;
}

// ============================================
// Draft Order Creation
// ============================================

export interface DraftOrderLineItem {
  variantId?: string;
  title?: string;
  quantity: number;
  originalUnitPrice?: string;
  sku?: string;
}

export interface DraftOrderInput {
  lineItems: DraftOrderLineItem[];
  email?: string;
  phone?: string;
  note?: string;
  tags?: string[];
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    phone?: string;
    company?: string;
  };
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    phone?: string;
    company?: string;
  };
  customAttributes?: Array<{ key: string; value: string }>;
  taxExempt?: boolean;
}

export interface DraftOrder {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  totalPrice: string;
  subtotalPrice: string;
  totalTax: string;
  currencyCode: string;
  note: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  invoiceUrl: string | null;
  lineItems: Array<{
    id: string;
    title: string;
    quantity: number;
    originalUnitPrice: string;
    sku: string | null;
    variant?: {
      id: string;
      title: string;
      sku: string | null;
    };
  }>;
  shippingAddress: ShopifyAddress | null;
  billingAddress: ShopifyAddress | null;
  customer: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export async function createDraftOrder(
  input: DraftOrderInput,
  credentials?: ShopifyApiCredentials
): Promise<DraftOrder> {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          email
          phone
          status
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
            }
          }
          totalTaxSet {
            shopMoney {
              amount
            }
          }
          note
          tags
          createdAt
          updatedAt
          invoiceUrl
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                sku
                variant {
                  id
                  title
                  sku
                }
              }
            }
          }
          shippingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
            phone
            company
          }
          billingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
            phone
            company
          }
          customer {
            id
            email
            firstName
            lastName
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Build line items for the mutation
  const lineItems = input.lineItems.map(item => {
    const lineItem: Record<string, any> = {
      quantity: item.quantity,
    };
    
    if (item.variantId) {
      // Use Shopify variant ID (must be in GID format)
      lineItem.variantId = item.variantId.startsWith('gid://') 
        ? item.variantId 
        : `gid://shopify/ProductVariant/${item.variantId}`;
    } else {
      // Custom line item (not from Shopify catalog)
      lineItem.title = item.title || 'Custom Item';
      lineItem.originalUnitPrice = item.originalUnitPrice || '0.00';
    }
    
    return lineItem;
  });

  const variables: Record<string, any> = {
    input: {
      lineItems,
    },
  };

  // Add optional fields
  if (input.email) variables.input.email = input.email;
  if (input.phone) variables.input.phone = input.phone;
  if (input.note) variables.input.note = input.note;
  if (input.tags && input.tags.length > 0) variables.input.tags = input.tags;
  if (input.taxExempt !== undefined) variables.input.taxExempt = input.taxExempt;
  if (input.customAttributes) variables.input.customAttributes = input.customAttributes;
  
  if (input.shippingAddress) {
    variables.input.shippingAddress = input.shippingAddress;
  }
  
  if (input.billingAddress) {
    variables.input.billingAddress = input.billingAddress;
  }

  const data = await shopifyGraphQL<{
    draftOrderCreate: {
      draftOrder: any;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(mutation, variables, credentials);

  if (data.draftOrderCreate.userErrors && data.draftOrderCreate.userErrors.length > 0) {
    const errors = data.draftOrderCreate.userErrors.map(e => e.message).join(', ');
    throw new Error(`Failed to create draft order: ${errors}`);
  }

  const order = data.draftOrderCreate.draftOrder;

  return {
    id: order.id,
    name: order.name,
    email: order.email,
    phone: order.phone,
    status: order.status,
    totalPrice: order.totalPriceSet.shopMoney.amount,
    subtotalPrice: order.subtotalPriceSet.shopMoney.amount,
    totalTax: order.totalTaxSet.shopMoney.amount,
    currencyCode: order.totalPriceSet.shopMoney.currencyCode,
    note: order.note,
    tags: order.tags || [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    invoiceUrl: order.invoiceUrl,
    lineItems: order.lineItems.edges.map(({ node }: any) => ({
      id: node.id,
      title: node.title,
      quantity: node.quantity,
      originalUnitPrice: node.originalUnitPriceSet.shopMoney.amount,
      sku: node.sku,
      variant: node.variant ? {
        id: node.variant.id,
        title: node.variant.title,
        sku: node.variant.sku,
      } : undefined,
    })),
    shippingAddress: order.shippingAddress ? {
      first_name: order.shippingAddress.firstName || '',
      last_name: order.shippingAddress.lastName || '',
      address1: order.shippingAddress.address1 || '',
      address2: order.shippingAddress.address2,
      city: order.shippingAddress.city || '',
      province: order.shippingAddress.province || '',
      country: order.shippingAddress.country || '',
      zip: order.shippingAddress.zip || '',
      phone: order.shippingAddress.phone,
      company: order.shippingAddress.company,
    } : null,
    billingAddress: order.billingAddress ? {
      first_name: order.billingAddress.firstName || '',
      last_name: order.billingAddress.lastName || '',
      address1: order.billingAddress.address1 || '',
      address2: order.billingAddress.address2,
      city: order.billingAddress.city || '',
      province: order.billingAddress.province || '',
      country: order.billingAddress.country || '',
      zip: order.billingAddress.zip || '',
      phone: order.billingAddress.phone,
      company: order.billingAddress.company,
    } : null,
    customer: order.customer ? {
      id: order.customer.id,
      email: order.customer.email,
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
    } : null,
  };
}

export async function completeDraftOrder(
  draftOrderId: string,
  paymentPending?: boolean,
  credentials?: ShopifyApiCredentials
): Promise<ShopifyOrder> {
  const mutation = `
    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          id
          order {
            id
            name
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const id = draftOrderId.startsWith('gid://') 
    ? draftOrderId 
    : `gid://shopify/DraftOrder/${draftOrderId}`;

  const data = await shopifyGraphQL<{
    draftOrderComplete: {
      draftOrder: { id: string; order: { id: string; name: string } | null };
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(mutation, { id, paymentPending: paymentPending ?? true }, credentials);

  if (data.draftOrderComplete.userErrors && data.draftOrderComplete.userErrors.length > 0) {
    const errors = data.draftOrderComplete.userErrors.map(e => e.message).join(', ');
    throw new Error(`Failed to complete draft order: ${errors}`);
  }

  const orderId = data.draftOrderComplete.draftOrder.order?.id;
  if (!orderId) {
    throw new Error('Draft order completed but no order was created');
  }

  // Fetch the complete order details
  const numericId = orderId.split('/').pop() || orderId;
  return getOrder(numericId, credentials);
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

