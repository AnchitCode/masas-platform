/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Search as SearchIcon, LocateFixed, ScanSearch, Filter, Bell, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import searchService from '../services/searchService';
import savedSearchService from '../services/savedSearchService';
import PrescriptionModal from '../components/prescription/PrescriptionModal';
import PharmacyCard from '../components/search/PharmacyCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertBanner from '../components/ui/AlertBanner';
import EmptyState from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/forms';
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
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);

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

  // Auto-trigger geolocation when arriving with a ?q= param
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
  }, [debouncedQuery, coords]);

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
      // Redirect to login with returnUrl
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
      setTimeout(() => setSaveAlertSuccess(false), 5000); // Hide success after 5s
    } catch (err: any) {
      setSearchError(err?.response?.data?.message || 'Failed to save alert. Try again.');
    } finally {
      setSavingAlert(false);
    }
  };

  const hasMore = results.length > 0 && results.length < total;

  return (
    <div className="main-content bg-slate-50">
      <div className="bg-white border-b border-border sticky top-[56px] z-10 px-4 pt-4 pb-0 sm:px-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-xl">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
            <Input
              id="medicine-search"
              type="search"
              className="pl-9 bg-slate-50 w-full"
              placeholder="Search medicine — e.g. paracetamol, dard ki dawa"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
            >
              {geoState === 'ready' ? 'Location active' : 'Set location'}
            </Button>
          </div>
        </div>

        {geoMessage && (
          <div className="max-w-5xl mx-auto mt-4">
            <AlertBanner variant={geoState === 'error' || geoState === 'denied' ? 'warning' : 'info'} title={undefined}>
              {geoMessage}
            </AlertBanner>
          </div>
        )}

        <div className="max-w-5xl mx-auto mt-4 flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar border-t border-border pt-3">
          <Filter className="w-4 h-4 text-muted shrink-0 mr-1" />
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium whitespace-nowrap cursor-pointer">All results</span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-border text-sm font-medium text-muted whitespace-nowrap hover:bg-slate-50 cursor-pointer transition-colors">Available only</span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-border text-sm font-medium text-muted whitespace-nowrap hover:bg-slate-50 cursor-pointer transition-colors">Within 5km</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 py-8 sm:px-6 flex flex-col md:flex-row gap-8 items-start">
        <div className="flex-1 w-full min-w-0">
          <div className="space-y-6" aria-live="polite">
            {searchError ? (
              <AlertBanner variant="error" title="Search failed">
                {searchError}
              </AlertBanner>
            ) : null}

            {searchLoading ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner text="Searching verified stock…" />
              </div>
            ) : null}

            {!searchLoading && coords && debouncedQuery.trim().length >= 1 && results.length === 0 && !searchError ? (
              <div className="flex flex-col items-center gap-4">
                <EmptyState
                  icon={ScanSearch}
                  title="No matches in this area"
                  description="Try a different spelling or generic name. A wider search radius feature is coming soon."
                />
                
                <div className="w-full max-w-sm">
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-text">
                        {total === 1 ? '1 result found' : `${results.length} shown · ${total} total matches`}
                      </p>
                    </div>
                    {searchMeta?.normalizedQuery ? (
                      <p className="text-xs text-muted" data-testid="normalized-query-hint">
                        Showing results for <span className="font-medium text-text">{searchMeta.normalizedQuery}</span>
                      </p>
                    ) : null}
                  </div>

                  {/* Out-of-stock warning for explicit medicine target */}
                  {targetUnavailable ? (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="target-unavailable-banner">
                      <span className="text-xl shrink-0">⚠️</span>
                      <p className="text-sm font-medium text-amber-800">
                        <span className="capitalize">{searchMeta!.target!.name}</span> is currently out of stock near you.
                      </p>
                    </div>
                  ) : null}

                  {/* Primary results (exact / partial / generic) */}
                  {primaryResults.length > 0 ? (
                    <ul className="flex flex-col gap-4">
                      {primaryResults.map((row) => (
                        <li key={row.inventory?.id ?? `${row.pharmacy?.id}-${row.medicine?.id}`}>
                          <PharmacyCard
                            pharmacy={row.pharmacy}
                            distanceMeters={row.distanceMeters}
                            medicine={row.medicine}
                            inventory={row.inventory}
                            matchType={row.matchType}
                            className="shadow-sm border-border"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {/* Semantic results section */}
                  {semanticResults.length > 0 ? (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold text-slate-700" data-testid="similar-medicines-heading">Similar Medicines</h3>
                        <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium">AI Suggested</span>
                      </div>
                      <p className="text-xs text-muted mb-4 -mt-1">
                        Consult your doctor before taking similar medicines
                      </p>
                      <ul className="flex flex-col gap-4">
                        {semanticResults.map((row) => (
                          <li key={row.inventory?.id ?? `${row.pharmacy?.id}-${row.medicine?.id}`}>
                            <PharmacyCard
                              pharmacy={row.pharmacy}
                              distanceMeters={row.distanceMeters}
                              medicine={row.medicine}
                              inventory={row.inventory}
                              matchType={row.matchType}
                              className="shadow-sm border-border"
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
                icon={LocateFixed}
                title="Location Required"
                description="Enable location to find medicines near you. Click 'Set location' to begin."
              />
            ) : null}
          </div>
        </div>

        <div className="hidden lg:block w-72 shrink-0 sticky top-[160px]">
          <Card className="border-border shadow-sm">
            <CardContent className="p-0">
              <div className="h-40 bg-slate-100 flex items-center justify-center rounded-t-[10px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')] opacity-20 mix-blend-multiply"></div>
                <MapPin className="text-slate-300 w-10 h-10 relative z-10" />
              </div>
              <div className="p-5">
                <h4 className="font-semibold text-text mb-1">Nearby Pharmacies</h4>
                <p className="text-sm text-muted mb-4">View verified pharmacies around your location.</p>
                <Button variant="secondary" className="w-full">
                  Browse Map
                </Button>
              </div>
            </CardContent>
          </Card>
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
