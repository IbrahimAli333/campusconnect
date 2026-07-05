import { useEffect } from "react";
import type { ReactNode } from "react";

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

/**
 * Runs the Google ID-token auth flow and hands the resulting token to the
 * caller, leaving the trigger UI to the render-prop children. Mount only when
 * a client ID exists so the auth-request hook never runs with an empty one.
 */
export function GoogleIdTokenGate({
  clientId,
  onError,
  onIdToken,
  children,
}: {
  clientId: string;
  onError: (message: string) => void;
  onIdToken: (idToken: string) => void;
  children: (promptGoogleSignIn: () => void, ready: boolean) => ReactNode;
}) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId,
  });

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === "success") {
      const idToken = response.params.id_token;
      if (idToken) {
        onIdToken(idToken);
      } else {
        onError("Google sign-in did not return an identity token.");
      }
    } else if (response.type === "error") {
      onError(response.error?.message ?? "Google sign-in failed. Try again.");
    }
    // The callbacks are stable enough for these screens; re-running on
    // response changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return <>{children(() => void promptAsync(), Boolean(request))}</>;
}
