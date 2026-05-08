import React from "react";
import { cn } from "#/utils/utils";

interface BackendStatusDotProps {
  /** `null` while the first probe is in flight. */
  isConnected: boolean | null;
  className?: string;
}

/**
 * Small colored dot that reflects backend reachability:
 *   - green when connected
 *   - red when disconnected
 *   - dim gray while the first probe is in flight
 */
export function BackendStatusDot({
  isConnected,
  className,
}: BackendStatusDotProps) {
  let color: string;
  let label: string;
  if (isConnected === true) {
    color = "bg-green-500";
    label = "Connected";
  } else if (isConnected === false) {
    color = "bg-red-500";
    label = "Disconnected";
  } else {
    color = "bg-neutral-500";
    label = "Checking connection";
  }

  return (
    <span
      data-testid="backend-status-dot"
      data-status={
        isConnected === null
          ? "checking"
          : isConnected
            ? "connected"
            : "disconnected"
      }
      aria-label={label}
      title={label}
      role="status"
      className={cn(
        "inline-block w-2 h-2 rounded-full shrink-0",
        color,
        className,
      )}
    />
  );
}
