/**
 * WebSocket client for real-time communication with the backend.
 * Sends JSON messages: { type: "chat"|"voice", content: string, auth_token: string }
 * Receives: { type: "text"|"audio"|"task_update"|"status"|"error", content: string|base64_audio, agent: string }
 */

type MessagePayload = {
  type: "chat" | "voice";
  content: string;
  auth_token: string;
};

type ResponsePayload = {
  type: "text" | "audio" | "task_update" | "status" | "error" | "text_chunk" | "text_end";
  content: string;
  agent?: string;
  message_id?: string;
};

type EventType = "open" | "close" | "message" | "error";
type EventHandler = (...args: unknown[]) => void;

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners: Map<EventType, EventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 500;
  private shouldReconnect = true;
  private pendingMessages: MessagePayload[] = [];

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Register an event listener.
   */
  on(event: "open", handler: () => void): void;
  on(event: "close", handler: () => void): void;
  on(event: "message", handler: (data: ResponsePayload) => void): void;
  on(event: "error", handler: (error: Event) => void): void;
  on(event: EventType, handler: (...args: any[]) => void): void { // eslint-disable-line
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit(event: EventType, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((handler) => handler(...args));
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (typeof window === "undefined") return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.flushPendingMessages();
        this.emit("open");
      };

      this.ws.onclose = () => {
        this.emit("close");
        this.attemptReconnect();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data: ResponsePayload = JSON.parse(event.data);
          this.emit("message", data);
        } catch {
          console.error("Failed to parse WebSocket message:", event.data);
        }
      };

      this.ws.onerror = (error: Event) => {
        this.emit("error", error);
      };
    } catch {
      this.attemptReconnect();
    }
  }

  /**
   * Send a message to the server. If disconnected, queue it for delivery on reconnect.
   */
  send(payload: MessagePayload): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.pendingMessages.push(payload);
    }
  }

  /**
   * Flush any messages that were queued while disconnected.
   */
  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const payload = this.pendingMessages.shift()!;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      } else {
        // Connection lost again mid-flush; put it back and stop.
        this.pendingMessages.unshift(payload);
        break;
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff.
   */
  private attemptReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect and prevent reconnection.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.pendingMessages = [];
  }

  /**
   * Get current connection state.
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
