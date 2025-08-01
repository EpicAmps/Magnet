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

// Celebration state tracking
var celebrationInProgress = false;

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
        // Single note - use full-width display with delete button
        var note = currentNotes[0];
        var content = formatNoteContent(note.content);
        var deleteBtn = '<button class="individual-delete-btn" onclick="deleteIndividualNote(0, \'' + 
            (note.id || note.timestamp) + '\')" title="Delete this note">×</button>';
        
        notesContainer.innerHTML = '<div class="note-content single-note-container">' + 
            deleteBtn + content + '</div>';
    } else {
        // Multiple notes - use card layout with individual delete buttons
        var html = '';
        for (var i = 0; i < currentNotes.length; i++) {
            var note = currentNotes[i];
            var deleteBtn = '<button class="individual-delete-btn" onclick="deleteIndividualNote(' + i + ', \'' + 
                (note.id || note.timestamp) + '\')" title="Delete this note">×</button>';
            
            html += '<div class="note-item">' +
                '<div class="note-meta">' +
                '<span class="note-sender">' + (note.sender || note.source || 'Unknown') + '</span>' +
                '<div class="note-meta-right">' +
                '<span class="note-time">' + formatTime(note.timestamp) + '</span>' +
                deleteBtn +
                '</div>' +
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

// Global delete function (deletes all notes)
function deleteNote() {
    if (!confirm('Are you sure you want to delete ALL notes?')) {
        return;
    }
    
    updateConnectionStatus(true);
    document.getElementById('statusText').textContent = '🗑️ Deleting all notes...';
    
    fetch(API_BASE + '/api/note', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fridgeId: fridgeId,
            deleteAll: true
        })
    })
    .then(function(response) {
        if (response.ok) {
            // Clear ALL frontend state immediately
            allNotes = [];
            currentPage = 0;
            lastUpdate = 0;
            
            // Clear any cached data
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('cachedNotes_' + fridgeId);
                localStorage.removeItem('lastUpdate_' + fridgeId);
            }
            
            // Update UI immediately
            var notesContainer = document.getElementById('notesContainer');
            notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">📱 All notes deleted!<br><br>Send a new note to see it here!</div></div>';
            
            // Hide pagination
            document.getElementById('pagination').style.display = 'none';
            
            // Update status and timestamp
            document.getElementById('statusText').textContent = '✅ All notes deleted!';
            document.getElementById('timestamp').textContent = 'Deleted: ' + new Date().toLocaleString();
            
            // Force a fresh fetch after a short delay to confirm deletion
            setTimeout(function() {
                fetchNote();
            }, 1000);
            
        } else {
            throw new Error('Failed to delete notes: ' + response.status);
        }
    })
    .catch(function(error) {
        console.error('Error deleting notes:', error);
        document.getElementById('statusText').textContent = '❌ Error deleting notes. Try again.';
        
        // Still clear frontend state even if backend fails
        allNotes = [];
        currentPage = 0;
        renderCurrentPage();
        updatePagination();
    });
}

// Individual note delete function
function deleteIndividualNote(noteIndex, noteId) {
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    // Calculate the actual index in the allNotes array
    var actualIndex = (currentPage * notesPerPage) + noteIndex;
    var noteToDelete = allNotes[actualIndex];
    
    if (!noteToDelete) {
        console.error('Note not found at index:', actualIndex);
        return;
    }
    
    document.getElementById('statusText').textContent = '🗑️ Deleting note...';
    
    fetch(API_BASE + '/api/note', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fridgeId: fridgeId,
            noteId: noteId || noteToDelete.id || noteToDelete.timestamp,
            deleteAll: false
        })
    })
    .then(function(response) {
        if (response.ok) {
            // Remove note from frontend array
            allNotes.splice(actualIndex, 1);
            
            // Adjust current page if we deleted the last note on this page
            var totalPages = Math.ceil(allNotes.length / notesPerPage);
            if (currentPage >= totalPages && currentPage > 0) {
                currentPage = totalPages - 1;
            }
            
            // Re-render the current page
            if (allNotes.length === 0) {
                var notesContainer = document.getElementById('notesContainer');
                notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">📱 No notes left!<br><br>Send a new note to see it here!</div></div>';
                document.getElementById('pagination').style.display = 'none';
                document.getElementById('statusText').textContent = '✅ Note deleted!';
            } else {
                renderCurrentPage();
                updatePagination();
                var totalNotes = allNotes.length;
                document.getElementById('statusText').textContent = '✅ Note deleted! ' + totalNotes + ' note' + (totalNotes > 1 ? 's' : '') + ' remaining';
            }
            
        } else {
            throw new Error('Failed to delete note: ' + response.status);
        }
    })
    .catch(function(error) {
        console.error('Error deleting individual note:', error);
        document.getElementById('statusText').textContent = '❌ Error deleting note. Try again.';
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

// Create celebration audio
function createTadaSound() {
    // Create a simple, triumphant "tada" sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    function playTone(frequency, duration, delay = 0) {
        setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        }, delay);
    }
    
    // Play a triumphant sequence: C - E - G - C (major chord arpeggio)
    playTone(523.25, 0.3, 0);    // C5
    playTone(659.25, 0.3, 100);  // E5  
    playTone(783.99, 0.3, 200);  // G5
    playTone(1046.50, 0.5, 300); // C6
}

