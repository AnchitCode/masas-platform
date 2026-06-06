import { Pill } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card, CardContent } from '../ui/Card';
import type { Medicine } from '../../types';

interface MedicineCardProps {
  medicine: Medicine;
  className?: string;
}

export default function MedicineCard({ medicine, className = '' }: MedicineCardProps) {
  if (!medicine) return null;

  const title = medicine.name ?? '—';
  const subtitle = [medicine.genericName, medicine.dosageForm].filter(Boolean).join(' · ');

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex gap-3 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
          <Pill className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold capitalize text-text">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{subtitle}</p>
          ) : null}
          {medicine.manufacturer ? (
            <p className="mt-1 text-xs text-muted">{medicine.manufacturer}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
