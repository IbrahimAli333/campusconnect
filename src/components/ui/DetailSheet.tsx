import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetHandleProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../../lib/i18n";
import { palette } from "../../styles/theme";

interface DetailSheetValue {
  /** Animate the sheet closed; the sheet then calls the owner's onClose. */
  dismiss: () => void;
}

const DetailSheetContext = createContext<DetailSheetValue | null>(null);

/** Lets content (e.g. a panel's close button) close the sheet with animation. */
export function useDetailSheet(): DetailSheetValue | null {
  return useContext(DetailSheetContext);
}

// The library ships English accessibility labels ("Bottom Sheet", "Bottom
// sheet handle", "Bottom sheet backdrop"); these replace them with
// translated ones, and the background is purely decorative.
function Backdrop(props: BottomSheetBackdropProps) {
  const { t } = useI18n();
  return (
    <BottomSheetBackdrop
      {...props}
      accessibilityHint={t("Closes the panel")}
      accessibilityLabel={t("Close")}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.45}
      pressBehavior="close"
    />
  );
}

function Handle(props: BottomSheetHandleProps) {
  const { t } = useI18n();
  return (
    <BottomSheetHandle
      {...props}
      accessibilityHint={t("Drag down to close the panel")}
      accessibilityLabel={t("Panel handle")}
      indicatorStyle={sheetStyles.handle}
    />
  );
}

function Background({ style }: BottomSheetBackgroundProps) {
  return <View accessible={false} pointerEvents="none" style={[style, sheetStyles.background]} />;
}

/**
 * Presents its children in a draggable bottom sheet as soon as it mounts, and
 * calls onClose once the sheet has been dismissed (drag down, backdrop tap,
 * close button, or Escape on the web). Detail panels render inside this, so
 * opening a profile or post slides up over the list instead of jumping the
 * page.
 */
export function DetailSheet({
  accessibilityLabel,
  children,
  fitContent = false,
  onClose,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
  /** Size to the content (short prompts) instead of nearly full height. */
  fitContent?: boolean;
  onClose: () => void;
}) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const closedRef = useRef(false);

  useEffect(() => {
    ref.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    if (!closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [onClose]);

  const dismiss = useCallback(() => {
    ref.current?.dismiss();
  }, []);

  // Keyboard users on the web close the sheet with Escape (WCAG 2.1.2).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  const value = useMemo(() => ({ dismiss }), [dismiss]);

  return (
    <BottomSheetModal
      accessibilityLabel={accessibilityLabel}
      backdropComponent={Backdrop}
      backgroundComponent={Background}
      enableDynamicSizing={fitContent}
      handleComponent={Handle}
      onDismiss={handleDismiss}
      ref={ref}
      snapPoints={fitContent ? undefined : ["92%"]}
      stackBehavior="push"
    >
      <DetailSheetContext.Provider value={value}>
        <BottomSheetScrollView
          contentContainerStyle={[sheetStyles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </BottomSheetScrollView>
      </DetailSheetContext.Provider>
    </BottomSheetModal>
  );
}

const sheetStyles = StyleSheet.create({
  background: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    backgroundColor: "#CFC7B8",
    height: 5,
    width: 44,
  },
  content: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 720,
    paddingHorizontal: 20,
    paddingTop: 4,
    width: "100%",
  },
});
