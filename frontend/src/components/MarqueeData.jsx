import React, { useContext, useEffect, useState, useRef } from "react";
import Marquee from "react-fast-marquee";
import { WebSocketContext } from "../WebSocketContext";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import { staticFallbackData } from "./Marquee";
const TickerItem = React.memo(
  ({ symbolName, lastPrice, netChange, changePercentage, isPositive }) => {
    return (
      <div className="marquee-item inline-flex items-center text-sm">
        <span className="font-semibold mr-1">{symbolName}:</span>
        <span className="w-16 inline-block text-right">{lastPrice}</span>
        <span
          className={`ml-1 flex items-center ${
            isPositive ? "text-green-500" : "text-red-500"
          }`}
        >
          <span className="w-12 inline-block text-center">{netChange}</span>
          <span
            className={`ml-1 rounded px-2 ${
              isPositive
                ? "bg-green-100 text-green-500"
                : "bg-red-100 text-red-500"
            }`}
          >
            {changePercentage}%
          </span>
          <div
            className={`ml-1 rounded-full w-5 h-5 flex items-center justify-center ${
              isPositive
                ? "bg-green-100 text-green-500"
                : "bg-red-100 text-red-500"
            }`}
            aria-label={isPositive ? "Positive change" : "Negative change"}
          >
            {isPositive ? <FaArrowUp /> : <FaArrowDown />}
          </div>
        </span>
      </div>
    );
  }
);

const MarqueeCard = () => {
  const { marqueeTickData } = useContext(WebSocketContext); // Real-time data
  const renderedDataRef = useRef({}); // Track rendered data
  const [renderedData, setRenderedData] = useState({}); // Data to render
  const CACHE_KEY = "marqueeTickDataCache"; // Cache key for localStorage

  // Static fallback data (from marqueeTokens)
  

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
    <div className="bg-white shadow-md p-2">
      <Marquee gradient={false} speed={50}>
        {Object.keys(renderedData).map((token, index, array) => {
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
              <React.Fragment key={token}>
                <TickerItem
                  symbolName={symbolName}
                  lastPrice={lastPrice}
                  netChange={netChange}
                  changePercentage={changePercentage}
                  isPositive={isPositive}
                />
                {index < array.length - 1 && (
                  <div className="inline-block mx-1 text-gray-500">|</div>
                )}
              </React.Fragment>
            );
          }
          return null;
        })}
      </Marquee>
    </div>
  );
};

export default MarqueeCard;
