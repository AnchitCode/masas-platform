import React, { forwardRef } from 'react';
import { cn } from '../../../lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
  leftIcon?: React.ElementType;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, hasError, leftIcon: LeftIcon, children, ...props }, ref) => {
  return (
    <div style={{ position: 'relative' }}>
      {LeftIcon ? (
        <LeftIcon
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 16,
            color: 'var(--light)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      ) : null}
      <select
        ref={ref}
        className={cn(
          'select-field',
          hasError && 'input-error',
          className
        )}
        style={LeftIcon ? { paddingLeft: 40 } : undefined}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});
Select.displayName = 'Select';
