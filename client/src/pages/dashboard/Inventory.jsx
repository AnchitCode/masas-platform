/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, AlertCircle } from 'lucide-react';
import inventoryService from '../../services/inventoryService';
import pharmacyService from '../../services/pharmacyService';
import MedicineModal from '../../components/inventory/MedicineModal';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Search state for local filtering
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // First get pharmacy status
      const profileRes = await pharmacyService.getOwnProfile();
      // API envelope: { success, message, data: { pharmacy } }
      const p = profileRes?.data?.pharmacy ?? null;
      setPharmacy(p);

      // If verified, fetch inventory
      if (p?.status === 'VERIFIED') {
        const invRes = await inventoryService.getInventory();
        // Same envelope; payload is { inventory: [...] }
        setInventory(invRes?.data?.inventory ?? []);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setPharmacy(null); // No profile yet
      } else {
        setError('Failed to load inventory data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;
    try {
      await inventoryService.deleteMedicine(id);
      fetchData(); // refresh list
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete medicine');
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
      </div>
    );
  }

  // Guard: No profile or not verified
  if (!pharmacy || pharmacy.status !== 'VERIFIED') {
    return (
      <div className="animate-fade-in max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text tracking-tight">Inventory Management</h1>
        </div>
        <div className="card p-12 text-center border-dashed border-2 border-border/60 bg-surface-hover/30">
          <Package className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold text-text mb-2">Inventory Locked</h2>
          <p className="text-text-secondary max-w-md mx-auto text-sm leading-relaxed">
            {!pharmacy 
              ? 'You must complete your pharmacy profile before managing inventory.'
              : `Your pharmacy is currently ${pharmacy.status}. You can only manage inventory once verified.`}
          </p>
        </div>
      </div>
    );
  }

  const q = searchTerm.toLowerCase();
  const filteredInventory = (inventory || []).filter((item) => {
    const name = item.medicine?.name?.toLowerCase() ?? '';
    const generic = item.medicine?.genericName?.toLowerCase() ?? '';
    return name.includes(q) || generic.includes(q);
  });

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text tracking-tight">Inventory Management</h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            Manage your medicine catalog, stock levels, and pricing.
          </p>
        </div>
        <button onClick={handleOpenAdd} className="btn btn-primary shadow-sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Medicine
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-red-50 text-danger text-sm border border-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="card mb-6 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            className="input pl-9 bg-surface"
            placeholder="Search your inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-hover/50 text-text-muted uppercase text-[11px] font-bold tracking-wider border-b border-border">
              <tr>
                <th className="px-6 py-4">Medicine</th>
                <th className="px-6 py-4">Price (₹)</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-text-muted">
                    No medicines found in your inventory.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-text capitalize">{item.medicine?.name ?? '—'}</p>
                      <p className="text-xs text-text-muted capitalize">{item.medicine?.genericName || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      ₹{typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${item.quantity <= 10 ? 'text-amber-600' : 'text-text'}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.isAvailable && item.quantity > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          In Stock
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                          Out of Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MedicineModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        initialData={editingItem}
      />
    </div>
  );
}
