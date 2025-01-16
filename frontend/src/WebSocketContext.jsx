import React, { createContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

export const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [desiredTickData, setDesiredTickData] = useState({});
  const [marqueeTickData, setMarqueeTickData] = useState({});
  const [desiredTokens, setDesiredTokens] = useState({});
  const [marqueeTokens, setMarqueeTokens] = useState({});
  const [fetchError, setFetchError] = useState(null);
  const [socketError, setSocketError] = useState(null);

  useEffect(() => {
    // Fetch tokens from config.json on mount
    fetch('http://localhost:5000/config.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch config.json: ' + response.statusText);
        }
        return response.json();
      })
      .then((config) => {
        setDesiredTokens(config.desiredTokens);
        setMarqueeTokens(config.marqueeTokens);
        setFetchError(null);
      })
      .catch((error) => {
        console.error('Error fetching config:', error);
        setFetchError(error.message);
      });
  }, []);

  useEffect(() => {
    // Fetch initial tick data
    fetch('http://localhost:5000/api/ticks')
      .then((response) => response.json())
      .then((initialData) => {
        const desired = {};
        const marquee = {};

        Object.entries(initialData).forEach(([token, tick]) => {
          if (desiredTokens[token]) {
            desired[token] = {
              ...tick,
              symbol_name: desiredTokens[token],
            };
          }
          if (marqueeTokens[token]) {
            marquee[token] = {
              ...tick,
              symbol_name: marqueeTokens[token],
            };
          }
        });

        setDesiredTickData(desired);
        setMarqueeTickData(marquee);
      })
      .catch((error) => {
        console.error('Error fetching initial tick data:', error);
      });
  }, [desiredTokens, marqueeTokens]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setSocketError('WebSocket connection error: ' + err.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
      setSocketError('WebSocket disconnected: ' + reason);
    });

    newSocket.on('error', (err) => {
      console.error('WebSocket error:', err);
      setSocketError('WebSocket error: ' + err.message);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, []);

  useEffect(() => {
    if (socket && desiredTokens && marqueeTokens) {
      socket.on('FromAPI', (data) => {
        // `data` is a dictionary where the key is the token
        Object.entries(data).forEach(([token, tick]) => {
          // Check if the token exists in desiredTokens
          if (desiredTokens[token]) {
            setDesiredTickData((prevData) => ({
              ...prevData,
              [token]: {
                ...tick,
                symbol_name: desiredTokens[token],
              },
            }));
          }
  
          // Check if the token exists in marqueeTokens
          if (marqueeTokens[token]) {
            setMarqueeTickData((prevData) => ({
              ...prevData,
              [token]: {
                ...tick,
                symbol_name: marqueeTokens[token],
              },
            }));
          }
        });
      });
  
      return () => {
        socket.off('FromAPI');
      };
    }
  }, [socket, desiredTokens, marqueeTokens]);
  

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        desiredTickData,
        marqueeTickData,
        fetchError,
        socketError,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
