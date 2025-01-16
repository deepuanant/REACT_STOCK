import React, { useContext, useRef, useEffect, useState } from "react";
import { WebSocketContext } from "../WebSocketContext";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

// Memoized CardItem for individual cards
const CardItem = React.memo(({ symbolName, lastPrice, netChange, changePercentage, isPositive }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-1 flex flex-col items-center justify-center">
      <div className="flex items-center mb-2">
        <h3 className="text-sm font-semibold text-center mr-2">{symbolName}</h3>
        <div
          className={`rounded-full p-2 flex items-center justify-center ${
            isPositive ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"
          } w-6 h-6`}
        >
          {isPositive ? <FaArrowUp /> : <FaArrowDown />}
        </div>
      </div>
      <div className="flex items-center text-gray-700 text-sm">
        <span className="mr-2 w-14 text-center">{lastPrice}</span>
        <div
          className={`flex items-center ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          <span className="w-10 text-center">{netChange}</span>
          <span
            className={`ml-2 rounded px-2 flex items-center justify-center ${
              isPositive ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"
            }`}
          >
            {changePercentage}%
          </span>
        </div>
      </div>
    </div>
  );
});

const CardData = React.memo(() => {
  const { desiredTickData } = useContext(WebSocketContext); // Real-time data from WebSocket

  // Static fallback data for the first visit
  const staticFallbackData = {
    256265: {
      symbolName: "NIFTY 50",
      lastPrice: "23178.60",
      netChange: "2.55",
      changePercentage: "0.01",
      isPositive: true,
    },
    257801: {
      symbolName: "FINNIFTY",
      lastPrice: "22617.85",
      netChange: "104.30",
      changePercentage: "-0.46",
      isPositive: false,
    },
    259849: {
      symbolName: "NIFTY IT",
      lastPrice: "43340.55",
      netChange: "279.40",
      changePercentage: "0.65",
      isPositive: true,
    },
    260105: {
      symbolName: "BANKNIFTY",
      lastPrice: "48626.25",
      netChange: "102.90",
      changePercentage: "-0.21",
      isPositive: false,
    },
    264969: {
      symbolName: "INDIAVIX",
      lastPrice: "15.44",
      netChange: "0.03",
      changePercentage: "-0.19",
      isPositive: false,
    },
    265: {
      symbolName: "SENSEX",
      lastPrice: "15.44",
      netChange: "0.03",
      changePercentage: "-0.19",
      isPositive: false,
    },
  };

  const [renderedData, setRenderedData] = useState(staticFallbackData); // Initialize with static data
  const renderedDataRef = useRef(staticFallbackData); // Store the most recent state
  const CACHE_KEY = "desiredTickDataCache"; // Local storage key

  // Load cached data on page load
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      renderedDataRef.current = parsedData;
      setRenderedData(parsedData);
    }
  }, []);

  // Update rendered data when desiredTickData changes
  useEffect(() => {
    const updatedData = {};

    Object.keys(desiredTickData).forEach((token) => {
      const data = desiredTickData[token];
      if (
        !renderedDataRef.current[token] || // If token is new
        renderedDataRef.current[token].lastPrice !== data.last_price // If data has changed
      ) {
        updatedData[token] = {
          symbolName: data.symbol_name,
          lastPrice: data.last_price.toFixed(2),
          netChange: Math.abs(data.net_change).toFixed(2),
          changePercentage: data.change.toFixed(2),
          isPositive: data.change >= 0,
        };
      }
    });

    // Update local reference and state
    const newRenderedData = { ...renderedDataRef.current, ...updatedData };
    renderedDataRef.current = newRenderedData;
    setRenderedData(newRenderedData);

    // Cache the updated data
    localStorage.setItem(CACHE_KEY, JSON.stringify(newRenderedData));
  }, [desiredTickData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 mt-2 p-1">
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
