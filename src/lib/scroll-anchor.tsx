import { createContext, useContext, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ScrollView, View } from "react-native";

// The app renders every tab inside one shared ScrollView (App.tsx). Detail
// panels mount at the bottom of the screen content, below the fold, so
// opening one is invisible without this: the anchor scrolls the shared
// ScrollView down to the panel when it mounts.
export const ScrollAnchorContext = createContext<RefObject<ScrollView | null> | null>(null);

export function useScrollIntoViewOnMount(): RefObject<View | null> {
  const scrollViewRef = useContext(ScrollAnchorContext);
  const anchorRef = useRef<View | null>(null);

  useEffect(() => {
    const scrollView = scrollViewRef?.current;
    const anchor = anchorRef.current;
    if (!scrollView || !anchor) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const innerNode = scrollView.getInnerViewNode?.();
      if (!innerNode) {
        return;
      }

      anchor.measureLayout(
        innerNode,
        (_x, y) => scrollView.scrollTo({ animated: true, y: Math.max(y - 12, 0) }),
        () => {
          // Measurement can fail while nodes detach; skipping the scroll is fine.
        },
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [scrollViewRef]);

  return anchorRef;
}
