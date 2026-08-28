/**
 * Shared client-side type definitions for API entities.
 * These mirror the Prisma models used on the server but are
 * intentionally loose (optional fields) since API responses
 * may include partial data depending on the endpoint.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  error?: string;
}

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
  /** How this result was matched (Phase 9.1e hybrid search) */
  matchType?: 'exact' | 'partial' | 'generic' | 'semantic';
}

/* ─── Search response metadata ──────────────────────── */
export interface SearchMeta {
  aiUsed?: boolean;
  /** Normalized query if Hinglish was translated (e.g. "dard ki dawa" → "pain medicine") */
  normalizedQuery?: string;
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

/* ─── Prescription scanner (Phase 9.2e) ─────────────── */
export interface PrescriptionMatch {
  id: string;
  name: string;
  genericName: string | null;
  matchType: 'exact' | 'fuzzy' | 'semantic';
  confidence: number;
}

export interface PrescriptionCandidate {
  extractedName: string;
  matches: PrescriptionMatch[];
}

export interface PrescriptionExtractionResponse {
  ocrText: string;
  ocrConfidence: number;
  candidates: PrescriptionCandidate[];
  meta: {
    ocrLatencyMs: number;
    llmLatencyMs: number;
    matchLatencyMs: number;
    totalLatencyMs: number;
    aiUsed: boolean;
  };
  error?: string;
}
