import { useState } from "react";
import { useFetcher } from "react-router";

import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Notice from "~/components/notice";
import Select from "~/components/select";
import type { Role } from "~/server/web/roles";

import type { HeadplaneUserData } from "../route";

interface EditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: HeadplaneUserData;
}

export default function EditUserDialog({ isOpen, onOpenChange, user }: EditUserDialogProps) {
  const fetcher = useFetcher();
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<Role>(user.role);

  const isSubmitting = fetcher.state === "submitting";
  const isValid = username.trim();
  const hasChanges = username !== user.username || role !== user.role;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || !hasChanges) return;

    const formData = new FormData();
    formData.set("_action", "update");
    formData.set("userId", user.id);
    formData.set("username", username);
    formData.set("role", role);

    fetcher.submit(formData, { method: "POST" });
  };

  // Close dialog on success
  if (fetcher.data?.success && isOpen) {
    setTimeout(() => {
      onOpenChange(false);
    }, 100);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogPanel onSubmit={handleSubmit} isDisabled={!isValid || !hasChanges || isSubmitting}>
        <h2 className="text-xl font-semibold">Edit User</h2>
        <p className="text-sm text-mist-600 dark:text-mist-300">
          Update username or role for this user.
        </p>

        {fetcher.data?.error && (
          <Notice variant="error" title="Error updating user">
            {fetcher.data.error}
          </Notice>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <Input
              id="edit-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="edit-role" className="mb-1 block text-sm font-medium">
              Role
            </label>
            <Select id="edit-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="auditor">Auditor</option>
              <option value="it_admin">IT Admin</option>
              <option value="network_admin">Network Admin</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
