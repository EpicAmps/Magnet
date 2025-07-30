// Samsung Family Hub compatibility fixes
'use strict';

// Variables
let eventSource = null;
let lastUpdate = 0;
let fridgeId = null;
let fridgeName = null;
let lastSSEMessage = Date.now();
let isSSEWorking = false;
let pollingInterval = null;
let lastManualCheck = 0;

// Multi-note support
let allNotes = [];
let currentNoteIndex = 0;

// Get fridge ID from URL parameter or localStorage
const urlParams = new URLSearchParams(window.location.search);
fridgeId = urlParams.get('id') || getFromPath() || localStorage.getItem('fridgeId');
fridgeName = localStorage.getItem('fridgeName');

// Helper functions
function getFromPath() {
    // Extract ID from paths like /fridge/abc123
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'fridge') {
        return pathParts[2];
    }
    return null;
}

let lastPollingCheck = 0;
let nextPollingIn = 120; // 2 minutes in seconds
let countdownInterval = null;

// Update display with fridge info
if (fridgeId && fridgeName) {
    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('fridgeIdInfo').textContent = fridgeId;
        document.getElementById('fridgeEmailInfo').textContent = 'incoming.magnet+' + fridgeName + '@gmail.com';
    });
} else {
    // Redirect to setup if no fridge info
    window.location.href = '/setup.html';
}

function toggleInfo() {
    const popup = document.getElementById('infoPopup');
    popup.classList.toggle('show');
}

// Countdown and status functions
function updateCountdown() {
    const now = Date.now();
    const timeSinceLastCheck = Math.floor((now - lastPollingCheck) / 1000);
    const timeUntilNext = Math.max(0, 120 - timeSinceLastCheck);
    
    if (timeUntilNext > 0) {
        const minutes = Math.floor(timeUntilNext / 60);
        const seconds = timeUntilNext % 60;
        document.getElementById('countdown').textContent = 
            ' • Next check in ' + minutes + ':' + seconds.toString().padStart(2, '0');
    } else {
        document.getElementById('countdown').textContent = ' • Checking now...';
    }
}

function startCountdown() {
    lastPollingCheck = Date.now();
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown();
}

const API_BASE = window.location.origin;

function updateConnectionStatus(connected, method) {
    method = method || '';
    // Update status text instead of separate indicator
    if (connected) {
        document.getElementById('statusText').textContent = '✅ Connected and ready';
    } else {
        document.getElementById('statusText').textContent = '🔄 Connecting...';
    }
}

function connectToNotifications() {
    if (eventSource) {
        eventSource.close();
    }
    
    // Connect to fridge-specific ping endpoint
    eventSource = new EventSource(API_BASE + '/api/ping?fridgeId=' + fridgeId);
    
    eventSource.onopen = function() {
        console.log('Connected to notification service for fridge:', fridgeId);
        isSSEWorking = true;
        lastSSEMessage = Date.now();
        updateConnectionStatus(true);
        document.getElementById('statusText').textContent = '✅ Real-time updates active';
    };
    
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('Received SSE notification:', data);
        
        // Update SSE health tracking
        isSSEWorking = true;
        lastSSEMessage = Date.now();
        
        if (data.type === 'note_updated') {
            document.getElementById('statusText').textContent = '📧 New note received instantly!';
            fetchNote();
        } else if (data.type === 'connected') {
            document.getElementById('statusText').textContent = '✅ Real-time updates active';
        }
    };
    
    eventSource.onerror = function(error) {
        console.error('SSE Error:', error);
        isSSEWorking = false;
        updateConnectionStatus(false);
        document.getElementById('statusText').textContent = '🔄 Using backup checking';
        
        // Retry SSE connection in 10 seconds
        setTimeout(connectToNotifications, 10000);
    };
}

function startPollingBackup() {
    // Poll every 2 minutes as backup
    pollingInterval = setInterval(function() {
        const timeSinceLastSSE = Date.now() - lastSSEMessage;
        const timeSinceLastManualCheck = Date.now() - lastManualCheck;
        
        // Only poll if:
        // 1. SSE hasn't worked in the last 3 minutes, AND
        // 2. We haven't manually checked in the last minute
        if (timeSinceLastSSE > 180000 && timeSinceLastManualCheck > 60000) {
            console.log('SSE down, polling for updates...');
            fetchNoteViaPolling();
        }
    }, 120000); // Check every 2 minutes
}

function fetchNoteViaPolling() {
    fetch(API_BASE + '/api/note?fridgeId=' + fridgeId)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.timestamp > lastUpdate) {
                console.log('Found new note via polling!');
                document.getElementById('statusText').textContent = '📧 New note found!';
                updateNoteDisplay(data);
            } else {
                // No new notes, but polling is working - show connected
                updateConnectionStatus(true);
                document.getElementById('statusText').textContent = '✅ Up to date';
            }
            
            startCountdown(); // Reset countdown
            lastManualCheck = Date.now();
        })
        .catch(function(error) {
            console.error('Polling error:', error);
            updateConnectionStatus(false);
        });
}

