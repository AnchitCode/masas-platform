import { cn } from '../../lib/utils';

export function Card({ className, children, interactive = false, ...props }) {
  return (
    <div
      className={cn('card', interactive && 'card-interactive', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('card-header', className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('card-content', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn('card-footer', className)} {...props}>
      {children}
    </div>
  );
}
