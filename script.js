// ==========================================
// 1. FIREBASE CONFIGURATION
// Replace these placeholders with your actual Firebase config keys!
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
let currentFilter = 'ALL';

// ==========================================
// 2. CHARACTER & PASSCODE HELPERS
// ==========================================
function initCharacter() {
    const savedChar = localStorage.getItem('sable_harbour_char');
    const select = document.getElementById('char-select');

    if (savedChar && select) {
        if (![...select.options].some(opt => opt.value === savedChar)) {
            const newOpt = new Option(savedChar, savedChar);
            select.add(newOpt, select.options[select.options.length - 1]);
        }
        currentCharacter = savedChar;
        select.value = savedChar;
    } else if (select) {
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

function toggleDmMode() {
    isDmMode = !isDmMode;
    const dmForm = document.getElementById('dm-add-job-panel');
    if (dmForm) {
        dmForm.style.display = isDmMode ? 'block' : 'none';
    }
    renderBoard();
}

// ==========================================
// 3. SCORING & CONSENSUS
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

function getConsensusBadge(score) {
    if (score >= 8) return '<span class="consensus-badge unanimous">UNANIMOUS DECREE</span>';
    if (score >= 6) return '<span class="consensus-badge accepted">PARTY ACCEPTED</span>';
    if (score >= 1) return '<span class="consensus-badge considering">UNDER DELIBERATION</span>';
    return '<span class="consensus-badge pending">UNCONSIDERED</span>';
}

function setFilter(filterType, event) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    renderBoard();
}

// ==========================================
// 4. FIREBASE ACTIONS (VOTE, STATUS, NOTES)
// ==========================================
function castVote(jobId, voteType) {
    const passcode = getGroupPasscode();
    if (!passcode) return;

    const jobIndex = jobsData.findIndex(j => j && j.id === jobId);
    if (jobIndex === -1) return;

    if (voteType === 'CLEAR') {
        database.ref(`jobs/${jobIndex}/votes/${currentCharacter}`).remove();
    } else {
        const updates = {};
        updates[`jobs/${jobIndex}/votes/${currentCharacter}`] = voteType;
        updates[`jobs/${jobIndex}/passcode`] = passcode;
        database.ref().update(updates);
    }
}

function updateJobStatus(jobId, newStatus) {
    const passcode = getGroupPasscode();
    if (!passcode) return;

    const jobIndex = jobsData.findIndex(j => j && j.id === jobId);
    if (jobIndex === -1) return;

    const updates = {};
    updates[`jobs/${jobIndex}/status`] = newStatus;
    updates[`jobs/${jobIndex}/passcode`] = passcode;

    database.ref().update(updates).catch(() => {
        alert("Permission denied! Incorrect passcode.");
    });
}

function editPartyNotes(jobId) {
    const passcode = getGroupPasscode();
    if (!passcode) return;

    const jobIndex = jobsData.findIndex(j => j && j.id === jobId);
    if (jobIndex === -1) return;

    const currentNotes = jobsData[jobIndex].partyNotes || "";
    const newNotes = prompt("Update Party / Quest Notes:", currentNotes);

    if (newNotes !== null) {
        const updates = {};
        updates[`jobs/${jobIndex}/partyNotes`] = newNotes.trim();
        updates[`jobs/${jobIndex}/passcode`] = passcode;

        database.ref().update(updates).catch(() => {
            alert("Permission denied! Incorrect passcode.");
        });
    }
}

function deleteJob(jobId) {
    const passcode = getGroupPasscode();
    if (!passcode) return;

    const jobIndex = jobsData.findIndex(j => j && j.id === jobId);
    if (jobIndex === -1) return;

    if (confirm(`Are you sure you want to delete Quest #${jobId}?`)) {
        database.ref(`jobs/${jobIndex}/passcode`).set(passcode).then(() => {
            database.ref(`jobs/${jobIndex}`).remove();
        });
    }
}

// ==========================================
// 5. BOARD RENDERING ENGINE
// ==========================================
function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;
    
    container.innerHTML = '';

    // Safety filter to prevent null/empty index crashes
    let validJobs = jobsData.filter(j => j && typeof j === 'object' && j.id !== undefined);

    // Apply Filter Bar Rules
    if (currentFilter === 'ACCEPTED') {
        validJobs = validJobs.filter(j => getScore(j.votes) >= 6);
    } else if (currentFilter === 'AVAILABLE') {
        validJobs = validJobs.filter(j => (!j.status || j.status === 'AVAILABLE'));
    } else if (currentFilter === 'UNVOTED') {
        validJobs = validJobs.filter(j => !j.votes || !j.votes[currentCharacter]);
    }

    // Sort: IN PROGRESS -> AVAILABLE (by score) -> COMPLETED
    validJobs.sort((a, b) => {
        const statusWeight = { "IN PROGRESS": 1, "AVAILABLE": 2, "COMPLETED": 3 };
        const weightA = statusWeight[a.status] || 2;
        const weightB = statusWeight[b.status] || 2;

        if (weightA !== weightB) {
            return weightA - weightB;
        }
        return getScore(b.votes) - getScore(a.votes);
    });

    validJobs.forEach(job => {
        const score = getScore(job.votes);
        const status = job.status || 'AVAILABLE';
        
        let badgesHtml = '';
        if (job.votes) {
            Object.entries(job.votes).forEach(([char, vote]) => {
                const label = vote === 'Y' ? 'AYE' : vote === 'M' ? 'PERHAPS' : 'NAY';
                badgesHtml += `<span class="badge badge-${vote}">${char}: ${label}</span>`;
            });
        }

        let statusRibbon = '';
        if (status === 'IN PROGRESS') {
            statusRibbon = '<span class="status-banner in-progress-banner">⚡ IN PROGRESS</span>';
        } else if (status === 'COMPLETED') {
            statusRibbon = '<span class="status-banner completed-banner">✓ COMPLETED</span>';
        } else {
            statusRibbon = getConsensusBadge(score);
        }

        const card = document.createElement('div');
        const statusClass = status.toLowerCase().replace(/\s+/g, '-');
        card.className = `job-card ${statusClass}`;

        card.innerHTML = `
            <div>
                <div class="job-header">
                    <div>
                        <h3>#${job.id} ${job.title}</h3>
                        ${statusRibbon}
                    </div>
                    <span class="reward">${job.reward}</span>
                </div>
                <p><strong>Offered By:</strong> ${job.offeredBy}</p>
                <p>${job.description}</p>
                
                <div class="party-notes-box">
                    <strong>Party Notes:</strong>
                    <p class="notes-text">${job.partyNotes ? job.partyNotes : '<em>No notes recorded yet.</em>'}</p>
                    <button class="btn-notes" onclick="editPartyNotes(${job.id})">✏️ Edit Notes</button>
                </div>

                <div class="vote-summary">
                    <strong>Party Votes (Tally: ${score}):</strong><br>
                    ${badgesHtml || '<em>No votes recorded</em>'}
                </div>
            </div>

            ${status !== 'COMPLETED' ? `
                <div class="vote-actions">
                    <button class="btn-yes" onclick="castVote(${job.id}, 'Y')">AYE</button>
                    <button class="btn-maybe" onclick="castVote(${job.id}, 'M')">PERHAPS</button>
                    <button class="btn-no" onclick="castVote(${job.id}, 'N')">NAY</button>
                    <button class="btn-clear" onclick="castVote(${job.id}, 'CLEAR')">ABSTAIN</button>
                </div>
            ` : '<div class="completed-notice">Contract Settled & Archived</div>'}

            ${isDmMode ? `
                <div class="dm-card-controls">
                    <label><strong>Status:</strong></label>
                    <select onchange="updateJobStatus(${job.id}, this.value)">
                        <option value="AVAILABLE" ${status === 'AVAILABLE' ? 'selected' : ''}>AVAILABLE</option>
                        <option value="IN PROGRESS" ${status === 'IN PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
                        <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
                    </select>
                    <button class="btn-delete" onclick="deleteJob(${job.id})">Delete</button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 6. REALTIME DATABASE LISTENER (AUTO-RUN)
// ==========================================
function listenToDatabase() {
    initCharacter();

    jobsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            jobsData = Array.isArray(data) ? data : Object.values(data);
        } else {
            jobsData = [];
        }
        
        renderBoard();
    });
}

// Start listener on script load
listenToDatabase();