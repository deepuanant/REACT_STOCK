import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { WebSocketProvider } from "./WebSocketContext";

import Main from "./components/Main";
import AdminLayout from "./Layout/AdminLayout";
import Dashboard from "./components/Admin/Dashboard";
import Upload from "./components/Admin/Upload";

const App = () => {
  return (
    <WebSocketProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Main />} />
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="upload" element={<Upload />} />
          </Route>
        </Routes>
      </Router>
      {/* <div className="">
        <MarqueeData />
        <CardData />
        <GlobalData />
      </div> */}
    </WebSocketProvider>
  );
};

export default App;
