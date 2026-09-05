/**
 * PrescriptionModal (Phase 9.2e & Stage 6 UX Polish)
 *
 * Full-screen accessible modal for prescription image upload, OCR extraction,
 * candidate review, editing, and single-click medicine search.
 *
 * Privacy: No image is retained after the modal closes.
 * UX: Mobile-first camera capture, step progress indicators, match confidence tags,
 * and unambiguous search actions.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Search,
  Trash2,
  Pencil,
  Check,
  AlertTriangle,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import prescriptionService from '../../services/prescriptionService';
import type { PrescriptionExtractionResponse, PrescriptionCandidate, PrescriptionMatch } from '../../types';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

type ModalState = 'upload' | 'processing' | 'results' | 'error';

interface ProcessingStep {
  number: number;
  total: number;
  label: string;
  detail: string;
}

/**
 * Compress an image file to reduce upload size.
 * Targets 1MP max resolution, 0.8 quality JPEG.
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof canvas.toBlob !== 'function') {
        resolve(file);
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          const MAX_DIM = 1000;
          let { width, height } = img;

          if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8,
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    } catch {
      resolve(file);
    }
  });
}

function getMatchBadge(match: PrescriptionMatch | undefined | null) {
  if (!match) return null;
  const conf = match.confidence;
  if (match.matchType === 'exact' || conf >= 0.85) {
    return (
      <span className="prescription-candidate__badge prescription-candidate__badge--high" title="High confidence catalog match">
        <Check style={{ width: 11, height: 11 }} aria-hidden="true" />
        <span>Exact match</span>
      </span>
    );
  }
  if (match.matchType === 'fuzzy' || conf >= 0.5) {
    return (
      <span className="prescription-candidate__badge prescription-candidate__badge--medium" title="Catalog suggestion based on spelling">
        <Sparkles style={{ width: 11, height: 11 }} aria-hidden="true" />
        <span>{Math.round(conf * 100)}% match</span>
      </span>
    );
  }
  return (
    <span className="prescription-candidate__badge prescription-candidate__badge--low" title="Possible similar match">
      <HelpCircle style={{ width: 11, height: 11 }} aria-hidden="true" />
      <span>Suggested</span>
    </span>
  );
}

export default function PrescriptionModal({ isOpen, onClose, onSearch }: PrescriptionModalProps) {
  const [state, setState] = useState<ModalState>('upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<PrescriptionExtractionResponse | null>(null);
  const [candidates, setCandidates] = useState<PrescriptionCandidate[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showOcrText, setShowOcrText] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>({
    number: 1,
    total: 2,
    label: 'Preparing scan…',
    detail: 'Initializing OCR engine',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setState('upload');
    setPreview(null);
    setSelectedFile(null);
    setResult(null);
    setCandidates([]);
    setEditingIndex(null);
    setEditValue('');
    setErrorMessage('');
    setShowOcrText(false);
    setProcessingStep({
      number: 1,
      total: 2,
      label: 'Preparing scan…',
      detail: 'Initializing OCR engine',
    });
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type client-side
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please select a JPEG, PNG, or WebP image.');
      setState('error');
      return;
    }

    // Validate file size client-side (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image is too large. Maximum size is 5 MB.');
      setState('error');
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setErrorMessage('');
  }, []);

  const handleScan = useCallback(async () => {
    if (!selectedFile) return;

    setState('processing');
    setProcessingStep({
      number: 1,
      total: 2,
      label: 'Optimizing prescription image…',
      detail: 'Adjusting contrast and preparing for OCR processing',
    });

    try {
      const compressed = await compressImage(selectedFile);

      setProcessingStep({
        number: 2,
        total: 2,
        label: 'Extracting medicine text & matching catalog…',
        detail: 'Running OCR and checking verified medicine database',
      });

      const extractionResult = await prescriptionService.extractMedicines(compressed);

      setResult(extractionResult);
      setCandidates(extractionResult.candidates);

      if (extractionResult.error && extractionResult.candidates.length === 0) {
        setErrorMessage(extractionResult.error);
        setState('error');
      } else {
        setState('results');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process prescription';
      setErrorMessage(message);
      setState('error');
    }
  }, [selectedFile]);

  const handleRemoveCandidate = useCallback((index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartEdit = useCallback((index: number, name: string) => {
    setEditingIndex(index);
    setEditValue(name);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed.length === 0) {
      handleRemoveCandidate(editingIndex);
    } else {
      setCandidates((prev) =>
        prev.map((c, i) => (i === editingIndex ? { ...c, extractedName: trimmed } : c)),
      );
    }
    setEditingIndex(null);
    setEditValue('');
  }, [editingIndex, editValue, handleRemoveCandidate]);

  const handleSearchCandidate = useCallback(
    (name: string) => {
      onSearch(name);
      handleClose();
    },
    [onSearch, handleClose],
  );

  const handleSearchFirst = useCallback(() => {
    if (candidates.length === 0) return;
    const targetName = candidates[0].matches?.[0]?.name || candidates[0].extractedName;
    onSearch(targetName);
    handleClose();
  }, [candidates, onSearch, handleClose]);

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Scan Prescription"
      description="Upload an image of a printed prescription to detect medicine names and check stock nearby."
      size="lg"
    >
      <ModalBody>
        {/* ── Upload State ── */}
        {state === 'upload' && (
          <div className="space-y-4">
            {!preview ? (
              <div
                className="prescription-upload-zone"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload className="prescription-upload-icon" aria-hidden="true" />
                <p className="prescription-upload-title">Take a photo or upload an image</p>
                <p className="prescription-upload-sub">Supports JPEG, PNG, or WebP • Max 5 MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="prescription-preview-box">
                  <img
                    src={preview}
                    alt="Prescription preview"
                    className="prescription-preview-img"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="prescription-preview-remove"
                    aria-label="Remove image"
                    title="Remove selected image"
                  >
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  leftIcon={Search}
                  onClick={handleScan}
                >
                  Scan for medicines
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="prescription-privacy-note">
              <ShieldCheck style={{ width: 14, height: 14, color: 'var(--green-600)', flexShrink: 0 }} aria-hidden="true" />
              <span>Prescription images are processed locally and discarded immediately. No images are stored.</span>
            </div>
          </div>
        )}

        {/* ── Processing State ── */}
        {state === 'processing' && (
          <div className="prescription-processing">
            <Loader2 className="prescription-processing__spinner animate-spin" aria-hidden="true" />
            <span className="prescription-processing__step-badge">
              Step {processingStep.number} of {processingStep.total}
            </span>
            <div className="space-y-1">
              <p className="prescription-processing__label">{processingStep.label}</p>
              <p className="prescription-processing__detail">{processingStep.detail}</p>
            </div>
          </div>
        )}

        {/* ── Results State ── */}
        {state === 'results' && result && (
          <div className="space-y-4">
            {/* Low confidence warning */}
            {result.ocrConfidence > 0 && result.ocrConfidence < 30 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" aria-hidden="true" />
                <span>Low scan resolution or faint text. You can edit any medicine name below before searching.</span>
              </div>
            )}

            {/* Candidates */}
            {candidates.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Detected {candidates.length} medicine{candidates.length !== 1 ? 's' : ''}:
                </p>
                <div className="prescription-candidates-wrap">
                  {candidates.map((candidate, index) => {
                    const bestMatch = candidate.matches && candidate.matches.length > 0 ? candidate.matches[0] : null;

                    return (
                      <div key={index} className="prescription-candidate-card">
                        {editingIndex === index ? (
                          <div className="prescription-candidate__edit-row">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') setEditingIndex(null);
                              }}
                              className="input-field prescription-candidate__edit-input"
                              placeholder="Medicine name"
                              autoFocus
                            />
                            <div className="prescription-candidate__edit-actions">
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                onClick={handleSaveEdit}
                                aria-label="Save"
                              >
                                <Check style={{ width: 14, height: 14 }} />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingIndex(null)}
                                aria-label="Cancel"
                              >
                                <X style={{ width: 14, height: 14 }} />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="prescription-candidate__info">
                              <div className="prescription-candidate__name-row">
                                <p className="prescription-candidate__name">{candidate.extractedName}</p>
                                {getMatchBadge(bestMatch)}
                              </div>
                              {bestMatch && (
                                <p className="prescription-candidate__match-text">
                                  Catalog: <strong>{bestMatch.name}</strong>
                                  {bestMatch.genericName ? ` · ${bestMatch.genericName}` : ''}
                                </p>
                              )}
                            </div>

                            <div className="prescription-candidate__actions">
                              <button
                                type="button"
                                onClick={() => handleSearchCandidate(bestMatch?.name || candidate.extractedName)}
                                className="prescription-candidate__btn prescription-candidate__btn--search"
                                title={`Search ${bestMatch?.name || candidate.extractedName}`}
                                aria-label={`Search ${bestMatch?.name || candidate.extractedName}`}
                              >
                                <Search style={{ width: 13, height: 13 }} />
                                <span className="prescription-candidate__btn-label">Search</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(index, candidate.extractedName)}
                                className="prescription-candidate__btn prescription-candidate__btn--edit"
                                title="Edit medicine name"
                                aria-label="Edit name"
                              >
                                <Pencil style={{ width: 13, height: 13 }} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCandidate(index)}
                                className="prescription-candidate__btn prescription-candidate__btn--remove"
                                title="Remove from list"
                                aria-label="Remove"
                              >
                                <Trash2 style={{ width: 13, height: 13 }} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-700">No medicine names found in the prescription.</p>
                <p className="text-xs text-slate-500 mt-1">Try uploading a clearer, higher-contrast photo or search manually.</p>
              </div>
            )}

            {/* OCR text toggle */}
            {result.ocrText && (
              <div className="border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOcrText(!showOcrText)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  {showOcrText ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                  <span>{showOcrText ? 'Hide' : 'View'} scanned raw text</span>
                </button>
                {showOcrText && (
                  <pre className="mt-2 p-3 rounded-lg bg-slate-100 text-xs text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono border border-slate-200">
                    {result.ocrText}
                  </pre>
                )}
              </div>
            )}

            {/* Processing time */}
            <p className="text-xs text-slate-400 text-center">
              Processed in {(result.meta.totalLatencyMs / 1000).toFixed(1)}s
            </p>
          </div>
        )}

        {/* ── Error State ── */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle style={{ width: 24, height: 24 }} aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">Scan Unsuccessful</p>
              <p className="text-xs text-slate-500 max-w-sm">{errorMessage}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={reset}
            >
              Try another image
            </Button>
          </div>
        )}
      </ModalBody>

      {/* ── Footer ── */}
      {state === 'results' && candidates.length > 0 && (
        <ModalFooter className="prescription-modal__footer">
          <div className="prescription-modal__footer-content">
            <Button
              type="button"
              variant="primary"
              onClick={handleSearchFirst}
              className="w-full"
              leftIcon={Search}
            >
              Search "{candidates[0].matches?.[0]?.name || candidates[0].extractedName}"
            </Button>
            {candidates.length > 1 && (
              <p className="prescription-modal__footer-note">
                Searches 1 medicine at a time. Click "Search" on any medicine above to search it directly.
              </p>
            )}
          </div>
        </ModalFooter>
      )}
    </Modal>
  );
}
