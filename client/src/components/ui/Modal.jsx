import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const maxWidthMap = {
  sm: '400px',
  md: '480px',
  lg: '560px',
  xl: '640px',
  '2xl': '720px',
};

/**
 * Accessible modal shell: backdrop, escape to close, focus return, body scroll lock.
 * Consumers own body/footer content.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
  panelClassName,
  closeLabel = 'Close dialog',
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const frame = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const preferred = root.querySelector('[data-autofocus]');
      const first =
        preferred ||
        root.querySelector(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
      first?.focus?.();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [open, handleClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div
      className={cn('modal-backdrop', className)}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={cn('modal-panel', panelClassName)}
        style={{ maxWidth: maxWidthMap[size] ?? maxWidthMap.md }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div style={{ minWidth: 0 }}>
            {title ? (
              <h2 id={titleId} className="modal-header-title">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descriptionId} style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={closeLabel}
            className="modal-close"
          >
            <X style={{ width: 18, height: 18 }} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalBody({ className, children, ...props }) {
  return (
    <div className={cn('modal-body', className)} {...props}>
      {children}
    </div>
  );
}

export function ModalFooter({ className, children, ...props }) {
  return (
    <div className={cn('modal-footer', className)} {...props}>
      {children}
    </div>
  );
}
