import React from "react";
import { FaUsers, FaChartBar, FaEnvelope, FaBell } from "react-icons/fa";

const AdminDashboard = () => {
  return (
    <div className="flex h-screen bg-gray-100 ">
      {/* Main Content */}
      <div className="flex-1 flex flex-col ">
        {/* Dashboard Content */}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-500">Total Users</h2>
            <p className="text-2xl font-bold text-gray-800 mt-2">1,234</p>
            <p className="text-sm text-green-500 mt-1">+5% (24h)</p>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-500">
              Active Sessions
            </h2>
            <p className="text-2xl font-bold text-gray-800 mt-2">765</p>
            <p className="text-sm text-red-500 mt-1">-2% (24h)</p>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-500">
              New Messages
            </h2>
            <p className="text-2xl font-bold text-gray-800 mt-2">82</p>
            <p className="text-sm text-blue-500 mt-1">+12% (24h)</p>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Website Traffic
          </h2>
          <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
            Chart Placeholder (Integrate Chart.js or Recharts here)
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white shadow-md rounded-lg p-6 mt-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Recent Activities
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">
                  <span>U</span>
                </div>
                <p className="text-sm text-gray-700">
                  User John created a new post
                </p>
              </div>
              <span className="text-xs text-gray-500">2 min ago</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center mr-3">
                  <span>R</span>
                </div>
                <p className="text-sm text-gray-700">
                  User Rachel completed the task
                </p>
              </div>
              <span className="text-xs text-gray-500">15 min ago</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-md rounded-lg p-2 mt-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Recent Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-gray-500">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Transaction ID
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    User
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Amount
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">#12345</td>
                  <td className="px-4 py-2">John Doe</td>
                  <td className="px-4 py-2">$123.45</td>
                  <td className="px-4 py-2 text-green-500">Completed</td>
                  <td className="px-4 py-2">Jan 15, 2025</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">#12346</td>
                  <td className="px-4 py-2">Jane Smith</td>
                  <td className="px-4 py-2">$98.76</td>
                  <td className="px-4 py-2 text-yellow-500">Pending</td>
                  <td className="px-4 py-2">Jan 14, 2025</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
        <div className="p-2">

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
