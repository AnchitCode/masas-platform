/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Search as SearchIcon, LocateFixed, ScanSearch, Bell, Camera, AlertCircle, RefreshCw, Loader2, Sparkles, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import searchService from '../services/searchService';
import savedSearchService from '../services/savedSearchService';
import PrescriptionModal from '../components/prescription/PrescriptionModal';
import PharmacyCard from '../components/search/PharmacyCard';
import AlertBanner from '../components/ui/AlertBanner';
import EmptyState from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/forms';
import SearchResultSkeleton from '../components/ui/SearchResultSkeleton';
import { getErrorMessage, isCancelledRequest } from '../lib/utils';
import type { SearchResultRow, SearchMeta } from '../types';

const DEFAULT_RADIUS_KM = 12;
const PAGE_SIZE = 20;

export default function Search() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 400);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState('idle');
  const [geoMessage, setGeoMessage] = useState('');

  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [savingAlert, setSavingAlert] = useState(false);
  const [saveAlertSuccess, setSaveAlertSuccess] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setGeoMessage('Location is not supported in this browser.');
      return;
    }
    setGeoState('loading');
    setGeoMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoState('ready');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState('denied');
          setGeoMessage('Location permission denied. Allow location to search nearby pharmacies.');
        } else {
          setGeoState('error');
          setGeoMessage(err.message || 'Could not read your location.');
        }
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 }
    );
  }, []);

  useEffect(() => {
    if (initialQuery && geoState === 'idle') {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!coords || q.length < 1) {
      setResults([]);
      setTotal(0);
      setPage(1);
      setSearchLoading(false);
      setSearchError('');
      return undefined;
    }

    const ac = new AbortController();
    const run = async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const body = await searchService.searchInventory(
          {
            q,
            lat: coords.lat,
            lng: coords.lng,
            radiusKm: DEFAULT_RADIUS_KM,
            page: 1,
            limit: PAGE_SIZE,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted) return;
        const data = body?.data;
        setResults(data?.results ?? []);
        setTotal(typeof data?.total === 'number' ? data.total : 0);
        setSearchMeta(data?.meta ?? null);
        setPage(1);
      } catch (err: unknown) {
        if (ac.signal.aborted || isCancelledRequest(err)) return;
        setSearchError(getErrorMessage(err, 'Search failed. Try again.'));

        setResults([]);
        setTotal(0);
        setSearchMeta(null);
      } finally {
        if (!ac.signal.aborted) setSearchLoading(false);
      }
    };
    run();
    return () => ac.abort();
  }, [debouncedQuery, coords, retryTrigger]);

  const handleLoadMore = async () => {
    const q = debouncedQuery.trim();
    if (!coords || q.length < 1 || loadMoreLoading) return;
    const nextPage = page + 1;
    setLoadMoreLoading(true);
    setSearchError('');
    try {
      const body = await searchService.searchInventory({
        q,
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: DEFAULT_RADIUS_KM,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const data = body?.data;
      const next = data?.results ?? [];
      setResults((prev) => [...prev, ...next]);
      setPage(nextPage);
    } catch (err: unknown) {
      setSearchError(getErrorMessage(err, 'Could not load more results.'));
    } finally {
      setLoadMoreLoading(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    
    if (user?.role !== 'CUSTOMER') {
      setSearchError('Only customers can set availability alerts.');
      return;
    }

    const q = debouncedQuery.trim();
    if (!coords || q.length < 1) return;

    setSavingAlert(true);
    setSearchError('');
    setSaveAlertSuccess(false);

    try {
      await savedSearchService.create({
        query: q,
        latitude: coords.lat,
        longitude: coords.lng,
        radiusKm: DEFAULT_RADIUS_KM,
      });
      setSaveAlertSuccess(true);
      setTimeout(() => setSaveAlertSuccess(false), 5000);
    } catch (err: any) {
      setSearchError(err?.response?.data?.message || 'Failed to save alert. Try again.');
    } finally {
      setSavingAlert(false);
    }
  };

  const hasMore = results.length > 0 && results.length < total;

  return (
    <div className="main-content page-bg">
      {/* ── Search Header ── */}
      <div className="search-header">
        <div className="search-container">
          <div className="search-controls">
            <div className="search-input-wrap">
              <SearchIcon className="search-input-icon" size={16} />
              <Input
                id="medicine-search"
                type="search"
                className="pl-11 bg-slate-50 w-full"
                placeholder="Search medicine — e.g. paracetamol, dard ki dawa"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="search-actions">
              {isAuthenticated && (
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={Camera}
                  onClick={() => setPrescriptionOpen(true)}
                  className="whitespace-nowrap"
                >
                  Scan Rx
                </Button>
              )}
              <Button
                type="button"
                variant={geoState === 'ready' ? 'secondary' : 'primary'}
                leftIcon={geoState === 'ready' ? MapPin : LocateFixed}
                onClick={requestLocation}
                isLoading={geoState === 'loading'}
                className="whitespace-nowrap"
                title={geoState === 'ready' ? 'Location active · Click to refresh coordinates' : 'Click to detect your current location'}
              >
                {geoState === 'ready'
                  ? 'Location active'
                  : geoState === 'denied' || geoState === 'error'
                  ? 'Retry location'
                  : 'Set location'}
              </Button>
            </div>
          </div>

          <div className="search-meta-row" aria-live="polite">
            {geoState === 'ready' ? (
              <div className="location-indicator location-indicator--ready">
                <span className="location-indicator-dot" />
                <span>
                  Using your current location · Within <strong>{DEFAULT_RADIUS_KM} km</strong>
                </span>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="location-refresh-btn"
                  title="Refresh your location coordinates"
                >
                  <RefreshCw style={{ width: 11, height: 11 }} />
                  <span>Refresh</span>
                </button>
              </div>
            ) : geoState === 'loading' ? (
              <div className="location-indicator location-indicator--loading">
                <Loader2 className="animate-spin" style={{ width: 13, height: 13, flexShrink: 0 }} />
                <span>Detecting your location…</span>
              </div>
            ) : geoState === 'denied' ? (
              <div className="location-indicator location-indicator--warning">
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>Location access blocked. Allow permissions in your browser address bar to search nearby pharmacies.</span>
              </div>
            ) : geoState === 'error' ? (
              <div className="location-indicator location-indicator--warning">
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{geoMessage || 'Could not detect location. Click "Retry location" to try again.'}</span>
              </div>
            ) : geoState === 'unsupported' ? (
              <div className="location-indicator location-indicator--warning">
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>Geolocation is not supported by your browser.</span>
              </div>
            ) : (
              <div className="location-indicator location-indicator--idle">
                <LocateFixed style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>Location required to find nearby pharmacies · Within {DEFAULT_RADIUS_KM} km radius</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Results Area ── */}
      <div className="search-container" style={{ paddingTop: 28, paddingBottom: 48 }}>
        <div className="search-results" aria-live="polite">
          {searchError ? (
            <AlertBanner
              variant="error"
              title="Search failed"
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearchError('');
                    setRetryTrigger((prev) => prev + 1);
                  }}
                >
                  Try again
                </Button>
              }
            >
              {searchError}
            </AlertBanner>
          ) : null}

          {searchLoading ? (
            <SearchResultSkeleton count={3} />
          ) : null}

          {!searchLoading && coords && debouncedQuery.trim().length >= 1 && results.length === 0 && !searchError ? (
            <div className="search-no-results">
              <EmptyState
                icon={ScanSearch}
                title="No matches in this area"
                description="We couldn't find medicines matching your search within 12 km. Try a different medicine name, brand name, or active ingredient."
              />
              
              <div className="search-no-results__alert-box">
                {saveAlertSuccess ? (
                  <AlertBanner variant="success" className="mb-2">
                    Alert saved! You'll be notified when this medicine is available near you.
                  </AlertBanner>
                ) : null}
                <Button
                  variant="secondary"
                  className="w-full"
                  leftIcon={Bell}
                  onClick={handleSaveSearch}
                  isLoading={savingAlert}
                >
                  Alert me when available
                </Button>
              </div>
            </div>
          ) : null}

          {!searchLoading && results.length > 0 ? (() => {
            const primaryResults = results.filter(r => r.matchType !== 'semantic');
            const semanticResults = results.filter(r => r.matchType === 'semantic');
            const targetUnavailable = searchMeta?.target && !searchMeta.target.isAvailable;

            return (
              <>
                <div className="search-results-header">
                  <p className="search-results-count">
                    {total === 1 ? '1 result found' : `${results.length} shown · ${total} total matches`}
                  </p>
                  {searchMeta?.normalizedQuery ? (
                    <p className="search-results-hint" data-testid="normalized-query-hint">
                      Showing results for <span className="font-medium text-text">{searchMeta.normalizedQuery}</span>
                    </p>
                  ) : null}
                </div>

                {targetUnavailable ? (
                  <div className="search-oos-banner" data-testid="target-unavailable-banner">
                    <div className="search-oos-banner__main">
                      <AlertTriangle className="search-oos-banner__icon" aria-hidden="true" />
                      <div className="search-oos-banner__text">
                        <p className="search-oos-banner__title">
                          <strong className="capitalize">{searchMeta!.target!.name}</strong> is currently out of stock near you.
                        </p>
                        <p className="search-oos-banner__subtitle">
                          Verified pharmacies nearby don't have this medicine in stock right now. See therapeutic alternatives below, or set a stock alert.
                        </p>
                      </div>
                    </div>
                    <div className="search-oos-banner__actions">
                      {saveAlertSuccess ? (
                        <span className="search-oos-banner__saved">
                          <CheckCircle style={{ width: 14, height: 14 }} aria-hidden="true" />
                          <span>Alert saved! We'll notify you when in stock.</span>
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          leftIcon={Bell}
                          onClick={handleSaveSearch}
                          isLoading={savingAlert}
                          className="search-oos-banner__btn"
                        >
                          Alert me when available
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}

                {primaryResults.length > 0 ? (
                  <ul className="search-results-list">
                    {primaryResults.map((row) => (
                      <li key={row.inventory?.id ?? `${row.pharmacy?.id}-${row.medicine?.id}`}>
                        <PharmacyCard
                          pharmacy={row.pharmacy}
                          distanceMeters={row.distanceMeters}
                          medicine={row.medicine}
                          inventory={row.inventory}
                          matchType={row.matchType}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}

                {semanticResults.length > 0 ? (
                  <div className="search-semantic-section">
                    <div className="search-semantic-header">
                      <Sparkles style={{ width: 16, height: 16, color: 'var(--green-600)', flexShrink: 0 }} aria-hidden="true" />
                      <h3 className="search-semantic-title" data-testid="similar-medicines-heading">Similar Medicines</h3>
                      <span className="search-semantic-badge">AI Suggested</span>
                    </div>
                    <p className="search-semantic-disclaimer">
                      <ShieldAlert style={{ width: 13, height: 13, flexShrink: 0 }} aria-hidden="true" />
                      <span>Consult your doctor before taking similar medicines</span>
                    </p>
                    <ul className="search-results-list">
                      {semanticResults.map((row) => (
                        <li key={row.inventory?.id ?? `${row.pharmacy?.id}-${row.medicine?.id}`}>
                          <PharmacyCard
                            pharmacy={row.pharmacy}
                            distanceMeters={row.distanceMeters}
                            medicine={row.medicine}
                            inventory={row.inventory}
                            matchType="semantic"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {hasMore ? (
                  <div className="flex justify-center pt-6">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleLoadMore}
                      isLoading={loadMoreLoading}
                      className="min-w-[12rem]"
                    >
                      Load more results
                    </Button>
                  </div>
                ) : null}
              </>
            );
          })() : null}

          {!searchLoading && !coords ? (
            <EmptyState
              icon={geoState === 'denied' ? AlertCircle : LocateFixed}
              title={
                geoState === 'denied'
                  ? 'Location Access Blocked'
                  : geoState === 'error'
                  ? 'Location Detection Failed'
                  : 'Location Required'
              }
              description={
                geoState === 'denied'
                  ? "Your browser is blocking location permissions for MASAS. Please click the site settings / lock icon in your address bar, allow location access, and click 'Retry location' below."
                  : geoState === 'error'
                  ? `${geoMessage || 'Could not determine your current position'}. Please ensure your device GPS is active and try again.`
                  : "Enable location to find real-time medicine availability from verified pharmacies near you within 12 km."
              }
              action={
                <Button
                  type="button"
                  variant="primary"
                  leftIcon={LocateFixed}
                  onClick={requestLocation}
                  isLoading={geoState === 'loading'}
                >
                  {geoState === 'denied' || geoState === 'error' ? 'Retry location' : 'Set location'}
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      {/* Prescription Scanner Modal (Phase 9.2e) */}
      <PrescriptionModal
        isOpen={prescriptionOpen}
        onClose={() => setPrescriptionOpen(false)}
        onSearch={(q) => setQuery(q)}
      />
    </div>
  );
}
