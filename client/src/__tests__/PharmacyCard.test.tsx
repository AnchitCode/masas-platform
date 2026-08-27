/**
 * PharmacyCard Component Tests (Phase 9.1f)
 *
 * Tests the PharmacyCard rendering with hybrid search matchType.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PharmacyCard from '../components/search/PharmacyCard';
import type { Pharmacy, Medicine, InventoryItem } from '../types';

// ─── Test Fixtures ───────────────────────────────────

const mockPharmacy: Pharmacy = {
  id: 'pharm-1',
  userId: 'user-1',
  name: 'MedPlus Pharmacy',
  licenseNumber: 'LIC-001',
  address: '123 MG Road, New Delhi',
  phone: '+91-9876543210',
  latitude: 28.63,
  longitude: 77.22,
  status: 'VERIFIED',
};

const mockMedicine: Medicine = {
  id: 'med-1',
  name: 'paracetamol 500mg',
  genericName: 'acetaminophen',
  dosageForm: 'Tablet',
  category: 'Analgesic',
};

const mockInventory: InventoryItem = {
  id: 'inv-1',
  pharmacyId: 'pharm-1',
  medicineId: 'med-1',
  price: 25.0,
  quantity: 50,
  isAvailable: true,
};

// ─── Tests ───────────────────────────────────────────

describe('PharmacyCard', () => {
  it('renders pharmacy and medicine info', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={2500}
        medicine={mockMedicine}
        inventory={mockInventory}
      />
    );

    expect(screen.getByText('paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByText('MedPlus Pharmacy')).toBeInTheDocument();
    expect(screen.getByText(/2\.5 km away/)).toBeInTheDocument();
    expect(screen.getByText('₹25.00')).toBeInTheDocument();
  });

  it('renders distance in meters when < 1km', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={450}
        medicine={mockMedicine}
        inventory={mockInventory}
      />
    );

    expect(screen.getByText(/450 m away/)).toBeInTheDocument();
  });

  it('shows stock status badge', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
      />
    );

    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('shows Low Stock for quantity <= 10', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={{ ...mockInventory, quantity: 5 }}
      />
    );

    expect(screen.getByText('Low Stock')).toBeInTheDocument();
  });

  // ─── matchType Tests ─────────────────────────────────

  it('does NOT show "Similar match" label for exact matchType', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
        matchType="exact"
      />
    );

    expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
  });

  it('does NOT show "Similar match" label for partial matchType', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
        matchType="partial"
      />
    );

    expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
  });

  it('does NOT show "Similar match" label for generic matchType', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
        matchType="generic"
      />
    );

    expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
  });

  it('shows "Similar match" label for semantic matchType', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
        matchType="semantic"
      />
    );

    const label = screen.getByTestId('similar-match-label');
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent('Similar match');
  });

  it('does NOT show "Similar match" label when matchType is undefined', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
      />
    );

    expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
  });

  it('renders generic name and dosage form', () => {
    render(
      <PharmacyCard
        pharmacy={mockPharmacy}
        distanceMeters={1000}
        medicine={mockMedicine}
        inventory={mockInventory}
      />
    );

    expect(screen.getByText(/acetaminophen · Tablet/)).toBeInTheDocument();
  });

  it('renders null when pharmacy is missing', () => {
    const { container } = render(
      <PharmacyCard
        pharmacy={null as any}
        distanceMeters={1000}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
