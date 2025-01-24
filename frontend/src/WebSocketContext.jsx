import React, { createContext, useEffect, useState } from "react";
import io from "socket.io-client";

export const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [desiredTickData, setDesiredTickData] = useState({});
  const [marqueeTickData, setMarqueeTickData] = useState({});
  const [globalTickData, setglobalTickData] = useState({}); // Note: consistency in naming (globalTickData)
  
  const [desiredTokens, setDesiredTokens] = useState({});
  const [marqueeTokens, setMarqueeTokens] = useState({});
  const [globalTokens, setglobalTokens] = useState({});

  const [fetchError, setFetchError] = useState(null);
  const [socketError, setSocketError] = useState(null);

  // 1. Config fetch with better error handling and logging
  useEffect(() => {
    console.log("Fetching config...");
    fetch("http://localhost:5000/config.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch config.json: ${response.statusText}`);
        }
        return response.json();
      })
      .then((config) => {
        console.log("Config loaded:", {
          desiredTokens: Object.keys(config.desiredTokens || {}).length,
          marqueeTokens: Object.keys(config.marqueeTokens || {}).length,
          globalTokens: Object.keys(config.globalTokens || {}).length,
        });
        
        setDesiredTokens(config.desiredTokens || {});
        setMarqueeTokens(config.marqueeTokens || {});
        setglobalTokens(config.globalTokens || {});
        setFetchError(null);
      })
      .catch((error) => {
        console.error("Error fetching config:", error);
        setFetchError(error.message);
      });
  }, []);

  // 2. Initial tick data fetch with validation
  useEffect(() => {
    const hasTokens = 
      Object.keys(desiredTokens).length > 0 ||
      Object.keys(marqueeTokens).length > 0 ||
      Object.keys(globalTokens).length > 0;

    if (!hasTokens) {
      console.log("No tokens available yet, skipping initial tick data fetch");
      return;
    }

    console.log("Fetching initial tick data...");
    fetch("http://localhost:5000/api/ticks")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch tick data: ${response.statusText}`);
        }
        return response.json();
      })
      .then((initialData) => {
        console.log("Initial tick data received, processing...");
        const desired = {};
        const marquee = {};
        const globalData = {};

        Object.entries(initialData).forEach(([token, tick]) => {
          if (desiredTokens[token]) {
            desired[token] = { ...tick, symbol_name: desiredTokens[token] };
          }
          if (marqueeTokens[token]) {
            marquee[token] = { ...tick, symbol_name: marqueeTokens[token] };
          }
          if (globalTokens[token]) {
            globalData[token] = { ...tick, symbol_name: globalTokens[token] };
          }
        });

        console.log("Processed tick data counts:", {
          desired: Object.keys(desired).length,
          marquee: Object.keys(marquee).length,
          global: Object.keys(globalData).length
        });

        setDesiredTickData(desired);
        setMarqueeTickData(marquee);
        setglobalTickData(globalData);
      })
      .catch((error) => {
        console.error("Error fetching initial tick data:", error);
      });
  }, [desiredTokens, marqueeTokens, globalTokens]);

  // 3. WebSocket connection with reconnection logic
  useEffect(() => {
    console.log("Initializing WebSocket connection...");
    const newSocket = io("http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("connect", () => {
      console.log("WebSocket connected successfully");
      setSocketError(null);
    });

    newSocket.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err);
      setSocketError(`WebSocket connection error: ${err.message}`);
    });

    newSocket.on("disconnect", (reason) => {
      console.warn("WebSocket disconnected:", reason);
      setSocketError(`WebSocket disconnected: ${reason}`);
    });

    newSocket.on("error", (err) => {
      console.error("WebSocket error:", err);
      setSocketError(`WebSocket error: ${err.message}`);
    });

    setSocket(newSocket);

    return () => {
      console.log("Cleaning up WebSocket connection");
      if (newSocket) {
        newSocket.close();
      }
    };
  }, []);

  // 4. WebSocket data handler with validation
  useEffect(() => {
    if (!socket) {
      console.log("Socket not initialized, skipping data handler setup");
      return;
    }

    if (!desiredTokens && !marqueeTokens && !globalTokens) {
      console.log("No tokens available, skipping data handler setup");
      return;
    }

    console.log("Setting up WebSocket data handler");
    const handleData = (data) => {
      if (!data || typeof data !== 'object') {
        console.warn("Received invalid data format:", data);
        return;
      }

      const newDesiredData = { ...desiredTickData };
      const newMarqueeData = { ...marqueeTickData };
      const newGlobalData = { ...globalTickData };
      let updateCounts = { desired: 0, marquee: 0, global: 0 };

      Object.entries(data).forEach(([token, tick]) => {
        if (desiredTokens[token]) {
          newDesiredData[token] = { ...tick, symbol_name: desiredTokens[token] };
          updateCounts.desired++;
        }
        if (marqueeTokens[token]) {
          newMarqueeData[token] = { ...tick, symbol_name: marqueeTokens[token] };
          updateCounts.marquee++;
        }
        if (globalTokens[token]) {
          newGlobalData[token] = { ...tick, symbol_name: globalTokens[token] };
          updateCounts.global++;
        }
      });

      if (updateCounts.desired > 0) setDesiredTickData(newDesiredData);
      if (updateCounts.marquee > 0) setMarqueeTickData(newMarqueeData);
      if (updateCounts.global > 0) setglobalTickData(newGlobalData);

      console.log("Updated tick data counts:", updateCounts);
    };

    socket.on("FromAPI", handleData);

    return () => {
      console.log("Cleaning up data handler");
      socket.off("FromAPI", handleData);
    };
  }, [
    socket,
    desiredTickData,
    marqueeTickData,
    globalTickData,
    desiredTokens,
    marqueeTokens,
    globalTokens,
  ]);

  const contextValue = {
    socket,
    desiredTickData,
    marqueeTickData,
    globalTickData,
    fetchError,
    socketError,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};