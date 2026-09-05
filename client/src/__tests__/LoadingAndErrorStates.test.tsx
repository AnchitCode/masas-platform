/**
 * Stage 9 Integration Tests: Loading, Empty, and Error States
 *
 * Verifies:
 * - SearchResultSkeleton layout and accessibility attributes
 * - AlertBanner with interactive action slot (retry button)
 * - SavedSearches card skeleton loading state
 * - SavedSearches retry error banner
 * - SavedSearches delete confirmation modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SearchResultSkeleton from '../components/ui/SearchResultSkeleton';
import AlertBanner from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import SavedSearches from '../pages/SavedSearches';

// Mock savedSearchService
const mockList = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../services/savedSearchService', () => ({
  default: {
    list: () => mockList(),
    delete: (id: string) => mockDelete(id),
    update: (id: string, data: any) => mockUpdate(id, data),
  },
}));

describe('Stage 9: Loading, Empty, and Error States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SearchResultSkeleton', () => {
    it('renders the requested count of skeleton cards with accessible status role', () => {
      render(<SearchResultSkeleton count={3} />);

      const skeletonContainer = screen.getByTestId('search-results-skeleton');
      expect(skeletonContainer).toBeInTheDocument();
      expect(skeletonContainer).toHaveAttribute('role', 'status');
      expect(skeletonContainer).toHaveAttribute('aria-label', 'Searching verified stock');

      const cards = skeletonContainer.querySelectorAll('.pharmacy-card-skeleton');
      expect(cards).toHaveLength(3);
    });
  });

  describe('AlertBanner with Action Slot', () => {
    it('renders error banner with interactive retry button', async () => {
      const user = userEvent.setup();
      const mockRetry = vi.fn();

      render(
        <AlertBanner
          variant="error"
          title="Connection Error"
          action={
            <Button size="sm" variant="secondary" onClick={mockRetry}>
              Try again
            </Button>
          }
        >
          Could not connect to MASAS servers.
        </AlertBanner>
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Could not connect to MASAS servers.')).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /try again/i });
      expect(retryBtn).toBeInTheDocument();

      await user.click(retryBtn);
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('SavedSearches Loading and Error Experience', () => {
    it('renders skeleton cards while loading saved searches', async () => {
      // Delay response to test loading skeleton
      let resolvePromise: (value: any) => void;
      mockList.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(
        <MemoryRouter initialEntries={['/saved-searches']}>
          <SavedSearches />
        </MemoryRouter>
      );

      // Should show skeleton loading container
      expect(screen.getByRole('status', { name: /loading saved searches/i })).toBeInTheDocument();

      // Resolve and verify content appears
      resolvePromise!({
        data: [
          {
            id: 'saved-1',
            query: 'paracetamol',
            radiusKm: 12,
            isActive: true,
          },
        ],
      });

      await waitFor(() => {
        expect(screen.getByText('paracetamol')).toBeInTheDocument();
      });
    });

    it('shows error banner with retry capability when list API fails', async () => {
      const user = userEvent.setup();
      mockList.mockRejectedValueOnce(new Error('Network disconnected'));

      render(
        <MemoryRouter initialEntries={['/saved-searches']}>
          <SavedSearches />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load saved searches/i)).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();

      mockList.mockResolvedValueOnce({
        data: [
          {
            id: 'saved-2',
            query: 'amoxyclav',
            radiusKm: 12,
            isActive: true,
          },
        ],
      });

      await user.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('amoxyclav')).toBeInTheDocument();
      });
    });

    it('opens delete confirmation modal and removes search', async () => {
      const user = userEvent.setup();
      mockList.mockResolvedValueOnce({
        data: [
          {
            id: 'saved-3',
            query: 'cetirizine',
            radiusKm: 12,
            isActive: true,
          },
        ],
      });
      mockDelete.mockResolvedValueOnce({ success: true });

      render(
        <MemoryRouter initialEntries={['/saved-searches']}>
          <SavedSearches />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('cetirizine')).toBeInTheDocument();
      });

      // Click delete button
      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteBtn);

      // Modal appears
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to remove the stock alert for/i)).toBeInTheDocument();

      // Confirm in modal
      const modalConfirmBtn = screen.getByRole('button', { name: /delete alert/i });
      await user.click(modalConfirmBtn);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('saved-3');
      });
    });
  });
});
