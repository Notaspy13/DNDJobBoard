// ==========================================
// 1. FIREBASE CONFIGURATION
// Replace the values below with your Firebase Project Settings
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCJHO9goSgvt5vvU2ZAzhSfCaMgiU0mco0",
  authDomain: "dndjobboard.firebaseapp.com",
  databaseURL: "https://dndjobboard-default-rtdb.firebaseio.com",
  projectId: "dndjobboard",
  storageBucket: "dndjobboard.firebasestorage.app",
  messagingSenderId: "588749545106",
  appId: "1:588749545106:web:4ca3f6fedfceb089a6d04b",
  measurementId: "G-6GT5X4K6BB"
};


// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const jobsRef = database.ref('jobs');

// State Variables
let currentCharacter = "Arendale";
let jobsData = [];
let isDmMode = false;

// ==========================================
// 2. CHARACTER & ROLE MANAGEMENT
// ==========================================
function initCharacter() {
    const savedChar = localStorage.getItem('sable_harbour_char');
    const select = document.getElementById('char-select');

    if (savedChar) {
        if (![...select.options].some(opt => opt.value === savedChar)) {
            const newOpt = new Option(savedChar, savedChar);
            select.add(newOpt, select.options[select.options.length - 1]);
        }
        currentCharacter = savedChar;
        select.value = savedChar;
    } else {
        currentCharacter = select.value;
    }
}

function switchCharacter(val) {
    if (val === "NEW") {
        const customName = prompt("Enter your character name:");
        if (customName && customName.trim() !== "") {
            const cleanName = customName.trim();
            const select = document.getElementById('char-select');
            
            const newOpt = new Option(cleanName, cleanName);
            select.add(newOpt, select.options[select.options.length - 1]);
            select.value = cleanName;
            currentCharacter = cleanName;
            localStorage.setItem('sable_harbour_char', cleanName);
        } else {
            document.getElementById('char-select').value = currentCharacter;
            return;
        }
    } else {
        currentCharacter = val;
        localStorage.setItem('sable_harbour_char', val);
    }
    renderBoard();
}

function toggleDmMode() {
    isDmMode = !isDmMode;
    const dmForm = document.getElementById('dm-add-job-panel');
    if (dmForm) {
        dmForm.style.display = isDmMode ? 'block' : 'none';
    }
    renderBoard();
}

// ==========================================
// 3. REALTIME DATA LISTENER & SEEDING
// ==========================================
function listenToDatabase() {
    initCharacter();

    jobsRef.on('value', async (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // Convert Firebase object map to Array
            jobsData = Array.isArray(data) ? data : Object.values(data);
        } else {
            // First run: Seed Firebase from jobs.json if cloud is empty
            try {
                const res = await fetch('jobs.json');
                const initialJobs = await res.json();
                jobsRef.set(initialJobs);
                jobsData = initialJobs;
            } catch (err) {
                console.error("Error loading initial jobs.json:", err);
                jobsData = [];
            }
        }
        renderBoard();
    });
}

// ==========================================
// 4. VOTING ENGINE
// ==========================================
function getScore(votes = {}) {
    let score = 0;
    Object.values(votes).forEach(v => {
        if (v === 'Y') score += 2;
        if (v === 'M') score += 1;
        if (v === 'N') score -= 1;
    });
    return score;
}

// Get or prompt for group passcode
function getGroupPasscode() {
    let passcode = localStorage.getItem('sable_harbour_passcode');
    if (!passcode) {
        passcode = prompt("Enter your group's table passcode:");
        if (passcode) {
            localStorage.setItem('sable_harbour_passcode', passcode.trim());
        }
    }
    return passcode ? passcode.trim() : "";
}

// Helper to get or prompt for passcode
function getGroupPasscode() {
    let passcode = localStorage.getItem('sable_harbour_passcode');
    if (!passcode) {
        passcode = prompt("Enter your table's passcode:");
        if (passcode) {
            passcode = passcode.trim();
            localStorage.setItem('sable_harbour_passcode', passcode);
        }
    }
    return passcode || "";
}

// Fixed Voting Function
function castVote(jobId, voteType) {
    const passcode = getGroupPasscode();
    if (!passcode) {
        alert("A valid passcode is required to submit votes.");
        return;
    }

    // Find array index in Firebase data
    const jobIndex = jobsData.findIndex(j => j && j.id === jobId);
    if (jobIndex === -1) return;

    if (voteType === 'CLEAR') {
        database.ref(`jobs/${jobIndex}/votes/${currentCharacter}`).remove();
    } else {
        // Set the vote AND write passcode to pass Firebase rules validation
        database.ref(`jobs/${jobIndex}/votes/${currentCharacter}`).set(voteType);
        database.ref(`jobs/${jobIndex}/passcode`).set(passcode);
    }
}

