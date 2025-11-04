import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const buttonStyles = cva(
  "inline-flex items-center justify-center rounded-lg px-4 h-10 text-base leading-[1.4] transition-all border select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed tap-target",
  {
    variants: {
      variant: {
        primary: clsx(
          "bg-blue-600 text-white border-transparent",
          "hover:bg-blue-700 active:bg-blue-800",
          "dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800"
        ),
        secondary: clsx(
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
          "border-zinc-200 dark:border-zinc-700",
          "hover:bg-zinc-200 dark:hover:bg-zinc-700",
          "active:bg-zinc-300 dark:active:bg-zinc-600"
        ),
        outline: clsx(
          "bg-transparent text-zinc-700 dark:text-zinc-300",
          "border-zinc-300 dark:border-zinc-700",
          "hover:bg-zinc-100 dark:hover:bg-zinc-800",
          "hover:border-zinc-400 dark:hover:border-zinc-600"
        ),
        ghost: clsx(
          "bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent",
          "hover:text-zinc-900 dark:hover:text-zinc-100",
          "hover:bg-zinc-100 dark:hover:bg-zinc-800"
        ),
        destructive: clsx(
          "bg-red-600 text-white border-transparent",
          "hover:bg-red-700 active:bg-red-800",
          "dark:bg-red-600 dark:hover:bg-red-700"
        )
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-5 text-lg"
      },
      full: { true: "w-full", false: "" },
      loading: { true: "relative cursor-progress", false: "" }
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      full: false,
      loading: false
    }
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, loading, leftIcon, rightIcon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(buttonStyles({ variant, size, full, loading }), className)}
        aria-busy={loading || undefined}
        {...props}
      >
        {leftIcon ? <span className="mr-2 -ml-1">{leftIcon}</span> : null}
        <span className={clsx(loading && "opacity-0")}>{children}</span>
        {rightIcon ? <span className="ml-2 -mr-1">{rightIcon}</span> : null}
        {loading && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
