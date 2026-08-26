import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import savedSearchService, { SavedSearch } from '../services/savedSearchService';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Bell, BellOff, Trash2, MapPin, Loader2 } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import AlertBanner from '../components/ui/AlertBanner';

export default function SavedSearches() {
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadSearches();
  }, []);

  const loadSearches = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await savedSearchService.list();
      setSearches(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load saved searches');
    } finally {
      setLoading(false);
    }
  };

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this saved search?')) return;
    try {
      setDeletingId(id);
      await savedSearchService.delete(id);
      setSearches(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete saved search');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <AlertBanner variant="error" className="mb-6">
          {error}
        </AlertBanner>
      )}

      {searches.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No saved searches"
          description="When you search for a medicine that isn't available nearby, you can save the search to be alerted when it arrives."
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
                  onClick={() => handleDelete(search.id)}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
