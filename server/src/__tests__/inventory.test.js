const request = require('supertest');
const app = require('../app');
const {
  createTestUser,
  createTestPharmacy,
  createTestMedicine,
  createTestInventory,
  createVerifiedPharmacyUser,
  createAdminUser,
} = require('./setup');

describe('Inventory Module', () => {
  // ─── Middleware Guards ──────────────────────────────────────

  describe('Middleware guards', () => {
    it('rejects unauthenticated user with 401', async () => {
      const res = await request(app).get('/api/v1/inventory');
      expect(res.status).toBe(401);
    });

    it('rejects non-PHARMACY role with 403', async () => {
      const { accessToken } = await createAdminUser();

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unverified pharmacy with 403', async () => {
      const { user, accessToken } = await createTestUser();
      await createTestPharmacy(user.id, { status: 'PENDING' });

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/PENDING/i);
    });
  });

  // ─── GET Inventory ──────────────────────────────────────────

  describe('GET /api/v1/inventory', () => {
    it('returns empty inventory for new pharmacy', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory).toEqual([]);
    });

    it('returns inventory with medicine details', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine({ name: 'paracetamol' });
      await createTestInventory(pharmacy.id, medicine.id, { price: 30, quantity: 50 });

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.inventory).toHaveLength(1);
      expect(res.body.data.inventory[0].medicine.name).toBe('paracetamol');
      expect(res.body.data.inventory[0].price).toBe(30);
    });
  });

  // ─── POST Add Inventory ────────────────────────────────────

  describe('POST /api/v1/inventory', () => {
    it('adds medicine to inventory', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          medicineName: 'Amoxicillin 500mg',
          genericName: 'Amoxicillin',
          manufacturer: 'Cipla',
          category: 'Antibiotic',
          dosageForm: 'Capsule',
          price: 45,
          quantity: 200,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventoryItem).toBeDefined();
      expect(res.body.data.inventoryItem.price).toBe(45);
      expect(res.body.data.inventoryItem.quantity).toBe(200);
      expect(res.body.data.inventoryItem.medicine).toBeDefined();
    });

    it('creates medicine in catalog if not exists', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          medicineName: 'BrandNewMedicine123',
          price: 100,
          quantity: 10,
        });

      expect(res.status).toBe(201);
      // Medicine name should be lowercased in catalog
      expect(res.body.data.inventoryItem.medicine.name).toBe('brandnewmedicine123');
    });

    it('reuses existing catalog medicine', async () => {
      const medicine = await createTestMedicine({ name: 'existing drug' });
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          medicineName: 'Existing Drug',
          price: 50,
          quantity: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.inventoryItem.medicine.id).toBe(medicine.id);
    });

    it('rejects duplicate medicine for same pharmacy', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine({ name: 'duplicate drug' });
      await createTestInventory(pharmacy.id, medicine.id);

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          medicineName: 'Duplicate Drug',
          price: 25,
          quantity: 5,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative price', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ medicineName: 'NegPrice', price: -10, quantity: 5 });

      expect(res.status).toBe(400);
    });

    it('rejects negative quantity', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ medicineName: 'NegQty', price: 10, quantity: -5 });

      expect(res.status).toBe(400);
    });

    it('defaults isAvailable to true', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();

      const res = await request(app)
        .post('/api/v1/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ medicineName: 'AvailDefault', price: 10, quantity: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.inventoryItem.isAvailable).toBe(true);
    });
  });

  // ─── PATCH Update Inventory ─────────────────────────────────

  describe('PATCH /api/v1/inventory/:id', () => {
    it('updates price and quantity', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmacy.id, medicine.id, { price: 20, quantity: 10 });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ price: 35, quantity: 50 });

      expect(res.status).toBe(200);
      expect(res.body.data.inventoryItem.price).toBe(35);
      expect(res.body.data.inventoryItem.quantity).toBe(50);
    });

    it('auto-sets isAvailable=false when quantity=0', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 10, isAvailable: true });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.inventoryItem.quantity).toBe(0);
      expect(res.body.data.inventoryItem.isAvailable).toBe(false);
    });

    it('auto-sets isAvailable=true when quantity > 0', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 0, isAvailable: false });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 25 });

      expect(res.status).toBe(200);
      expect(res.body.data.inventoryItem.isAvailable).toBe(true);
    });

    it('does not auto-toggle when isAvailable explicitly set', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmacy.id, medicine.id, { quantity: 10 });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 0, isAvailable: true }); // Explicit override

      expect(res.status).toBe(200);
      expect(res.body.data.inventoryItem.quantity).toBe(0);
      expect(res.body.data.inventoryItem.isAvailable).toBe(true);
    });

    it('rejects update to non-existent item', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .patch(`/api/v1/inventory/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ price: 10 });

      expect(res.status).toBe(404);
    });

    it('rejects update to another pharmacy\'s item', async () => {
      // Create pharmacy A's inventory
      const pharmaA = await createVerifiedPharmacyUser({ email: 'a@test.com' });
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmaA.pharmacy.id, medicine.id);

      // Try to update with pharmacy B's token
      const pharmaB = await createVerifiedPharmacyUser({ email: 'b@test.com' });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${pharmaB.accessToken}`)
        .send({ price: 999 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE Inventory ───────────────────────────────────────

  describe('DELETE /api/v1/inventory/:id', () => {
    it('deletes own inventory item', async () => {
      const { pharmacy, accessToken } = await createVerifiedPharmacyUser();
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmacy.id, medicine.id);

      const res = await request(app)
        .delete(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects delete of non-existent item', async () => {
      const { accessToken } = await createVerifiedPharmacyUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .delete(`/api/v1/inventory/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('rejects delete of another pharmacy\'s item', async () => {
      const pharmaA = await createVerifiedPharmacyUser({ email: 'del-a@test.com' });
      const medicine = await createTestMedicine();
      const inv = await createTestInventory(pharmaA.pharmacy.id, medicine.id);

      const pharmaB = await createVerifiedPharmacyUser({ email: 'del-b@test.com' });

      const res = await request(app)
        .delete(`/api/v1/inventory/${inv.id}`)
        .set('Authorization', `Bearer ${pharmaB.accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});
