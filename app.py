import os
import json
from flask import Flask, render_template, request, jsonify
import fastf1
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder

app = Flask(__name__)

# Enable FastF1 Caching
CACHE_DIR = 'f1_cache'
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# Global variable to hold the currently loaded session in memory
current_session = None

@app.route('/')
def index():
    """Renders the main dashboard interface."""
    return render_template('index.html')

@app.route('/api/load_session', methods=['POST'])
def load_session():
    """Loads the FastF1 session based on user input."""
    global current_session
    data = request.json
    year = int(data.get('year'))
    race = data.get('race')
    session_type = data.get('session')

    try:
        current_session = fastf1.get_session(year, race, session_type)
        current_session.load()
        return jsonify({"status": "success", "message": f"Loaded {year} {race} {session_type}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/results', methods=['GET'])
def get_results():
    """Returns race results and fastest lap data."""
    global current_session
    if not current_session:
        return jsonify({"error": "No session loaded"}), 400

    try:
        # Results Table
        results = current_session.results[['Position', 'BroadcastName', 'TeamName', 'GridPosition', 'Time']].copy()
        results['Time'] = results['Time'].astype(str).str.split('.').str[0] # Clean timedelta formatting
        results.fillna("N/A", inplace=True)
        
        # Fastest Lap
        fastest_lap = current_session.laps.pick_fastest()
        fastest_data = {
            "driver": fastest_lap['Driver'],
            "lap_time": str(fastest_lap['LapTime']).split('.')[0][7:], # Format to M:SS
            "lap_number": int(fastest_lap['LapNumber'])
        }

        return jsonify({
            "results": results.to_dict(orient='records'),
            "fastest_lap": fastest_data
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/telemetry', methods=['POST'])
def get_telemetry():
    """Generates a Plotly JSON graph for driver telemetry comparison."""
    global current_session
    if not current_session:
        return jsonify({"error": "No session loaded"}), 400

    data = request.json
    driver1 = data.get('driver1')
    driver2 = data.get('driver2')

    try:
        lap1 = current_session.laps.pick_driver(driver1).pick_fastest()
        lap2 = current_session.laps.pick_driver(driver2).pick_fastest()
        
        tel1 = lap1.get_telemetry()
        tel2 = lap2.get_telemetry()

        fig = go.Figure()
        
        # Speed
        fig.add_trace(go.Scatter(x=tel1['Distance'], y=tel1['Speed'], name=f"{driver1} Speed", line=dict(color='blue')))
        fig.add_trace(go.Scatter(x=tel2['Distance'], y=tel2['Speed'], name=f"{driver2} Speed", line=dict(color='red')))

        fig.update_layout(title=f"Telemetry Comparison: {driver1} vs {driver2}",
                          xaxis_title="Distance (m)", yaxis_title="Speed (km/h)",
                          template="plotly_dark")

        return json.dumps(fig, cls=PlotlyJSONEncoder)
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/track_map', methods=['GET'])
def get_track_map():
    """Generates a Plotly JSON graph for the track layout colored by speed."""
    global current_session
    if not current_session:
        return jsonify({"error": "No session loaded"}), 400

    try:
        # Get fastest lap of the session for track mapping
        lap = current_session.laps.pick_fastest()
        tel = lap.get_telemetry()

        fig = px.scatter(tel, x='X', y='Y', color='Speed', 
                         color_continuous_scale='Plasma', 
                         title=f"Track Speed Map - {current_session.event['EventName']}")
        
        # Ensure track proportions are correct and hide axis lines
        fig.update_yaxes(scaleanchor="x", scaleratio=1, showgrid=False, zeroline=False, visible=False)
        fig.update_xaxes(showgrid=False, zeroline=False, visible=False)
        fig.update_layout(template="plotly_dark")

        return json.dumps(fig, cls=PlotlyJSONEncoder)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        # Add this route to your existing app.py

@app.route('/api/schedule/<int:year>', methods=['GET'])
def get_schedule(year):
    """Fetches the official race calendar for a given year."""
    try:
        schedule = fastf1.get_event_schedule(year)
        # Filter out pre-season testing to only show actual race events
        races = schedule[schedule['EventFormat'] != 'testing']['EventName'].tolist()
        return jsonify({"status": "success", "races": races})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400




if __name__ == '__main__':
    app.run(debug=True)
