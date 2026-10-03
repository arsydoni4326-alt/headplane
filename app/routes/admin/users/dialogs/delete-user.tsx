import { AlertTriangle } from "lucide-react";
import { useFetcher } from "react-router";

import Dialog, { DialogPanel } from "~/components/dialog";
import Notice from "~/components/notice";

import type { HeadplaneUserData } from "../route";

interface DeleteUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: HeadplaneUserData;
}

export default function DeleteUserDialog({ isOpen, onOpenChange, user }: DeleteUserDialogProps) {
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state === "submitting";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData();
    formData.set("_action", "delete");
    formData.set("userId", user.id);

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
      <DialogPanel variant="destructive" onSubmit={handleSubmit} isDisabled={isSubmitting}>
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Delete User</h2>
            <p className="mt-1 text-sm text-mist-600 dark:text-mist-300">
              Are you sure you want to delete <strong>{user.username}</strong>? This action cannot
              be undone.
            </p>
          </div>
        </div>

        {fetcher.data?.error && (
          <Notice variant="error" title="Error deleting user">
            {fetcher.data.error}
          </Notice>
        )}

        {user.role === "admin" && (
          <Notice variant="warning" title="Warning">
            You are about to delete an admin user. Make sure there is at least one other admin
            account before proceeding.
          </Notice>
        )}
      </DialogPanel>
    </Dialog>
  );
}
