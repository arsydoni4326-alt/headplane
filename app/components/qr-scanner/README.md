# QR Scanner Component

A reusable QR code scanner component with camera integration for Headplane.

## Features

- 📷 Browser camera API integration (`getUserMedia`)
- 🔍 QR code decoding with `html5-qrcode`
- ✅ Permission handling (grant/deny/revoke)
- ❌ Error states (no camera, decode failed, invalid payload)
- ♿ Accessibility (keyboard nav, screen reader support)
- 🌗 Dark mode support

## Usage

```tsx
import { QRScanner } from "~/components/qr-scanner";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  const handleScan = (data: string) => {
    console.log("QR Code scanned:", data);
    // Process the QR code data
  };

  const handleError = (error: Error) => {
    console.error("Scanner error:", error);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Scanner</button>
      {isOpen && (
        <QRScanner onScan={handleScan} onError={handleError} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
```

## Props

### `QRScannerProps`

| Prop      | Type                     | Required | Description                                                  |
| --------- | ------------------------ | -------- | ------------------------------------------------------------ |
| `onScan`  | `(data: string) => void` | Yes      | Callback fired when a QR code is successfully scanned        |
| `onError` | `(error: Error) => void` | No       | Callback fired when an error occurs (camera not found, etc.) |
| `onClose` | `() => void`             | No       | Callback fired when the user closes the scanner              |

## States

The scanner manages the following internal states:

- **requesting-permission**: Initial state while requesting camera access
- **permission-denied**: Camera permission was denied by the user
- **scanning**: Camera is active and scanning for QR codes
- **error**: An error occurred (no camera found, etc.)
- **success**: QR code was successfully scanned

## Requirements

- **HTTPS**: The camera API requires a secure context (HTTPS) to function
- **Browser support**: Modern browsers with `getUserMedia` support
- **Permissions**: User must grant camera permission

## Accessibility

- Full keyboard navigation support
- ARIA labels and live regions for screen readers
- Focus management and visual focus indicators
- Descriptive error messages

## Testing

```bash
pnpm test:component qr-scanner
```

## Browser Compatibility

- ✅ Chrome/Edge (desktop + mobile)
- ✅ Firefox (desktop + mobile)
- ✅ Safari (desktop + mobile, with some quirks on iOS)

### Known Issues

- **iOS Safari**: Camera selection may behave differently than other browsers
- **HTTP**: Component will fail on non-HTTPS pages (use `localhost` for development)

## Implementation Details

- Uses `html5-qrcode` library for QR decoding
- Scans at 10 FPS for optimal performance
- Auto-closes after successful scan (500ms delay)
- Cleanup on unmount to release camera resources
- Environment-facing camera selected by default on mobile
