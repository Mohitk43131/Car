// Initialize page data on load
document.addEventListener('DOMContentLoaded', () => {
    populateYears();
    loadSchedule();
});

function populateYears() {
    const yearSelect = document.getElementById('year');
    const currentYear = new Date().getFullYear(); // Will automatically pick up 2026 and beyond
    
    // FastF1 reliably supports data from 2018 onwards
    for (let y = currentYear; y >= 2018; y--) {
        let option = document.createElement('option');
        option.value = y;
        option.text = y;
        yearSelect.appendChild(option);
    }
}

async function loadSchedule() {
    const year = document.getElementById('year').value;
    const raceSelect = document.getElementById('race');
    
    raceSelect.innerHTML = '<option>Loading...</option>';
    raceSelect.disabled = true;

    try {
        const response = await fetch(`/api/schedule/${year}`);
        const data = await response.json();

        if (response.ok) {
            raceSelect.innerHTML = '';
            data.races.forEach(race => {
                let option = document.createElement('option');
                option.value = race;
                option.text = race;
                raceSelect.appendChild(option);
            });
            raceSelect.disabled = false;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        raceSelect.innerHTML = '<option>Error loading schedule</option>';
        console.error(error);
    }
}

async function loadSession() {
    const btn = document.getElementById('loadBtn');
    const statusMsg = document.getElementById('statusMsg');
    
    const year = document.getElementById('year').value;
    const race = document.getElementById('race').value;
    const sessionType = document.getElementById('sessionType').value;

    btn.disabled = true;
    btn.innerText = "Processing...";
    statusMsg.innerText = "Downloading and mapping data. This might take a minute the first time...";
    statusMsg.style.color = "var(--text-secondary)";

    try {
        const response = await fetch('/api/load_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, race, session: sessionType })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            statusMsg.innerText = data.message;
            statusMsg.style.color = "#4caf50";
            
            // Show dashboard and set title
            document.getElementById('dashboardContent').style.display = 'flex';
            document.getElementById('dashboardTitle').innerText = `${year} ${race} - ${sessionType}`;
            
            fetchResults();
            loadTrackMap();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        statusMsg.innerText = "Error: " + error.message;
        statusMsg.style.color = "var(--f1-red)";
    } finally {
        btn.disabled = false;
        btn.innerText = "Load Session Data";
    }
}

async function fetchResults() {
    const response = await fetch('/api/results');
    const data = await response.json();

    document.getElementById('flDriver').innerText = data.fastest_lap.driver;
    document.getElementById('flTime').innerText = data.fastest_lap.lap_time;
    document.getElementById('flLap').innerText = "Lap " + data.fastest_lap.lap_number;

    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = ''; 
    data.results.slice(0, 5).forEach(row => { // Showing top 5 to keep the layout clean
        tbody.innerHTML += `
            <tr>
                <td>${row.Position}</td>
                <td><strong>${row.BroadcastName}</strong></td>
                <td>${row.TeamName}</td>
                <td>${row.GridPosition}</td>
            </tr>
        `;
    });
}

async function loadTelemetry() {
    const driver1 = document.getElementById('driver1').value.toUpperCase();
    const driver2 = document.getElementById('driver2').value.toUpperCase();

    const response = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver1, driver2 })
    });
    
    const figData = await response.json();
    
    // Customize Plotly dark layout dynamically
    figData.layout.paper_bgcolor = 'rgba(0,0,0,0)';
    figData.layout.plot_bgcolor = 'rgba(0,0,0,0)';
    figData.layout.font = { color: '#8b92a5', family: 'Inter' };
    
    Plotly.newPlot('telemetryChart', figData.data, figData.layout);
}

async function loadTrackMap() {
    const response = await fetch('/api/track_map');
    const figData = await response.json();
    
    figData.layout.paper_bgcolor = 'rgba(0,0,0,0)';
    figData.layout.plot_bgcolor = 'rgba(0,0,0,0)';
    figData.layout.font = { color: '#8b92a5', family: 'Inter' };

    Plotly.newPlot('trackMapChart', figData.data, figData.layout);
}

function exportCSV() {
    let csv = [];
    const rows = document.querySelectorAll("table tr");
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) row.push(cols[j].innerText);
        csv.push(row.join(","));
    }
    
    const csvFile = new Blob([csv.join("\n")], {type: "text/csv"});
    const downloadLink = document.createElement("a");
    downloadLink.download = "f1_results.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
}
