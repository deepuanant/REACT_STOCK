import React, { useContext, useRef, useEffect, useState } from "react";
import { WebSocketContext } from "../WebSocketContext";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

// Memoized CardItem for individual cards
const CardItem = React.memo(
  ({ symbolName, lastPrice, netChange, changePercentage, isPositive }) => {
    return (
      <div className="bg-white shadow-md rounded-lg p-1 flex flex-col items-center justify-center">
        <div className="flex items-center mb-2">
          <h3 className="text-sm font-semibold text-center mr-2">
            {symbolName}
          </h3>
          <div
            className={`rounded-full p-1 flex items-center justify-center ${
              isPositive
                ? "bg-green-100 text-green-500"
                : "bg-red-100 text-red-500"
            } w-5 h-5`}
          >
            {isPositive ? <FaArrowUp /> : <FaArrowDown />}
          </div>
        </div>
        <div className="flex items-center text-gray-700 text-sm">
          {/* Fixed width to help avoid any layout shifts */}
          <span className="mr-2 w-14 text-center">{lastPrice}</span>
          <div
            className={`flex items-center ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            <span className="w-10 text-center">{netChange}</span>
            <span
              className={`ml-2 rounded px-2 flex items-center justify-center ${
                isPositive
                  ? "bg-green-100 text-green-500"
                  : "bg-red-100 text-red-500"
              }`}
            >
              {changePercentage}%
            </span>
          </div>
        </div>
      </div>
    );
  }
);

const CardData = React.memo(() => {
  const { desiredTickData } = useContext(WebSocketContext); // Real-time data from WebSocket

  // Local storage key
  const CACHE_KEY = "desiredTickDataCache";

  // We'll keep our data here, defaulting to empty (no fallback data)
  const [renderedData, setRenderedData] = useState({});
  const renderedDataRef = useRef({}); // Tracks the most recent in-memory data

  // 1) On mount, try to load from localStorage
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      renderedDataRef.current = parsedData;
      setRenderedData(parsedData);
    }
  }, []);

  // 2) When new desiredTickData arrives, merge it in if changed
  useEffect(() => {
    if (!desiredTickData || Object.keys(desiredTickData).length === 0) return;

    let hasChanged = false;
    const updatedData = { ...renderedDataRef.current };

    Object.keys(desiredTickData).forEach((token) => {
      const data = desiredTickData[token];
      if (!data) return;

      // Format the new data
      const newFormatted = {
        symbolName: data.symbol_name,
        lastPrice: data.last_price?.toFixed(2) || "0.00",
        netChange: Math.abs(data.net_change || 0).toFixed(2),
        changePercentage: (data.change || 0).toFixed(2),
        isPositive: (data.change || 0) >= 0,
      };

      // Compare to existing data; only update if something truly changed
      const oldData = updatedData[token];
      if (
        !oldData ||
        oldData.lastPrice !== newFormatted.lastPrice ||
        oldData.netChange !== newFormatted.netChange ||
        oldData.changePercentage !== newFormatted.changePercentage ||
        oldData.isPositive !== newFormatted.isPositive
      ) {
        updatedData[token] = newFormatted;
        hasChanged = true;
      }
    });

    if (hasChanged) {
      renderedDataRef.current = updatedData;
      setRenderedData(updatedData);
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
    }
  }, [desiredTickData]);

  // If there's no data in state, show a friendly message
  const hasData = Object.keys(renderedData).length > 0;

  if (!hasData) {
    return (
      <div className="text-center p-4">
        No data available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 mt-2 p-1">
      {Object.keys(renderedData).map((token) => {
        const data = renderedData[token];
        return (
          <CardItem
            key={token}
            symbolName={data.symbolName}
            lastPrice={data.lastPrice}
            netChange={data.netChange}
            changePercentage={data.changePercentage}
            isPositive={data.isPositive}
          />
        );
      })}
    </div>
  );
});

export default CardData;