function fetchNote() {
    fetch(API_BASE + '/api/note?fridgeId=' + fridgeId)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            // Handle multiple notes or single note response
            if (Array.isArray(data)) {
                allNotes = data.sort(function(a, b) { return b.timestamp - a.timestamp; }); // Sort newest first
                currentNoteIndex = 0; // Start with newest note
                updateNoteDisplay(allNotes[currentNoteIndex]);
                updatePagination();
            } else {
                // Single note response (backward compatibility)
                allNotes = data.content ? [data] : [];
                currentNoteIndex = 0;
                updateNoteDisplay(data);
                updatePagination();
            }
            
            // Show that manual refresh worked
            updateConnectionStatus(true);
            lastManualCheck = Date.now();
        })
        .catch(function(error) {
            console.error('Error fetching note:', error);
            document.getElementById('noteContent').innerHTML = 
                '<div class="empty-state">❌ Connection error<br><br>Check your network and try refreshing</div>';
            document.getElementById('statusText').textContent = '❌ Connection error';
            updateConnectionStatus(false);
        });
}

function updateNoteDisplay(data) {
    if (!data || (!data.content && !data.timestamp)) {
        document.getElementById('noteContent').innerHTML = 
            '<div class="empty-state">📱 Waiting for your first note...<br><br>Send a note using "Shortcuts" → "Coolio Quickie"!</div>';
        document.getElementById('statusText').textContent = '⏳ No notes yet';
        document.getElementById('pagination').style.display = 'none';
        return;
    }
    
    if (data.timestamp > lastUpdate || true) { // Always update when navigating
        const content = data.content || 'No content received';
        
        // Show better status messages
        if (content.includes('No notes yet')) {
            document.getElementById('noteContent').innerHTML = 
                '<div class="empty-state">📱 Waiting for your first note...<br><br>Send a note using "Shortcuts" → "Coolio Quickie"!</div>';
            document.getElementById('statusText').textContent = '⏳ No notes yet';
        } else if (content.includes('Error loading')) {
            document.getElementById('noteContent').innerHTML = 
                '<div class="empty-state">❌ Error loading note<br><br>Try refreshing or send a new note</div>';
            document.getElementById('statusText').textContent = '❌ Error loading note';
        } else {
            // Display HTML content (from markdown) or plain text
            let displayContent = content;
            
            // Remove iOS Shortcut attribution if present
            displayContent = displayContent.replace(/— iOS Shortcut$/gim, '');
            displayContent = displayContent.replace(/- iOS Shortcut$/gim, '');
            displayContent = displayContent.replace(/<p[^>]*>— iOS Shortcut<\/p>/gi, '');
            displayContent = displayContent.replace(/<p[^>]*>- iOS Shortcut<\/p>/gi, '');
            displayContent = displayContent.replace(/<div[^>]*class="sender-attribution"[^>]*>.*?<\/div>/gi, '');
            
            if (displayContent.includes('<') && displayContent.includes('>')) {
                // Content contains HTML (from markdown processing)
                document.getElementById('noteContent').innerHTML = displayContent;
            } else {
                // Plain text content
                document.getElementById('noteContent').innerHTML = displayContent.replace(/\n/g, '<br>');
            }
            
            // Update status based on current note
            const noteNumber = allNotes.length > 1 ? ' (' + (currentNoteIndex + 1) + '/' + allNotes.length + ')' : '';
            document.getElementById('statusText').textContent = '📧 Note from ' + (data.sender || 'someone') + noteNumber;
        }
        
        document.getElementById('timestamp').textContent = 
            'Last updated: ' + new Date(data.timestamp).toLocaleString();
        lastUpdate = Math.max(lastUpdate, data.timestamp);
    }
}

// Pagination functions
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (allNotes.length <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    pageInfo.textContent = (currentNoteIndex + 1) + ' of ' + allNotes.length;
    
    prevBtn.disabled = currentNoteIndex === 0;
    nextBtn.disabled = currentNoteIndex === allNotes.length - 1;
}

function previousNote() {
    if (currentNoteIndex > 0) {
        currentNoteIndex--;
        updateNoteDisplay(allNotes[currentNoteIndex]);
        updatePagination();
    }
}

function nextNote() {
    if (currentNoteIndex < allNotes.length - 1) {
        currentNoteIndex++;
        updateNoteDisplay(allNotes[currentNoteIndex]);
        updatePagination();
    }
}

