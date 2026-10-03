import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Notice from "~/components/notice";
import Select from "~/components/select";
import type { Role } from "~/server/web/roles";

interface CreateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateUserDialog({ isOpen, onOpenChange }: CreateUserDialogProps) {
  const fetcher = useFetcher();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("member");

  const isSubmitting = fetcher.state === "submitting";
  const passwordsMatch = password === confirmPassword;
  const isValid = username.trim() && password && passwordsMatch;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;

    const formData = new FormData();
    formData.set("_action", "create");
    formData.set("username", username);
    formData.set("password", password);
    formData.set("role", role);

    fetcher.submit(formData, { method: "POST" });
  };

  // Close dialog and reset form on success
  if (fetcher.data?.success && isOpen) {
    setTimeout(() => {
      onOpenChange(false);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setRole("member");
    }, 100);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogPanel onSubmit={handleSubmit} isDisabled={!isValid || isSubmitting}>
        <h2 className="text-xl font-semibold">Create New User</h2>
        <p className="text-sm text-mist-600 dark:text-mist-300">
          Create a new Headplane user account with a username and password.
        </p>

        {fetcher.data?.error && (
          <Notice variant="error" title="Error creating user">
            {fetcher.data.error}
          </Notice>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-mist-500 hover:text-mist-700 dark:hover:text-mist-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-mist-500 hover:text-mist-700 dark:hover:text-mist-300"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">Passwords do not match</p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium">
              Role
            </label>
            <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
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