// Create celebration overlay
function createCelebrationOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'celebration-overlay';
    overlay.innerHTML = `
        <div class="celebration-content">
            <div class="big-checkmark">✓</div>
            <div class="celebration-text">TADA!</div>
            <div class="celebration-subtext">All tasks completed! 🎉</div>
        </div>
        <div class="confetti-container"></div>
    `;
    
    document.body.appendChild(overlay);
    return overlay;
}

// Create confetti particle
function createConfettiPiece() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#6c5ce7', '#fd79a8'];
    const shapes = ['square', 'circle', 'triangle'];
    
    const confetti = document.createElement('div');
    confetti.className = `confetti-piece ${shapes[Math.floor(Math.random() * shapes.length)]}`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
    
    return confetti;
}

// Main celebration function
function triggerCelebration() {
    if (celebrationInProgress) return;
    celebrationInProgress = true;
    
    console.log('🎉 TADA! All tasks completed!');
    
    // Create and show celebration overlay
    const overlay = createCelebrationOverlay();
    
    // Add confetti
    const confettiContainer = overlay.querySelector('.confetti-container');
    for (let i = 0; i < 50; i++) {
        confettiContainer.appendChild(createConfettiPiece());
    }
    
    // Play celebration sound
    try {
        createTadaSound();
    } catch (error) {
        console.log('Audio context not available:', error);
    }
    
    // Animate in
    requestAnimationFrame(() => {
        overlay.classList.add('show');
    });
    
    // Remove after celebration
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            celebrationInProgress = false;
        }, 500);
    }, 3000);
}

// Check if all tasks are completed
function checkTaskCompletion(container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    
    if (checkboxes.length === 0) return false; // No checkboxes
    if (checkboxes.length === 1) return false; // Only one task doesn't warrant celebration
    
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const allCompleted = checkboxes.length === checkedBoxes.length;
    
    if (allCompleted) {
        // Small delay to let the final checkbox animation complete
        setTimeout(triggerCelebration, 300);
        return true;
    }
    
    return false;
}

// Enhanced task list interaction with celebration
function setupTaskListInteraction() {
    document.getElementById('notesContainer').addEventListener('click', function(event) {
        var listItem = event.target.closest('li');
        
        if (listItem && listItem.querySelector('input[type="checkbox"]')) {
            var checkbox = listItem.querySelector('input[type="checkbox"]');
            var wasChecked = checkbox.checked;
            
            if (event.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
            }
            
            // Visual feedback for checked state
            listItem.style.backgroundColor = checkbox.checked ? 
                'rgba(46, 204, 113, 0.2)' : '';
            
            // Add strikethrough for completed tasks
            var textContent = listItem.childNodes;
            for (var i = 0; i < textContent.length; i++) {
                if (textContent[i].nodeType === Node.TEXT_NODE) {
                    textContent[i].parentElement.style.textDecoration = checkbox.checked ? 
                        'line-through' : 'none';
                    textContent[i].parentElement.style.opacity = checkbox.checked ? 
                        '0.7' : '1';
                }
            }
            
            // Check for completion only if we just checked a box (not unchecked)
            if (checkbox.checked && !wasChecked) {
                // Find the parent container (could be note-content or note-item-content)
                var noteContainer = listItem.closest('.note-content, .note-item-content');
                if (noteContainer) {
                    checkTaskCompletion(noteContainer);
                }
            }
        }
    });
}
