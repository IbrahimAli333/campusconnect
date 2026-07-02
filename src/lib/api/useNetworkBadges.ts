import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { getMyApplications, getMyConnections } from "./network";
import type { MyOpportunityApplicationRead, NetworkTab } from "../../types/network";

const APPLICATIONS_SEEN_AT_KEY = "campusconnect.applications_seen_at";

function webStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

async function loadApplicationsSeenAt(): Promise<number | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? webStorage()?.getItem(APPLICATIONS_SEEN_AT_KEY) ?? null
        : await SecureStore.getItemAsync(APPLICATIONS_SEEN_AT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

async function storeApplicationsSeenAt(iso: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      webStorage()?.setItem(APPLICATIONS_SEEN_AT_KEY, iso);
      return;
    }
    await SecureStore.setItemAsync(APPLICATIONS_SEEN_AT_KEY, iso);
  } catch {
    // Persisting the seen marker is best-effort; the in-memory value still applies.
  }
}

function isDecided(application: MyOpportunityApplicationRead): boolean {
  return application.status === "accepted" || application.status === "rejected";
}

export function useNetworkBadges(
  token: string | null,
  activeTab: NetworkTab,
): {
  badges: Partial<Record<NetworkTab, number>>;
  markApplicationsSeen: () => void;
} {
  const [pendingReceived, setPendingReceived] = useState(0);
  const [decidedUpdatedAts, setDecidedUpdatedAts] = useState<number[]>([]);
  const [seenAt, setSeenAt] = useState<number | null>(null);
  const [seenAtLoaded, setSeenAtLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadApplicationsSeenAt().then((value) => {
      if (!cancelled) {
        setSeenAt(value);
        setSeenAtLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setPendingReceived(0);
      setDecidedUpdatedAts([]);
      return;
    }

    let cancelled = false;

    void getMyConnections(token)
      .then((connections) => {
        if (!cancelled) {
          setPendingReceived(connections.received.filter((request) => request.status === "pending").length);
        }
      })
      .catch(() => {
        // Badges are best-effort; keep the last known count on failure.
      });

    void getMyApplications(token)
      .then((applications) => {
        if (!cancelled) {
          setDecidedUpdatedAts(
            applications.filter(isDecided).map((application) => Date.parse(application.updated_at)),
          );
        }
      })
      .catch(() => {
        // Badges are best-effort; keep the last known count on failure.
      });

    return () => {
      cancelled = true;
    };
  }, [token, activeTab]);

  const markApplicationsSeen = useCallback(() => {
    // Anchor to the newest known decision so server/device clock skew cannot
    // leave the badge stuck after the tab has been opened.
    const nowMs = Math.max(Date.now(), ...decidedUpdatedAts.filter((ms) => !Number.isNaN(ms)));
    setSeenAt(nowMs);
    void storeApplicationsSeenAt(new Date(nowMs).toISOString());
  }, [decidedUpdatedAts]);

  const badges = useMemo<Partial<Record<NetworkTab, number>>>(() => {
    const unseenDecisions = seenAtLoaded
      ? decidedUpdatedAts.filter((updatedAt) => seenAt === null || updatedAt > seenAt).length
      : 0;
    return {
      connections: pendingReceived,
      applications: unseenDecisions,
    };
  }, [pendingReceived, decidedUpdatedAts, seenAt, seenAtLoaded]);

  return { badges, markApplicationsSeen };
}
