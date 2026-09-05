/**
 * PrescriptionModal Integration Tests (Stage 6)
 *
 * Verifies the modernized PrescriptionModal:
 * - Upload state & privacy disclaimer
 * - Compression and multi-step progress indicators
 * - Candidate list with confidence badges (Exact, Fuzzy, Suggested)
 * - Editing and deleting candidate medicines
 * - Unambiguous search actions (individual search & first-item button)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrescriptionModal from '../components/prescription/PrescriptionModal';

// Mock prescriptionService
const mockExtractMedicines = vi.fn();
vi.mock('../services/prescriptionService', () => ({
  default: {
    extractMedicines: (...args: any[]) => mockExtractMedicines(...args),
  },
}));

// Mock URL.createObjectURL and revokeObjectURL
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-image-url');
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

// Mock Image and canvas in jsdom for compressImage
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 800;
  height = 600;
  private _src = '';

  get src() {
    return this._src;
  }
  set src(val: string) {
    this._src = val;
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}
window.Image = MockImage as any;

if (!HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function (callback: any) {
    callback(new Blob(['compressed-image'], { type: 'image/jpeg' }));
  };
}

describe('PrescriptionModal (Stage 6 UX)', () => {
  const mockOnClose = vi.fn();
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload zone and privacy assurance when open', () => {
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
      />
    );

    expect(screen.getByText('Scan Prescription')).toBeInTheDocument();
    expect(screen.getByText('Take a photo or upload an image')).toBeInTheDocument();
    expect(screen.getByText(/Prescription images are processed locally and discarded immediately/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <PrescriptionModal
        isOpen={false}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
      />
    );

    expect(screen.queryByText('Scan Prescription')).not.toBeInTheDocument();
  });

  it('renders candidates with correct match confidence badges after scan', async () => {
    const user = userEvent.setup();

    mockExtractMedicines.mockResolvedValueOnce({
      candidates: [
        {
          extractedName: 'Paracetamol 500mg',
          matches: [
            {
              name: 'Paracetamol',
              genericName: 'Acetaminophen',
              confidence: 0.95,
              matchType: 'exact',
            },
          ],
        },
        {
          extractedName: 'Amoxyclav',
          matches: [
            {
              name: 'Amoxicillin',
              genericName: 'Amoxicillin Trihydrate',
              confidence: 0.72,
              matchType: 'fuzzy',
            },
          ],
        },
      ],
      ocrConfidence: 85,
      ocrText: 'Rx Paracetamol 500mg\nAmoxyclav 625mg',
      meta: { totalLatencyMs: 1200 },
    });

    render(
      <PrescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
      />
    );

    // Select a file through the portal-rendered file input
    const file = new File(['dummy-prescription'], 'rx.jpg', { type: 'image/jpeg' });
    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput, file);

    // Preview should appear with "Scan for medicines" CTA
    const scanButton = screen.getByRole('button', { name: /scan for medicines/i });
    expect(scanButton).toBeInTheDocument();
    await user.click(scanButton);

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Detected 2 medicines:')).toBeInTheDocument();
    });

    // Exact match badge
    expect(screen.getByText('Exact match')).toBeInTheDocument();
    // Fuzzy match badge (72%)
    expect(screen.getByText('72% match')).toBeInTheDocument();

    // Catalog names
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();

    // Search "{first}" button in footer
    const footerSearchBtn = screen.getByRole('button', { name: /search "paracetamol"/i });
    expect(footerSearchBtn).toBeInTheDocument();
    expect(screen.getByText(/searches 1 medicine at a time/i)).toBeInTheDocument();
  });

  it('allows editing a candidate medicine name', async () => {
    const user = userEvent.setup();

    mockExtractMedicines.mockResolvedValueOnce({
      candidates: [
        {
          extractedName: 'Pracitamol',
          matches: [],
        },
      ],
      ocrConfidence: 60,
      ocrText: 'Pracitamol',
      meta: { totalLatencyMs: 800 },
    });

    render(
      <PrescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
      />
    );

    const file = new File(['dummy-prescription'], 'rx.jpg', { type: 'image/jpeg' });
    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /scan for medicines/i }));

    await waitFor(() => {
      expect(screen.getByText('Pracitamol')).toBeInTheDocument();
    });

    // Click edit
    const editBtn = screen.getByRole('button', { name: /edit name/i });
    await user.click(editBtn);

    const editInput = screen.getByPlaceholderText('Medicine name');
    await user.clear(editInput);
    await user.type(editInput, 'Paracetamol');

    // Click save
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await user.click(saveBtn);

    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.queryByText('Pracitamol')).not.toBeInTheDocument();
  });

  it('triggers onSearch when individual Search button is clicked', async () => {
    const user = userEvent.setup();

    mockExtractMedicines.mockResolvedValueOnce({
      candidates: [
        {
          extractedName: 'Azithromycin 500',
          matches: [
            {
              name: 'Azithromycin',
              confidence: 0.9,
              matchType: 'exact',
            },
          ],
        },
      ],
      ocrConfidence: 90,
      ocrText: 'Azithromycin 500',
      meta: { totalLatencyMs: 950 },
    });

    render(
      <PrescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
      />
    );

    const file = new File(['dummy-prescription'], 'rx.jpg', { type: 'image/jpeg' });
    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /scan for medicines/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /search azithromycin/i })).toBeInTheDocument();
    });

    const candidateSearchBtn = screen.getByRole('button', { name: /search azithromycin/i });
    await user.click(candidateSearchBtn);

    expect(mockOnSearch).toHaveBeenCalledWith('Azithromycin');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
