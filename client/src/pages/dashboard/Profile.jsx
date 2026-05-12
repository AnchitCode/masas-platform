import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pharmacyService from '../../services/pharmacyService';
import { useAuth } from '../../context/AuthContext';
import { Store, MapPin, Phone, FileText, AlertCircle, CheckCircle, Map, Crosshair } from 'lucide-react';

export default function Profile() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pharmacy, setPharmacy] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    licenseNumber: '',
    address: '',
    phone: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await pharmacyService.getOwnProfile();
        const p = response.data.pharmacy;
        setPharmacy(p);
        setFormData({
          name: p.name,
          licenseNumber: p.licenseNumber,
          address: p.address,
          phone: p.phone,
          latitude: p.latitude,
          longitude: p.longitude,
        });
        setIsEditing(true);
      } catch {
        setIsEditing(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
      };

      if (isEditing) {
        // eslint-disable-next-line no-unused-vars
        const { licenseNumber, ...updateData } = payload;
        const response = await pharmacyService.updateProfile(updateData);
        setPharmacy(response.data.pharmacy);
        setSuccess('Profile updated successfully!');
      } else {
        const response = await pharmacyService.createProfile(payload);
        setPharmacy(response.data.pharmacy);
        setIsEditing(true);
        setSuccess('Pharmacy profile created! Awaiting verification.');
        await refreshUser();
      }
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
      },
      () => {
        setError('Unable to get your location. Please enter coordinates manually.');
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text tracking-tight">
          {isEditing ? 'Pharmacy Settings' : 'Setup Pharmacy'}
        </h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          {isEditing
            ? 'Manage your pharmacy details and location settings'
            : 'Enter your pharmacy details to request verification'}
        </p>
      </div>

      {pharmacy && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-surface rounded-xl border border-border shadow-sm">
          <div className={`p-2 rounded-lg ${
            pharmacy.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : 
            pharmacy.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
          }`}>
            <Store className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Account Status</p>
            <p className="text-xs text-text-muted mt-0.5">Current verification standing</p>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              pharmacy.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 
              pharmacy.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
            }`}>
              {pharmacy.status}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 mb-6 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">There was a problem</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 mb-6 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm shadow-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Success</p>
            <p className="mt-1 opacity-90">{success}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <div className="card overflow-hidden">
          <div className="bg-surface-hover/30 px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text">General Information</h2>
            <p className="text-xs text-text-muted mt-1">Publicly visible details about your pharmacy</p>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label htmlFor="name" className="label text-text-secondary">Pharmacy Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Store className="w-4 h-4 text-text-muted" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="input pl-9"
                    placeholder="E.g. HealthPlus Pharmacy"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="licenseNumber" className="label text-text-secondary">License Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="w-4 h-4 text-text-muted" />
                  </div>
                  <input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    className={`input pl-9 ${isEditing ? 'bg-surface-hover text-text-muted cursor-not-allowed border-dashed' : ''}`}
                    placeholder="PH-2026-001"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    required
                    disabled={isEditing}
                  />
                </div>
                {isEditing && (
                  <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Cannot be changed after registration
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="label text-text-secondary">Contact Phone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-text-muted" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="input pl-9"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Location */}
        <div className="card overflow-hidden">
          <div className="bg-surface-hover/30 px-6 py-4 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-text">Location Details</h2>
              <p className="text-xs text-text-muted mt-1">Address and GPS coordinates for the map</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="address" className="label text-text-secondary">Street Address</label>
              <div className="relative">
                <div className="absolute top-2.5 left-0 pl-3 flex items-start pointer-events-none">
                  <MapPin className="w-4 h-4 text-text-muted" />
                </div>
                <textarea
                  id="address"
                  name="address"
                  className="input pl-9"
                  rows={2}
                  placeholder="123 Main Street, City, State, PIN"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-text flex items-center gap-2">
                  <Map className="w-4 h-4 text-primary" />
                  GPS Coordinates
                </label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="btn btn-secondary btn-sm bg-white hover:bg-surface text-primary border-primary/20 shadow-sm"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Auto-detect
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Latitude</p>
                  <input
                    name="latitude"
                    type="number"
                    step="any"
                    className="input bg-white"
                    placeholder="28.6139"
                    value={formData.latitude}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Longitude</p>
                  <input
                    name="longitude"
                    type="number"
                    step="any"
                    className="input bg-white"
                    placeholder="77.2090"
                    value={formData.longitude}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          {isEditing && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn btn-ghost px-6"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary px-8 shadow-md hover:shadow-lg"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="spinner border-white border-t-white/30" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></div>
                Saving...
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Submit for Verification'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
