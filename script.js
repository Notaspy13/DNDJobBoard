let currentCharacter = "Arendale";
let jobsData = [];

// Load stored character choice or default to Arendale
function initCharacter() {
    const savedChar = localStorage.getItem('sable_harbour_char');
    const select = document.getElementById('char-select');

    if (savedChar) {
        // If it's a custom character not in default list, add it to dropdown
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

// Fetch jobs and render
async function loadJobs() {
    initCharacter();
    
    // Check if we have saved voting state locally, otherwise load JSON
    const localJobs = localStorage.getItem('sable_harbour_jobs');
    if (localJobs) {
        jobsData = JSON.parse(localJobs);
    } else {
        const res = await fetch('jobs.json');
        jobsData = await res.json();
    }
    renderBoard();
}

function castVote(jobId, voteType) {
    const job = jobsData.find(j => j.id === jobId);
    if (!job) return;

    if (!job.votes) job.votes = {};

    if (voteType === 'CLEAR') {
        delete job.votes[currentCharacter];
    } else {
        job.votes[currentCharacter] = voteType;
    }

    // Save state to local browser memory
    localStorage.setItem('sable_harbour_jobs', JSON.stringify(jobsData));
    renderBoard();
}

function getScore(votes = {}) {
    let score = 0;
    Object.values(votes).forEach(v => {
        if (v === 'Y') score += 2;
        if (v === 'M') score += 1;
        if (v === 'N') score -= 1;
    });
    return score;
}

function renderBoard() {
    const container = document.getElementById('board-container');
    container.innerHTML = '';

    // Sort by calculated score (highest priority first)
    jobsData.sort((a, b) => getScore(b.votes) - getScore(a.votes));

    jobsData.forEach(job => {
        const score = getScore(job.votes);
        
        // Render badges for all player votes
        let badgesHtml = '';
        if (job.votes) {
            Object.entries(job.votes).forEach(([char, vote]) => {
                const label = vote === 'Y' ? 'YES' : vote === 'M' ? 'MAYBE' : 'NO';
                badgesHtml += `<span class="badge badge-${vote}">${char}: ${label}</span>`;
            });
        }

        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <div>
                <div class="job-header">
                    <h3>#${job.id} ${job.title}</h3>
                    <span class="reward">${job.reward}</span>
                </div>
                <p><strong>Offered By:</strong> ${job.offeredBy}</p>
                <p>${job.description}</p>
                
                <div class="vote-summary">
                    <strong>Votes (Score: ${score}):</strong><br>
                    ${badgesHtml || '<em>No votes yet</em>'}
                </div>
            </div>

            <div class="vote-actions">
                <button class="btn-yes" onclick="castVote(${job.id}, 'Y')">YES</button>
                <button class="btn-maybe" onclick="castVote(${job.id}, 'M')">MAYBE</button>
                <button class="btn-no" onclick="castVote(${job.id}, 'N')">NO</button>
                <button class="btn-clear" onclick="castVote(${job.id}, 'CLEAR')">Clear</button>
            </div>
        `;
        container.appendChild(card);
    });
}

loadJobs();