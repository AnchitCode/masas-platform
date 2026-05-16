/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import catalogService from '../../services/catalogService';
import inventoryService from '../../services/inventoryService';
import { Search, X, Loader2, AlertCircle } from 'lucide-react';
import { FormField, Input } from '../ui/forms';
import { Button } from '../ui/Button';

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
    <div className="modal-backdrop" style={{ zIndex: 100 }}>
      <div className="modal-panel">
        
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-header-title">
            {isEdit ? 'Edit Medicine' : 'Add Medicine'}
          </h2>
          <button onClick={onClose} className="modal-close">
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Form Body */}
        <div className="modal-body">
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', marginBottom: '20px', borderRadius: 'var(--radius-input)', background: '#fef2f2', color: '#dc2626', fontSize: '13px', border: '1px solid #fecaca' }}>
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
            </div>
          )}

          <form id="medicine-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Search/Name */}
            <div ref={wrapperRef} style={{ position: 'relative', zIndex: 20 }}>
              <FormField label="Medicine Name" required>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--muted)', zIndex: 10, pointerEvents: 'none' }} />
                  <Input
                    type="text"
                    style={{ paddingLeft: '36px' }}
                    placeholder="Type to search global catalog..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => { if (!isEdit && suggestions.length > 0) setShowSuggestions(true); }}
                    required
                    disabled={isEdit}
                    autoComplete="off"
                  />
                  {searching && (
                    <Loader2 className="animate-spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--muted)' }} />
                  )}
                </div>
              </FormField>

              {/* Suggestions Dropdown */}
              {!isEdit && showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', boxShadow: 'var(--shadow-lg)', maxHeight: '192px', overflowY: 'auto' }}>
                  {suggestions.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: '13px', transition: 'background-color var(--duration) var(--ease), color var(--duration) var(--ease)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--green-50)'; e.currentTarget.style.color = 'var(--green-600)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'inherit'; }}
                      onClick={() => handleSelectSuggestion(med)}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--text)' }}>{med.name}</span>
                      {med.genericName && (
                        <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{med.genericName}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generic Name */}
            <FormField label="Generic Name (Optional)">
              <Input
                type="text"
                name="genericName"
                placeholder="E.g. Paracetamol"
                value={formData.genericName}
                onChange={handleChange}
                disabled={isEdit}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <FormField label="Price (₹)" required>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: '500', zIndex: 10, pointerEvents: 'none' }}>₹</span>
                  <Input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0.01"
                    style={{ paddingLeft: '32px' }}
                    placeholder="0.00"
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
              </FormField>
              <FormField label="Stock Quantity" required>
                <Input
                  type="number"
                  name="quantity"
                  min="0"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={handleChange}
                  required
                />
              </FormField>
            </div>

            <FormField label="Expiry Date (Optional)">
              <Input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
              />
            </FormField>

            {isEdit && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginTop: '8px', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', background: 'var(--slate-50)', transition: 'background-color var(--duration) var(--ease)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-100)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}>
                <input
                  type="checkbox"
                  name="isAvailable"
                  style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid var(--border)', accentColor: 'var(--green-500)', cursor: 'pointer' }}
                  checked={formData.isAvailable}
                  onChange={handleChange}
                />
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Currently Available for Sale</span>
              </label>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="medicine-form" isLoading={saving}>
            Save Medicine
          </Button>
        </div>

      </div>
    </div>
  );
}
