let currentProjectId = null;

async function createIdea() {
    const content = document.getElementById('ideaContent').value.trim();
    if (!content) {
        alert('Please enter an idea');
        return;
    }
    
    const btn = document.getElementById('createIdeaBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    try {
        const response = await fetch('/api/ideas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        currentProjectId = data.projectId;
        
        document.getElementById('projectSection').classList.remove('hidden');
        document.getElementById('artifactsSection').classList.remove('hidden');
        document.getElementById('reportSection').classList.remove('hidden');
        
        updateProjectStatus();
        
        // Show trigger buttons based on stage
        if (data.state === 'Idea' || !data.stage || data.stage === 'Idea') {
            document.getElementById('triggerFeasibilityBtn').classList.remove('hidden');
        } else {
            document.getElementById('triggerFeasibilityBtn').classList.add('hidden');
        }
        
        // Show planning button if stage is FeasibilityComplete
        if (data.stage === 'FeasibilityComplete') {
            document.getElementById('triggerPlanningBtn').classList.remove('hidden');
        } else {
            document.getElementById('triggerPlanningBtn').classList.add('hidden');
        }
        
        // Show execution button if stage is PlanningComplete
        if (data.stage === 'PlanningComplete') {
            document.getElementById('startExecutionBtn').classList.remove('hidden');
        } else {
            document.getElementById('startExecutionBtn').classList.add('hidden');
        }
        
        btn.disabled = false;
        btn.textContent = 'Create Idea';
    } catch (error) {
        console.error('Error creating idea:', error);
        alert('Error creating idea: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Create Idea';
    }
}

async function startExecution() {
    if (!currentProjectId) {
        alert('No project selected');
        return;
    }
    
    const btn = document.getElementById('startExecutionBtn');
    btn.disabled = true;
    btn.textContent = 'Starting...';
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}/execution/start`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Execution started:', data);
        
        // Poll for status updates
        pollProjectStatus();
        
        btn.disabled = false;
        btn.textContent = 'Start Execution';
    } catch (error) {
        console.error('Error starting execution:', error);
        alert('Error starting execution: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Start Execution';
    }
}

async function triggerPlanning() {
    if (!currentProjectId) {
        alert('No project selected');
        return;
    }
    
    const btn = document.getElementById('triggerPlanningBtn');
    btn.disabled = true;
    btn.textContent = 'Triggering...';
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}/planning`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Planning triggered:', data);
        
        // Poll for status updates
        pollProjectStatus();
        
        btn.disabled = false;
        btn.textContent = 'Trigger Planning';
    } catch (error) {
        console.error('Error triggering planning:', error);
        alert('Error triggering planning: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Trigger Planning';
    }
}

async function triggerFeasibility() {
    if (!currentProjectId) {
        alert('No project selected');
        return;
    }
    
    const btn = document.getElementById('triggerFeasibilityBtn');
    btn.disabled = true;
    btn.textContent = 'Triggering...';
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}/feasibility`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Feasibility triggered:', data);
        
        // Poll for status updates
        pollProjectStatus();
        
        btn.disabled = false;
        btn.textContent = 'Trigger Feasibility Analysis';
    } catch (error) {
        console.error('Error triggering feasibility:', error);
        alert('Error triggering feasibility: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Trigger Feasibility Analysis';
    }
}

async function updateProjectStatus() {
    if (!currentProjectId) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const project = await response.json();
        
        const statusDiv = document.getElementById('projectStatus');
        let statusClass = 'status';
        
        if (project.state === 'Approved') {
            statusClass += ' approved';
        } else if (project.state === 'Error') {
            statusClass += ' error';
        }
        
        let html = `<div class="${statusClass}">`;
        html += `<strong>State:</strong> ${project.state}<br>`;
        html += `<strong>Stage:</strong> ${project.stage || 'Idea'}<br>`;
        html += `<strong>Project ID:</strong> ${project.id}<br>`;
        
        if (project.decision) {
            html += `<br><strong>Decision:</strong> ${project.decision.outcome}<br>`;
            if (project.decision.rationale) {
                html += `<strong>Rationale:</strong> ${project.decision.rationale}`;
            }
        }
        
        html += `</div>`;
        statusDiv.innerHTML = html;
        
        // Update trigger buttons based on stage
        if (project.stage === 'Idea' || !project.stage) {
            document.getElementById('triggerFeasibilityBtn').classList.remove('hidden');
        } else {
            document.getElementById('triggerFeasibilityBtn').classList.add('hidden');
        }
        
        if (project.stage === 'FeasibilityComplete') {
            document.getElementById('triggerPlanningBtn').classList.remove('hidden');
        } else {
            document.getElementById('triggerPlanningBtn').classList.add('hidden');
        }
        
        if (project.stage === 'PlanningComplete') {
            document.getElementById('startExecutionBtn').classList.remove('hidden');
        } else {
            document.getElementById('startExecutionBtn').classList.add('hidden');
        }
        
        // Update artifacts
        updateArtifacts();
    } catch (error) {
        console.error('Error updating project status:', error);
    }
}

async function updateArtifacts() {
    if (!currentProjectId) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}/artifacts`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const artifactsDiv = document.getElementById('artifactsList');
        
        if (data.artifacts.length === 0) {
            artifactsDiv.innerHTML = '<p>No artifacts yet</p>';
            return;
        }
        
        let html = '';
        data.artifacts.forEach(artifact => {
            html += `<div class="artifact">`;
            html += `<h3>${artifact.name}</h3>`;
            if (artifact.content) {
                html += `<pre>${JSON.stringify(artifact.content, null, 2)}</pre>`;
            }
            if (artifact.uri) {
                html += `<p><strong>URI:</strong> ${artifact.uri}</p>`;
            }
            html += `</div>`;
        });
        
        artifactsDiv.innerHTML = html;
    } catch (error) {
        console.error('Error updating artifacts:', error);
    }
}

async function viewReport() {
    if (!currentProjectId) {
        alert('No project selected');
        return;
    }
    
    const btn = document.getElementById('viewReportBtn');
    const reportDiv = document.getElementById('reportContent');
    
    btn.disabled = true;
    btn.textContent = 'Loading...';
    reportDiv.classList.remove('hidden');
    reportDiv.textContent = 'Loading report...';
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}/report`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const reportText = await response.text();
        reportDiv.textContent = reportText;
        
        btn.disabled = false;
        btn.textContent = 'View Report';
    } catch (error) {
        console.error('Error loading report:', error);
        reportDiv.textContent = 'Error loading report: ' + error.message;
        btn.disabled = false;
        btn.textContent = 'View Report';
    }
}

function pollProjectStatus() {
    const interval = setInterval(() => {
        updateProjectStatus();
        
        // Stop polling if project is in terminal state
        fetch(`/api/projects/${currentProjectId}`)
            .then(res => res.json())
            .then(project => {
                if (['ExecutionComplete'].includes(project.stage)) {
                    clearInterval(interval);
                }
            })
            .catch(err => {
                console.error('Error polling:', err);
                clearInterval(interval);
            });
    }, 2000);
    
    // Stop polling after 30 seconds
    setTimeout(() => clearInterval(interval), 30000);
}

