import React from "react";
import { WebSocketProvider } from "./WebSocketContext";
import CardData from "./components/CardData";
import MarqueeData from "./components/MarqueeData";
import GlobalData from "./components/GlobalData";

const App = () => {
  return (
    <WebSocketProvider>
      <div className="">
        <MarqueeData />
        <CardData />
        <GlobalData />
      </div>
    </WebSocketProvider>
  );
};

export default App;
