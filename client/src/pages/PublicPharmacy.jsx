import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Pill } from 'lucide-react';
import pharmacyService from '../services/pharmacyService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../utils/constants';
import StatusBadge from '../components/ui/StatusBadge';

export default function PublicPharmacy() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pharmacy, setPharmacy] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await pharmacyService.getPublicProfile(id);
        if (cancelled) return;
        setPharmacy(res?.data?.pharmacy ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || 'Pharmacy not found.');
          setPharmacy(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <LoadingSpinner text="Loading pharmacy…" />
      </div>
    );
  }

  if (error || !pharmacy) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-12 sm:py-16">
        <EmptyState
          title="Pharmacy unavailable"
          description={error || 'This pharmacy could not be found or is no longer listed.'}
          action={
            <Button type="button" variant="primary" onClick={() => navigate(ROUTES.SEARCH)}>
              Back to search
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8 sm:py-12">
      <Link
        to={ROUTES.SEARCH}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to search
      </Link>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600 border border-green-100">
              <Pill className="h-7 w-7" strokeWidth={2.2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-text">{pharmacy.name}</h1>
              <p className="mt-2 text-sm sm:text-base text-muted">
                Call ahead to confirm availability and opening hours.
              </p>
              {pharmacy.status ? (
                <div className="mt-3">
                  <StatusBadge
                    variant={pharmacy.status === 'VERIFIED' ? 'success' : 'warning'}
                  >
                    {pharmacy.status}
                  </StatusBadge>
                </div>
              ) : null}
            </div>
          </div>

          <p className="flex items-start gap-2 text-sm text-text">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span>{pharmacy.address}</span>
          </p>

          {pharmacy.phone ? (
            <a
              href={`tel:${pharmacy.phone}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {pharmacy.phone}
            </a>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
