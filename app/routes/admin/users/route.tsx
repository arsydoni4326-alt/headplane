import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import EmptyState from "~/components/empty-state";
import { appConfigContext, authContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import type { Role } from "~/server/web/roles";
import { isAdmin, createUnauthorizedResponse } from "~/utils/auth";
import cn from "~/utils/cn";

import type { Route } from "./+types/route";
import CreateUserDialog from "./dialogs/create-user";
import DeleteUserDialog from "./dialogs/delete-user";
import EditUserDialog from "./dialogs/edit-user";

export interface HeadplaneUserData {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const principal = await auth.require(request);

  // Use centralized admin check
  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(
      principal,
      "You do not have permission to manage users. Only administrators can access this page.",
    );
  }

  // Only password-authenticated users can access this page
  if (principal.kind !== "password") {
    throw createUnauthorizedResponse(
      principal,
      "User management is only available for password-authenticated administrators. Please log out and log in with your password instead of an API key.",
    );
  }

  const sessionToken = principal.token;
  const headscaleUrl = config.headscale.url;

  try {
    const response = await fetch(`${headscaleUrl}/api/v1/headplane/users`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      // Try to parse error response from backend
      let errorMessage = `Failed to load users: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse errors, use default message
      }

      return {
        error: {
          error: response.status === 401 ? "unauthorized" : "error",
          message: errorMessage,
          status: response.status,
        },
      };
    }

    const data = await response.json();
    const users = (data.users || []) as HeadplaneUserData[];

    return {
      users,
      sessionToken,
      headscaleUrl,
    };
  } catch (error) {
    console.error("Error loading users:", error);
    return {
      error: {
        error: "error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        status: 500,
      },
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const principal = await auth.require(request);

  // Use centralized admin check
  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(principal, "Insufficient permissions to manage users.");
  }

  if (principal.kind !== "password") {
    throw createUnauthorizedResponse(principal, "User management requires password authentication.");
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;
  const sessionToken = principal.token;
  const headscaleUrl = config.headscale.url;

  try {
    if (actionType === "create") {
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;
      const role = formData.get("role") as Role;

      const response = await fetch(`${headscaleUrl}/api/v1/headplane/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ username, password, role }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText || "Failed to create user" };
      }

      return { success: true, message: "User created successfully" };
    }

    if (actionType === "update") {
      const userId = formData.get("userId") as string;
      const username = formData.get("username") as string;
      const role = formData.get("role") as Role;

      const response = await fetch(`${headscaleUrl}/api/v1/headplane/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ username, role }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText || "Failed to update user" };
      }

      return { success: true, message: "User updated successfully" };
    }

    if (actionType === "delete") {
      const userId = formData.get("userId") as string;

      const response = await fetch(`${headscaleUrl}/api/v1/headplane/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText || "Failed to delete user" };
      }

      return { success: true, message: "User deleted successfully" };
    }

    return { success: false, error: "Unknown action" };
  } catch (error) {
    console.error("Action error:", error);
    return { success: false, error: String(error) };
  }
}

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<HeadplaneUserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<HeadplaneUserData | null>(null);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="mt-1 text-sm text-mist-600 dark:text-mist-300">
            Manage Headplane user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} variant="heavy">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {loaderData.users.length === 0 ? (
        <EmptyState
          title="No users"
          description="Create your first user to get started."
          action={{
            label: "Create User",
            onClick: () => setShowCreateDialog(true),
          }}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-auto rounded-lg">
            <thead className="text-mist-600 dark:text-mist-300">
              <tr className="px-0.5 text-left">
                <th className="pb-2 text-xs font-bold uppercase">Username</th>
                <th className="pb-2 text-xs font-bold uppercase">Role</th>
                <th className="pb-2 text-xs font-bold uppercase">Created</th>
                <th className="w-12 pb-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody
              className={cn(
                "divide-y divide-mist-100 dark:divide-mist-800 align-top",
                "border-t border-mist-100 dark:border-mist-800",
              )}
            >
              {loaderData.users.map((user) => (
                <tr className="group hover:bg-mist-100 dark:hover:bg-mist-800" key={user.id}>
                  <td className="py-3 pl-2">
                    <p className="font-medium">{user.username}</p>
                  </td>
                  <td className="py-3 pl-0.5">
                    <p>{mapRoleToName(user.role)}</p>
                  </td>
                  <td className="py-3 pl-0.5">
                    <p
                      className="text-sm text-mist-600 dark:text-mist-300"
                      suppressHydrationWarning
                    >
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="py-3 pr-0.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button onClick={() => setEditingUser(user)} variant="light">
                        Edit
                      </Button>
                      <Button onClick={() => setDeletingUser(user)} variant="danger">
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog isOpen={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {editingUser && (
        <EditUserDialog
          isOpen={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
        />
      )}

      {deletingUser && (
        <DeleteUserDialog
          isOpen={!!deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          user={deletingUser}
        />
      )}
    </>
  );
}

function mapRoleToName(role: Role) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "network_admin":
      return "Network Admin";
    case "it_admin":
      return "IT Admin";
    case "auditor":
      return "Auditor";
    case "viewer":
      return "Viewer";
    case "member":
      return "Member";
    default:
      return "Unknown";
  }
}
