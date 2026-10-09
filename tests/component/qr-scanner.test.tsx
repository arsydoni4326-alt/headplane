import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { StrictMode } from "react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import { QRScanner } from "~/components/qr-scanner";

// Mock html5-qrcode
vi.mock("html5-qrcode", () => {
  return {
    Html5Qrcode: vi.fn(),
    Html5QrcodeScannerState: {
      NOT_STARTED: 1,
      SCANNING: 2,
      PAUSED: 3,
    },
  };
});

describe("QRScanner", () => {
  let mockScanner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock scanner instance
    mockScanner = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      getState: vi.fn(() => Html5QrcodeScannerState.SCANNING),
    };

    // Mock Html5Qrcode constructor to return our mock instance
    vi.mocked(Html5Qrcode).mockImplementation(function (this: any) {
      return mockScanner as any;
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders with requesting permission state initially", () => {
    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Scan QR Code")).toBeInTheDocument();
    expect(screen.getByText("Requesting camera permission...")).toBeInTheDocument();
    expect(screen.getByTestId("qr-scanner-region")).not.toHaveClass("hidden");
  });

  test("transitions to scanning state on successful camera access", async () => {
    mockScanner.start.mockResolvedValue(undefined);

    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} />);

    await waitFor(() => {
      expect(screen.getByText("Position the QR code within the frame to scan")).toBeInTheDocument();
    });

    expect(mockScanner.start).toHaveBeenCalledWith(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      expect.any(Function),
      undefined,
    );
  });

  test("calls onScan when QR code is decoded", async () => {
    let scanCallback: ((decodedText: string) => void) | undefined;

    mockScanner.start.mockImplementation(async (_config, _options, onScanSuccess) => {
      scanCallback = onScanSuccess;
    });

    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} />);

    await waitFor(() => {
      expect(mockScanner.start).toHaveBeenCalled();
    });

    // Simulate QR code scan
    scanCallback?.("test-qr-data");

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith("test-qr-data");
    });
  });

  test("shows permission denied message on permission error", async () => {
    mockScanner.start.mockRejectedValue(new Error("NotAllowedError: Permission denied"));

    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} />);

    await waitFor(() => {
      expect(screen.getByText("Camera Access Denied")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Camera access denied. Please enable camera permissions/i),
    ).toBeInTheDocument();
  });

  test("shows no camera error when camera not found", async () => {
    mockScanner.start.mockRejectedValue(new Error("NotFoundError: No camera found"));

    const onError = vi.fn();
    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} onError={onError} />);

    await waitFor(() => {
      expect(screen.getByText("Camera Error")).toBeInTheDocument();
    });

    expect(screen.getByText("No camera found on this device.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  test("shows generic error for other errors", async () => {
    mockScanner.start.mockRejectedValue(new Error("Unknown error"));

    const onError = vi.fn();
    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} onError={onError} />);

    await waitFor(() => {
      expect(screen.getByText("Camera Error")).toBeInTheDocument();
    });

    expect(screen.getByText("Unknown error")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Unknown error" }));
  });

  test("calls onClose when close button is clicked", async () => {
    mockScanner.start.mockResolvedValue(undefined);

    const onClose = vi.fn();
    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close scanner");
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  test("cleans up scanner on unmount", async () => {
    mockScanner.start.mockResolvedValue(undefined);

    const onScan = vi.fn();
    const { unmount } = render(<QRScanner onScan={onScan} />);

    await waitFor(() => {
      expect(mockScanner.start).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockScanner.stop).toHaveBeenCalled();
      expect(mockScanner.clear).toHaveBeenCalled();
    });
  });

  test("does not stop a scanner that failed to start", async () => {
    mockScanner.getState.mockReturnValue(Html5QrcodeScannerState.NOT_STARTED);
    mockScanner.start.mockRejectedValue(new Error("NotAllowedError: Permission denied"));

    const { unmount } = render(<QRScanner onScan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Camera Access Denied")).toBeInTheDocument();
    });

    unmount();

    expect(mockScanner.stop).not.toHaveBeenCalled();
    expect(mockScanner.clear).not.toHaveBeenCalled();
  });

  test("absorbs a synchronous stop error during cleanup", async () => {
    mockScanner.start.mockResolvedValue(undefined);
    mockScanner.stop.mockImplementation(() => {
      throw new Error("Cannot stop, scanner is not running or paused.");
    });

    const { unmount } = render(<QRScanner onScan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Position the QR code within the frame to scan")).toBeInTheDocument();
    });

    expect(() => unmount()).not.toThrow();

    await waitFor(() => {
      expect(mockScanner.stop).toHaveBeenCalledOnce();
    });

    expect(mockScanner.clear).not.toHaveBeenCalled();
  });

  test("cleans up a paused scanner on unmount", async () => {
    mockScanner.getState.mockReturnValue(Html5QrcodeScannerState.PAUSED);
    mockScanner.start.mockResolvedValue(undefined);

    const { unmount } = render(<QRScanner onScan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Position the QR code within the frame to scan")).toBeInTheDocument();
    });

    unmount();

    await waitFor(() => {
      expect(mockScanner.stop).toHaveBeenCalledOnce();
      expect(mockScanner.clear).toHaveBeenCalledOnce();
    });
  });

  test("stops a scanner that starts after it unmounts", async () => {
    let resolveStart: (() => void) | undefined;
    mockScanner.getState.mockReturnValue(Html5QrcodeScannerState.SCANNING);
    mockScanner.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        }),
    );

    const { unmount } = render(<QRScanner onScan={vi.fn()} />);

    await waitFor(() => {
      expect(mockScanner.start).toHaveBeenCalledOnce();
    });

    unmount();
    resolveStart?.();

    await waitFor(() => {
      expect(mockScanner.stop).toHaveBeenCalledOnce();
      expect(mockScanner.clear).toHaveBeenCalledOnce();
    });
  });

  test("starts successfully when React StrictMode replays the effect", async () => {
    mockScanner.start.mockResolvedValue(undefined);

    render(
      <StrictMode>
        <QRScanner onScan={vi.fn()} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText("Position the QR code within the frame to scan")).toBeInTheDocument();
    });
  });

  test("has correct accessibility attributes", () => {
    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "QR Code Scanner");

    const closeButton = screen.getByLabelText("Close scanner");
    expect(closeButton).toBeInTheDocument();
  });

  test("shows success message after successful scan", async () => {
    let scanCallback: ((decodedText: string) => void) | undefined;

    mockScanner.start.mockImplementation(async (_config, _options, onScanSuccess) => {
      scanCallback = onScanSuccess;
    });

    const onScan = vi.fn();
    render(<QRScanner onScan={onScan} />);

    await waitFor(() => {
      expect(mockScanner.start).toHaveBeenCalled();
    });

    // Simulate QR code scan
    scanCallback?.("test-data");

    await waitFor(() => {
      expect(screen.getByText("QR Code Scanned Successfully!")).toBeInTheDocument();
    });
  });
});
