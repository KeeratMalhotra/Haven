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
}: ChatExperienceProps) {
  const {
    messages,
    thinking,
    statusLabel,
    connection,
    send,
    finishStreaming,
    hasMessages,
  } = useChatSocket({ accessToken });

  const [voiceActive, setVoiceActive] = useState(false);

  useEffect(() => {
    onConnectionChange?.(connection);
  }, [connection, onConnectionChange]);

  return (
    <div className="relative z-10 flex h-full w-full flex-col">
      {/* Conversation / Greeting region */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {!hasMessages ? (
            <motion.div
              key="greeting"
              className="absolute inset-0 flex items-center justify-center"
              exit={{ opacity: 0 }}
            >
              <GreetingHero name={userName} />
            </motion.div>
          ) : (
            <motion.div
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="scroll-thin h-full overflow-y-auto"
            >
              <MessageList
                messages={messages}
                thinking={thinking}
                statusLabel={statusLabel}
                onStreamComplete={finishStreaming}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Composer: centered when empty, docked to bottom in conversation */}
      <motion.div
        layout
        className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4 ${
          hasMessages
            ? "bottom-6"
            : "top-1/2 translate-y-[calc(-50%+7rem)]"
        }`}
      >
        <div className="pointer-events-auto w-full flex justify-center">
          <ChatComposer
            onSend={(v) => send(v, "chat")}
            onVoice={() => setVoiceActive(true)}
            centered={!hasMessages}
            disabled={connection === "disconnected"}
          />
        </div>
      </motion.div>

      <VoiceMode
        active={voiceActive}
        onClose={() => setVoiceActive(false)}
        onSpeak={(t) => send(t, "voice")}
        statusLabel={statusLabel}
        thinking={thinking}
      />
    </div>
  );
}
