import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pharmacyService from '../../services/pharmacyService';
import { useAuth } from '../../context/AuthContext';
import { Store, MapPin, Phone, FileText, AlertCircle, Map, Crosshair } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AlertBanner from '../../components/ui/AlertBanner';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { FormSection, FormField, Input, TextArea, FormActions } from '../../components/ui/forms';
import { Button } from '../../components/ui/Button';

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
        const p = response?.data?.pharmacy;
        if (!p) {
          setPharmacy(null);
          setIsEditing(false);
          return;
        }
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
        setPharmacy(response?.data?.pharmacy ?? null);
        setSuccess('Profile updated successfully!');
      } else {
        const response = await pharmacyService.createProfile(payload);
        setPharmacy(response?.data?.pharmacy ?? null);
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
      <div style={{ display: 'flex', minHeight: '320px', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading profile…" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '768px', margin: '0 auto', paddingBottom: '48px' }}>
      <PageHeader
        title={isEditing ? 'Pharmacy settings' : 'Set up your pharmacy'}
        description={
          isEditing
            ? 'Update your public details and map pin. License number is locked after registration.'
            : 'Tell us about your pharmacy so we can verify you and connect patients to your stock.'
        }
      />

      {pharmacy && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '20px', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
          <div
            style={{ display: 'flex', width: '40px', height: '40px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', border: '1px solid',
              ...(pharmacy.status === 'VERIFIED' ? { background: 'var(--green-50)', color: 'var(--green-600)', borderColor: 'var(--green-200)' } :
                  pharmacy.status === 'PENDING' ? { background: '#fffbeb', color: '#d97706', borderColor: '#fde68a' } :
                  pharmacy.status === 'REJECTED' ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' } :
                  { background: 'var(--slate-50)', color: 'var(--slate-500)', borderColor: 'var(--border)' })
            }}
          >
            <Store style={{ width: '20px', height: '20px' }} aria-hidden />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>Account Status</p>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Current verification standing</p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <StatusBadge variant={
              pharmacy.status === 'VERIFIED' ? 'success' : 
              pharmacy.status === 'PENDING' ? 'warning' : 'danger'
            }>
              {pharmacy.status}
            </StatusBadge>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '24px' }}>
          <AlertBanner variant="error" title="Something went wrong">
            {error}
          </AlertBanner>
        </div>
      )}

      {success && (
        <div style={{ marginBottom: '24px' }}>
          <AlertBanner variant="success" title="Saved">
            {success}
          </AlertBanner>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <FormSection title="General Information" description="Publicly visible details about your pharmacy">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <FormField label="Pharmacy Name">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  leftIcon={Store}
                  placeholder="E.g. HealthPlus Pharmacy"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </FormField>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <FormField 
                  label="License Number" 
                  helperText={isEditing ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle style={{ width: '12px', height: '12px' }} /> Cannot be changed after registration</span> : undefined}
                >
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    leftIcon={FileText}
                    placeholder="PH-2026-001"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    required
                    disabled={isEditing}
                  />
                </FormField>
              </div>

              <div>
                <FormField label="Contact Phone">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    leftIcon={Phone}
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </FormField>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Location Details" description="Address and GPS coordinates for the map">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <FormField label="Street Address">
              <TextArea
                id="address"
                name="address"
                leftIcon={MapPin}
                rows={2}
                placeholder="123 Main Street, City, State, PIN"
                value={formData.address}
                onChange={handleChange}
                required
                style={{ resize: 'vertical' }}
              />
            </FormField>

            <div style={{ padding: '16px', backgroundColor: 'var(--green-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--green-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Map style={{ width: '16px', height: '16px', color: 'var(--green-600)' }} />
                  GPS Coordinates
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleGetLocation}
                  leftIcon={Crosshair}
                >
                  Auto-detect
                </Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Latitude</p>
                  <Input
                    name="latitude"
                    type="number"
                    step="any"
                    style={{ backgroundColor: '#fff' }}
                    placeholder="28.6139"
                    value={formData.latitude}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Longitude</p>
                  <Input
                    name="longitude"
                    type="number"
                    step="any"
                    style={{ backgroundColor: '#fff' }}
                    placeholder="77.2090"
                    value={formData.longitude}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        <FormActions>
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            isLoading={saving}
          >
            {isEditing ? 'Save Changes' : 'Submit for Verification'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
