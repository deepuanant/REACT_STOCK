import React from 'react';
import { WebSocketProvider } from './WebSocketContext';
import CardData from './components/CardData';
import MarqueeData from './components/MarqueeData';
import TableCard from './components/TableCard';
const App = () => {
  return (
    <WebSocketProvider>
      <div className="">
        <MarqueeData />
        <CardData />
        {/* <TableCard /> */}
      </div>
    </WebSocketProvider>
  );
};

export default App;
