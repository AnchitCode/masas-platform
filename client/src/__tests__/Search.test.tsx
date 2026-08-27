/**
 * Search Page Integration Tests (Phase 9.1f)
 *
 * Tests the Search page's consumption of hybrid search API responses.
 * Uses vitest module mocking to simulate API responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Search from '../pages/Search';

// ─── Mock Dependencies ───────────────────────────────

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', role: 'CUSTOMER' },
    isAuthenticated: true,
  }),
}));

// Mock searchService
const mockSearchInventory = vi.fn();
vi.mock('../services/searchService', () => ({
  default: {
    searchInventory: (...args: any[]) => mockSearchInventory(...args),
  },
}));

// Mock savedSearchService
vi.mock('../services/savedSearchService', () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};
Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

// ─── Helpers ─────────────────────────────────────────

function renderSearch(query = '') {
  return render(
    <MemoryRouter initialEntries={[`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`]}>
      <Search />
    </MemoryRouter>
  );
}

function simulateLocationReady() {
  mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
    success({ coords: { latitude: 28.6139, longitude: 77.209 } });
  });
}

function makeSearchResponse(overrides: Record<string, any> = {}) {
  return {
    success: true,
    message: 'Search completed',
    data: {
      results: [
        {
          distanceMeters: 2500,
          matchType: 'exact',
          pharmacy: {
            id: 'p1',
            userId: 'u1',
            name: 'Test Pharmacy',
            licenseNumber: 'LIC-1',
            address: '123 Test St',
            phone: '1234567890',
            latitude: 28.63,
            longitude: 77.22,
            status: 'VERIFIED',
          },
          medicine: {
            id: 'm1',
            name: 'paracetamol',
            genericName: 'acetaminophen',
            dosageForm: 'Tablet',
          },
          inventory: {
            id: 'i1',
            pharmacyId: 'p1',
            medicineId: 'm1',
            price: 25,
            quantity: 100,
            isAvailable: true,
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      meta: { aiUsed: false },
      ...overrides,
    },
  };
}

// ─── Tests ───────────────────────────────────────────

describe('Search Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchInventory.mockResolvedValue(makeSearchResponse());
    simulateLocationReady();
  });

  it('renders search input with Hinglish-friendly placeholder', () => {
    renderSearch();
    const input = screen.getByPlaceholderText(/dard ki dawa/i);
    expect(input).toBeInTheDocument();
  });

  describe('Exact search', () => {
    it('displays exact match results', async () => {
      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('paracetamol')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
      expect(screen.getByText(/2\.5 km away/)).toBeInTheDocument();
    });
  });

  describe('Semantic search', () => {
    it('displays semantic match results with "Similar match" label', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          results: [
            {
              distanceMeters: 3000,
              matchType: 'semantic',
              pharmacy: {
                id: 'p1', userId: 'u1', name: 'MedPlus', licenseNumber: 'L1',
                address: '456 St', phone: '999', latitude: 28.63, longitude: 77.22, status: 'VERIFIED',
              },
              medicine: {
                id: 'm2', name: 'ibuprofen', genericName: 'ibuprofen', dosageForm: 'Tablet',
              },
              inventory: {
                id: 'i2', pharmacyId: 'p1', medicineId: 'm2', price: 30, quantity: 50, isAvailable: true,
              },
            },
          ],
          meta: { aiUsed: true, normalizedQuery: 'pain medicine' },
        })
      );

      renderSearch('dard ki dawa');

      await waitFor(() => {
        expect(screen.getByText('ibuprofen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('similar-match-label')).toBeInTheDocument();
    });
  });

  describe('Hinglish normalization hint', () => {
    it('shows "Showing results for" when query was normalized', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          meta: { aiUsed: true, normalizedQuery: 'pain medicine' },
        })
      );

      renderSearch('dard ki dawa');

      await waitFor(() => {
        const hint = screen.getByTestId('normalized-query-hint');
        expect(hint).toBeInTheDocument();
        expect(hint).toHaveTextContent('pain medicine');
      });
    });

    it('does NOT show normalization hint for English queries', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          meta: { aiUsed: true },
        })
      );

      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('paracetamol')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('normalized-query-hint')).not.toBeInTheDocument();
    });
  });

  describe('AI fallback / error', () => {
    it('shows results normally when AI is disabled', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          meta: { aiUsed: false },
        })
      );

      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('paracetamol')).toBeInTheDocument();
      });

      // No special AI UI
      expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
      expect(screen.queryByTestId('normalized-query-hint')).not.toBeInTheDocument();
    });

    it('shows error banner when API fails', async () => {
      mockSearchInventory.mockRejectedValue(new Error('Network error'));

      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('Search failed')).toBeInTheDocument();
      });
    });
  });

  describe('Empty results', () => {
    it('shows empty state for no matches', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          results: [],
          total: 0,
          meta: { aiUsed: true },
        })
      );

      renderSearch('nonexistent_medicine_xyz');

      await waitFor(() => {
        expect(screen.getByText('No matches in this area')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('shows Load More button when there are more results', async () => {
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        distanceMeters: 1000 + i * 100,
        matchType: 'exact' as const,
        pharmacy: {
          id: `p${i}`, userId: 'u1', name: `Pharmacy ${i}`, licenseNumber: `L${i}`,
          address: `Addr ${i}`, phone: '999', latitude: 28.63, longitude: 77.22, status: 'VERIFIED',
        },
        medicine: {
          id: `m${i}`, name: 'paracetamol', genericName: 'acetaminophen',
        },
        inventory: {
          id: `i${i}`, pharmacyId: `p${i}`, medicineId: `m${i}`, price: 25, quantity: 100, isAvailable: true,
        },
      }));

      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          results: manyResults,
          total: 50,
        })
      );

      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('Load more results')).toBeInTheDocument();
      });
    });

    it('does NOT show Load More when all results shown', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          total: 1,
        })
      );

      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('paracetamol')).toBeInTheDocument();
      });

      expect(screen.queryByText('Load more results')).not.toBeInTheDocument();
    });
  });

  describe('Match types rendering', () => {
    it('does NOT show Similar match label for exact match', async () => {
      renderSearch('paracetamol');

      await waitFor(() => {
        expect(screen.getByText('paracetamol')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
    });

    it('does NOT show Similar match label for generic match', async () => {
      mockSearchInventory.mockResolvedValue(
        makeSearchResponse({
          results: [{
            distanceMeters: 2500,
            matchType: 'generic',
            pharmacy: {
              id: 'p1', userId: 'u1', name: 'Test Pharmacy', licenseNumber: 'L1',
              address: '123 St', phone: '999', latitude: 28.63, longitude: 77.22, status: 'VERIFIED',
            },
            medicine: {
              id: 'm1', name: 'crocin', genericName: 'acetaminophen', dosageForm: 'Tablet',
            },
            inventory: {
              id: 'i1', pharmacyId: 'p1', medicineId: 'm1', price: 30, quantity: 50, isAvailable: true,
            },
          }],
          meta: { aiUsed: false },
        })
      );

      renderSearch('acetaminophen');

      await waitFor(() => {
        expect(screen.getByText('crocin')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('similar-match-label')).not.toBeInTheDocument();
    });
  });
});
