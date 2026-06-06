/**
 * Shared client-side type definitions for API entities.
 * These mirror the Prisma models used on the server but are
 * intentionally loose (optional fields) since API responses
 * may include partial data depending on the endpoint.
 */

/* ─── Medicine (global catalog) ─────────────────────── */
export interface Medicine {
  id: string;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  description?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
}

/* ─── Inventory Item (pharmacy stock) ───────────────── */
export interface InventoryItem {
  id: string;
  pharmacyId: string;
  medicineId: string;
  price: number;
  quantity: number;
  isAvailable: boolean;
  expiryDate?: string | null;
  batchNumber?: string | null;
  medicine?: Medicine | null;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── Pharmacy ──────────────────────────────────────── */
export interface Pharmacy {
  id: string;
  userId: string;
  name: string;
  licenseNumber: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string | null;
  user?: { email: string; role?: string };
  _count?: { inventory?: number };
  createdAt?: string;
  updatedAt?: string;
}

/* ─── Search result row ─────────────────────────────── */
export interface SearchResultRow {
  pharmacy: Pharmacy;
  medicine: Medicine;
  inventory: InventoryItem;
  distanceMeters: number;
}

/* ─── Admin stats ───────────────────────────────────── */
export interface AdminStats {
  totalPharmacies: number;
  verifiedPharmacies: number;
  pendingPharmacies: number;
  totalMedicines: number;
  totalInventoryItems: number;
  totalUsers: number;
  recentPharmacies: Pharmacy[];
}

/* ─── Catalog suggestion ────────────────────────────── */
export interface CatalogSuggestion {
  id: string;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
}
