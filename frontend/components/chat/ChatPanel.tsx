"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import MessageBubble from "./MessageBubble";
import { WebSocketClient } from "@/lib/ws";
import { startListening, playAudioBase64 } from "@/lib/voice";

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "ai";
  agent?: string;
  timestamp: Date;
}

export default function ChatPanel() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>("");
  const [statusText, setStatusText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocketClient | null>(null);

  // Get the access token from the session
  const accessToken = (session as Record<string, unknown> | null)?.accessToken as string || "";

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
    const ws = new WebSocketClient(wsUrl);
    wsRef.current = ws;

    ws.on("open", () => {
      setIsConnected(true);
      setHasConnectedOnce(true);
    });
    ws.on("close", () => setIsConnected(false));

    ws.on("message", (data: { type: string; content: string; agent?: string }) => {
      if (data.type === "text" || data.type === "task_update") {
        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: data.content,
          role: "ai",
          agent: data.agent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        // Final answer arrived — clear the typing indicator and status text.
        setIsTyping(false);
        setStatusText("");
        setActiveAgent(data.agent || "");
      } else if (data.type === "status") {
        // Real-time progress update from the orchestrator. Keep typing true
        // and surface the status text on the indicator.
        setActiveAgent(data.agent || "");
        setStatusText(data.content || "");
        setIsTyping(true);
      } else if (data.type === "error") {
        // Show timeout/auth errors as a friendly inline chat message.
        const errMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: data.content,
          role: "ai",
          agent: data.agent || "system",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMessage]);
        setIsTyping(false);
        setStatusText("");
      } else if (data.type === "audio") {
        playAudioBase64(data.content);
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, []);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    wsRef.current.send({
      type: "chat",
      content: input.trim(),
      auth_token: accessToken,
    });
    setIsTyping(true);
    setStatusText("");
    setActiveAgent("");
    setInput("");
  }, [input, accessToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoice = async () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    try {
      const transcript = await startListening();
      if (transcript && wsRef.current) {
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: transcript,
          role: "user",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        wsRef.current.send({
          type: "voice",
          content: transcript,
          auth_token: accessToken,
        });
        setIsTyping(true);
        setStatusText("");
        setActiveAgent("");
      }
    } finally {
      setIsListening(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-600">
        <h2 className="text-sm font-medium text-gray-300">Chat</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-neon-cyan"
                : hasConnectedOnce
                ? "bg-red-500"
                : "bg-yellow-400 animate-pulse"
            }`}
          />
          <span className="text-xs text-gray-500">
            {isConnected
              ? "Connected"
              : hasConnectedOnce
              ? "Disconnected"
              : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Connection Status Bar */}
      <div className="px-4 py-2 border-b border-dark-600 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] font-mono text-gray-400">Google Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] font-mono text-gray-400">Google Tasks</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] font-mono text-gray-400">Gmail</span>
        </div>
        {isTyping && activeAgent && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
            <span className="text-[10px] font-mono text-neon-purple">{activeAgent}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 chat-scroll">
        {!hasConnectedOnce && !isConnected && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
              <span>Connecting to ChronAI...</span>
            </div>
          </div>
        )}
        {hasConnectedOnce && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm text-center">
              Say hello to start a conversation with ChronAI
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            content={msg.content}
            role={msg.role}
            agent={msg.agent}
            timestamp={msg.timestamp}
          />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-3 animate-message-in">
            <div className="bg-dark-700 border border-dark-600 rounded-2xl px-4 py-3">
              <div className="text-xs text-neon-purple font-medium mb-1">
                {activeAgent || "chronai"}
              </div>
              <div className="flex items-center gap-1">
                <span className="typing-dot" />
                <span className="typing-dot animation-delay-200" />
                <span className="typing-dot animation-delay-400" />
                <span className="text-xs text-gray-400 ml-2">
                  {statusText
                    ? activeAgent
                      ? `${activeAgent} is ${statusText.charAt(0).toLowerCase()}${statusText.slice(1)}`
                      : statusText
                    : activeAgent
                    ? `${activeAgent} is thinking...`
                    : "thinking..."}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-dark-600">
        <div className="flex items-center gap-2">
          {/* Voice button */}
          <button
            onClick={handleVoice}
            className={`p-2 rounded-full transition-all ${
              isListening
                ? "bg-neon-cyan/20 text-neon-cyan animate-pulse-glow"
                : "text-gray-400 hover:text-neon-cyan hover:bg-dark-700"
            }`}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>

          {/* Text input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-dark-700 border border-dark-600 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-neon-cyan/50 transition-colors"
          />

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-2 rounded-full text-gray-400 hover:text-neon-cyan hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" x2="11" y1="2" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
