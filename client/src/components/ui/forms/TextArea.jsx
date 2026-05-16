import { forwardRef } from 'react';
import { cn } from '../../../lib/utils';

export const TextArea = forwardRef(({ className, hasError, leftIcon: LeftIcon, rows = 4, ...props }, ref) => {
  return (
    <div style={{ position: 'relative' }}>
      {LeftIcon ? (
        <div style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}>
          <LeftIcon style={{ width: 16, height: 16, color: 'var(--light)' }} aria-hidden="true" />
        </div>
      ) : null}
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'textarea-field',
          hasError && 'input-error',
          className
        )}
        style={LeftIcon ? { paddingLeft: 40 } : undefined}
        {...props}
      />
    </div>
  );
});
TextArea.displayName = 'TextArea';
