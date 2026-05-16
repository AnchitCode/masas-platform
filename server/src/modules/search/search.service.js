const prisma = require('../../lib/prisma');

/**
 * Public medicine + inventory search near a point.
 * Uses PostGIS on pharmacy lat/lon (float columns) cast to geography.
 *
 * @param {object} params
 * @param {string} params.q
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.radiusKm
 * @param {number} params.page
 * @param {number} params.limit
 */
const searchPublicInventory = async ({ q, lat, lng, radiusKm, page, limit }) => {
  const radiusMeters = radiusKm * 1000;
  const offset = (page - 1) * limit;
  const pattern = `%${q}%`;

  const rows = await prisma.$queryRaw`
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
      COUNT(*) OVER() AS full_count
    FROM pharmacy_inventory pi
    INNER JOIN pharmacies p ON p.id = pi.pharmacy_id
    INNER JOIN medicine_catalog mc ON mc.id = pi.medicine_id
    WHERE p.status = 'VERIFIED'
      AND pi.is_available = true
      AND pi.quantity > 0
      AND (
        mc.name ILIKE ${pattern}
        OR mc.generic_name ILIKE ${pattern}
      )
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_meters ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const total =
    rows.length > 0 && rows[0].full_count != null ? Number(rows[0].full_count) : 0;

  const results = rows.map((row) => ({
    distanceMeters: Number(row.distance_meters),
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
  }));

  return {
    results,
    total,
    page,
    limit,
  };
};

module.exports = {
  searchPublicInventory,
};
