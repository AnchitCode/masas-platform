import React, { forwardRef } from 'react';
import { cn } from '../../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  leftIcon?: React.ElementType;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, hasError, leftIcon: LeftIcon, ...props }, ref) => {
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
      <input
        ref={ref}
        className={cn(
          'input-field',
          hasError && 'input-error',
          className
        )}
        style={LeftIcon ? { paddingLeft: 40 } : undefined}
        {...props}
      />
    </div>
  );
});
Input.displayName = 'Input';