// Fixed DM Quest Creation Function
function createNewJob() {
    const passcode = getGroupPasscode();
    if (!passcode) {
        alert("Passcode required.");
        return;
    }

    const title = document.getElementById('new-job-title').value.trim();
    const offeredBy = document.getElementById('new-job-offered').value.trim();
    const reward = document.getElementById('new-job-reward').value.trim();
    const description = document.getElementById('new-job-desc').value.trim();

    if (!title || !offeredBy) {
        alert("Please provide a Job Title and Offered By field.");
        return;
    }

    // Determine highest current ID
    const validJobs = jobsData.filter(j => j && j.id !== undefined);
    const newId = validJobs.length > 0 ? Math.max(...validJobs.map(j => j.id)) + 1 : 1;
    const newIndex = jobsData.length;

    const newJob = {
        id: newId,
        title: title,
        offeredBy: offeredBy,
        reward: reward || "Unspecified",
        description: description || "No description provided.",
        status: "AVAILABLE",
        partyNotes: "",
        dmNotes: "",
        passcode: passcode, // Passcode required for rule validation
        votes: {}
    };

    database.ref(`jobs/${newIndex}`).set(newJob)
        .then(() => {
            document.getElementById('new-job-title').value = '';
            document.getElementById('new-job-offered').value = '';
            document.getElementById('new-job-reward').value = '';
            document.getElementById('new-job-desc').value = '';
        })
        .catch((err) => {
            alert("Permission denied! Incorrect passcode.");
            localStorage.removeItem('sable_harbour_passcode'); // reset saved passcode on error
        });
}

// Fixed DM Delete Function
function deleteJob(jobId) {
    const passcode = getGroupPasscode();
    const jobIndex = jobsData.findIndex(j => j && j.id === jobId);
    if (jobIndex === -1) return;

    if (confirm(`Are you sure you want to delete Quest #${jobId}?`)) {
        // Ensure passcode exists on node prior to removal
        database.ref(`jobs/${jobIndex}/passcode`).set(passcode).then(() => {
            database.ref(`jobs/${jobIndex}`).remove();
        });
    }
}

function updateJobStatus(jobId, newStatus) {
    database.ref(`jobs/${jobId}/status`).set(newStatus);
}

// ==========================================
// 6. BOARD RENDERING
// ==========================================
function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;
    
    container.innerHTML = '';

    // Filter out deleted/empty array slots and sort by vote score
    const validJobs = jobsData.filter(j => j && j.id !== undefined);
    validJobs.sort((a, b) => getScore(b.votes) - getScore(a.votes));

    validJobs.forEach(job => {
        const score = getScore(job.votes);
        const consensusHtml = getConsensusBadge(score);
        
        let badgesHtml = '';
        if (job.votes) {
            Object.entries(job.votes).forEach(([char, vote]) => {
                const label = vote === 'Y' ? 'YES' : vote === 'M' ? 'MAYBE' : 'NO';
                badgesHtml += `<span class="badge badge-${vote}">${char}: ${label}</span>`;
            });
        }

        const card = document.createElement('div');
        card.className = `job-card ${job.status ? job.status.toLowerCase() : ''}`;
        card.innerHTML = `
            <div>
                <div class="job-header">
                    <div>
                        <h3>#${job.id} ${job.title}</h3>
                        ${consensusHtml}
                    </div>
                    <span class="reward">${job.reward}</span>
                </div>
                <p><strong>Offered By:</strong> ${job.offeredBy}</p>
                <p>${job.description}</p>
                ${job.partyNotes ? `<p><strong>Party Notes:</strong> <em>${job.partyNotes}</em></p>` : ''}
                
                <div class="vote-summary">
                    <strong>Party Votes (Tally: ${score}):</strong><br>
                    ${badgesHtml || '<em>No votes recorded</em>'}
                </div>
            </div>

            <!-- Player Action Buttons -->
            <div class="vote-actions">
                <button class="btn-yes" onclick="castVote(${job.id}, 'Y')">AYE</button>
                <button class="btn-maybe" onclick="castVote(${job.id}, 'M')">PERHAPS</button>
                <button class="btn-no" onclick="castVote(${job.id}, 'N')">NAY</button>
                <button class="btn-clear" onclick="castVote(${job.id}, 'CLEAR')">ABSTAIN</button>
            </div>

            <!-- DM Controls (Visible when DM Mode is active) -->
            ${isDmMode ? `
                <div class="dm-card-controls">
                    <hr>
                    <label>Status:</label>
                    <select onchange="updateJobStatus(${job.id}, this.value)">
                        <option value="AVAILABLE" ${job.status === 'AVAILABLE' ? 'selected' : ''}>AVAILABLE</option>
                        <option value="IN PROGRESS" ${job.status === 'IN PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
                        <option value="COMPLETED" ${job.status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
                    </select>
                    <button class="btn-delete" onclick="deleteJob(${job.id})">Delete Quest</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

let currentFilter = 'ALL';

function setFilter(filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    renderBoard();
}

function getConsensusBadge(score) {
    if (score >= 8) return '<span class="consensus-badge unanimous">UNANIMOUS DECREE</span>';
    if (score >= 6) return '<span class="consensus-badge accepted">PARTY ACCEPTED</span>';
    if (score >= 1) return '<span class="consensus-badge considering">UNDER DELIBERATION</span>';
    return '<span class="consensus-badge pending">UNCONSIDERED</span>';
}


// Start live sync
listenToDatabase();