import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import savedSearchService, { SavedSearch } from '../services/savedSearchService';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Bell, BellOff, Trash2, MapPin, Search } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import AlertBanner from '../components/ui/AlertBanner';
import { Skeleton } from '../components/ui/SkeletonLoader';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';

export default function SavedSearches() {
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchToDelete, setSearchToDelete] = useState<SavedSearch | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSearches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await savedSearchService.list();
      setSearches(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load saved searches. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError('');
        const res = await savedSearchService.list();
        if (!cancelled) setSearches(res.data);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load saved searches. Please check your connection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      setTogglingId(id);
      const res = await savedSearchService.update(id, { isActive: !currentStatus });
      setSearches(prev => prev.map(s => s.id === id ? res.data : s));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update saved search');
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!searchToDelete) return;
    try {
      setDeletingId(searchToDelete.id);
      await savedSearchService.delete(searchToDelete.id);
      setSearches(prev => prev.filter(s => s.id !== searchToDelete.id));
      setSearchToDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete saved search');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text">Saved Searches</h1>
            <p className="text-muted mt-1">Manage your availability alerts for medicines.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading saved searches">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div style={{ flex: 1 }}>
                  <Skeleton style={{ height: 22, width: '48%', marginBottom: 8 }} />
                  <Skeleton style={{ height: 14, width: '65%' }} />
                </div>
                <Skeleton style={{ height: 22, width: 62, borderRadius: 9999 }} />
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-end gap-2">
                <Skeleton style={{ height: 32, width: 108, borderRadius: 'var(--radius-input)' }} />
                <Skeleton style={{ height: 32, width: 72, borderRadius: 'var(--radius-input)' }} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Saved Searches</h1>
          <p className="text-muted mt-1">Manage your availability alerts for medicines.</p>
        </div>
      </div>

      {error && (
        <AlertBanner
          variant="error"
          className="mb-6"
          action={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={loadSearches}
            >
              Retry
            </Button>
          }
        >
          {error}
        </AlertBanner>
      )}

      {searches.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No saved searches"
          description="When you search for a medicine that isn't available nearby, you can save the search to be alerted when it arrives."
          action={
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/search')}
              leftIcon={Search}
            >
              Search medicines
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {searches.map(search => (
            <Card key={search.id} className="border-border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <h3 className="text-lg text-text capitalize font-semibold">
                    {search.query}
                  </h3>
                  <div className="flex items-center text-sm text-muted mt-2">
                    <MapPin className="w-4 h-4 mr-1 shrink-0" />
                    <span className="truncate">
                      Within {search.radiusKm}km of your location
                    </span>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  search.isActive 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  {search.isActive ? 'Active' : 'Paused'}
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={search.isActive ? BellOff : Bell}
                  isLoading={togglingId === search.id}
                  onClick={() => handleToggle(search.id, search.isActive)}
                >
                  {search.isActive ? 'Pause Alerts' : 'Resume Alerts'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={Trash2}
                  isLoading={deletingId === search.id}
                  onClick={() => setSearchToDelete(search)}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!searchToDelete}
        onClose={() => !deletingId && setSearchToDelete(null)}
        title="Delete Saved Search"
        description="Stop receiving availability alerts for this medicine."
        size="sm"
      >
        <ModalBody>
          <p style={{ fontSize: '13.5px', color: 'var(--text)', margin: 0 }}>
            Are you sure you want to remove the stock alert for{' '}
            <strong style={{ textTransform: 'capitalize' }}>
              {searchToDelete?.query}
            </strong>
            ?
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', margin: '6px 0 0 0' }}>
            You will no longer receive notifications when this medicine becomes available nearby.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={!!deletingId}
            onClick={() => setSearchToDelete(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={!!deletingId}
            onClick={confirmDelete}
          >
            Delete Alert
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

