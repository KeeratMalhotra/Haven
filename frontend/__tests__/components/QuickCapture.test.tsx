/**
 * Tests for the QuickCapture component (universal quick capture).
 *
 * Mocks next-auth (useSession) to provide an access token, the parseBraindump
 * helper from lib/api-extended, and the useAI hook (addNotification toast).
 * Verifies the real open/submit/input-guard logic:
 *   (a) pressing "n" on document.body opens the capture input;
 *   (b) typing text + submitting calls parseBraindump with the entered text;
 *   (c) "n" does NOT open while focus is in an input/textarea.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { accessToken: "mock-access-token", user: { name: "Test User" } },
    status: "authenticated",
  }),
}));

const mockParseBraindump = jest.fn();
jest.mock("@/lib/api-extended", () => ({
  parseBraindump: (...args: unknown[]) => mockParseBraindump(...args),
}));

const mockAddNotification = jest.fn();
jest.mock("@/components/ai/AIContextProvider", () => ({
  useAI: () => ({
    addNotification: mockAddNotification,
    reportAction: jest.fn(),
    suggestions: [],
    dismissSuggestion: jest.fn(),
  }),
}));

import QuickCapture from "@/components/layout/QuickCapture";

const PLACEHOLDER =
  "Capture a task or event... e.g. call dentist tomorrow 3pm";

describe("QuickCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseBraindump.mockResolvedValue({
      summary: "",
      counts: { tasks: 1, events: 0, habits: 0 },
      tasks: [{ title: "call dentist", due_days_from_now: 1, priority: "medium" }],
      events: [],
      habits: [],
    });
  });

  it("opens the capture input when pressing 'n' on the document body", () => {
    render(<QuickCapture />);

    // Closed initially.
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();

    act(() => {
      fireEvent.keyDown(document.body, { key: "n" });
    });

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDefined();
  });

  it("opens when the 'chronai-open-quick-capture' event is dispatched", () => {
    render(<QuickCapture />);

    act(() => {
      window.dispatchEvent(new CustomEvent("chronai-open-quick-capture"));
    });

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDefined();
  });

  it("calls parseBraindump with the entered text on submit and shows a toast", async () => {
    render(<QuickCapture />);

    act(() => {
      fireEvent.keyDown(document.body, { key: "n" });
    });

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "call dentist tomorrow 3pm" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockParseBraindump).toHaveBeenCalledWith(
        "mock-access-token",
        "call dentist tomorrow 3pm"
      );
    });

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Added 'call dentist'", type: "info" })
      );
    });

    // Modal closes after a successful capture.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    });
  });

  it("does NOT open when 'n' is pressed while focus is in an input field", () => {
    render(
      <div>
        <input data-testid="other-input" />
        <QuickCapture />
      </div>
    );

    const otherInput = screen.getByTestId("other-input");
    otherInput.focus();

    act(() => {
      fireEvent.keyDown(otherInput, { key: "n" });
    });

    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  it("ignores 'n' when a modifier key is held (no conflict with Cmd+K)", () => {
    render(<QuickCapture />);

    act(() => {
      fireEvent.keyDown(document.body, { key: "n", metaKey: true });
    });

    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });
});
