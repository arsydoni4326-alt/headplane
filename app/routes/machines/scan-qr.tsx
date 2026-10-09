import { useState } from "react";
import { data, redirect, useLoaderData, useNavigate } from "react-router";

import Button from "~/components/button";
import { QRScanner } from "~/components/qr-scanner";
import Select, { type SelectItem } from "~/components/select";
import { actorFromPrincipal } from "~/server/audit";
import {
  auditContext,
  authContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";
import { normalizeRegistrationKey } from "~/utils/register-key";

import type { Route } from "./+types/scan-qr";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);

  if (!auth.can(principal, Capabilities.write_machines)) {
    throw data("You do not have permission to register machines", {
      status: 403,
    });
  }

  const { api } = await getRequestApi(request);
  const usersSnap = await headscaleLiveStore.get(usersResource, api);

  return {
    users: usersSnap.data.map((user: { id: string; name: string }) => ({
      id: user.id,
      name: user.name,
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const audit = context.get(auditContext);
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const { principal, api } = await getRequestApi(request);

  if (!auth.can(principal, Capabilities.write_machines)) {
    throw data("You do not have permission to register machines", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const qrData = formData.get("qr_data")?.toString();
  const user = formData.get("user")?.toString();

  if (!qrData) {
    throw data("Missing QR code data", { status: 400 });
  }

  if (!user) {
    throw data("Missing user selection", { status: 400 });
  }

  // Parse and validate QR code payload
  let payload: {
    type?: string;
    version?: string;
    auth_id?: string;
    server_url?: string;
    expires_at?: string;
  };
  try {
    payload = JSON.parse(qrData);
  } catch {
    throw data("Invalid QR code format", { status: 400 });
  }

  if (payload.type !== "headscale-registration") {
    throw data("Invalid QR code type", { status: 400 });
  }

  if (payload.version !== "1") {
    throw data("Unsupported QR code version", { status: 400 });
  }

  if (!payload.auth_id) {
    throw data("Missing auth_id in QR code", { status: 400 });
  }

  if (!payload.server_url) {
    throw data("Missing server_url in QR code", { status: 400 });
  }

  if (!payload.expires_at || Number.isNaN(Date.parse(payload.expires_at))) {
    throw data("Invalid QR code expiration", { status: 400 });
  }

  if (Date.parse(payload.expires_at) <= Date.now()) {
    throw data("QR code has expired. Start registration again to get a new code.", { status: 400 });
  }

  try {
    new URL(payload.server_url);
  } catch {
    throw data("Invalid server_url in QR code", { status: 400 });
  }

  const authId = normalizeRegistrationKey(payload.auth_id);
  if (!authId) {
    throw data("Invalid auth_id in QR code", { status: 400 });
  }

  try {
    const node = await api.nodes.register(user, authId);
    await headscaleLiveStore.refresh(nodesResource, api);

    const actor = actorFromPrincipal(principal);
    await audit.record({
      ...actor,
      action: "machine.register",
      resourceType: "machine",
      resourceId: node.id,
      details: { name: node.givenName, user, method: "qr_code" },
    });

    return redirect(`/machines/${node.id}`);
  } catch (error) {
    const message = isDataWithApiError(error)
      ? extractApiErrorMessage(error.data)
      : error instanceof Error && error.message.trim() !== ""
        ? error.message
        : "Unable to register this device. Please try again.";
    const status = isDataWithApiError(error) ? error.data.statusCode : 500;

    return data({ error: message }, { status });
  }
}

function extractApiErrorMessage(error: { data?: unknown; rawData: string }) {
  if (error.data != null && typeof error.data === "object" && "message" in error.data) {
    const message = (error.data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  }

  return error.rawData.trim() || "Unable to register this device. Please try again.";
}

async function registrationErrorMessage(response: Response) {
  const raw = await response.text();
  if (raw.trim() === "") {
    return "Unable to register this device. Please try again.";
  }

  try {
    const body = JSON.parse(raw) as { error?: unknown; message?: unknown };
    const message = body.error ?? body.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  } catch {
    // The server or reverse proxy can return plain text instead of JSON.
  }

  return raw.trim() || "Unable to register this device. Please try again.";
}

export default function ScanQRPage() {
  const loaderData = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userItems: SelectItem[] = loaderData.users.map((user: { id: string; name: string }) => ({
    value: user.id,
    label: user.name,
  }));

  const handleScan = (data: string) => {
    setShowScanner(false);
    setError(null);

    try {
      const payload: {
        type?: string;
        version?: string;
        auth_id?: string;
        server_url?: string;
        expires_at?: string;
      } = JSON.parse(data);
      if (payload.type !== "headscale-registration") {
        setError("Invalid QR code type. Please scan a Headscale registration QR code.");
        return;
      }
      if (payload.version !== "1") {
        setError("Unsupported QR code version.");
        return;
      }
      if (!payload.auth_id) {
        setError("Invalid QR code: missing auth_id.");
        return;
      }
      if (!payload.server_url) {
        setError("Invalid QR code: missing server_url.");
        return;
      }
      if (!payload.expires_at || Number.isNaN(Date.parse(payload.expires_at))) {
        setError("Invalid QR code expiration.");
        return;
      }
      if (Date.parse(payload.expires_at) <= Date.now()) {
        setError("QR code has expired. Start registration again to get a new code.");
        return;
      }

      try {
        new URL(payload.server_url);
      } catch {
        setError("Invalid server_url in QR code.");
        return;
      }

      setScannedData(data);
    } catch {
      setError("Invalid QR code format. Please try again.");
    }
  };

  const handleError = (err: Error) => {
    setError(err.message);
    setShowScanner(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!scannedData || !selectedUser) {
      setError("Please scan a QR code and select a user");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch(`${__PREFIX__}/machines/scan-qr`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await registrationErrorMessage(response));
      }

      // Extract redirect location and navigate
      const redirectUrl = response.headers.get("Location") || response.url;
      navigate(redirectUrl.replace(window.location.origin, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register device");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-mist-900 dark:text-mist-50">Scan QR Code</h1>
        <p className="mt-2 text-sm text-mist-600 dark:text-mist-400">
          Scan a QR code from a device registration page to quickly approve and register it to your
          network.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Select
          items={userItems}
          label="Select User"
          placeholder="Choose a user for this device"
          description="The device will be assigned to this user"
          value={selectedUser}
          onValueChange={(value) => setSelectedUser(value ?? "")}
          required
          disabled={isSubmitting}
        />

        <input type="hidden" name="user" value={selectedUser} />
        {scannedData && <input type="hidden" name="qr_data" value={scannedData} />}

        {!scannedData && (
          <Button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={!selectedUser || isSubmitting}
            className="w-full"
          >
            {showScanner ? "Scanning..." : "Start Scanning"}
          </Button>
        )}

        {showScanner && (
          <QRScanner
            onScan={handleScan}
            onError={handleError}
            onClose={() => setShowScanner(false)}
          />
        )}

        {scannedData && !error && (
          <div
            className={cn(
              "rounded-lg border p-4",
              "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
            )}
          >
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              QR code scanned successfully!
            </p>
            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
              Click &quot;Register Device&quot; to complete the registration.
            </p>
          </div>
        )}

        {error && (
          <div
            className={cn(
              "rounded-lg border p-4",
              "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
            )}
          >
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
            <Button
              type="button"
              variant="light"
              onClick={() => {
                setError(null);
                setScannedData(null);
                setShowScanner(true);
              }}
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        )}

        {scannedData && !error && (
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting || !selectedUser} className="flex-1">
              {isSubmitting ? "Registering..." : "Register Device"}
            </Button>
            <Button
              type="button"
              variant="light"
              onClick={() => {
                setScannedData(null);
                setError(null);
                setShowScanner(true);
              }}
              disabled={isSubmitting}
            >
              Scan Again
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="light"
          onClick={() => navigate("/machines")}
          disabled={isSubmitting}
          className="w-full"
        >
          Cancel
        </Button>
      </form>
    </div>
  );
}
