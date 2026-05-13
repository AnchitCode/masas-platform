/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import catalogService from '../../services/catalogService';
import inventoryService from '../../services/inventoryService';
import { Search, X, Loader2, AlertCircle } from 'lucide-react';

function formatInventoryApiError(err) {
  const data = err.response?.data;
  if (!data) return 'Failed to save medicine';
  const base = data.message || 'Failed to save medicine';
  if (!Array.isArray(data.errors) || data.errors.length === 0) return base;
  const lines = data.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message));
  return `${base}\n${lines.join('\n')}`;
}

export default function MedicineModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const isEdit = !!initialData;

  const [formData, setFormData] = useState({
    medicineName: '',
    genericName: '',
    price: '',
    quantity: '',
    expiryDate: '',
    isAvailable: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        medicineName: initialData.medicine?.name ?? '',
        genericName: initialData.medicine?.genericName || '',
        price: initialData.price,
        quantity: initialData.quantity,
        expiryDate: initialData.expiryDate ? initialData.expiryDate.split('T')[0] : '',
        isAvailable: initialData.isAvailable,
      });
      setSearchQuery(initialData.medicine?.name ?? '');
    } else {
      // Reset form
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        medicineName: '',
        genericName: '',
        price: '',
        quantity: '',
        expiryDate: '',
        isAvailable: true,
      });
      setSearchQuery('');
    }
    setError('');
  }, [initialData, isOpen]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (isEdit || !searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await catalogService.searchMedicines(searchQuery);
        setSuggestions(res?.data?.medicines ?? []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isEdit]);

  const handleSelectSuggestion = (medicine) => {
    setSearchQuery(medicine.name);
    setFormData((prev) => ({
      ...prev,
      medicineName: medicine.name,
      genericName: medicine.genericName || '',
    }));
    setShowSuggestions(false);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setFormData((prev) => ({ ...prev, medicineName: val }));
    setShowSuggestions(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const medicineName = (isEdit ? formData.medicineName : formData.medicineName || searchQuery || '')
        .trim();
      if (!medicineName) {
        setError('Medicine name is required');
        return;
      }

      const price = Number(formData.price);
      const quantity = Number.parseInt(String(formData.quantity), 10);
      if (Number.isNaN(price) || price <= 0) {
        setError('Enter a valid price greater than 0');
        return;
      }
      if (Number.isNaN(quantity) || quantity < 0) {
        setError('Enter a valid stock quantity (0 or more)');
        return;
      }

      const expiryDate = formData.expiryDate
        ? new Date(`${formData.expiryDate}T12:00:00`).toISOString()
        : '';

      const payload = isEdit
        ? {
            price,
            quantity,
            expiryDate,
            isAvailable: formData.isAvailable,
          }
        : {
            medicineName,
            genericName: formData.genericName?.trim() || undefined,
            price,
            quantity,
            expiryDate,
            isAvailable: formData.isAvailable,
          };

      if (isEdit) {
        await inventoryService.updateMedicine(initialData.id, payload);
      } else {
        await inventoryService.addMedicine(payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(formatInventoryApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface-hover/30">
          <h2 className="text-lg font-bold text-text tracking-tight">
            {isEdit ? 'Edit Medicine' : 'Add Medicine'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:bg-border hover:text-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 mb-5 rounded-lg bg-red-50 text-danger text-sm border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          <form id="medicine-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Search/Name */}
            <div ref={wrapperRef} className="relative">
              <label className="label text-text-secondary">Medicine Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  className={`input pl-9 ${isEdit ? 'bg-surface-hover text-text-muted cursor-not-allowed border-dashed' : ''}`}
                  placeholder="Type to search global catalog..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => { if (!isEdit && suggestions.length > 0) setShowSuggestions(true); }}
                  required
                  disabled={isEdit}
                  autoComplete="off"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {!isEdit && showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-primary/5 hover:text-primary transition-colors border-b border-border last:border-0"
                      onClick={() => handleSelectSuggestion(med)}
                    >
                      <span className="font-semibold text-text">{med.name}</span>
                      {med.genericName && (
                        <span className="block text-xs text-text-muted mt-0.5">{med.genericName}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generic Name */}
            <div>
              <label className="label text-text-secondary">Generic Name (Optional)</label>
              <input
                type="text"
                name="genericName"
                className={`input ${isEdit ? 'bg-surface-hover text-text-muted cursor-not-allowed border-dashed' : ''}`}
                placeholder="E.g. Paracetamol"
                value={formData.genericName}
                onChange={handleChange}
                disabled={isEdit}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-text-secondary">Price (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">₹</span>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0.01"
                    className="input pl-8"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label text-text-secondary">Stock Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min="0"
                  className="input"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label text-text-secondary">Expiry Date (Optional)</label>
              <input
                type="date"
                name="expiryDate"
                className="input"
                value={formData.expiryDate}
                onChange={handleChange}
              />
            </div>

            {isEdit && (
              <label className="flex items-center gap-3 cursor-pointer mt-2 p-3 border border-border rounded-lg bg-surface-hover/30 hover:bg-surface-hover/50 transition-colors">
                <input
                  type="checkbox"
                  name="isAvailable"
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                  checked={formData.isAvailable}
                  onChange={handleChange}
                />
                <span className="text-sm font-semibold text-text">Currently Available for Sale</span>
              </label>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-hover/30 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost px-5">
            Cancel
          </button>
          <button type="submit" form="medicine-form" className="btn btn-primary px-6 shadow-sm" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Medicine'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
