import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import { QRScanner } from "~/components/qr-scanner";

// Mock the QRScanner component
vi.mock("~/components/qr-scanner", () => ({
  QRScanner: vi.fn(),
}));

// Mock react-router
const mockNavigate = vi.fn();
const mockUseLoaderData = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLoaderData: mockUseLoaderData,
  };
});

// Import the component after mocks are set up
const { default: ScanQRRoute } = await import("~/routes/machines/scan-qr");

describe("ScanQR Route", () => {
  const mockUsers = [
    { id: "user-1", name: "Alice" },
    { id: "user-2", name: "Bob" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue({ users: mockUsers });

    // Default mock implementation for QRScanner
    vi.mocked(QRScanner).mockImplementation(({ onScan, onError, onClose }: any) => (
      <div data-testid="qr-scanner-mock">
        <button onClick={() => onScan("mock-scan-data")}>Mock Scan</button>
        <button onClick={() => onError?.(new Error("Mock error"))}>Mock Error</button>
        <button onClick={() => onClose?.()}>Mock Close</button>
      </div>
    ));
  });

  test("renders scan QR form with user selection", () => {
    render(<ScanQRRoute />);

    expect(screen.getByText("Scan QR Code")).toBeInTheDocument();
    expect(screen.getByText(/scan a QR code/i)).toBeInTheDocument();
    expect(screen.getByText("Select User")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  test("requires user selection before scanning", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const startButton = screen.getByRole("button", { name: /start scanning/i });
    expect(startButton).toBeDisabled();

    // Select a user using the combobox
    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));

    expect(startButton).not.toBeDisabled();
  });

  test("shows scanner when Start Scanning is clicked", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    // Select a user first
    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));

    // Click start scanning
    const startButton = screen.getByRole("button", { name: /start scanning/i });
    await user.click(startButton);

    expect(QRScanner).toHaveBeenCalled();
  });

  test("handles expired QR code", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    // Select a user
    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));

    // Start scanning
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    // Get the onScan callback from the QRScanner mock
    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    // Create an expired QR code payload
    const expiredPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() - 10000).toISOString(), // Expired 10 seconds ago
    });

    // Simulate scanning the expired QR code
    onScanCallback(expiredPayload);

    await waitFor(() => {
      expect(screen.getByText(/qr code has expired/i)).toBeInTheDocument();
    });
  });

  test("handles invalid QR code format (not JSON)", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    // Select a user
    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));

    // Start scanning
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    // Simulate scanning invalid (non-JSON) data
    onScanCallback("not-a-json-string");

    await waitFor(() => {
      expect(screen.getByText(/invalid qr code format/i)).toBeInTheDocument();
    });
  });

  test("handles invalid QR code type", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    // Select a user
    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));

    // Start scanning
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const invalidTypePayload = JSON.stringify({
      type: "some-other-type",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(invalidTypePayload);

    await waitFor(() => {
      expect(screen.getByText(/invalid qr code type/i)).toBeInTheDocument();
    });
  });

  test("handles unsupported QR code version", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    // Select a user
    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));

    // Start scanning
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const invalidVersionPayload = JSON.stringify({
      type: "headscale-registration",
      version: "2",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(invalidVersionPayload);

    await waitFor(() => {
      expect(screen.getByText(/unsupported qr code version/i)).toBeInTheDocument();
    });
  });

  test("handles missing auth_id in QR code", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const missingAuthIdPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(missingAuthIdPayload);

    await waitFor(() => {
      expect(screen.getByText(/missing auth_id/i)).toBeInTheDocument();
    });
  });

  test("handles missing server_url in QR code", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const missingServerUrlPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(missingServerUrlPayload);

    await waitFor(() => {
      expect(screen.getByText(/missing server_url/i)).toBeInTheDocument();
    });
  });

  test("handles invalid server_url format", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const invalidUrlPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "not-a-valid-url",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(invalidUrlPayload);

    await waitFor(() => {
      expect(screen.getByText(/invalid server_url/i)).toBeInTheDocument();
    });
  });

  test("handles missing expires_at in QR code", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const missingExpiryPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
    });

    onScanCallback(missingExpiryPayload);

    await waitFor(() => {
      expect(screen.getByText(/invalid qr code expiration/i)).toBeInTheDocument();
    });
  });

  test("shows success message after valid QR scan", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const validPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(validPayload);

    await waitFor(() => {
      expect(screen.getByText(/qr code scanned successfully/i)).toBeInTheDocument();
    });
  });

  test("allows retry after scan error", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    onScanCallback("invalid-data");

    await waitFor(() => {
      expect(screen.getByText(/invalid qr code format/i)).toBeInTheDocument();
    });

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    await user.click(tryAgainButton);

    expect(screen.queryByText(/invalid qr code format/i)).not.toBeInTheDocument();
    expect(QRScanner).toHaveBeenCalledTimes(2);
  });

  test("allows scanning again after successful scan", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const validPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(validPayload);

    await waitFor(() => {
      expect(screen.getByText(/qr code scanned successfully/i)).toBeInTheDocument();
    });

    const scanAgainButton = screen.getByRole("button", { name: /scan again/i });
    await user.click(scanAgainButton);

    expect(screen.queryByText(/qr code scanned successfully/i)).not.toBeInTheDocument();
    expect(QRScanner).toHaveBeenCalledTimes(2);
  });

  test("navigates to /machines on cancel", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith("/machines");
  });

  test("register button is enabled after valid scan with user selection", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onScanCallback = vi.mocked(QRScanner).mock.calls[0][0].onScan;

    const validPayload = JSON.stringify({
      type: "headscale-registration",
      version: "1",
      auth_id: "test-auth-id",
      server_url: "https://example.com",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    onScanCallback(validPayload);

    await waitFor(() => {
      const registerButton = screen.getByRole("button", { name: /register device/i });
      expect(registerButton).toBeInTheDocument();
      expect(registerButton).not.toBeDisabled();
    });
  });

  test("handles scanner errors from QRScanner component", async () => {
    const user = userEvent.setup();
    render(<ScanQRRoute />);

    const selectInput = screen.getByRole("combobox");
    await user.click(selectInput);
    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByRole("button", { name: /start scanning/i }));

    const onErrorCallback = vi.mocked(QRScanner).mock.calls[0][0].onError;

    onErrorCallback(new Error("Camera access denied"));

    await waitFor(() => {
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
    });
  });
});
