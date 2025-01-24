// GlobalData.jsx
import React, { useContext, useRef, useEffect, useState } from "react";
import { WebSocketContext } from "../WebSocketContext";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

// Rename to match the import in App.jsx
const GlobalData = React.memo(() => {
  const { globalTickData } = useContext(WebSocketContext);
  const CACHE_KEY = "globalTickDataCache";
  const [renderedData, setRenderedData] = useState({});
  const renderedDataRef = useRef({});

  // Debug logs to track data flow
  useEffect(() => {
    console.log('globalTickData received:', globalTickData);
    console.log('Current renderedData:', renderedData);
  }, [globalTickData]);

  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      renderedDataRef.current = parsedData;
      setRenderedData(parsedData);
      console.log('Loaded cached data:', parsedData);
    }
  }, []);

  useEffect(() => {
    if (!globalTickData || Object.keys(globalTickData).length === 0) {
      console.log('No globalTickData available');
      return;
    }

    let hasChanged = false;
    const updatedData = { ...renderedDataRef.current };

    Object.keys(globalTickData).forEach((token) => {
      const data = globalTickData[token];
      if (!data) return;

      const newFormatted = {
        symbolName: data.symbol_name,
        lastPrice: data.last_price?.toFixed(2) || "0.00",
        netChange: Math.abs(data.net_change || 0).toFixed(2),
        changePercentage: (data.change || 0).toFixed(2),
        isPositive: (data.change || 0) >= 0,
      };

      // Log individual token updates
      console.log(`Processing token ${token}:`, newFormatted);

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
      console.log('Updating rendered data:', updatedData);
      renderedDataRef.current = updatedData;
      setRenderedData(updatedData);
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
    }
  }, [globalTickData]);

  // Log when no data is available
  if (Object.keys(renderedData).length === 0) {
    console.log('No rendered data available');
    return <div className="text-center p-4">No data available</div>;
  }

  return (
    <div className="p-2">
      <div className="flex items-center mb-2">
        <div className="flex-grow h-px bg-gray-200"></div>
        <h2 className="px-4 text-center text-xl font-semibold text-gray-800">
          Global Indices
        </h2>
        <div className="flex-grow h-px bg-gray-200"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 p-2">
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
    </div>
  );
});

// Also fix the CardItem component reference
const CardItem = React.memo(({ symbolName, lastPrice, netChange, changePercentage, isPositive }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-1 flex flex-col items-center justify-center">
      <div className="flex items-center mb-2">
        <h3 className="text-sm font-semibold text-center mr-2">
          {symbolName}
        </h3>
        <div className={`rounded-full p-1 flex items-center justify-center ${
          isPositive ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"
        } w-5 h-5`}>
          {isPositive ? <FaArrowUp /> : <FaArrowDown />}
        </div>
      </div>
      <div className="flex items-center text-gray-700 text-sm">
        <span className="mr-2 w-14 text-center">{lastPrice}</span>
        <div className={`flex items-center ${
          isPositive ? "text-green-500" : "text-red-500"
        }`}>
          <span className="text-center">{netChange}</span>
          <span className={`ml-2 rounded px-1 flex items-center justify-center ${
            isPositive ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"
          }`}>
            {changePercentage}%
          </span>
        </div>
      </div>
    </div>
  );
});

export default GlobalData;