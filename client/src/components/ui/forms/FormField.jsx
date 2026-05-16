import { cn } from '../../../lib/utils';

export function FormField({ label, error, helperText, required, children, className = '' }) {
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-label">
          {label}
          {required ? (
            <span style={{ marginLeft: 4, color: '#ef4444' }} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="form-error">{error}</p> : null}
      {helperText && !error ? (
        <p className="form-hint">{helperText}</p>
      ) : null}
    </div>
  );
}
