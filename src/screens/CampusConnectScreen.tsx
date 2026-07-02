import type { NetworkTab } from "../types/network";
import { ApplicationsScreen } from "./network/ApplicationsScreen";
import { ConnectionsScreen } from "./network/ConnectionsScreen";
import { DiscoverScreen } from "./network/DiscoverScreen";
import { OpportunitiesScreen } from "./network/OpportunitiesScreen";
import { ProfileScreen } from "./network/ProfileScreen";

interface CampusConnectScreenProps {
  activeTab: NetworkTab;
  onAccountDeleted?: () => void;
  token: string | null;
}

export function CampusConnectScreen({ activeTab, onAccountDeleted, token }: CampusConnectScreenProps) {
  if (activeTab === "opportunities") {
    return <OpportunitiesScreen token={token} />;
  }

  if (activeTab === "applications") {
    return <ApplicationsScreen token={token} />;
  }

  if (activeTab === "profile") {
    return <ProfileScreen onAccountDeleted={onAccountDeleted} token={token} />;
  }

  if (activeTab === "connections") {
    return <ConnectionsScreen token={token} />;
  }

  return <DiscoverScreen token={token} />;
}
