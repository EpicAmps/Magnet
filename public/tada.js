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

// Multi-note support - NEW APPROACH
var allNotes = [];
var currentPage = 0;
var notesPerPage = 5;

// Get fridge ID from URL parameter or localStorage
var urlParams = new URLSearchParams(window.location.search);
fridgeId = urlParams.get('id') || getFromPath() || localStorage.getItem('fridgeId');
fridgeName = localStorage.getItem('fridgeName');

console.log('tada.js loaded successfully');

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
            displayNotes(data); // Use new displayNotes function
            updateConnectionStatus(true);
            document.getElementById('statusText').textContent = '✅ Up to date';
            startCountdown();
            lastManualCheck = Date.now();
        })
        .catch(function(error) {
            console.error('Polling error:', error);
            updateConnectionStatus(false);
        });
}

function fetchNote() {
    startCountdown(); 
    fetch(API_BASE + '/api/note?fridgeId=' + fridgeId)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            displayNotes(data); // Use new displayNotes function
            updateConnectionStatus(true);
            lastManualCheck = Date.now();
        })
        .catch(function(error) {
            console.error('Error fetching note:', error);
            var notesContainer = document.getElementById('notesContainer');
            notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">❌ Connection error<br><br>Check your network and try refreshing</div></div>';
            document.getElementById('statusText').textContent = '❌ Connection error';
            updateConnectionStatus(false);
        });
}

// NEW: Multiple notes display function
function displayNotes(notesData) {
    var notesContainer = document.getElementById('notesContainer');
    var paginationDiv = document.getElementById('pagination');
    
    // Handle both old format (single note) and new format (multiple notes)
    if (notesData.notes && Array.isArray(notesData.notes)) {
        allNotes = notesData.notes;
    } else if (notesData.content) {
        allNotes = [notesData]; // Convert old format
    } else {
        allNotes = [];
    }
    
    if (allNotes.length === 0) {
        notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">📱 No notes yet. Send your first note from iPhone!</div></div>';
        paginationDiv.style.display = 'none';
        document.getElementById('statusText').textContent = '⏳ No notes yet';
        return;
    }
    
    renderCurrentPage();
    updatePagination();
    
    // Update status
    var totalNotes = allNotes.length;
    var latestNote = allNotes[0];
    document.getElementById('statusText').textContent = '📧 ' + totalNotes + ' note' + (totalNotes > 1 ? 's' : '') + 
        ' from ' + (latestNote.sender || 'someone');
    
    // Update timestamp
    document.getElementById('timestamp').textContent = 
        'Last updated: ' + new Date(latestNote.timestamp).toLocaleString();
    lastUpdate = Math.max(lastUpdate, latestNote.timestamp);
}

function renderCurrentPage() {
    var notesContainer = document.getElementById('notesContainer');
    var startIndex = currentPage * notesPerPage;
    var endIndex = startIndex + notesPerPage;
    var currentNotes = allNotes.slice(startIndex, endIndex);
    
    if (currentNotes.length === 1 && allNotes.length === 1) {
        // Single note - use full-width display
        var note = currentNotes[0];
        var content = formatNoteContent(note.content);
        notesContainer.innerHTML = '<div class="note-content">' + content + '</div>';
    } else {
        // Multiple notes - use card layout
        var html = '';
        for (var i = 0; i < currentNotes.length; i++) {
            var note = currentNotes[i];
            html += '<div class="note-item">' +
                '<div class="note-meta">' +
                '<span class="note-sender">' + (note.sender || note.source || 'Unknown') + '</span>' +
                '<span class="note-time">' + formatTime(note.timestamp) + '</span>' +
                '</div>' +
                '<div class="note-item-content">' + formatNoteContent(note.content) + '</div>' +
                '</div>';
        }
        notesContainer.innerHTML = html;
    }
}

function updatePagination() {
    var paginationDiv = document.getElementById('pagination');
    var pageInfo = document.getElementById('pageInfo');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    
    var totalPages = Math.ceil(allNotes.length / notesPerPage);
    
    if (totalPages <= 1) {
        paginationDiv.style.display = 'none';
        return;
    }
    
    paginationDiv.style.display = 'flex';
    pageInfo.textContent = (currentPage + 1) + ' of ' + totalPages;
    
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
}

function changePage(direction) {
    var totalPages = Math.ceil(allNotes.length / notesPerPage);
    var newPage = currentPage + direction;
    
    if (newPage >= 0 && newPage < totalPages) {
        currentPage = newPage;
        renderCurrentPage();
        updatePagination();
    }
}

function formatTime(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var diffMs = now - date;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    
    return date.toLocaleDateString();
}

function formatNoteContent(content) {
    if (!content) return 'Empty note';
    
    var displayContent = content;
    
    // Remove iOS Shortcut attribution if present
    displayContent = displayContent.replace(/— iOS Shortcut$/gim, '');
    displayContent = displayContent.replace(/- iOS Shortcut$/gim, '');
    displayContent = displayContent.replace(/<p[^>]*>— iOS Shortcut<\/p>/gi, '');
    displayContent = displayContent.replace(/<p[^>]*>- iOS Shortcut<\/p>/gi, '');
    displayContent = displayContent.replace(/<div[^>]*class="sender-attribution"[^>]*>.*?<\/div>/gi, '');
    
    // Handle HTML content (from markdown)
    if (displayContent.includes('<') && displayContent.includes('>')) {
        return displayContent;
    }
    
    // Handle plain text - convert line breaks to HTML
    return displayContent.replace(/\n/g, '<br>');
}

// Backward compatibility functions
function previousNote() {
    changePage(-1);
}

function nextNote() {
    changePage(1);
}

function deleteNote() {
    if (!confirm('Are you sure you want to delete all notes?')) {
        return;
    }
    
    updateConnectionStatus(true);
    document.getElementById('statusText').textContent = '🗑️ Deleting notes...';
    
    fetch(API_BASE + '/api/note', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fridgeId: fridgeId
        })
    })
    .then(function(response) {
        if (response.ok) {
            allNotes = [];
            currentPage = 0;
            var notesContainer = document.getElementById('notesContainer');
            notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">📱 Notes deleted!<br><br>Send a new note to see it here!</div></div>';
            document.getElementById('pagination').style.display = 'none';
            document.getElementById('statusText').textContent = '✅ All notes deleted!';
            document.getElementById('timestamp').textContent = 'Deleted: ' + new Date().toLocaleString();
            lastUpdate = 0;
        } else {
            throw new Error('Failed to delete notes');
        }
    })
    .catch(function(error) {
        console.error('Error deleting notes:', error);
        document.getElementById('statusText').textContent = '❌ Error deleting notes. Try again.';
    });
}

function goToSetup() {
    window.location.href = '/setup.html';
}

// Simple task list interaction
function setupTaskListInteraction() {
    document.getElementById('notesContainer').addEventListener('click', function(event) {
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
