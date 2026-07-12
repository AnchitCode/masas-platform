import { useEffect, useRef, useCallback } from 'react';
import { GOOGLE_CLIENT_ID } from '../utils/constants';

/**
 * Google Identity Services (GIS) hook.
 * Initializes GIS and renders the "Sign in with Google" button.
 *
 * @param onSuccess - Called with the Google ID token (credential) on successful sign-in
 * @param buttonRef - React ref to the DOM element where the button should render
 */
export function useGoogleAuth(
  onSuccess: (idToken: string) => void,
  buttonRef: React.RefObject<HTMLDivElement | null>,
) {
  const callbackRef = useRef(onSuccess);
  useEffect(() => {
    callbackRef.current = onSuccess;
  });

  const initGoogle = useCallback(() => {
    const google = (window as unknown as Record<string, unknown>).google as
      | { accounts: { id: { initialize: (config: Record<string, unknown>) => void; renderButton: (el: HTMLElement, config: Record<string, unknown>) => void } } }
      | undefined;

    if (!google?.accounts?.id || !buttonRef.current) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        callbackRef.current(response.credential);
      },
    });

    google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: buttonRef.current.offsetWidth,
      text: 'continue_with',
      logo_alignment: 'left',
    });
  }, [buttonRef]);

  useEffect(() => {
    // GIS script may already be loaded
    if ((window as unknown as Record<string, unknown>).google) {
      initGoogle();
      return;
    }

    // Wait for the script to load
    const handleLoad = () => initGoogle();
    window.addEventListener('load', handleLoad);

    // Also poll briefly in case the script loads after our event listener
    const interval = setInterval(() => {
      if ((window as unknown as Record<string, unknown>).google) {
        initGoogle();
        clearInterval(interval);
      }
    }, 200);

    return () => {
      window.removeEventListener('load', handleLoad);
      clearInterval(interval);
    };
  }, [initGoogle]);
}
