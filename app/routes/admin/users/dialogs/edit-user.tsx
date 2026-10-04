import { useState } from "react";
import { useFetcher } from "react-router";

import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Notice from "~/components/notice";
import Select from "~/components/select";

import type { HeadplaneDashboardRole, HeadplaneUserData } from "../route";

interface EditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: HeadplaneUserData;
}

export default function EditUserDialog({ isOpen, onOpenChange, user }: EditUserDialogProps) {
  const fetcher = useFetcher();
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<HeadplaneDashboardRole>(user.role);

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
              label="Username"
              labelHidden
              value={username}
              onChange={setUsername}
              placeholder="Enter username"
              required
              autoComplete="off"
            />
          </div>

          <Select
            items={[
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ]}
            label="Role"
            onValueChange={(value) => setRole((value ?? user.role) as HeadplaneDashboardRole)}
            value={role}
          />
        </div>
      </DialogPanel>
    </Dialog>
  );
}
