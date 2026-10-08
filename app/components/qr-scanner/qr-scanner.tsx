import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Button from "~/components/button";
import cn from "~/utils/cn";

export interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

type ScannerState =
  | { status: "requesting-permission" }
  | { status: "permission-denied"; message: string }
  | { status: "scanning" }
  | { status: "error"; error: Error }
  | { status: "success"; data: string };

export function QRScanner({ onScan, onError, onClose }: QRScannerProps) {
  const [state, setState] = useState<ScannerState>({ status: "requesting-permission" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const startScanning = async () => {
      // Prevent double initialization
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        const scanner = new Html5Qrcode("qr-scanner-region");
        scannerRef.current = scanner;

        // Request camera permission and start scanning
        await scanner.start(
          { facingMode: "environment" }, // Use back camera on mobile
          {
            fps: 10, // Scan 10 times per second
            qrbox: { width: 250, height: 250 }, // Scanning box size
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (mounted) {
              setState({ status: "success", data: decodedText });
              onScan(decodedText);
              // Auto-close after successful scan
              setTimeout(() => {
                onClose?.();
              }, 500);
            }
          },
          undefined, // Error callback - we don't want to show decode errors
        );

        if (mounted) {
          setState({ status: "scanning" });
        }
      } catch (err) {
        if (!mounted) return;

        const error = err instanceof Error ? err : new Error(String(err));

        // Check for permission-related errors
        if (
          error.message.includes("Permission") ||
          error.message.includes("permission") ||
          error.message.includes("NotAllowedError") ||
          error.message.includes("denied")
        ) {
          setState({
            status: "permission-denied",
            message:
              "Camera access denied. Please enable camera permissions in your browser settings and reload the page.",
          });
        } else if (
          error.message.includes("NotFoundError") ||
          error.message.includes("No camera") ||
          error.message.includes("not found")
        ) {
          const noCamera = new Error("No camera found on this device.");
          setState({ status: "error", error: noCamera });
          onError?.(noCamera);
        } else {
          setState({ status: "error", error });
          onError?.(error);
        }
      }
    };

    startScanning();

    return () => {
      mounted = false;
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch(() => {
            // Ignore cleanup errors
          });
      }
    };
  }, [onScan, onError, onClose]);

  const handleClose = () => {
    onClose?.();
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/80",
        "transition-opacity duration-200",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="QR Code Scanner"
    >
      <div
        className={cn(
          "relative flex w-full max-w-lg flex-col items-center gap-4 p-4",
          "rounded-xl bg-white dark:bg-mist-900",
          "shadow-2xl",
        )}
        ref={containerRef}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            "absolute right-4 top-4 z-10 rounded-lg p-2",
            "bg-white/90 dark:bg-mist-800/90",
            "text-mist-700 dark:text-mist-300",
            "hover:bg-white dark:hover:bg-mist-800",
            "transition-colors",
            "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40",
          )}
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scanner title */}
        <div className="flex items-center gap-2 pt-2">
          <Camera className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-semibold text-mist-900 dark:text-white">Scan QR Code</h2>
        </div>

        {/* Scanner container with state-based UI */}
        <div className="relative w-full overflow-hidden rounded-lg bg-black">
          {state.status === "requesting-permission" && (
            <div
              className="flex h-[400px] flex-col items-center justify-center gap-4 text-white"
              role="status"
              aria-live="polite"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              <p className="text-sm">Requesting camera permission...</p>
            </div>
          )}

          {state.status === "permission-denied" && (
            <div
              className="flex h-[400px] flex-col items-center justify-center gap-4 p-6 text-center text-white"
              role="alert"
              aria-live="assertive"
            >
              <Camera className="h-12 w-12 opacity-50" />
              <div className="space-y-2">
                <p className="font-semibold">Camera Access Denied</p>
                <p className="text-sm text-white/80">{state.message}</p>
              </div>
            </div>
          )}

          {state.status === "error" && (
            <div
              className="flex h-[400px] flex-col items-center justify-center gap-4 p-6 text-center text-white"
              role="alert"
              aria-live="assertive"
            >
              <Camera className="h-12 w-12 opacity-50" />
              <div className="space-y-2">
                <p className="font-semibold">Camera Error</p>
                <p className="text-sm text-white/80">{state.error.message}</p>
              </div>
            </div>
          )}

          {/* Scanner region - html5-qrcode injects video here */}
          <div
            id="qr-scanner-region"
            className={cn(
              state.status === "scanning" || state.status === "success" ? "block" : "hidden",
            )}
          />

          {state.status === "success" && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/50"
              role="status"
              aria-live="polite"
            >
              <div className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
                <p className="font-semibold">QR Code Scanned Successfully!</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        {state.status === "scanning" && (
          <p
            className="text-center text-sm text-mist-600 dark:text-mist-400"
            role="status"
            aria-live="polite"
          >
            Position the QR code within the frame to scan
          </p>
        )}

        {/* Action buttons for error states */}
        {(state.status === "permission-denied" || state.status === "error") && (
          <div className="flex w-full justify-end">
            <Button onClick={handleClose} variant="light">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
