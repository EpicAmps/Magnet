// Simple Samsung Family Hub compatible JavaScript
'use strict';

// Variables
var eventSource = null;
var lastUpdate = 0;
var fridgeId = null;
var fridgeName = null;
var lastSSEMessage = Date.now();
var isSSEWorking = false;
var pollingInterval = null;
var lastManualCheck = 0;

// Multi-note support
var allNotes = [];
var currentNoteIndex = 0;

// Get fridge ID from URL parameter or localStorage
var urlParams = new URLSearchParams(window.location.search);
fridgeId = urlParams.get('id') || getFromPath() || localStorage.getItem('fridgeId');
fridgeName = localStorage.getItem('fridgeName');

function getFromPath() {
    var pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'fridge') {
        return pathParts[2];
    }
    return null;
}

var lastPollingCheck = 0;
var countdownInterval = null;

// Update display with fridge info
if (fridgeId && fridgeName) {
    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('fridgeIdInfo').textContent = fridgeId;
        document.getElementById('fridgeEmailInfo').textContent = 'incoming.magnet+' + fridgeName + '@gmail.com';
    });
} else {
    window.location.href = '/setup.html';
}

function toggleInfo() {
    var popup = document.getElementById('infoPopup');
    if (popup.classList.contains('show')) {
        popup.classList.remove('show');
    } else {
        popup.classList.add('show');
    }
}

function updateCountdown() {
    var now = Date.now();
    var timeSinceLastCheck = Math.floor((now - lastPollingCheck) / 1000);
    var timeUntilNext = Math.max(0, 120 - timeSinceLastCheck);
    
    if (timeUntilNext > 0) {
        var minutes = Math.floor(timeUntilNext / 60);
        var seconds = timeUntilNext % 60;
        var paddedSeconds = seconds < 10 ? '0' + seconds : seconds;
        document.getElementById('countdown').textContent = ' • Next check in ' + minutes + ':' + paddedSeconds;
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

var API_BASE = window.location.origin;

function updateConnectionStatus(connected) {
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
    
    eventSource = new EventSource(API_BASE + '/api/ping?fridgeId=' + fridgeId);
    
    eventSource.onopen = function() {
        console.log('Connected to notification service for fridge:', fridgeId);
        isSSEWorking = true;
        lastSSEMessage = Date.now();
        updateConnectionStatus(true);
        document.getElementById('statusText').textContent = '✅ Real-time updates active';
    };
    
    eventSource.onmessage = function(event) {
        var data = JSON.parse(event.data);
        console.log('Received SSE notification:', data);
        
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
        setTimeout(connectToNotifications, 10000);
    };
}

function startPollingBackup() {
    pollingInterval = setInterval(function() {
        var timeSinceLastSSE = Date.now() - lastSSEMessage;
        var timeSinceLastManualCheck = Date.now() - lastManualCheck;
        
        if (timeSinceLastSSE > 180000 && timeSinceLastManualCheck > 60000) {
            console.log('SSE down, polling for updates...');
            fetchNoteViaPolling();
        }
    }, 120000);
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
                updateConnectionStatus(true);
                document.getElementById('statusText').textContent = '✅ Up to date';
            }
            
            startCountdown();
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
                allNotes = data.sort(function(a, b) { return b.timestamp - a.timestamp; });
                currentNoteIndex = 0;
                updateNoteDisplay(allNotes[currentNoteIndex]);
                updatePagination();
            } else {
                allNotes = data.content ? [data] : [];
                currentNoteIndex = 0;
                updateNoteDisplay(data);
                updatePagination();
            }
            
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
    
    if (data.timestamp > lastUpdate || true) {
        var content = data.content || 'No content received';
        
        if (content.includes('No notes yet')) {
            document.getElementById('noteContent').innerHTML = 
                '<div class="empty-state">📱 Waiting for your first note...<br><br>Send a note using "Shortcuts" → "Coolio Quickie"!</div>';
            document.getElementById('statusText').textContent = '⏳ No notes yet';
        } else if (content.includes('Error loading')) {
            document.getElementById('noteContent').innerHTML = 
                '<div class="empty-state">❌ Error loading note<br><br>Try refreshing or send a new note</div>';
            document.getElementById('statusText').textContent = '❌ Error loading note';
        } else {
            var displayContent = content;
            
            // Remove iOS Shortcut attribution if present
            displayContent = displayContent.replace(/— iOS Shortcut$/gim, '');
            displayContent = displayContent.replace(/- iOS Shortcut$/gim, '');
            displayContent = displayContent.replace(/<p[^>]*>— iOS Shortcut<\/p>/gi, '');
            displayContent = displayContent.replace(/<p[^>]*>- iOS Shortcut<\/p>/gi, '');
            displayContent = displayContent.replace(/<div[^>]*class="sender-attribution"[^>]*>.*?<\/div>/gi, '');
            
            if (displayContent.includes('<') && displayContent.includes('>')) {
                document.getElementById('noteContent').innerHTML = displayContent;
            } else {
                document.getElementById('noteContent').innerHTML = displayContent.replace(/\n/g, '<br>');
            }
            
            var noteNumber = allNotes.length > 1 ? ' (' + (currentNoteIndex + 1) + '/' + allNotes.length + ')' : '';
            document.getElementById('statusText').textContent = '📧 Note from ' + (data.sender || 'someone') + noteNumber;
        }
        
        document.getElementById('timestamp').textContent = 
            'Last updated: ' + new Date(data.timestamp).toLocaleString();
        lastUpdate = Math.max(lastUpdate, data.timestamp);
    }
}

// Pagination functions
function updatePagination() {
    var pagination = document.getElementById('pagination');
    var pageInfo = document.getElementById('pageInfo');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    
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
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    updateConnectionStatus(true);
    document.getElementById('statusText').textContent = '🗑️ Deleting note...';
    
    var currentNote = allNotes[currentNoteIndex];
    fetch(API_BASE + '/api/note', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fridgeId: fridgeId,
            noteId: currentNote.id || currentNote.timestamp
        })
    })
    .then(function(response) {
        if (response.ok) {
            allNotes.splice(currentNoteIndex, 1);
            
            if (currentNoteIndex >= allNotes.length && allNotes.length > 0) {
                currentNoteIndex = allNotes.length - 1;
            }
            
            if (allNotes.length > 0) {
                updateNoteDisplay(allNotes[currentNoteIndex]);
                updatePagination();
                document.getElementById('statusText').textContent = '✅ Note deleted successfully!';
            } else {
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

// Simple task list interaction (no celebration)
function setupTaskListInteraction() {
    document.getElementById('noteContent').addEventListener('click', function(event) {
        var listItem = event.target.closest('li');
        
        if (listItem && listItem.querySelector('input[type="checkbox"]')) {
            var checkbox = listItem.querySelector('input[type="checkbox"]');
            
            if (event.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
            }
            
            listItem.style.backgroundColor = checkbox.checked ? 
                'rgba(46, 204, 113, 0.2)' : '';
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    if (fridgeId) {
        console.log('Starting notification system...');
        connectToNotifications();
        startPollingBackup();
        fetchNote();
        setupTaskListInteraction();
        startCountdown();
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (eventSource) {
        eventSource.close();
    }
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});
