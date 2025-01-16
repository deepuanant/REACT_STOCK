import React, { useContext, useEffect, useState, useRef } from "react";
import { WebSocketContext } from "../WebSocketContext";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import { staticFallbackData } from "./Marquee";

const TableRow = React.memo(
  ({ symbolName, lastPrice, netChange, changePercentage, isPositive }) => {
    return (
      <tr className="text-sm border-b">
        <td className="px-4 py-2 font-semibold">{symbolName}</td>
        <td className="px-4 py-2 text-right">{lastPrice}</td>
        <td
          className={`px-4 py-2 text-center ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          {netChange}
        </td>
        <td
          className={`px-4 py-2 text-center ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          <span
            className={`inline-flex items-center rounded px-2 py-1 ${
              isPositive
                ? "bg-green-100 text-green-500"
                : "bg-red-100 text-red-500"
            }`}
          >
            {changePercentage}%
            <span className="ml-1">
              {isPositive ? <FaArrowUp /> : <FaArrowDown />}
            </span>
          </span>
        </td>
      </tr>
    );
  }
);

const TableCard = () => {
  const { marqueeTickData } = useContext(WebSocketContext); // Real-time data
  const renderedDataRef = useRef({}); // Track rendered data
  const [renderedData, setRenderedData] = useState({}); // Data to render
  const CACHE_KEY = "marqueeTickDataCache"; // Cache key for localStorage

  // Load cached data or fallback on first render
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      renderedDataRef.current = parsedData;
      setRenderedData(parsedData);
    } else {
      renderedDataRef.current = staticFallbackData;
      setRenderedData(staticFallbackData);
    }
  }, []);

  // Update rendered data when marqueeTickData changes
  useEffect(() => {
    if (Object.keys(marqueeTickData).length === 0) return; // Avoid unnecessary updates

    const updatedData = { ...renderedDataRef.current }; // Start with current rendered data

    Object.keys(marqueeTickData).forEach((token) => {
      const data = marqueeTickData[token];
      if (updatedData[token]) {
        // Update existing static card with dynamic data
        updatedData[token] = {
          symbolName: data.symbol_name,
          lastPrice: data.last_price.toFixed(2),
          netChange: Math.abs(data.net_change).toFixed(2),
          changePercentage: data.change.toFixed(2),
          isPositive: data.change >= 0,
        };
      }
    });

    // Update rendered data and cache it
    renderedDataRef.current = updatedData;
    setRenderedData(updatedData);
    localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
  }, [marqueeTickData]);

  return (
    <div className="bg-white shadow-md p-4 rounded-lg">
      <table className="table-auto w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2">Symbol</th>
            <th className="px-4 py-2 text-right">Last Price</th>
            <th className="px-4 py-2 text-center">Net Change</th>
            <th className="px-4 py-2 text-center">Change %</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(renderedData).map((token) => {
            const data = renderedData[token];
            if (data) {
              const {
                symbolName,
                lastPrice,
                netChange,
                changePercentage,
                isPositive,
              } = data;

              return (
                <TableRow
                  key={token}
                  symbolName={symbolName}
                  lastPrice={lastPrice}
                  netChange={netChange}
                  changePercentage={changePercentage}
                  isPositive={isPositive}
                />
              );
            }
            return null;
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TableCard;
