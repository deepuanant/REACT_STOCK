import React, { useState } from "react";
import * as XLSX from "xlsx";

function Upload() {
  const [data, setData] = useState([]); // To store the parsed data

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const binaryString = event.target.result;
        const workbook = XLSX.read(binaryString, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        setData(sheetData); // Update state with parsed data
      };
      reader.readAsBinaryString(file);
    }
  };

  // Handle Submit
  const handleSubmit = () => {
    console.log("Submitted Data:", data);
    setData([])
    alert("Data submitted successfully!");
  };

  return (
    <div className="p-2 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Upload and Preview Excel
      </h1>

      {/* File Upload */}
      <div className="mb-6">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
        />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">Preview Data</h2>
      {/* Data Preview */}
      {data.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-1">
          <div className="overflow-x-auto max-w-5xl">
            <table className="min-w-full text-sm text-left text-gray-500">
              <thead className="bg-gray-100">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th
                      key={key}
                      className="px-4 py-2 font-semibold text-gray-600"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    {Object.values(row).map((value, i) => (
                      <td key={i} className="px-4 py-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {data.length > 0 && (
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

export default Upload;
