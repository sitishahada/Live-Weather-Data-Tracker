import { useState, useEffect } from "react";

const API_BASE_URL = "http://127.0.0.1:8000"; // Adjust if your backend is running on a different host

const CityFilter = ({ onCityChange }: { onCityChange: (city: string) => void }) => {
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");

  // Fetch the list of cities from FastAPI
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cities`)
      .then((response) => response.json())
      .then((data) => setCities(data))
      .catch((error) => console.error("Error fetching cities:", error));
  }, []);

  const handleCityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = event.target.value;
    setSelectedCity(selected);
    onCityChange(selected); // Pass the selected city to the parent component
  };

  return (
    <div className="p-4">
      <label htmlFor="city-select" className="block mb-2 font-semibold">Select City:</label>
      <select
        id="city-select"
        value={selectedCity}
        onChange={handleCityChange}
        className="p-2 border rounded-md"
      >
        <option value="">-- Select a city --</option>
        {cities.map((city, index) => (
          <option key={index} value={city}>{city}</option>
        ))}
      </select>
    </div>
  );
};

export default CityFilter;
