/**
 * Tests for ChatPanel component.
 *
 * Mocks next-auth, WebSocketClient, and voice utilities to test
 * rendering and message submission behavior.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { accessToken: "mock-access-token", user: { name: "Test User" } },
    status: "authenticated",
  }),
}));

// Mock WebSocketClient
const mockSend = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockOn = jest.fn();

jest.mock("@/lib/ws", () => ({
  WebSocketClient: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    send: mockSend,
    on: mockOn,
  })),
}));

// Mock voice utilities
jest.mock("@/lib/voice", () => ({
  startListening: jest.fn().mockResolvedValue(""),
  playAudioBase64: jest.fn().mockResolvedValue(undefined),
}));

import ChatPanel from "@/components/chat/ChatPanel";

describe("ChatPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset crypto.randomUUID
    Object.defineProperty(global, "crypto", {
      value: {
        randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2),
      },
    });
  });

  it("renders with input field and send button", () => {
    render(<ChatPanel />);

    // Check for textarea (input field)
    const input = screen.getByPlaceholderText("Type a message...");
    expect(input).toBeDefined();

    // Check for send button (has an SVG with polygon)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2); // Voice + Send buttons
  });

  it("typing and submitting a message calls WebSocket send", () => {
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Type a message...");

    // Type a message
    fireEvent.change(input, { target: { value: "Hello ChronAI!" } });

    // Find the send button (the second button, after voice)
    const buttons = screen.getAllByRole("button");
    const sendButton = buttons[buttons.length - 1]; // Last button is send

    // Click send
    fireEvent.click(sendButton);

    // Verify WebSocket send was called with correct payload
    expect(mockSend).toHaveBeenCalledWith({
      type: "chat",
      content: "Hello ChronAI!",
      auth_token: "mock-access-token",
    });
  });

  it("initializes WebSocket connection on mount", () => {
    render(<ChatPanel />);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith("open", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("close", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("message", expect.any(Function));
  });
});
