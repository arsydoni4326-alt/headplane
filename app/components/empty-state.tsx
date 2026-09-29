import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import cn from "~/utils/cn";

import Button, { type ButtonProps } from "./button";

export interface EmptyStateProps {
  /**
   * The icon to display. Defaults to Inbox.
   */
  icon?: ReactNode;
  /**
   * The main title of the empty state.
   */
  title: string;
  /**
   * A description explaining why the state is empty and what the user can do.
   */
  description: string;
  /**
   * Optional primary action (e.g., "Create your first machine").
   */
  action?: {
    label: string;
    onClick?: () => void;
  } & Partial<ButtonProps>;
  /**
   * Optional secondary action (e.g., "Learn more").
   */
  secondaryAction?: {
    label: string;
    onClick?: () => void;
  } & Partial<ButtonProps>;
  /**
   * Visual variant of the empty state.
   */
  variant?: "default" | "filtered" | "error";
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const Icon = icon ?? (variant === "error" ? <AlertCircle /> : <Inbox />);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
          variant === "error"
            ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
            : "bg-mist-100 text-mist-500 dark:bg-mist-800 dark:text-mist-400",
        )}
        aria-hidden="true"
      >
        {Icon}
      </div>
      <h3 className="text-lg font-semibold text-mist-900 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-mist-600 dark:text-mist-400">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            <Button
              variant={action.variant ?? "heavy"}
              onClick={action.onClick}
              {...action}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? "light"}
              onClick={secondaryAction.onClick}
              {...secondaryAction}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
