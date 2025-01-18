import React from "react";
import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="w-44 bg-gray-800 text-white flex flex-col">
      <div className="p-2 text-lg font-bold">Admin Panel</div>
      <nav className="flex-1 px-2 py-2 space-y-1">
        <Link
          to="/admin/dashboard"
          className="block px-4 py-2 rounded hover:bg-gray-700"
        >
          Dashboard
        </Link>
        <Link
          to="/admin/users"
          className="block px-4 py-2 rounded hover:bg-gray-700"
        >
          Users
        </Link>
        <Link
          to="/admin/upload"
          className="block px-4 py-2 rounded hover:bg-gray-700"
        >
          Upload
        </Link>
      </nav>
    </aside>
  );
}

export default Sidebar;
