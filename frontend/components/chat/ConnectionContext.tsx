"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ConnectionState } from "@/hooks/useChatSocket";

interface ConnectionContextValue {
  connection: ConnectionState | undefined;
  setConnection: (state: ConnectionState) => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  connection: undefined,
  setConnection: () => {},
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnectionState] = useState<ConnectionState | undefined>(
    undefined
  );

  const setConnection = useCallback((state: ConnectionState) => {
    setConnectionState(state);
  }, []);

  return (
    <ConnectionContext.Provider value={{ connection, setConnection }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnectionState() {
  return useContext(ConnectionContext);
}
