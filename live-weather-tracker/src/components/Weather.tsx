import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

interface WeatherData {
  id: number;
  city: string;
  humidity: number;
  cloud: number;
  wind_speed: number;
}

export default function Weather() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch existing weather data from backend on page load
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const response = await axios.get<WeatherData[]>("http://localhost:5000/weather");
        setWeatherData(response.data);
      } catch (error) {
        console.error("Error fetching weather data:", error);
      }
    };

    fetchWeatherData();

    // Real-time updates
    socket.on("weather_update", (data: WeatherData) => {
      setWeatherData((prev) => [data, ...prev]); // Add new data at the top
    });

    socket.on("weather_delete", (data: { id: number }) => {
      setWeatherData((prev) => prev.filter((item) => item.id !== data.id));
    });

    return () => {
      socket.off("weather_update");
      socket.off("weather_delete");
    };
  }, []);

  // Add new weather data manually
  const addWeatherData = async () => {
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/add");
    } catch (error) {
      console.error("Error adding weather data:", error);
    }
    setLoading(false);
  };

  // Delete weather data
  const deleteWeather = async (id: number) => {
    try {
      await axios.delete(`http://localhost:5000/delete/${id}`, {
        headers: { "Content-Type": "application/json" },  // ✅ Ensures proper request
      });
      setWeatherData((prev) => prev.filter((item) => item.id !== id));  // ✅ Updates UI
    } catch (error) {
      console.error("Error deleting weather data:", error);
    }
  };
  
  return (
    <div className={`max-w-xl mx-auto p-4 min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"}`}>
    {/* ✅ Sticky Header */}
    <div className={`sticky top-0 z-10 p-4 shadow-md ${darkMode ? "bg-gray-900 text-white" : "bg-gray-200 text-black"}`}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">🌍 Live Weather Updates</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-4 py-1 bg-gray-800 text-white rounded-md hover:bg-gray-600 transition"
        >
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>
    </div>

    <p className="mt-6 mb-4">Clicking the button below will add a new weather data entry to the list.</p>

    <button
      onClick={addWeatherData}
      disabled={loading}
      className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg mb-4 hover:bg-blue-700 transition"
    >
      {loading ? "🔄 Fetching..." : "🔄 Refresh Weather"}
    </button>

    {weatherData.length === 0 && <p className="text-center">No weather data available.</p>}

    <ul>
      {weatherData.map((weather) => (
        <li key={weather.id} className={`p-4 rounded-lg shadow-md mb-2 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-lg">{weather.city}</p>
              <p>☁️ Cloud Cover: {weather.cloud}%</p>
              <p>💧 Humidity: {weather.humidity}%</p>
              <p>🌬 Wind Speed: {weather.wind_speed} kph</p>
            </div>
            <button
              onClick={() => deleteWeather(weather.id)}
              className="text-red-500 hover:text-red-700 transition"
            >
              🗑 Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  </div>
);
}