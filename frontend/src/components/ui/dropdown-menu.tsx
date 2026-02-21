import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@utils/format";

type Align = "start" | "center" | "end";
type Side = "top" | "bottom" | "left" | "right";

interface DropdownContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null> ;
  contentId: string;
}

const DropdownContext = createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  contentId: "",
});


interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function DropdownMenu({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLElement>(null);
  const contentId = useId();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );

  // Close on outside click (handled in content) + Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        (triggerRef.current as HTMLElement | null)?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, setOpen]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentId }}>
      {children}
    </DropdownContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function DropdownMenuTrigger({
  asChild,
  children,
}: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef, contentId } = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    (children.props as any).onClick?.(e);
    setOpen(!open);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
    (children.props as any).onKeyDown?.(e);
  };

  const extraProps = {
    ref: triggerRef,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": contentId,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, extraProps);
  }
  return React.cloneElement(children, extraProps);
}

function getContentPosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  align: Align,
  side: Side,
  sideOffset: number
): { top: number; left: number } {
  let top = 0;
  let left = 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Side
  if (side === "bottom") top = triggerRect.bottom + sideOffset;
  else if (side === "top") top = triggerRect.top - contentRect.height - sideOffset;
  else if (side === "left") left = triggerRect.left - contentRect.width - sideOffset;
  else if (side === "right") left = triggerRect.right + sideOffset;

  // Align (for vertical sides)
  if (side === "bottom" || side === "top") {
    if (align === "start") left = triggerRect.left;
    else if (align === "end") left = triggerRect.right - contentRect.width;
    else left = triggerRect.left + triggerRect.width / 2 - contentRect.width / 2;
  }

  // Clamp to viewport
  const pad = 8;
  top = Math.max(pad, Math.min(top, vh - contentRect.height - pad));
  left = Math.max(pad, Math.min(left, vw - contentRect.width - pad));

  return { top, left };
}

// ─── DropdownMenuContent ──────────────────────────────────────────────────────
interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: Align;
  side?: Side;
  sideOffset?: number;
  alignOffset?: number;
}

const MENU_ANIM = `
  @keyframes dropdown-in {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
  }
`;

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(
  (
    {
      className,
      children,
      align = "start",
      side = "bottom",
      sideOffset = 6,
      alignOffset = 0,
      ...props
    },
    ref
  ) => {
    const { open, setOpen, triggerRef, contentId } = useContext(DropdownContext);
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Compute position after mount/open
    const updatePosition = useCallback(() => {
      if (!triggerRef.current || !contentRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      setPosition(getContentPosition(triggerRect, contentRect, align, side, sideOffset));
    }, [align, side, sideOffset]);

    useEffect(() => {
      if (!open) { setPosition(null); setFocusedIndex(-1); return; }
      // Small delay to let the DOM render before measuring
      const id = requestAnimationFrame(updatePosition);
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [open, updatePosition]);

    // Arrow key navigation
    useEffect(() => {
      if (!open || !contentRef.current) return;
      const items = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
      );
      if (focusedIndex >= 0 && items[focusedIndex]) {
        items[focusedIndex].focus();
      }
    }, [focusedIndex, open]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!contentRef.current) return;
      const items = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusedIndex(items.length - 1);
      }
    };

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handlePointer = (e: PointerEvent) => {
        const target = e.target as Node;
        if (contentRef.current?.contains(target)) return;
        if ((triggerRef.current as Node | null)?.contains(target)) return;
        setOpen(false);
      };
      document.addEventListener("pointerdown", handlePointer);
      return () => document.removeEventListener("pointerdown", handlePointer);
    }, [open, setOpen, triggerRef]);

    if (!open) return null;

    return createPortal(
      <>
        <style>{MENU_ANIM}</style>
        <div
          id={contentId}
          ref={(el) => {
            (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={cn(
            "fixed z-[200] min-w-[8rem] overflow-hidden",
            "rounded-xl border border-zinc-700 bg-zinc-900",
            "p-1 shadow-2xl shadow-black/50",
            "text-zinc-300 text-sm",
            "focus:outline-none",
            className
          )}
          style={{
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            animation: "dropdown-in 120ms ease",
            transformOrigin: "top",
            visibility: position ? "visible" : "hidden",
          }}
          {...props}
        >
          {children}
        </div>
      </>,
      document.body
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  disabled?: boolean;
}

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps
>(({ className, children, inset, disabled, onClick, ...props }, ref) => {
  const { setOpen } = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    onClick?.(e);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      role="menuitem"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2",
        "rounded-lg px-2.5 py-2 text-xs font-medium outline-none",
        "transition-colors duration-100",
        "hover:bg-zinc-800 hover:text-zinc-100",
        "focus:bg-zinc-800 focus:text-zinc-100",
        disabled && "pointer-events-none opacity-40",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn("-mx-1 my-1 h-px bg-zinc-800", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";


export const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500",
      inset && "pl-8",
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";


export function DropdownMenuGroup({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="group" {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-[10px] tracking-widest text-zinc-600", className)}
      {...props}
    />
  );
}

interface DropdownMenuCheckboxItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuCheckboxItemProps
>(
  (
    { className, children, checked, onCheckedChange, disabled, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="menuitemcheckbox"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2",
          "rounded-lg py-2 pl-8 pr-2.5 text-xs font-medium outline-none",
          "transition-colors hover:bg-zinc-800 hover:text-zinc-100",
          "focus:bg-zinc-800 focus:text-zinc-100",
          disabled && "pointer-events-none opacity-40",
          className
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {checked && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="2 5 4 7 8 3" />
            </svg>
          )}
        </span>
        {children}
      </div>
    );
  }
);
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

interface DropdownMenuRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = createContext<{
  value?: string;
  onValueChange?: (v: string) => void;
}>({});

export function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div role="group" {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export const DropdownMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuRadioItemProps
>(({ className, children, value, disabled, ...props }, ref) => {
  const { value: groupValue, onValueChange } = useContext(RadioGroupContext);
  const checked = groupValue === value;

  return (
    <div
      ref={ref}
      role="menuitemradio"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onValueChange?.(value)}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2",
        "rounded-lg py-2 pl-8 pr-2.5 text-xs font-medium outline-none",
        "transition-colors hover:bg-zinc-800 hover:text-zinc-100",
        "focus:bg-zinc-800 focus:text-zinc-100",
        disabled && "pointer-events-none opacity-40",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && (
          <div className="h-2 w-2 rounded-full bg-current" />
        )}
      </span>
      {children}
    </div>
  );
});
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2",
      "rounded-lg px-2.5 py-2 text-xs font-medium outline-none",
      "transition-colors hover:bg-zinc-800",
      "focus:bg-zinc-800",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <svg
      className="ml-auto h-4 w-4 text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </div>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";