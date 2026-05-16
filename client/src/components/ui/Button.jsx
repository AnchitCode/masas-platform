import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const sizeClasses = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export const Button = forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      disabled,
      children,
      type,
      ...props
    },
    ref
  ) => {
    const variantClass = variantClasses[variant] ?? variantClasses.primary;
    const sizeClass = sizeClasses[size] ?? sizeClasses.md;

    return (
      <button
        ref={ref}
        {...(type !== undefined ? { type } : {})}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn('btn', variantClass, sizeClass, isLoading && 'btn-loading', className)}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden="true" />}
        {!isLoading && LeftIcon && <LeftIcon style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden="true" />}
        {children}
        {!isLoading && RightIcon && <RightIcon style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden="true" />}
      </button>
    );
  }
);

Button.displayName = 'Button';
