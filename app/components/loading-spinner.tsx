import { Loader2 } from "lucide-react";

import cn from "~/utils/cn";

export interface LoadingSpinnerProps {
  /**
   * Optional label describing what is loading.
   */
  label?: string;
  /**
   * Size variant.
   */
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function LoadingSpinner({ label, size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12", className)}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <Loader2
        className={cn("animate-spin text-mist-400 dark:text-mist-500", sizeClasses[size])}
        aria-hidden="true"
      />
      {label && (
        <p className="mt-3 text-sm text-mist-600 dark:text-mist-400">{label}</p>
      )}
    </div>
  );
}
