import React, { useContext, useEffect, useState, useRef } from "react";
import Marquee from "react-fast-marquee";
import { WebSocketContext } from "../WebSocketContext";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

// A single ticker item with fixed widths to avoid layout jumps
const TickerItem = React.memo(({ 
  symbolName, 
  lastPrice, 
  netChange, 
  changePercentage, 
  isPositive 
}) => {
  return (
    <div className="marquee-item inline-flex items-center text-sm">
      <span className="font-semibold mr-1">{symbolName}:</span>

      {/* Fixed width so layout doesn't jump when numbers change */}
      <span className="inline-block text-right" style={{ width: 50 }}>
        {lastPrice}
      </span>

      <span
        className={`ml-1 flex items-center ${
          isPositive ? "text-green-500" : "text-red-500"
        }`}
      >
        {/* Fixed width for net change */}
        <span className="inline-block text-center" style={{ width: 50 }}>
          {netChange}
        </span>

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
});

const MarqueeCard = () => {
  const { marqueeTickData } = useContext(WebSocketContext);
  const renderedDataRef = useRef({});
  const [renderedData, setRenderedData] = useState({});
  
  // Key for localStorage
  const CACHE_KEY = "marqueeTickDataCache";

  // 1) Load cached data on first render (if it exists)
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      renderedDataRef.current = parsedData;
      setRenderedData(parsedData);
    }
    // If there's no cached data, we just start with an empty object
  }, []);

  // 2) When WebSocket data arrives, merge/update if anything changed
  useEffect(() => {
    if (!marqueeTickData || Object.keys(marqueeTickData).length === 0) return;

    let hasChanged = false;
    const updatedData = { ...renderedDataRef.current };

    Object.keys(marqueeTickData).forEach((token) => {
      const data = marqueeTickData[token];
      if (!data) return;

      // Format new values
      const newFormatted = {
        symbolName: data.symbol_name,
        lastPrice: data.last_price?.toFixed(2) || "0.00",
        netChange: Math.abs(data.net_change || 0).toFixed(2),
        changePercentage: (data.change || 0).toFixed(2),
        isPositive: (data.change || 0) >= 0,
      };

      // Compare with existing data; only update if actually changed
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
  }, [marqueeTickData]);

  // 3) Decide if we have any data to show
  const hasData = Object.keys(renderedData).length > 0;

  return (
    <div
      className="bg-white shadow-md p-2"
      style={{ transform: "translateZ(0)" }} // GPU acceleration
    >
      {hasData ? (
        <Marquee
          gradient={false}
          speed={50}
          pauseOnHover={false}
          pauseOnClick={false}
        >
          {Object.keys(renderedData).map((token, index, array) => {
            const data = renderedData[token];
            if (!data) return null;

            const { 
              symbolName, 
              lastPrice, 
              netChange, 
              changePercentage, 
              isPositive 
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
                  <div className="inline-block mx-2 text-gray-400">|</div>
                )}
              </React.Fragment>
            );
          })}
        </Marquee>
      ) : (
        // Show a placeholder if no data is available yet
        <div className="text-center py-4">No live data available</div>
      )}
    </div>
  );
};

export default MarqueeCard;
