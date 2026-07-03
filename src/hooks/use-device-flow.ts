import React from "react";
import {
  startDeviceFlow,
  pollForToken,
  DeviceFlowError,
  type DeviceAuthorizationResponse,
} from "#/api/device-flow-client";

export type DeviceFlowStatus =
  | "idle"
  | "starting"
  | "awaiting_authorization"
  | "success"
  | "error";

export interface DeviceFlowState {
  status: DeviceFlowStatus;
  /** The verification URL to show/open for the user */
  verificationUrl: string | null;
  /** User code to display as fallback */
  userCode: string | null;
  /**
   * The user id returned by the cookie endpoint on success. The API key
   * itself is **not** exposed here — it lives in the HttpOnly cookie
   * minted by `POST /oauth/device/cookie` so XSS payloads cannot read it.
   */
  userId: string | null;
  /** Error message if status is "error" */
  error: string | null;
  /** Error code for programmatic handling */
  errorCode: string | null;
}

export interface UseDeviceFlowReturn extends DeviceFlowState {
  /** Start the device flow authentication */
  start: (host: string) => void;
  /** Cancel an in-progress flow */
  cancel: () => void;
  /** Reset state back to idle */
  reset: () => void;
}

const initialState: DeviceFlowState = {
  status: "idle",
  verificationUrl: null,
  userCode: null,
  userId: null,
  error: null,
  errorCode: null,
};

/**
 * React hook for managing OAuth 2.0 Device Flow authentication.
 *
 * The flow itself uses the cookie endpoint (`POST /oauth/device/cookie`)
 * introduced in OpenHands/OpenHands#15104, which writes the API key into
 * an HttpOnly `api_key` cookie instead of returning it in the response
 * body. The hook therefore does **not** surface the API key to callers —
 * the only public success-state artifact is the `userId` returned in the
 * `{success, user_id}` response body. The actual credential stays in
 * the cookie jar and is sent on subsequent cloud requests via
 * `credentials: "include"`.
 *
 * Usage:
 * ```tsx
 * const { status, verificationUrl, error, start, cancel, reset } = useDeviceFlow();
 *
 * // Start auth
 * start("https://app.all-hands.dev");
 *
 * // Open browser when awaiting
 * if (status === "awaiting_authorization" && verificationUrl) {
 *   window.open(verificationUrl, "_blank");
 * }
 *
 * // React to success — mark the backend as cookie-authenticated and let
 * // the cookie carry the credential from here on.
 * if (status === "success") {
 *   markBackendCookieAuthenticated();
 * }
 * ```
 */
export function useDeviceFlow(): UseDeviceFlowReturn {
  const [state, setState] = React.useState<DeviceFlowState>(initialState);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const start = React.useCallback((host: string) => {
    // Cancel any existing flow
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState({
      ...initialState,
      status: "starting",
    });

    (async () => {
      let authResponse: DeviceAuthorizationResponse;

      try {
        authResponse = await startDeviceFlow(host);
      } catch (error) {
        if (abortController.signal.aborted) return;

        const message =
          error instanceof Error
            ? error.message
            : "Failed to start device flow";
        const code = error instanceof DeviceFlowError ? error.code : undefined;

        setState({
          ...initialState,
          status: "error",
          error: message,
          errorCode: code ?? null,
        });
        return;
      }

      if (abortController.signal.aborted) return;

      setState({
        ...initialState,
        status: "awaiting_authorization",
        verificationUrl: authResponse.verification_uri_complete,
        userCode: authResponse.user_code,
      });

      try {
        const cookieResponse = await pollForToken(
          host,
          authResponse.device_code,
          {
            interval: authResponse.interval,
            signal: abortController.signal,
          },
        );

        if (abortController.signal.aborted) return;

        setState({
          ...initialState,
          status: "success",
          userId: cookieResponse.user_id,
        });
      } catch (error) {
        // Early return if component unmounted or user cancelled
        if (abortController.signal.aborted) return;

        // Defensive: handle cancellation errors that may slip through
        // (currently pollForToken only throws "cancelled" when signal.aborted,
        // which is caught above, but this guards against future changes)
        const isCancel =
          error instanceof DeviceFlowError && error.code === "cancelled";
        if (isCancel) {
          setState(initialState);
          return;
        }

        const message =
          error instanceof Error ? error.message : "Authorization failed";
        const code = error instanceof DeviceFlowError ? error.code : undefined;

        setState({
          ...initialState,
          status: "error",
          error: message,
          errorCode: code ?? null,
        });
      }
    })();
  }, []);

  const cancel = React.useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState(initialState);
  }, []);

  const reset = React.useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState(initialState);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    ...state,
    start,
    cancel,
    reset,
  };
}
