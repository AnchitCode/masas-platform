/**
 * PrescriptionModal (Phase 9.2e)
 *
 * Full-screen modal for prescription image upload, OCR extraction,
 * and medicine name review before searching.
 *
 * Privacy: No image is retained after the modal closes.
 * UX: Mobile-first with camera capture support via HTML5 file input.
 */
import { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, Search, Trash2, Pencil, Check, AlertTriangle, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import prescriptionService from '../../services/prescriptionService';
import type { PrescriptionExtractionResponse, PrescriptionCandidate } from '../../types';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

type ModalState = 'upload' | 'processing' | 'results' | 'error';

/**
 * Compress an image file to reduce upload size.
 * Targets 1MP max resolution, 0.8 quality JPEG.
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Target max 1MP (1000x1000)
      const MAX_DIM = 1000;
      let { width, height } = img;

      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file); // Fallback to original
          }
        },
        'image/jpeg',
        0.8,
      );
    };

    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
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
  const [processingStage, setProcessingStage] = useState('');
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
    setProcessingStage('');
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
    setProcessingStage('Compressing image…');

    try {
      const compressed = await compressImage(selectedFile);

      setProcessingStage('Reading prescription text…');

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
      // Remove if edited to empty
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

  const handleSearchAll = useCallback(() => {
    if (candidates.length === 0) return;
    // Search for the first candidate (user can search others individually)
    onSearch(candidates[0].extractedName);
    handleClose();
  }, [candidates, onSearch, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900">Scan Prescription</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Upload State ── */}
          {state === 'upload' && (
            <div className="space-y-4">
              {!preview ? (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm font-medium text-slate-700">
                    Take a photo or upload an image
                  </p>
                  <p className="text-xs text-slate-500 mt-1">JPEG, PNG, or WebP • Max 5 MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-slate-100">
                    <img
                      src={preview}
                      alt="Prescription preview"
                      className="w-full max-h-64 object-contain"
                    />
                    <button
                      onClick={() => {
                        setPreview(null);
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleScan}
                    className="w-full py-3 px-4 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Scan for medicines
                  </button>
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

              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Your prescription image is processed locally and is not stored.
                Only printed prescriptions are supported.
              </p>
            </div>
          )}

          {/* ── Processing State ── */}
          {state === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm font-medium text-slate-700">{processingStage}</p>
              <p className="text-xs text-slate-400">This may take 5–15 seconds</p>
            </div>
          )}

          {/* ── Results State ── */}
          {state === 'results' && result && (
            <div className="space-y-4">
              {/* Low confidence warning */}
              {result.ocrConfidence > 0 && result.ocrConfidence < 30 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Low quality scan. Results may be inaccurate.</span>
                </div>
              )}

              {/* Candidates */}
              {candidates.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">
                    Found {candidates.length} possible medicine{candidates.length !== 1 ? 's' : ''}:
                  </p>
                  <div className="space-y-2">
                    {candidates.map((candidate, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 group"
                      >
                        {editingIndex === index ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                              className="flex-1 px-2 py-1 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEdit}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              aria-label="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {candidate.extractedName}
                              </p>
                              {candidate.matches.length > 0 && (
                                <p className="text-xs text-slate-500 truncate">
                                  Possible match: {candidate.matches[0].name}
                                  {candidate.matches[0].genericName
                                    ? ` (${candidate.matches[0].genericName})`
                                    : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleSearchCandidate(candidate.extractedName)}
                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title="Search this medicine"
                              >
                                <Search className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartEdit(index, candidate.extractedName)}
                                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Edit name"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveCandidate(index)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No medicine names found in the prescription.</p>
                  <p className="text-xs text-slate-400 mt-1">Try a clearer photo or search manually.</p>
                </div>
              )}

              {/* OCR text toggle */}
              {result.ocrText && (
                <div className="border-t border-slate-200 pt-3">
                  <button
                    onClick={() => setShowOcrText(!showOcrText)}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    {showOcrText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showOcrText ? 'Hide' : 'Show'} scanned text
                  </button>
                  {showOcrText && (
                    <pre className="mt-2 p-3 rounded-lg bg-slate-100 text-xs text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
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
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-slate-700 text-center">{errorMessage}</p>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {state === 'results' && candidates.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleSearchAll}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search "{candidates[0].extractedName}"
              {candidates.length > 1 && (
                <span className="text-xs opacity-80">+{candidates.length - 1} more</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
