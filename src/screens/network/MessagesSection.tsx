import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { MessageCircle, Send } from "lucide-react-native";

import { EmptyState } from "../../components/common/PortalState";
import { SectionHeader } from "../../components/common/SectionHeader";
import {
  getMyProfile,
  getThreadMessages,
  listMessageThreads,
  sendThreadMessage,
} from "../../lib/api/network";
import { palette, styles } from "../../styles/theme";
import type { MessageRead, MessageThreadRead, ProfileSummary } from "../../types/network";

import { InlineAction, PanelHeader, formatFullDate, profileMeta, toErrorMessage } from "./shared";
import { networkStyles } from "./styles";

const THREADS_POLL_MS = 15000;
const MESSAGES_POLL_MS = 5000;
const MESSAGES_PAGE_SIZE = 50;

function ChatPanel({
  myProfileId,
  onClose,
  onMessagesRead,
  profile,
  token,
}: {
  myProfileId: number | null;
  onClose: () => void;
  onMessagesRead: () => void;
  profile: ProfileSummary;
  token: string;
}) {
  const [messages, setMessages] = useState<MessageRead[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      getThreadMessages(token, profile.id, { limit: MESSAGES_PAGE_SIZE })
        .then((items) => {
          if (cancelled) {
            return;
          }
          setLoadError(null);
          // The API returns newest first; the chat reads top-down.
          setMessages([...items].reverse());
          onMessagesRead();
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setLoadError(toErrorMessage(error));
          }
        });
    };

    refresh();
    const interval = setInterval(refresh, MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, profile.id, onMessagesRead]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) {
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const sent = await sendThreadMessage(token, profile.id, body);
      setDraft("");
      setMessages((current) => [...(current ?? []), sent]);
    } catch (error) {
      setSendError(toErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.card, styles.compactCard, networkStyles.networkCard]}>
      <PanelHeader eyebrow={profileMeta(profile)} icon={MessageCircle} onClose={onClose} title={profile.user.full_name} />

      {loadError && !messages ? (
        <Text style={[networkStyles.actionMessage, networkStyles.errorText]}>{loadError}</Text>
      ) : null}

      {messages && messages.length === 0 ? (
        <Text style={styles.smallText}>No messages yet. Say hello!</Text>
      ) : null}

      {messages && messages.length > 0 ? (
        <View style={networkStyles.chatList}>
          {messages.map((message) => {
            const isMine = message.sender_profile_id === myProfileId;
            return (
              <View key={message.id} style={[networkStyles.chatBubble, isMine && networkStyles.chatBubbleMine]}>
                <Text style={networkStyles.chatBubbleText}>{message.body}</Text>
                <Text style={networkStyles.chatBubbleMeta}>
                  {(isMine ? "You" : profile.user.full_name.split(" ")[0]) + " - " + formatFullDate(message.created_at)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={networkStyles.chatComposer}>
        <TextInput
          accessibilityLabel={`Message ${profile.user.full_name}`}
          multiline
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={palette.faint}
          style={[styles.textInput, networkStyles.chatComposerInput]}
          value={draft}
        />
        <InlineAction
          disabled={!draft.trim()}
          icon={Send}
          label="Send"
          loading={sending}
          onPress={() => void send()}
        />
      </View>
      {sendError ? <Text style={[networkStyles.actionMessage, networkStyles.errorText]}>{sendError}</Text> : null}
    </View>
  );
}

export function MessagesSection({
  onOpenThread,
  openThreadProfile,
  token,
}: {
  onOpenThread: (profile: ProfileSummary | null) => void;
  openThreadProfile: ProfileSummary | null;
  token: string | null;
}) {
  const [threads, setThreads] = useState<MessageThreadRead[] | null>(null);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [myProfileId, setMyProfileId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshThreads = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    if (!token) {
      setMyProfileId(null);
      return;
    }

    let cancelled = false;
    void getMyProfile(token)
      .then((profile) => {
        if (!cancelled) {
          setMyProfileId(profile.id);
        }
      })
      .catch(() => {
        // The chat still renders; own messages just lose right alignment.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setThreads(null);
      return;
    }

    let cancelled = false;

    const refresh = () => {
      listMessageThreads(token)
        .then((items) => {
          if (!cancelled) {
            setThreads(items);
            setThreadsError(null);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setThreadsError(toErrorMessage(error));
          }
        });
    };

    refresh();
    const interval = setInterval(refresh, THREADS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, refreshKey]);

  const sortedThreads = useMemo(
    () =>
      [...(threads ?? [])].sort(
        (left, right) => Date.parse(right.last_message.created_at) - Date.parse(left.last_message.created_at),
      ),
    [threads],
  );

  if (!token) {
    return null;
  }

  return (
    <>
      <SectionHeader
        action={sortedThreads.length ? `${sortedThreads.length} threads` : "Empty"}
        icon={MessageCircle}
        title="Messages"
      />

      {openThreadProfile ? (
        <ChatPanel
          myProfileId={myProfileId}
          onClose={() => {
            onOpenThread(null);
            refreshThreads();
          }}
          onMessagesRead={refreshThreads}
          profile={openThreadProfile}
          token={token}
        />
      ) : null}

      {threadsError && !threads ? (
        <Text style={[networkStyles.actionMessage, networkStyles.errorText]}>{threadsError}</Text>
      ) : null}

      {sortedThreads.length ? (
        <View style={networkStyles.panelList}>
          {sortedThreads.map((thread) => (
            <Pressable
              accessibilityLabel={
                thread.unread_count > 0
                  ? `Open conversation with ${thread.profile.user.full_name}, ${thread.unread_count} unread`
                  : `Open conversation with ${thread.profile.user.full_name}`
              }
              accessibilityRole="button"
              key={thread.profile.id}
              onPress={() => onOpenThread(thread.profile)}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
            >
              <View style={networkStyles.resumeIcon}>
                <MessageCircle color={palette.blue} size={18} strokeWidth={2.4} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {thread.profile.user.full_name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {(thread.last_message.sender_profile_id === myProfileId ? "You: " : "") + thread.last_message.body}
                </Text>
              </View>
              {thread.unread_count > 0 ? (
                <View style={networkStyles.unreadBadge}>
                  <Text style={networkStyles.unreadBadgeText}>
                    {thread.unread_count > 99 ? "99+" : thread.unread_count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          body="Conversations open after a connection or application is accepted."
          icon={MessageCircle}
          title="No messages yet"
        />
      )}
    </>
  );
}
