import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@utils/format";

interface DialogContextValue {
  open: boolean;
  onClose: () => void;
}

const DialogContext = createContext<DialogContextValue>({
  open: false,
  onClose: () => {},
});


const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;

    // Focus first focusable element
    const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusables[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      prevFocus?.focus();
    };
  }, [active, ref]);
}


function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scrollY = window.scrollY;
    const originalStyle = document.body.style.cssText;
    document.body.style.cssText = `
      overflow: hidden;
      position: fixed;
      top: -${scrollY}px;
      left: 0;
      right: 0;
    `;
    return () => {
      document.body.style.cssText = originalStyle;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

const OVERLAY_STYLE = `
  @keyframes dialog-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes dialog-overlay-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes dialog-content-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes dialog-content-out {
    from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    to   { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  }
`;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  return (
    <DialogContext.Provider value={{ open, onClose }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { onClose: _, open: __,  } = useContext(DialogContext);
  // We just need the open setter — pass onClick to child
//   const context = useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children.props as any).onClick?.(e);
        // The consumer must pass onOpenChange down; trigger just forwards
      },
    });
  }
  return children;
}

interface DialogPortalProps {
  children: React.ReactNode;
  container?: Element;
}

export function DialogPortal({
  children,
  container = document.body,
}: DialogPortalProps) {
  return createPortal(children, container);
}

interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  DialogOverlayProps
>(({ className, ...props }, ref) => {
  const { onClose } = useContext(DialogContext);
  return (
    <div
      ref={ref}
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm",
        className
      )}
      style={{ animation: "dialog-overlay-in 150ms ease" }}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onInteractOutside?: () => void;
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(({ className, children, onInteractOutside, ...props }, ref) => {
  const { open, onClose } = useContext(DialogContext);
  const innerRef = useRef<HTMLDivElement>(null);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerRef as React.RefObject<HTMLDivElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = el;
    },
    [ref]
  );

  useFocusTrap(innerRef, open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <DialogPortal>
      <>
        {/* Inject keyframe styles once */}
        <style>{OVERLAY_STYLE}</style>

        {/* Overlay */}
        <DialogOverlay />

        {/* Panel */}
        <div
          ref={setRef}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full",
            "max-h-[90vh] overflow-y-auto",
            "rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100",
            "shadow-2xl shadow-black/60",
            "focus:outline-none",
            className
          )}
          style={{
            animation: "dialog-content-in 150ms ease",
            transform: "translate(-50%, -50%)",
          }}
          {...props}
        >
          {children}
        </div>
      </>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";


export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}
DialogHeader.displayName = "DialogHeader";


export function DialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-zinc-800 px-6 py-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-bold leading-tight tracking-tight text-zinc-100",
      className
    )}
    {...props}
  >
    {children}
  </h2>
));
DialogTitle.displayName = "DialogTitle";


export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-zinc-500", className)}
    {...props}
  >
    {children}
  </p>
));
DialogDescription.displayName = "DialogDescription";


export function DialogClose({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { onClose } = useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children.props as any).onClick?.(e);
        onClose();
      },
    });
  }

  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        "rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300",
        "hover:bg-zinc-800 transition-all focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-amber-500/50"
      )}
      {...props}
    >
      {children}
    </button>
  );
}
DialogClose.displayName = "DialogClose";