function deleteNote() {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    updateConnectionStatus(true);
    document.getElementById('statusText').textContent = '🗑️ Deleting note...';
    
    // Send delete request to API for current note
    const currentNote = allNotes[currentNoteIndex];
    fetch(API_BASE + '/api/note', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fridgeId: fridgeId,
            noteId: currentNote.id || currentNote.timestamp // Use ID or timestamp
        })
    })
    .then(function(response) {
        if (response.ok) {
            // Remove note from local array
            allNotes.splice(currentNoteIndex, 1);
            
            // Adjust current index if needed
            if (currentNoteIndex >= allNotes.length && allNotes.length > 0) {
                currentNoteIndex = allNotes.length - 1;
            }
            
            if (allNotes.length > 0) {
                // Show remaining note
                updateNoteDisplay(allNotes[currentNoteIndex]);
                updatePagination();
                document.getElementById('statusText').textContent = '✅ Note deleted successfully!';
            } else {
                // No notes left
                document.getElementById('noteContent').innerHTML = 
                    '<div class="empty-state">📱 Note deleted!<br><br>Send a new email to see it here!</div>';
                document.getElementById('pagination').style.display = 'none';
                document.getElementById('statusText').textContent = '✅ All notes deleted!';
                lastUpdate = 0;
            }
            
            document.getElementById('timestamp').textContent = 
                'Deleted: ' + new Date().toLocaleString();
            
        } else {
            throw new Error('Failed to delete note');
        }
    })
    .catch(function(error) {
        console.error('Error deleting note:', error);
        document.getElementById('statusText').textContent = '❌ Error deleting note. Try again.';
    });
}

function goToSetup() {
    window.location.href = '/setup.html';
}

// Make entire task list rows clickable
function setupTaskListInteraction() {
    // Use event delegation to handle dynamically added content
    document.getElementById('noteContent').addEventListener('click', function(event) {
        const listItem = event.target.closest('li');
        
        // Only handle list items that contain checkboxes
        if (listItem && listItem.querySelector('input[type="checkbox"]')) {
            const checkbox = listItem.querySelector('input[type="checkbox"]');
            
            // Don't double-toggle if user clicked directly on checkbox
            if (event.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
            }
            
            // Add visual feedback
            listItem.style.backgroundColor = checkbox.checked ? 
                'rgba(46, 204, 113, 0.2)' :  // Green tint when checked
                '';  // Remove background when unchecked
            
            // Check if all checkboxes are now completed
            setTimeout(checkForCompletion, 100); // Small delay to ensure DOM updates
        }
    });
    
    // Also check when checkboxes are directly clicked
    document.getElementById('noteContent').addEventListener('change', function(event) {
        if (event.target.type === 'checkbox') {
            setTimeout(checkForCompletion, 100);
        }
    });
}

// Check if all tasks are completed and trigger celebration
function checkForCompletion() {
    const allCheckboxes = document.querySelectorAll('#noteContent input[type="checkbox"]');
    
    if (allCheckboxes.length === 0) return; // No checkboxes to check
    
    const checkedBoxes = document.querySelectorAll('#noteContent input[type="checkbox"]:checked');
    
    // If all checkboxes are checked, celebrate!
    if (allCheckboxes.length === checkedBoxes.length && allCheckboxes.length > 0) {
        triggerCelebration();
    }
}

// Trigger the celebration animation and sound
function triggerCelebration() {
    const overlay = document.getElementById('celebrationOverlay');
    
    // Show celebration overlay
    overlay.classList.add('show');
    
    // Play Ta-da sound
    playTadaSound();
    
    // Hide overlay after animation
    setTimeout(function() {
        overlay.classList.remove('show');
    }, 2000);
}

// Play Ta-da sound effect
function playTadaSound() {
    try {
        // Create audio context for better browser support
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a simple "Ta-da!" sound using Web Audio API
        const createTone = function(frequency, duration, startTime, volume) {
            volume = volume || 0.3;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, startTime);
            gainNode.gain.setValueAtTime(volume, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        };
        
        const now = audioContext.currentTime;
        
        // Ta-da! melody (C5 - E5 - G5 - C6) - triumphant ascending notes
        createTone(523.25, 0.2, now, 0.2);      // C5
        createTone(659.25, 0.2, now + 0.15, 0.25); // E5
        createTone(783.99, 0.3, now + 0.3, 0.3);   // G5
        createTone(1046.5, 0.6, now + 0.45, 0.35); // C6 (triumphant finish)
        
    } catch (error) {
        console.log('Could not play celebration sound:', error);
        // Fallback: try HTML5 audio with a data URL beep
        try {
            const audio = new Audio();
            audio.volume = 0.3;
            // Simple success beep sequence
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjiR1/LNeSsFJHfH8N2QQ
