import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;
    let startFinished = false;
    let scanner: Html5Qrcode | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const stopScanner = async () => {
      if (!scanner) {
        return;
      }

      try {
        const scannerState = scanner.getState();
        if (
          scannerState !== Html5QrcodeScannerState.SCANNING &&
          scannerState !== Html5QrcodeScannerState.PAUSED
        ) {
          return;
        }

        await scanner.stop();
        scanner.clear();
      } catch {
        // Camera cleanup must not escape into the route error boundary.
      }
    };

    const startScanning = async () => {
      try {
        scanner = new Html5Qrcode("qr-scanner-region");

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!cancelled) {
              setState({ status: "success", data: decodedText });
              onScan(decodedText);
              closeTimer = setTimeout(() => {
                onClose?.();
              }, 500);
            }
          },
          undefined,
        );

        startFinished = true;
        if (cancelled) {
          await stopScanner();
          return;
        }

        setState({ status: "scanning" });
      } catch (err) {
        startFinished = true;
        if (cancelled) {
          await stopScanner();
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));

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

    // Let StrictMode's effect replay cancel its first setup before creating a camera.
    queueMicrotask(() => {
      if (!cancelled) {
        void startScanning();
      }
    });

    return () => {
      cancelled = true;
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
      if (startFinished) {
        void stopScanner();
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
      >
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

        <div className="flex items-center gap-2 pt-2">
          <Camera className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-semibold text-mist-900 dark:text-white">Scan QR Code</h2>
        </div>

        <div className="relative h-[400px] w-full overflow-hidden rounded-lg bg-black">
          <div className="h-full w-full" data-testid="qr-scanner-region" id="qr-scanner-region" />

          {state.status === "requesting-permission" && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 text-white"
              role="status"
              aria-live="polite"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              <p className="text-sm">Requesting camera permission...</p>
            </div>
          )}

          {state.status === "permission-denied" && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white"
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
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white"
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

          {state.status === "success" && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
              role="status"
              aria-live="polite"
            >
              <div className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
                <p className="font-semibold">QR Code Scanned Successfully!</p>
              </div>
            </div>
          )}
        </div>

        {state.status === "scanning" && (
          <p
            className="text-center text-sm text-mist-600 dark:text-mist-400"
            role="status"
            aria-live="polite"
          >
            Position the QR code within the frame to scan
          </p>
        )}

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
