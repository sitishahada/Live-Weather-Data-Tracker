from flask import Flask, request, jsonify
from flask_socketio import SocketIO
import psycopg2
from psycopg2 import pool
import requests
import time
from flask_cors import CORS
from fastapi import FastAPI
from psycopg2.extras import RealDictCursor
import os

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app, resources={r"/*": {"origins": "*"}})  # ✅ Allows all requests, including DELETE

print(app.url_map) 

# PostgreSQL connection pool
DB_POOL = pool.SimpleConnectionPool(
    1, 10,  # Min 1, Max 10 connections
    dbname="weather_db",
    user="postgres",
    password="admin",
    host="localhost",
    port="5432",
    cursor_factory=RealDictCursor  # ✅ Return rows as dictionaries
)

# OpenWeather API details
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("API_KEY")
CITIES = ["Shah Alam, MY", "Kuala Lumpur, MY", "Singapore, SG"]

# Get a database connection from the pool
def get_db_connection():
    return DB_POOL.getconn()

# Release connection back to the pool
def release_db_connection(conn):
    DB_POOL.putconn(conn)

# Fetch live weather data
def fetch_weather(city):
    url = f"https://api.weatherapi.com/v1/current.json?key={API_KEY}&q={city}"
    response = requests.get(url)
    
    if response.status_code == 200:
        data = response.json()
        return {
            "city": city,
            "humidity": data["current"]["humidity"],
            "cloud": data["current"]["cloud"],
            "wind_speed": data["current"]["wind_kph"],
        }
    
    return None

# Fetch all weather data from PostgreSQL
@app.route('/weather', methods=['GET'])
def get_weather():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM weather3 ORDER BY id DESC;")
        rows = cur.fetchall()
        weather_list = [
            {
                "id": row[0],
                "city": row[1],
                "humidity": row[2],
                "cloud": row[3],
                "wind_speed": row[4],
            }
            for row in rows
        ]
        return jsonify(weather_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        release_db_connection(conn)

# Add weather data to PostgreSQL
@app.route('/add', methods=['POST'])
def add_weather():
    weather = fetch_weather()
    if not weather:
        return jsonify({"error": "Failed to fetch weather data"}), 500

    conn = get_db_connection()
    cur = conn.cursor()
    weather_entries = []
    try:
      for city in CITIES:
        weather = fetch_weather(city)
        if weather:  
            cur.execute(
                """
                INSERT INTO weather3 (city, humidity, cloud, wind_speed) 
                VALUES (%s, %s, %s, %s) RETURNING id;
                """,
                (weather["city"], weather["humidity"], weather["cloud"], weather["wind_speed"]),
            )
            conn.commit()
            weather_id = cur.fetchone()

        if weather_id:
            weather_id = weather_id[0]
            weather_entries.append({"id": weather_id, **weather})

        for weather in weather_entries:    
            socketio.emit("weather_update", {"id": weather_id, **weather})
            return jsonify({"message": "Weather data added", "id": weather_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        release_db_connection(conn)

# Delete weather data from PostgreSQL
@app.route('/delete/<int:weather_id>', methods=['DELETE'])
def delete_weather(weather_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM weather3 WHERE id = %s RETURNING id;", (weather_id,))
        conn.commit()
        deleted_id = cur.fetchone()

        if deleted_id:
            socketio.emit("weather_delete", {"id": weather_id})
            return jsonify({"message": "Weather data deleted"})
        return jsonify({"error": "Weather data not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        release_db_connection(conn)  # ✅ Release back to the pool

app = FastAPI()
# API to get distinct cities
@app.get("/api/cities")
def get_cities():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT city FROM weather3 ORDER BY city ASC;")
    cities = cur.fetchall()
    return cities

# Background task for periodic weather updates
# Periodically fetch and update weather data
def update_weather_periodically():
    while True:
        conn = get_db_connection()
        cur = conn.cursor()
        
        for city in CITIES:
            weather = fetch_weather(city)
            if weather:
                cur.execute(
                    """
                    INSERT INTO weather3 (city, humidity, cloud, wind_speed) 
                    VALUES (%s, %s, %s, %s) RETURNING id;
                    """,
                    (weather["city"], weather["humidity"], weather["cloud"], weather["wind_speed"]),
                )
                conn.commit()
                weather_id = cur.fetchone()
                
                if weather_id:
                    weather_id = weather_id[0]
                    socketio.emit("weather_update", {"id": weather_id, **weather})

        cur.close()
        conn.close()

        time.sleep(600)  # Update every 60 seconds


if __name__ == '__main__':
    socketio.start_background_task(update_weather_periodically)
    socketio.run(app, debug=True)