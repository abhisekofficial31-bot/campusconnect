let selectedEvent = "";

/* =========================
   MODAL FUNCTIONS
========================= */

function openModal(eventName) {
    selectedEvent = eventName;
    document.getElementById("eventTitle").innerText = eventName;
    document.getElementById("registrationModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("registrationModal").style.display = "none";
}

/* =========================
   SUBMIT REGISTRATION
========================= */

function submitRegistration() {

    let name = document.getElementById("studentName").value.trim();
    let email = document.getElementById("studentEmail").value.trim();
    let branch = document.getElementById("branch").value;
    let year = document.getElementById("year").value;

    if (!name || !email || !branch || !year) {
        alert("Please fill all fields!");
        return;
    }

    let registrations = JSON.parse(localStorage.getItem("registrations")) || [];

    // Prevent duplicate registration
    let alreadyRegistered = registrations.some(r =>
        r.email === email && r.event === selectedEvent
    );

    if (alreadyRegistered) {
        alert("You have already registered for this event!");
        return;
    }

    registrations.push({
        name: name,
        email: email,
        branch: branch,
        year: year,
        event: selectedEvent,
        date: new Date().toLocaleDateString()
    });

    localStorage.setItem("registrations", JSON.stringify(registrations));

    alert("Registration Successful!");

    closeModal();

    // Clear form
    document.getElementById("studentName").value = "";
    document.getElementById("studentEmail").value = "";
    document.getElementById("branch").value = "";
    document.getElementById("year").value = "";
}


/* =========================
   MY REGISTRATIONS PAGE
========================= */

function findEvents() {

    let email = document.getElementById("emailInput").value.trim();
    let stored = JSON.parse(localStorage.getItem("registrations")) || [];

    let resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    let userEvents = stored.filter(item => item.email === email);

    if (userEvents.length === 0) {
        resultsDiv.innerHTML = "<p>No registrations found.</p>";
        return;
    }

    userEvents.forEach(item => {
        let eventDiv = document.createElement("div");
        eventDiv.innerHTML = `
            <div class="result-card">
                <h4>${item.event}</h4>
                <p>Name: ${item.name}</p>
                <p>Branch: ${item.branch}</p>
                <p>Year: ${item.year}</p>
                <p>Date: ${item.date}</p>
            </div>
        `;
        resultsDiv.appendChild(eventDiv);
    });
}


/* =========================
   ADMIN DASHBOARD
========================= */

function loadAdminData() {

    let registrations = JSON.parse(localStorage.getItem("registrations")) || [];

    let total = registrations.length;

    let events = [...new Set(registrations.map(r => r.event))];
    let students = [...new Set(registrations.map(r => r.email))];

    if (document.getElementById("totalReg"))
        document.getElementById("totalReg").innerText = total;

    if (document.getElementById("activeEvents"))
        document.getElementById("activeEvents").innerText = events.length;

    if (document.getElementById("uniqueStudents"))
        document.getElementById("uniqueStudents").innerText = students.length;

    if (document.getElementById("avgEvent"))
        document.getElementById("avgEvent").innerText =
            events.length ? Math.round(total / events.length) : 0;

    let tbody = document.querySelector("#registrationTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    registrations.forEach(r => {
        let row = `
            <tr>
                <td>${r.name}</td>
                <td>${r.email}</td>
                <td>${r.branch}</td>
                <td>${r.year}</td>
                <td>${r.event}</td>
                <td>${r.date}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}


/* =========================
   TABLE SEARCH FILTER
========================= */

function filterTable() {

    let input = document.getElementById("searchInput").value.toLowerCase();
    let rows = document.querySelectorAll("#registrationTable tbody tr");

    rows.forEach(row => {
        let text = row.innerText.toLowerCase();
        row.style.display = text.includes(input) ? "" : "none";
    });
}

