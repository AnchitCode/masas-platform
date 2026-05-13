# Phase 3: Inventory Management — Implementation Plan

## Overview
Phase 3 focuses on enabling verified pharmacies to manage their medicine stock. This phase bridges the global catalog of medicines (`MedicineCatalog`) with a pharmacy's specific stock (`PharmacyInventory`). It involves creating the backend modules to handle CRUD operations and the frontend interfaces to manage stock levels and pricing.

---

## Step 1: Backend Catalog & Inventory Modules

### 1.1 Catalog Module (`src/modules/catalog/`)
The catalog is a shared global database of medicines.
- **Routes (`catalog.routes.js`)**: 
  - `GET /search?q=query` — Returns autocomplete suggestions for medicines.
- **Service & Controller**: 
  - Query `MedicineCatalog` using `contains` or fuzzy matching for the `name` or `genericName`.

### 1.2 Inventory Module (`src/modules/inventory/`)
Handles the specific stock for the authenticated pharmacy.
- **Validation (`inventory.validation.js`)**: 
  - Zod schemas for adding (`medicineName`, `price`, `quantity`, `expiryDate`) and updating items.
- **Service (`inventory.service.js`)**:
  - `addInventory`: Resolves the `medicineName` against the `MedicineCatalog` (creating a new entry if it doesn't exist), then creates the `PharmacyInventory` record.
  - `updateInventory`: Updates price, stock, or `isAvailable` status.
- **Routes (`inventory.routes.js`)**:
  - `GET /` — List all inventory items for the logged-in pharmacy.
  - `POST /` — Add a new medicine to inventory.
  - `PUT /:id` — Update an inventory item.
  - `DELETE /:id` — Remove an inventory item.
- **Security Check**:
  - Add middleware to ensure only `VERIFIED` pharmacies can perform `POST/PUT/DELETE` inventory actions.

---

## Step 2: Frontend API Integration

### 2.1 `src/services/catalogService.js`
Create an Axios service to hit the catalog endpoints.
- `searchMedicines(query)`: Fetches suggestions for the autocomplete input.

### 2.2 `src/services/inventoryService.js`
Create an Axios service for inventory management.
- `getInventory()`: Fetches the pharmacy's current stock.
- `addMedicine(data)`: Submits new inventory item.
- `updateMedicine(id, data)`: Modifies existing item.
- `deleteMedicine(id)`: Removes item.

---

## Step 3: Frontend Inventory UI

### 3.1 Inventory Dashboard (`src/pages/dashboard/Inventory.jsx`)
- Remove the current Phase 3 placeholder.
- **Data Table**: Display the pharmacy's inventory showing Medicine Name, Generic Name, Price, Stock Quantity, Expiry, and Status (Available/Out of Stock).
- **Actions**: Add an "Add Medicine" button and row-level "Edit/Delete" actions.

### 3.2 Add/Edit Medicine Modal (`src/components/inventory/MedicineModal.jsx`)
- **Autocomplete Input**: A custom input that searches the `catalogService` as the user types, allowing them to select an existing medicine or register a new one.
- **Form Fields**: Price, Quantity (Stock), Expiry Date.

### 3.3 Status Guarding
- Ensure the UI gracefully blocks access or disables the "Add Medicine" features if the pharmacy status is `PENDING` or `REJECTED`, which aligns with the Dashboard protections added in Phase 2.

---

## Step 4: Testing & Polish
1. **Catalog Matching**: Test that adding a completely new medicine properly creates a `MedicineCatalog` entry.
2. **Stock Management**: Verify that quantity updates accurately reflect on the frontend table.
3. **Security**: Ensure API rejects inventory modification attempts from unverified pharmacies.
4. **UX**: Add loading skeletons for the inventory table and toast notifications for success/error states.
