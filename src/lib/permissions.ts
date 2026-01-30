// Central roles & permissions model based on the CSV in
// /Users/jacklyons/Downloads/Untitled spreadsheet - Sheet1.csv
//
// Roles:
// - Admin
// - Sales Rep
// - Distributor
// - Technician
//
// Permissions (columns):
// - Full Access            (Admin only, implies all others)
// - OrdersViewing
// - InventoryViewing
// - InventoryEditing       (able to add or take away inventory)
// - QrCodesBarcodes
// - Quoting
// - QuotingCustomItems
// - ManufacturerOrders

export type Role = 'Admin' | 'Sales Rep' | 'Distributor' | 'Technician'

export type Permission =
  | 'FullAccess'
  | 'OrdersViewing'
  | 'InventoryViewing'
  | 'InventoryEditing'
  | 'QrCodesBarcodes'
  | 'Quoting'
  | 'QuotingCustomItems'
  | 'ManufacturerOrders'

// Matrix taken directly from the CSV:
// Role        Full Access  Orders viewing  Inventory Viewing  Inventory Editing  QR Codes/Barcodes  Quoting  Quoting (with custom items)  Manufacturer Orders
// Admin       TRUE         TRUE            TRUE                TRUE               TRUE               TRUE     TRUE                         TRUE
// Sales Rep   FALSE        FALSE           TRUE                FALSE              FALSE              TRUE     FALSE                        FALSE
// Distributor FALSE        FALSE           TRUE                FALSE              FALSE              TRUE     FALSE                        FALSE
// Technician  FALSE        TRUE            TRUE                TRUE               TRUE               TRUE     FALSE                        FALSE

export const ROLE_PERMISSIONS: Record<Role, Record<Permission, boolean>> = {
  Admin: {
    FullAccess: true,
    OrdersViewing: true,
    InventoryViewing: true,
    InventoryEditing: true,
    QrCodesBarcodes: true,
    Quoting: true,
    QuotingCustomItems: true,
    ManufacturerOrders: true,
  },
  'Sales Rep': {
    FullAccess: false,
    OrdersViewing: false,
    InventoryViewing: true,
    InventoryEditing: false,
    QrCodesBarcodes: false,
    Quoting: true,
    QuotingCustomItems: false,
    ManufacturerOrders: false,
  },
  Distributor: {
    FullAccess: false,
    OrdersViewing: false,
    InventoryViewing: true,
    InventoryEditing: false,
    QrCodesBarcodes: false,
    Quoting: true,
    QuotingCustomItems: false,
    ManufacturerOrders: false,
  },
  Technician: {
    FullAccess: false,
    OrdersViewing: true,
    InventoryViewing: true,
    InventoryEditing: true,
    QrCodesBarcodes: true,
    Quoting: true,
    QuotingCustomItems: false,
    ManufacturerOrders: false,
  },
}

export function normalizeRole(rawRole: string | null | undefined): Role {
  if (!rawRole) {
    // Default generic accounts to Distributor unless overridden at signup/admin
    return 'Distributor'
  }

  const trimmed = rawRole.trim()

  // Already in canonical form
  if (
    trimmed === 'Admin' ||
    trimmed === 'Sales Rep' ||
    trimmed === 'Distributor' ||
    trimmed === 'Technician'
  ) {
    return trimmed
  }

  // Map legacy roles to new ones
  const lower = trimmed.toLowerCase()
  if (lower === 'rep' || lower === 'salesrep' || lower === 'sales_rep') {
    return 'Sales Rep'
  }
  if (lower === 'tech' || lower === 'technician') {
    return 'Technician'
  }
  if (lower === 'admin' || lower === 'administrator' || lower.startsWith('admin')) {
    return 'Admin'
  }

  // Fallback generic user → Distributor
  return 'Distributor'
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false

  // FullAccess implies everything
  if (perms.FullAccess) {
    return true
  }

  return !!perms[permission]
}

// Client-side helper to read role from the user_info cookie (when available)
export function getRoleFromUserInfoCookie(): Role | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';').map((c) => c.trim())
  const userInfoCookie = cookies.find((c) => c.startsWith('user_info='))
  if (!userInfoCookie) return null

  try {
    // Value may contain '=' (e.g. encoded), so take everything after first '='
    const eqIndex = userInfoCookie.indexOf('=')
    const rawValue = userInfoCookie.slice(eqIndex + 1).trim()
    const decoded = decodeURIComponent(rawValue)
    const parsed = JSON.parse(decoded) as { role?: string | null }
    return normalizeRole(parsed.role)
  } catch {
    return null
  }
}


