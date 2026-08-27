import prisma from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import type { SearchInventoryQuery } from './search.validation.js';
import { findSemanticCandidates } from '../../ai/search/semanticSearch.js';
import logger from '../../utils/logger.js';

interface SearchRow {
  inventory_id: string;
  inventory_price: number;
  inventory_quantity: number;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone: string;
  pharmacy_latitude: number;
  pharmacy_longitude: number;
  medicine_id: string;
  medicine_name: string;
  medicine_generic_name: string | null;
  medicine_manufacturer: string | null;
  medicine_category: string | null;
  medicine_dosage_form: string | null;
  distance_meters: number;
  relevance_score: number;
  full_count: bigint | null;
}

/**
 * Public medicine + inventory search near a point (Phase 9.1e Hybrid Search).
 * Uses PostGIS on pharmacy lat/lon (float columns) cast to geography.
 * Ranks by relevance tier first, then distance.
 */
const searchPublicInventory = async ({ q, lat, lng, radiusKm, page, limit }: SearchInventoryQuery) => {
  const radiusMeters = radiusKm * 1000;
  const offset = (page - 1) * limit;
  const pattern = `%${q}%`;
  const exact = q;

  // 1. Fetch semantic candidates (Phase 9.1d)
  // Limited to 20 candidates. In a large catalog with geo-filtering, 10 might be 
  // too aggressive to find a nearby match. 20 is safe without hurting performance.
  const { candidates, aiUsed, normalizedQuery } = await findSemanticCandidates(q, 20);

  // 2. Build parameterized semantic join clause safely
  let semanticJoin = Prisma.empty;
  let matchCondition = Prisma.sql`(mc.name ILIKE ${pattern} OR mc.generic_name ILIKE ${pattern})`;
  let semanticScore = Prisma.sql`0`;

  if (candidates.length > 0) {
    const valueTuples = candidates.map(
      (c) => Prisma.sql`(${c.id}::text, ${c.score}::float)`
    );
    semanticJoin = Prisma.sql`LEFT JOIN (VALUES ${Prisma.join(valueTuples)}) AS sem(id, score) ON mc.id = sem.id`;
    matchCondition = Prisma.sql`(${matchCondition} OR sem.id IS NOT NULL)`;
    semanticScore = Prisma.sql`COALESCE(sem.score * 60, 0)`;
  }

  // 3. Execute hybrid query using Prisma's tagged templates for injection safety
  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      pi.id AS inventory_id,
      pi.price AS inventory_price,
      pi.quantity AS inventory_quantity,
      p.id AS pharmacy_id,
      p.name AS pharmacy_name,
      p.address AS pharmacy_address,
      p.phone AS pharmacy_phone,
      p.latitude AS pharmacy_latitude,
      p.longitude AS pharmacy_longitude,
      mc.id AS medicine_id,
      mc.name AS medicine_name,
      mc.generic_name AS medicine_generic_name,
      mc.manufacturer AS medicine_manufacturer,
      mc.category AS medicine_category,
      mc.dosage_form AS medicine_dosage_form,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_meters,
      GREATEST(
        CASE WHEN mc.name ILIKE ${exact} THEN 100 ELSE 0 END,
        CASE WHEN mc.name ILIKE ${pattern} THEN 80 ELSE 0 END,
        CASE WHEN mc.generic_name ILIKE ${pattern} THEN 70 ELSE 0 END,
        ${semanticScore}
      ) AS relevance_score,
      COUNT(*) OVER() AS full_count
    FROM pharmacy_inventory pi
    INNER JOIN pharmacies p ON p.id = pi.pharmacy_id
    INNER JOIN medicine_catalog mc ON mc.id = pi.medicine_id
    ${semanticJoin}
    WHERE p.status = 'VERIFIED'
      AND pi.is_available = true
      AND pi.quantity > 0
      AND ${matchCondition}
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY relevance_score DESC, distance_meters ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const total = rows.length > 0 && rows[0].full_count != null ? Number(rows[0].full_count) : 0;

  const results = rows.map((row) => {
    // Determine the minimal matchType metadata
    const score = Number(row.relevance_score);
    let matchType = 'semantic';
    if (score >= 100) matchType = 'exact';
    else if (score >= 80) matchType = 'partial';
    else if (score >= 70) matchType = 'generic';

    return {
      distanceMeters: Number(row.distance_meters),
      matchType,
      pharmacy: {
        id: row.pharmacy_id,
        name: row.pharmacy_name,
        address: row.pharmacy_address,
        phone: row.pharmacy_phone,
        latitude: row.pharmacy_latitude,
        longitude: row.pharmacy_longitude,
      },
      medicine: {
        id: row.medicine_id,
        name: row.medicine_name,
        genericName: row.medicine_generic_name,
        manufacturer: row.medicine_manufacturer,
        category: row.medicine_category,
        dosageForm: row.medicine_dosage_form,
      },
      inventory: {
        id: row.inventory_id,
        price: row.inventory_price,
        quantity: row.inventory_quantity,
      },
    };
  });

  return {
    results,
    total,
    page,
    limit,
    meta: {
      aiUsed,
      normalizedQuery: aiUsed && normalizedQuery !== q.toLowerCase().trim() ? normalizedQuery : undefined,
    },
  };
};

export {
  searchPublicInventory,
};
