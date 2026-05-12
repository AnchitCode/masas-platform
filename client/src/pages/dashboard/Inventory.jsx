import { Package } from 'lucide-react';

/**
 * Placeholder for inventory management page.
 * Will be built in Phase 3.
 */
export default function Inventory() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Inventory Management</h1>
        <p className="text-text-secondary mt-1">
          Manage your pharmacy's medicine stock
        </p>
      </div>

      <div className="card p-12 text-center">
        <Package className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-text mb-2">Coming in Phase 3</h2>
        <p className="text-text-secondary max-w-md mx-auto">
          Inventory management will be available after your pharmacy is verified.
          You'll be able to add medicines, update stock, and manage prices.
        </p>
      </div>
    </div>
  );
}
