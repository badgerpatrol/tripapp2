import { useCallback, useRef } from "react";

export interface UseLongPressOptions {
  onLongPress: (e: React.Touch | React.MouseEvent) => void;
  onClick?: (e: React.Touch | React.MouseEvent) => void;
  delay?: number; // milliseconds
}

/**
 * Custom hook for detecting long press (touch & hold) gestures
 * Supports both touch and mouse events for maximum compatibility
 */
export function useLongPress(options: UseLongPressOptions) {
  const { onLongPress, onClick, delay = 500 } = options;
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isLongPressRef = useRef(false);
  const eventDataRef = useRef<React.Touch | React.MouseEvent | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Store event data (touch or mouse coordinates)
      if ("touches" in e && e.touches.length > 0) {
        eventDataRef.current = e.touches[0];
      } else {
        eventDataRef.current = e as React.MouseEvent;
      }

      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if (eventDataRef.current) {
          onLongPress(eventDataRef.current);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const end = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      cancel();

      // If it wasn't a long press and onClick is provided, call it
      if (!isLongPressRef.current && onClick) {
        if ("changedTouches" in e && e.changedTouches.length > 0) {
          onClick(e.changedTouches[0]);
        } else {
          onClick(e as React.MouseEvent);
        }
      }

      isLongPressRef.current = false;
      eventDataRef.current = null;
    },
    [onClick, cancel]
  );

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: cancel,
  };
}
