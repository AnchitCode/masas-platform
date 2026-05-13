import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import pharmacyService from '../../services/pharmacyService';
import { Link } from 'react-router-dom';
import { Store, Package, AlertCircle, CheckCircle, Clock, ArrowRight, Plus, ExternalLink } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await pharmacyService.getOwnProfile();
        const p = response?.data?.pharmacy ?? null;
        setPharmacy(p);
        setHasProfile(!!p);
      } catch {
        setPharmacy(null);
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const statusConfig = {
    PENDING: { 
      icon: Clock, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50', 
      border: 'border-amber-200', 
      badge: 'bg-amber-100 text-amber-800', 
      text: 'Pending Review' 
    },
    VERIFIED: { 
      icon: CheckCircle, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200', 
      badge: 'bg-emerald-100 text-emerald-800', 
      text: 'Verified Active' 
    },
    REJECTED: { 
      icon: AlertCircle, 
      color: 'text-red-600', 
      bg: 'bg-red-50', 
      border: 'border-red-200', 
      badge: 'bg-red-100 text-red-800', 
      text: 'Action Required' 
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text tracking-tight">
            Dashboard
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            Overview and status for {user?.email}
          </p>
        </div>
        {hasProfile && pharmacy?.status === 'VERIFIED' && (
          <div className="flex items-center gap-3">
            <Link to="/dashboard/inventory" className="btn btn-primary btn-sm shadow-sm">
              <Plus className="w-4 h-4" />
              Add Medicine
            </Link>
          </div>
        )}
      </div>

      {!hasProfile ? (
        /* Onboarding State */
        <div className="card border-dashed border-2 border-border/60 bg-surface-hover/30 p-10 text-center max-w-2xl mx-auto mt-12">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-text mb-2 tracking-tight">
            Welcome to MASAS
          </h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Your account is ready. To start listing medicines and managing inventory, you need to set up your pharmacy profile for verification.
          </p>
          <Link to="/dashboard/profile" className="btn btn-primary shadow-sm px-6">
            Complete Pharmacy Profile
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      ) : (
        /* Dashboard Content */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Status Panel */}
          <div className={`col-span-1 md:col-span-3 rounded-xl border ${statusConfig[pharmacy.status].border} ${statusConfig[pharmacy.status].bg} p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm`}>
            <div className="flex items-center gap-4">
              <div className={`p-2.5 bg-white rounded-lg shadow-sm`}>
                {(() => {
                  const Icon = statusConfig[pharmacy.status].icon;
                  return <Icon className={`w-6 h-6 ${statusConfig[pharmacy.status].color}`} />;
                })()}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">Pharmacy Status</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusConfig[pharmacy.status].badge}`}>
                    {statusConfig[pharmacy.status].text}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm sm:text-right">
              {pharmacy.status === 'PENDING' && (
                 <p className="text-amber-800 font-medium">Review in progress. Usually takes 1-2 business days.</p>
              )}
              {pharmacy.status === 'VERIFIED' && (
                 <p className="text-emerald-800 font-medium">Your pharmacy is active and visible in searches.</p>
              )}
              {pharmacy.status === 'REJECTED' && (
                 <p className="text-red-800 font-medium">Verification failed. Please update your license details.</p>
              )}
            </div>
          </div>

          {/* Pharmacy Profile Card */}
          <div className="card flex flex-col hover:shadow-md transition-shadow">
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary/10 rounded-md">
                  <Store className="w-5 h-5 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-text text-lg mb-1">{pharmacy.name}</h3>
              <p className="text-sm text-text-secondary line-clamp-2">{pharmacy.address}</p>
              
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">License No.</p>
                <p className="text-sm font-medium text-text">{pharmacy.licenseNumber}</p>
              </div>
            </div>
            <div className="p-4 bg-surface-hover/50 border-t border-border flex items-center justify-between rounded-b-xl">
              <Link
                to="/dashboard/profile"
                className="text-sm font-medium text-text hover:text-primary transition-colors flex items-center gap-1"
              >
                Manage Profile
              </Link>
              <ExternalLink className="w-4 h-4 text-text-muted" />
            </div>
          </div>

          {/* Inventory Overview Card */}
          <div className="card flex flex-col hover:shadow-md transition-shadow">
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-50 rounded-md">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <h3 className="font-semibold text-text text-lg mb-1">Inventory</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-text">
                  {pharmacy._count?.inventory || 0}
                </span>
                <span className="text-sm text-text-muted font-medium">listed items</span>
              </div>
            </div>
            <div className="p-4 bg-surface-hover/50 border-t border-border flex items-center justify-between rounded-b-xl">
              <Link
                to="/dashboard/inventory"
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                  pharmacy.status === 'VERIFIED' ? 'text-primary hover:text-primary-dark' : 'text-text-muted cursor-not-allowed pointer-events-none'
                }`}
              >
                {pharmacy.status === 'VERIFIED' ? 'Manage Stock' : 'Locked pending verification'}
              </Link>
              {pharmacy.status === 'VERIFIED' && <ArrowRight className="w-4 h-4 text-primary" />}
            </div>
          </div>
          
          {/* Quick Actions (Placeholder for future features) */}
          <div className="card flex flex-col hover:shadow-md transition-shadow bg-gradient-to-br from-surface to-surface-hover/30">
             <div className="p-5 flex-1">
               <h3 className="font-semibold text-text text-sm uppercase tracking-wider mb-4 text-text-muted">Quick Actions</h3>
               <div className="space-y-3">
                 <button className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group text-left">
                   <span className="text-sm font-medium text-text group-hover:text-primary">View Analytics</span>
                   <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                 </button>
                 <button className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group text-left">
                   <span className="text-sm font-medium text-text group-hover:text-primary">Contact Support</span>
                   <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                 </button>
               </div>
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
