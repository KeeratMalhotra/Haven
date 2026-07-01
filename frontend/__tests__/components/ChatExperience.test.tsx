/**
 * Tests for the ChatExperience component (the chat-first home).
 *
 * Mocks next-auth, WebSocketClient, voice utilities, and the voice overlay
 * (which pulls in WebGL) to verify rendering and that messages are sent over
 * the WebSocket with the exact contract the backend expects.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next-auth/react (not strictly needed since token is passed via props)
jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { accessToken: "mock-access-token", user: { name: "Test User" } },
    status: "authenticated",
  }),
  signOut: jest.fn(),
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

// Mock the voice overlay so WebGL / next-dynamic isn't pulled into the test.
jest.mock("@/components/voice/VoiceMode", () => ({
  __esModule: true,
  default: () => null,
}));

import ChatExperience from "@/components/chat/ChatExperience";

describe("ChatExperience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the composer with input and send button", () => {
    render(<ChatExperience accessToken="mock-access-token" userName="Test" />);

    expect(screen.getByPlaceholderText("Message Haven")).toBeDefined();
    expect(screen.getByLabelText("Send message")).toBeDefined();
  });

  it("initializes the WebSocket connection on mount", () => {
    render(<ChatExperience accessToken="mock-access-token" />);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith("open", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("close", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("sends a chat message with the correct payload shape", () => {
    render(<ChatExperience accessToken="mock-access-token" />);

    const input = screen.getByPlaceholderText("Message Haven");
    fireEvent.change(input, { target: { value: "Hello Haven!" } });

    fireEvent.click(screen.getByLabelText("Send message"));

    expect(mockSend).toHaveBeenCalledWith({
      type: "chat",
      content: "Hello Haven!",
      auth_token: "mock-access-token",
    });
  });
});
