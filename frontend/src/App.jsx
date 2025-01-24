import React from 'react';
import { WebSocketProvider } from './WebSocketContext';
import CardData from './components/CardData';
import MarqueeData from './components/MarqueeData';
const App = () => {
  return (
    <WebSocketProvider>
      <div className="">
        <MarqueeData />
        <CardData />
      </div>
    </WebSocketProvider>
  );
};

export default App;
