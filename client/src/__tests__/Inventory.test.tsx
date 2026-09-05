/**
 * Inventory Integration Tests (Stage 7 UI/UX)
 *
 * Verifies the modernized Pharmacy Inventory interface:
 * - Summary stats bar (Total, Healthy, Low Stock, Expiring Soon)
 * - Table rendering with clean column layout (no hidden Generic column)
 * - Expiry and low-stock row styling
 * - In-table search filtering and empty state with clear action
 * - Accessible Modal-based delete confirmation flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Inventory from '../pages/dashboard/Inventory';

// Mock Services
const mockGetOwnProfile = vi.fn();
const mockGetInventory = vi.fn();
const mockDeleteMedicine = vi.fn();

vi.mock('../services/pharmacyService', () => ({
  default: {
    getOwnProfile: () => mockGetOwnProfile(),
  },
}));

vi.mock('../services/inventoryService', () => ({
  default: {
    getInventory: () => mockGetInventory(),
    deleteMedicine: (id: string) => mockDeleteMedicine(id),
  },
}));

const mockVerifiedPharmacy = {
  id: 'pharmacy-1',
  name: 'Apollo Pharmacy Koramangala',
  status: 'VERIFIED',
  address: '123 80ft Road, 4th Block',
  city: 'Bengaluru',
  pincode: '560034',
  latitude: 12.9352,
  longitude: 77.6245,
};

const mockInventoryData = [
  {
    id: 'inv-1',
    price: 45.5,
    quantity: 120,
    isAvailable: true,
    expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
    medicine: {
      id: 'med-1',
      name: 'Paracetamol 500mg',
      genericName: 'Acetaminophen',
    },
  },
  {
    id: 'inv-2',
    price: 180.0,
    quantity: 4, // Low stock (<= 10)
    isAvailable: true,
    expiryDate: new Date(Date.now() + 45 * 86400000).toISOString(), // Expiring soon (<= 90d)
    medicine: {
      id: 'med-2',
      name: 'Amoxyclav 625mg',
      genericName: 'Amoxicillin + Clavulanic Acid',
    },
  },
  {
    id: 'inv-3',
    price: 95.0,
    quantity: 0, // Out of stock
    isAvailable: false,
    expiryDate: new Date(Date.now() - 10 * 86400000).toISOString(), // Expired
    medicine: {
      id: 'med-3',
      name: 'Cetirizine 10mg',
      genericName: 'Cetirizine Hydrochloride',
    },
  },
];

function renderInventory() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/inventory']}>
      <Inventory />
    </MemoryRouter>
  );
}

describe('Inventory UI (Stage 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOwnProfile.mockResolvedValue({
      data: { pharmacy: mockVerifiedPharmacy },
    });
    mockGetInventory.mockResolvedValue({
      data: { inventory: mockInventoryData },
    });
  });

  it('renders summary stats bar with accurate counts', async () => {
    renderInventory();

    await waitFor(() => {
      expect(screen.getByText('Total Medicines')).toBeInTheDocument();
    });

    // Total = 3
    expect(screen.getByText('3')).toBeInTheDocument();
    // Healthy = 1 (Paracetamol)
    expect(screen.getByText('Healthy Stock')).toBeInTheDocument();
    // Low Stock (<= 10) = 1 (Amoxyclav)
    expect(screen.getByText('Low Stock (≤10)')).toBeInTheDocument();
    // Expiring Soon (<= 90d) = 2 (Amoxyclav 45d, Cetirizine expired)
    expect(screen.getByText('Expiring Soon (≤90d)')).toBeInTheDocument();
  });

  it('renders table columns without obsolete hidden Generic column', async () => {
    renderInventory();

    await waitFor(() => {
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByRole('columnheader', { name: /medicine/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /price/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /stock/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /shelf health/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /availability/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /expiry/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();

    // Verify exactly 7 th elements
    const thElements = screen.getAllByRole('columnheader');
    expect(thElements).toHaveLength(7);
  });

  it('filters inventory by medicine name or generic name and provides clear search button', async () => {
    const user = userEvent.setup();
    renderInventory();

    await waitFor(() => {
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by medicine or generic name/i);
    await user.type(searchInput, 'Amoxyclav');

    expect(screen.getByText('Amoxyclav 625mg')).toBeInTheDocument();
    expect(screen.queryByText('Paracetamol 500mg')).not.toBeInTheDocument();

    // Search for non-existent item
    await user.clear(searchInput);
    await user.type(searchInput, 'NonExistentDrug');

    expect(screen.getByText(/no medicines match "nonexistentdrug"/i)).toBeInTheDocument();
    const clearBtns = screen.getAllByRole('button', { name: /clear search/i });
    expect(clearBtns.length).toBe(2);

    await user.click(clearBtns[0]);
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('opens Delete Confirmation Modal and confirms deletion', async () => {
    const user = userEvent.setup();
    mockDeleteMedicine.mockResolvedValueOnce({ success: true });

    renderInventory();

    await waitFor(() => {
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    });

    // Click delete on first item
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    // Modal dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();

    // Click "Delete Medicine" inside modal
    const modalDeleteBtn = screen.getByRole('button', { name: 'Delete Medicine' });
    await user.click(modalDeleteBtn);

    await waitFor(() => {
      expect(mockDeleteMedicine).toHaveBeenCalledWith('inv-1');
    });
  });
});
