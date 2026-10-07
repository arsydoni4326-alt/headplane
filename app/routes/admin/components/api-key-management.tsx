import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Form, useFetcher, useRevalidator } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Dialog, { DialogPanel } from "~/components/dialog";
import Notice from "~/components/notice";

interface ApiKeyManagementProps {
  authToken: string;
  configuredApiKey?: string;
  apiKeys: ApiKey[];
}

interface ApiKey {
  id: string;
  prefix: string;
  expiration: string | null;
  createdAt: string;
}

export default function ApiKeyManagement({
  authToken,
  configuredApiKey,
  apiKeys: initialApiKeys,
}: ApiKeyManagementProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  
  const createFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const revalidator = useRevalidator();

  const serviceKeyPrefix = configuredApiKey ? configuredApiKey.substring(0, 8) : null;
  
  // Use data from fetcher if available, otherwise use initial data
  const apiKeys = revalidator.state === "loading" ? initialApiKeys : initialApiKeys;
  const newApiKey = createFetcher.data?.success ? createFetcher.data.apiKey : null;
  const error = createFetcher.data?.error || deleteFetcher.data?.error;

  function isServiceKey(key: ApiKey): boolean {
    if (!serviceKeyPrefix) return false;
    return key.prefix.replace(/\*/g, "").startsWith(serviceKeyPrefix);
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between">
        <div>
          <Card.Title>API Keys</Card.Title>
          <Card.Text>Manage Headscale API keys for automation and integrations</Card.Text>
        </div>
        <Button variant="heavy" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {error && (
        <Notice variant="error" className="mt-4">
          {error}
        </Notice>
      )}

      <ApiKeyTable
        apiKeys={apiKeys}
        isServiceKey={isServiceKey}
        onDelete={(key) => {
          setSelectedKey(key);
          setShowDeleteDialog(true);
        }}
      />

      <CreateApiKeyDialog
        isOpen={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          createFetcher.data = null;
        }}
        newApiKey={newApiKey}
        fetcher={createFetcher}
      />

      <DeleteApiKeyDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedKey(null);
        }}
        apiKey={selectedKey}
        fetcher={deleteFetcher}
      />
    </Card>
  );
}

  if (loading) {
    return (
      <Card className="mt-6">
        <Card.Title>API Keys</Card.Title>
        <p className="mt-4 text-sm text-mist-600">Loading API keys...</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <Card.Title>API Keys</Card.Title>
            <Card.Text>Manage Headscale API keys for programmatic access</Card.Text>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} variant="heavy">
            <Plus className="h-4 w-4" />
            Create API Key
          </Button>
        </div>

        {error && <Notice variant="error">{error}</Notice>}

        <ApiKeyTable
          apiKeys={apiKeys}
          isServiceKey={isServiceKey}
          onDelete={(key) => {
            setSelectedKey(key);
            setShowDeleteDialog(true);
          }}
        />
      </Card>

      <CreateApiKeyDialog
        isOpen={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setNewApiKey(null);
        }}
        onCreate={handleCreateApiKey}
        newApiKey={newApiKey}
      />

      <DeleteApiKeyDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedKey(null);
        }}
        onConfirm={async () => {
          if (selectedKey) {
            await handleDeleteApiKey(selectedKey);
          }
        }}
        apiKey={selectedKey}
      />
    </>
  );
}

interface ApiKeyTableProps {
  apiKeys: ApiKey[];
  isServiceKey: (key: ApiKey) => boolean;
  onDelete: (key: ApiKey) => void;
}

function ApiKeyTable({ apiKeys, isServiceKey, onDelete }: ApiKeyTableProps) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px] table-auto">
        <thead className="text-mist-600 dark:text-mist-300">
          <tr className="text-left">
            <th className="pb-2 text-xs font-bold uppercase">Prefix</th>
            <th className="pb-2 text-xs font-bold uppercase">Created</th>
            <th className="pb-2 text-xs font-bold uppercase">Expiry</th>
            <th className="w-12 pb-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mist-100 border-t border-mist-100 dark:divide-mist-800 dark:border-mist-800">
          {apiKeys.map((key) => (
            <tr key={key.id} className="group hover:bg-mist-100 dark:hover:bg-mist-800">
              <td className="py-3 pl-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm">{key.prefix}</code>
                  {isServiceKey(key) && (
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      Service Key
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3">
                <p className="text-sm text-mist-600 dark:text-mist-300">
                  {new Date(key.createdAt).toLocaleDateString()}
                </p>
              </td>
              <td className="py-3">
                <p className="text-sm text-mist-600 dark:text-mist-300">
                  {key.expiration ? new Date(key.expiration).toLocaleDateString() : "Never"}
                </p>
              </td>
              <td className="py-3 pr-2">
                <Button
                  onClick={() => onDelete(key)}
                  variant="danger"
                  disabled={isServiceKey(key)}
                  title={
                    isServiceKey(key) ? "Cannot delete configured service key" : "Delete API key"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CreateApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (expirationDays: number) => Promise<void>;
  newApiKey: string | null;
}

function CreateApiKeyDialog({ isOpen, onClose, onCreate, newApiKey }: CreateApiKeyDialogProps) {
  const [expirationDays, setExpirationDays] = useState(90);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await onCreate(expirationDays);
    } finally {
      setCreating(false);
    }
  }

  async function copyToClipboard() {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (newApiKey) {
    return (
      <Dialog isOpen={isOpen} onOpenChange={onClose}>
        <DialogPanel variant="unactionable">
          <h2 className="text-xl font-semibold">API Key Created</h2>

          <Notice variant="warning">Save this key now. It will not be shown again.</Notice>

          <div>
            <label className="mb-1 block text-sm font-medium">API Key</label>
            <div className="flex gap-2">
              <input
                value={newApiKey}
                readOnly
                className="flex-1 rounded-md border border-mist-200 bg-white px-3 py-2 font-mono text-sm dark:border-mist-800 dark:bg-mist-900"
              />
              <Button onClick={copyToClipboard} variant="light" type="button">
                <Copy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    );
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose}>
      <DialogPanel
        isDisabled={creating}
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <h2 className="text-xl font-semibold">Create API Key</h2>

        <div>
          <label htmlFor="expiration" className="mb-1 block text-sm font-medium">
            Expiration (days)
          </label>
          <input
            type="number"
            id="expiration"
            value={expirationDays}
            onChange={(e) => setExpirationDays(Number(e.target.value))}
            min={1}
            max={3650}
            className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm dark:border-mist-800 dark:bg-mist-900"
          />
          <p className="mt-1 text-xs text-mist-600 dark:text-mist-400">
            Key will expire in {expirationDays} days
          </p>
        </div>
      </DialogPanel>
    </Dialog>
  );
}

interface DeleteApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  apiKey: ApiKey | null;
}

function DeleteApiKeyDialog({ isOpen, onClose, onConfirm, apiKey }: DeleteApiKeyDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose}>
      <DialogPanel
        variant="destructive"
        isDisabled={deleting}
        onSubmit={(e) => {
          e.preventDefault();
          handleConfirm();
        }}
      >
        <h2 className="text-xl font-semibold">Delete API Key</h2>
        <p className="mt-2 text-sm text-mist-600 dark:text-mist-300">
          Are you sure you want to delete the API key <code>{apiKey?.prefix}</code>? This action
          cannot be undone.
        </p>
      </DialogPanel>
    </Dialog>
  );
}
