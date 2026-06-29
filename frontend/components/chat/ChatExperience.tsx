"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChatSocket, type ConnectionState } from "@/hooks/useChatSocket";
import GreetingHero from "./GreetingHero";
import MessageList from "./MessageList";
import ChatComposer from "./ChatComposer";
import VoiceMode from "@/components/voice/VoiceMode";

interface ChatExperienceProps {
  accessToken: string;
  userName?: string;
  onConnectionChange?: (state: ConnectionState) => void;
  onSendReady?: (sendFn: (content: string) => void) => void;
}

/**
 * ChatExperience
 * The chat-first centered home. Starts as a near-empty canvas with a huge
 * greeting + a centered composer. On first message the greeting dissolves
 * upward and the conversation takes the stage. Owns the WebSocket connection
 * and the voice overlay.
 */
export default function ChatExperience({
  accessToken,
  userName,
  onConnectionChange,
  onSendReady,
}: ChatExperienceProps) {
  const {
    messages,
    thinking,
    statusLabel,
    connection,
    send,
    finishStreaming,
    hasMessages,
    loadingHistory,
  } = useChatSocket({ accessToken });

  const [voiceActive, setVoiceActive] = useState(false);

  useEffect(() => {
    onConnectionChange?.(connection);
  }, [connection, onConnectionChange]);

  useEffect(() => {
    onSendReady?.((content: string) => send(content, "chat"));
  }, [send, onSendReady]);

  return (
    <div className="relative z-10 flex h-full w-full flex-col">
      {voiceActive ? (
        /* Voice mode: replaces message area with inline voice UI */
        <>
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <VoiceMode
                active={voiceActive}
                onClose={() => setVoiceActive(false)}
                onSpeak={(t) => send(t, "voice")}
                statusLabel={statusLabel}
                thinking={thinking}
              />
            </AnimatePresence>
          </div>
          <div className="z-20 flex justify-center px-4 pb-6 pt-2">
            <ChatComposer
              onSend={(v) => send(v, "chat")}
              onVoice={() => setVoiceActive(false)}
              centered={false}
              disabled={connection === "disconnected"}
            />
          </div>
        </>
      ) : hasMessages ? (
        /* Conversation mode: flex column with scrollable messages + pinned composer */
        <>
          <div className="flex-1 overflow-y-auto scroll-thin">
            <motion.div
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <MessageList
                messages={messages}
                thinking={thinking}
                statusLabel={statusLabel}
                onStreamComplete={finishStreaming}
              />
            </motion.div>
          </div>
          <div className="z-20 flex justify-center px-4 pb-6 pt-2">
            <ChatComposer
              onSend={(v) => send(v, "chat")}
              onVoice={() => setVoiceActive(true)}
              centered={false}
              disabled={connection === "disconnected"}
            />
          </div>
        </>
      ) : (
        /* Greeting mode: centered greeting + composer, or loading state */
        <>
          <div className="relative flex-1 overflow-hidden">
            {loadingHistory ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-white/20 animate-pulse" />
                  <p className="text-sm text-white/50">Loading conversation...</p>
                </div>
              </div>
            ) : (
              <motion.div
                key="greeting"
                className="absolute inset-0 flex items-center justify-center"
                exit={{ opacity: 0 }}
              >
                <GreetingHero name={userName} />
              </motion.div>
            )}
          </div>
          {!loadingHistory && (
            <motion.div
              layout
              className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex translate-y-[calc(-50%+7rem)] justify-center px-4"
            >
              <div className="pointer-events-auto w-full flex justify-center">
                <ChatComposer
                  onSend={(v) => send(v, "chat")}
                  onVoice={() => setVoiceActive(true)}
                  centered={true}
                  disabled={connection === "disconnected"}
                />
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
