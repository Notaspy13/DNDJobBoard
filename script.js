// Helper to prompt for group passcode
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

// Calculate total vote score
function getScore(votes = {}) {
    let score = 0;
    Object.values(votes).forEach(v => {
        if (v === 'Y') score += 2;
        if (v === 'M') score += 1;
        if (v === 'N') score -= 1;
    });
    return score;
}

// Get Consensus Badge text
function getConsensusBadge(score) {
    if (score >= 8) return '<span class="consensus-badge unanimous">UNANIMOUS DECREE</span>';
    if (score >= 6) return '<span class="consensus-badge accepted">PARTY ACCEPTED</span>';
    if (score >= 1) return '<span class="consensus-badge considering">UNDER DELIBERATION</span>';
    return '<span class="consensus-badge pending">UNCONSIDERED</span>';
}

// Cast Vote and sync to Firebase
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

// Update Job Status (DM Control)
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

// Edit / Add Party Notes (Players & DM)
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

// Delete Quest (DM Control)
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

// Render Board with Priority Sorting (IN PROGRESS -> AVAILABLE -> COMPLETED)
function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;
    
    container.innerHTML = '';

    const validJobs = jobsData.filter(j => j && j.id !== undefined);

    // SORTING PRIORITY:
    // 1. IN PROGRESS (Top)
    // 2. AVAILABLE (Middle, sorted by vote score)
    // 3. COMPLETED (Bottom)
    validJobs.sort((a, b) => {
        const statusWeight = { "IN PROGRESS": 1, "AVAILABLE": 2, "COMPLETED": 3 };
        const weightA = statusWeight[a.status] || 2;
        const weightB = statusWeight[b.status] || 2;

        if (weightA !== weightB) {
            return weightA - weightB; // Status order
        }
        return getScore(b.votes) - getScore(a.votes); // Vote score tie-breaker
    });

    validJobs.forEach(job => {
        const score = getScore(job.votes);
        const status = job.status || 'AVAILABLE';
        
        // Vote Badges
        let badgesHtml = '';
        if (job.votes) {
            Object.entries(job.votes).forEach(([char, vote]) => {
                const label = vote === 'Y' ? 'AYE' : vote === 'M' ? 'PERHAPS' : 'NAY';
                badgesHtml += `<span class="badge badge-${vote}">${char}: ${label}</span>`;
            });
        }

        // Status Ribbon
        let statusRibbon = '';
        if (status === 'IN PROGRESS') {
            statusRibbon = '<span class="status-banner in-progress-banner">⚡ IN PROGRESS</span>';
        } else if (status === 'COMPLETED') {
            statusRibbon = '<span class="status-banner completed-banner">✓ COMPLETED</span>';
        } else {
            statusRibbon = getConsensusBadge(score);
        }

        const card = document.createElement('div');
        // Convert status string to CSS class name
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
                
                <!-- Party Notes Section -->
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

            <!-- Player Action Buttons -->
            ${status !== 'COMPLETED' ? `
                <div class="vote-actions">
                    <button class="btn-yes" onclick="castVote(${job.id}, 'Y')">AYE</button>
                    <button class="btn-maybe" onclick="castVote(${job.id}, 'M')">PERHAPS</button>
                    <button class="btn-no" onclick="castVote(${job.id}, 'N')">NAY</button>
                    <button class="btn-clear" onclick="castVote(${job.id}, 'CLEAR')">ABSTAIN</button>
                </div>
            ` : '<div class="completed-notice">Contract Settled & Archived</div>'}

            <!-- DM Controls -->
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
// FIREBASE LIVE DATABASE LISTENER
// ==========================================

// Point explicitly to the 'jobs' folder in Firebase
const jobsRef = database.ref('jobs');

function listenToDatabase() {
    initCharacter();

    // Listen directly to the 'jobs' node for live updates
    jobsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // Convert Firebase object map or array to a clean list
            jobsData = Array.isArray(data) ? data : Object.values(data);
        } else {
            jobsData = [];
        }
        
        renderBoard();
    });
}

// Start live updates as soon as script loads
listenToDatabase();