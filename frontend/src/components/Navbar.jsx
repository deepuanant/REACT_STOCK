import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FaBell, FaRegUserCircle } from "react-icons/fa";
import { BsFullscreen } from "react-icons/bs";
import png1 from "../assets/Treyst Logo.png";

function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-white shadow-md px-4 py-2 flex items-center justify-between border-b">
      {/* Logo Section */}
      <div className="flex items-center">
        <Link to="/">
          <img src={png1} alt="Logo" className="w-16 h-auto" />
        </Link>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-6">
        {/* Notification Button */}
        <button
          aria-label="Notifications"
          className="relative text-gray-600 hover:text-gray-800"
        >
          <FaBell size={20} />
         
        </button>

        {/* Fullscreen Button */}
        <button
          aria-label="Fullscreen"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else if (document.exitFullscreen) {
              document.exitFullscreen();
            }
          }}
          className="text-gray-600 hover:text-gray-800"
        >
          <BsFullscreen size={20} />
        </button>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            aria-expanded={dropdownOpen}
            aria-label="User Menu"
            className="text-gray-600 hover:text-gray-800 focus:outline-none"
          >
            <FaRegUserCircle size={25} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <Link
                to="/profile"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Profile
              </Link>
              <Link
                to="/admin"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                Admin
                </Link>
              <Link
                to="/settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Settings
              </Link>
              <button
                onClick={() => console.log("Logout clicked")}
                className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
