// tada.js
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

// Tab filtering system
var currentTab = 'all';
var tabCounts = { all: 0, dad: 0, mom: 0, jess: 0 };

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
            displayNotes(data);
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

// Helper function to check if a note has all tasks completed (for initial load)
function isNoteCompleted(note) {
    if (!note.content) return false;
    
    // Count checkboxes in the content
    const content = note.content;
    const checkboxMatches = content.match(/\[ \]/g) || []; // Unchecked boxes
    const checkedBoxMatches = content.match(/\[x\]/gi) || []; // Checked boxes
    
    const totalBoxes = checkboxMatches.length + checkedBoxMatches.length;
    
    if (totalBoxes <= 1) return false; // Need at least 2 tasks
    
    return checkboxMatches.length === 0; // All boxes are checked
}

// Simplified displayNotes without tab system for now
function displayNotes(notesData) {
    var notesContainer = document.getElementById('notesContainer');
    var paginationDiv = document.getElementById('pagination');
    
    console.log('displayNotes called with:', notesData);
    
    // Handle both old format (single note) and new format (multiple notes)
    if (notesData.notes && Array.isArray(notesData.notes)) {
        allNotes = notesData.notes;
    } else if (notesData.content) {
        allNotes = [notesData];
    } else {
        allNotes = [];
    }
    
    console.log('Total notes loaded:', allNotes.length);
    
    if (allNotes.length === 0) {
        notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">📱 No notes yet. Send your first note from iPhone!</div></div>';
        paginationDiv.style.display = 'none';
        document.getElementById('statusText').textContent = '⏳ No notes yet';
        return;
    }
    
    // Check for completed notes and mark them
    for (let i = 0; i < allNotes.length; i++) {
        if (!allNotes[i].completed && isNoteCompleted(allNotes[i])) {
            allNotes[i].completed = true;
            allNotes[i].completedAt = allNotes[i].completedAt || allNotes[i].timestamp;
        }
    }
    
    // Sort notes
    allNotes.sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        if (a.completed && b.completed) {
            return (b.completedAt || b.timestamp) - (a.completedAt || a.timestamp);
        }
        return b.timestamp - a.timestamp;
    });
    
    renderCurrentPage();
    updatePagination();
    
    // Update status
    var totalNotes = allNotes.length;
    var completedNotes = allNotes.filter(note => note.completed).length;
    var activeNotes = totalNotes - completedNotes;
    var latestNote = allNotes[0];
    
    if (activeNotes > 0) {
        document.getElementById('statusText').textContent = '📧 ' + activeNotes + ' active note' + 
            (activeNotes > 1 ? 's' : '') + (completedNotes > 0 ? ', ' + completedNotes + ' completed' : '') +
            ' from ' + (latestNote.sender || 'someone');
    } else {
        document.getElementById('statusText').textContent = '🎉 All ' + totalNotes + ' notes completed!';
    }
    
    // Update timestamp
    document.getElementById('timestamp').textContent = 
        'Last updated: ' + new Date(latestNote.timestamp).toLocaleString();
    lastUpdate = Math.max(lastUpdate, latestNote.timestamp);
}


// Fixed content formatter - no syntax errors
function formatNoteContentWithCheckboxes(content) {
    if (!content) return 'Empty note';
    
    var displayContent = content;
    
    // Remove iOS Shortcut attribution if present
    displayContent = displayContent.replace(/— iOS Shortcut$/gim, '');
    displayContent = displayContent.replace(/- iOS Shortcut$/gim, '');
    displayContent = displayContent.replace(/<p[^>]*>— iOS Shortcut<\/p>/gi, '');
    displayContent = displayContent.replace(/<p[^>]*>- iOS Shortcut<\/p>/gi, '');
    displayContent = displayContent.replace(/<p[^>]*class="sender-attribution"[^>]*>.*?<\/p>/gi, '');
    displayContent = displayContent.replace(/<div[^>]*class="sender-attribution"[^>]*>.*?<\/div>/gi, '');
    
    // Remove the generic "Note from iPhone" h1 if it exists
    displayContent = displayContent.replace(/<h1[^>]*>Note from iPhone<\/h1>\s*/gi, '');
    
    // Enable the disabled checkboxes and make them clickable
    displayContent = displayContent.replace(/<input[^>]*disabled[^>]*type="checkbox"[^>]*>/gi, '<input type="checkbox">');
    displayContent = displayContent.replace(/<input[^>]*type="checkbox"[^>]*disabled[^>]*>/gi, '<input type="checkbox">');
    
    // Remove empty paragraphs that might be left over
    displayContent = displayContent.replace(/<p[^>]*>\s*<\/p>/gi, '');
    
    // Remove tags from display (they'll be handled by the tab system)
    displayContent = displayContent.replace(/<p[^>]*>\s*#\w+\s*<\/p>/gi, '');
    
    return displayContent.trim();
}

// Enhanced renderCurrentPage with consistent layout across all tabs
function renderCurrentPage() {
    var notesContainer = document.getElementById('notesContainer');
    
    // Filter notes based on current tab
    var filteredNotes = filterNotesByTab(allNotes);
    
    var startIndex = currentPage * notesPerPage;
    var endIndex = startIndex + notesPerPage;
    var currentNotes = filteredNotes.slice(startIndex, endIndex);
    
    if (filteredNotes.length === 0) {
        var tabName = currentTab === 'all' ? 'All' : currentTab.charAt(0).toUpperCase() + currentTab.slice(1);
        notesContainer.innerHTML = '<div class="note-content"><div class="empty-state">📱 No notes in ' + tabName + ' tab</div></div>';
        return;
    }
    
    // ALWAYS use the card layout for consistency - even for single notes
    var html = '';
    for (var i = 0; i < currentNotes.length; i++) {
        var note = currentNotes[i];
        var noteIndex = allNotes.indexOf(note); // Get original index for delete function
        var deleteBtn = '<button class="individual-delete-btn" onclick="deleteIndividualNote(' + noteIndex + ', \'' + 
            (note.id || note.timestamp) + '\')" title="Delete this note">×</button>';
        
        var noteClass = 'note-item';
        var completionBadge = '';
        
        if (note.completed) {
            noteClass += ' completed-note';
            completionBadge = '<span class="completion-badge">✓ Completed</span>';
        }
        
        // Extract dynamic title from note content and get cleaned content
        var titleData = extractAndCleanNoteTitle(note.content);
        var noteTitle = titleData.title;
        var cleanedContent = titleData.content;
        
        html += '<div class="' + noteClass + '">' +
            '<div class="note-header">' +
            '<h2 class="note-title">' + noteTitle + '</h2>' +
            '<div class="note-meta-right">' +
            completionBadge +
            '<span class="note-time">' + formatTime(note.timestamp) + '</span>' +
            deleteBtn +
            '</div>' +
            '</div>' +
            '<div class="note-item-content">' + formatNoteContentWithCheckboxes(cleanedContent) + '</div>' +
            '</div>';
    }
    notesContainer.innerHTML = html;
}

// Fixed title extraction
function extractAndCleanNoteTitle(content) {
    if (!content) return { title: 'Note from iPhone', content: content };
    
    var originalContent = content;
    var extractedTitle = 'Note from iPhone';
    var cleanedContent = content;
    
    // Remove the generic "Note from iPhone" h1 first
    cleanedContent = content.replace(/<h1[^>]*>Note from iPhone<\/h1>\s*/gi, '');
    
    // Look for the first <p> tag after removing the generic title
    var firstParagraphMatch = cleanedContent.match(/<p[^>]*>([^<]+)<\/p>/i);
    if (firstParagraphMatch) {
        var potentialTitle = firstParagraphMatch[1].trim();
        
        // Make sure it's not a tag and is reasonable length
        if (!potentialTitle.match(/^#\w+/) && potentialTitle.length > 2 && potentialTitle.length < 80) {
            extractedTitle = potentialTitle;
            cleanedContent = cleanedContent.replace(firstParagraphMatch[0], '').trim();
            return { title: extractedTitle, content: cleanedContent };
        }
    }
    
    return { title: 'Note from iPhone', content: cleanedContent };
}


// Enhanced updatePagination with tab filtering
function updatePagination() {
    var paginationDiv = document.getElementById('pagination');
    var pageInfo = document.getElementById('pageInfo');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    
    var filteredNotes = filterNotesByTab(allNotes);
    var totalPages = Math.ceil(filteredNotes.length / notesPerPage);
    
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

// Enhanced tag extraction for HTML format
function extractNoteTags(content) {
    if (!content) return [];
    
    var tags = [];
    
    // Look for tags in paragraph tags: <p>#dad</p>
    var paragraphTagMatches = content.match(/<p[^>]*>\s*#(dad|mom|jess)\s*<\/p>/gi);
    if (paragraphTagMatches) {
        paragraphTagMatches.forEach(function(match) {
            var tagMatch = match.match(/#(dad|mom|jess)/i);
            if (tagMatch) {
                var cleanTag = tagMatch[1].toLowerCase();
                if (!tags.includes(cleanTag)) {
                    tags.push(cleanTag);
                }
            }
        });
    }
    
    // Also check for inline tags just in case
    var inlineTagMatches = content.match(/#(dad|mom|jess)\b/gi);
    if (inlineTagMatches) {
        inlineTagMatches.forEach(function(tag) {
            var cleanTag = tag.toLowerCase().replace('#', '');
            if (!tags.includes(cleanTag)) {
                tags.push(cleanTag);
            }
        });
    }
    
    console.log('Extracted tags:', tags);
    return tags;
}

// Filter notes by current tab
function filterNotesByTab(notes) {
    if (currentTab === 'all') {
        return notes;
    }
    
    return notes.filter(function(note) {
        var tags = extractNoteTags(note.content);
        return tags.includes(currentTab);
    });
}

// Update tab counts
function updateTabCounts() {
    tabCounts = { all: 0, dad: 0, mom: 0, jess: 0 };
    
    allNotes.forEach(function(note) {
        tabCounts.all++;
        
        var tags = extractNoteTags(note.content);
        tags.forEach(function(tag) {
            if (tabCounts[tag] !== undefined) {
                tabCounts[tag]++;
            }
        });
        
        // If note has no recognized tags, it only counts toward "all"
        if (tags.length === 0) {
            // Already counted in "all" above
        }
    });
    
    updateTabDisplay();
}

// Update tab display with counts
function updateTabDisplay() {
    var tabs = ['all', 'dad', 'mom', 'jess'];
    var tabNames = { all: 'All', dad: 'Dad', mom: 'Mom', jess: 'Jess' };
    
    tabs.forEach(function(tab) {
        var tabElement = document.getElementById('tab-' + tab);
        if (tabElement) {
            var count = tabCounts[tab];
            var displayText = tabNames[tab];
            
            if (count > 0) {
                displayText += ' (' + count + ')';
            }
            
            tabElement.textContent = displayText;
            
            // Update active state
            if (tab === currentTab) {
                tabElement.classList.add('active');
            } else {
                tabElement.classList.remove('active');
            }
        }
    });
}

// Switch to a specific tab
function switchToTab(tab) {
    if (tab === currentTab) return;
    
    currentTab = tab;
    currentPage = 0; // Reset to first page when switching tabs
    
    updateTabDisplay();
    renderCurrentPage();
    updatePagination();
    updateStatusForTab();
}

// Update status message for current tab
function updateStatusForTab() {
    var filteredNotes = filterNotesByTab(allNotes);
    var totalNotes = filteredNotes.length;
    var completedNotes = filteredNotes.filter(note => note.completed).length;
    var activeNotes = totalNotes - completedNotes;
    
    var tabName = currentTab === 'all' ? 'All' : currentTab.charAt(0).toUpperCase() + currentTab.slice(1);
    
    if (totalNotes === 0) {
        document.getElementById('statusText').textContent = '📱 No notes in ' + tabName + ' tab';
    } else if (activeNotes > 0) {
        document.getElementById('statusText').textContent = '📧 ' + tabName + ': ' + activeNotes + ' active' + 
            (completedNotes > 0 ? ', ' + completedNotes + ' completed' : '');
    } else {
        document.getElementById('statusText').textContent = '🎉 All ' + totalNotes + ' notes completed in ' + tabName + '!';
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

// Find the index of a note from its DOM element
function findNoteIndexFromElement(noteElement) {
    // For single note view
    if (noteElement.classList.contains('note-content')) {
        return 0; // Single note is always index 0
    }
    
    // For multiple notes, find the note-item index
    if (noteElement.classList.contains('note-item')) {
        const allNoteItems = document.querySelectorAll('.note-item');
        for (let i = 0; i < allNoteItems.length; i++) {
            if (allNoteItems[i] === noteElement) {
                // Calculate the actual index in allNotes array
                return (currentPage * notesPerPage) + i;
            }
        }
    }
    
    return -1;
}

// Enhanced updateCheckboxInNoteData to be more robust
function updateCheckboxInNoteData(checkbox) {
    // Find which note this checkbox belongs to
    var noteElement = checkbox.closest('.note-item, .note-content');
    var noteIndex = findNoteIndexFromElement(noteElement);
    
    if (noteIndex === -1 || !allNotes[noteIndex]) return;
    
    var note = allNotes[noteIndex];
    if (!note.content) return;
    
    // Find all checkboxes in this note's container
    var allCheckboxes = noteElement.querySelectorAll('input[type="checkbox"]');
    var checkboxIndex = Array.from(allCheckboxes).indexOf(checkbox);
    
    if (checkboxIndex === -1) return;
    
    // Update the note content to reflect the new checkbox state
    var content = note.content;
    var checkboxCount = 0;
    
    // Replace both markdown and HTML checkbox patterns
    var updatedContent = content.replace(/(\[[ x]\]|<input[^>]*type="checkbox"[^>]*>)/gi, function(match) {
        if (checkboxCount === checkboxIndex) {
            checkboxCount++;
            if (checkbox.checked) {
                return match.includes('<input') ? 
                    '<input type="checkbox" checked="checked">' : '[x]';
            } else {
                return match.includes('<input') ? 
                    '<input type="checkbox">' : '[ ]';
            }
        }
        checkboxCount++;
        return match;
    });
    
    // Update the note data
    allNotes[noteIndex].content = updatedContent;
    
    console.log('Updated checkbox state in note data:', {
        noteIndex,
        checkboxIndex,
        checked: checkbox.checked,
        updatedContent: updatedContent.substring(0, 100) + '...'
    });
}

// Modified markNoteAsCompleted to prevent re-rendering during celebration
function markNoteAsCompleted(noteIndex) {
    if (noteIndex < 0 || noteIndex >= allNotes.length) return;
    
    const completedNote = allNotes[noteIndex];
    
    // Add completion metadata
    completedNote.completed = true;
    completedNote.completedAt = Date.now();
    
    // Remove from current position
    allNotes.splice(noteIndex, 1);
    
    // Add to the end
    allNotes.push(completedNote);
    
    console.log('📝 Moved completed note to bottom:', completedNote.id || completedNote.timestamp);
    
    // Adjust current page if needed (since we removed an item from the current view)
    const totalPages = Math.ceil(allNotes.length / notesPerPage);
    if (currentPage >= totalPages && currentPage > 0) {
        currentPage = totalPages - 1;
    }
    
    // Don't re-render immediately - let celebration play first
    // Re-render will happen after celebration is complete
    setTimeout(() => {
        renderCurrentPage();
        updatePagination();
        
        // Update status to reflect the reordering
        const totalNotes = allNotes.length;
        const completedNotes = allNotes.filter(note => note.completed).length;
        const activeNotes = totalNotes - completedNotes;
        
        if (activeNotes > 0) {
            document.getElementById('statusText').textContent = 
                `📧 ${activeNotes} active, ${completedNotes} completed`;
        } else {
            document.getElementById('statusText').textContent = 
                `🎉 All ${totalNotes} notes completed!`;
        }
    }, 3500); // Wait for celebration to finish (3000ms + buffer)
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

// Enhanced checkTaskCompletion function with card reordering
function checkTaskCompletion(container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    
    if (checkboxes.length === 0) return false; // No checkboxes
    if (checkboxes.length === 1) return false; // Only one task doesn't warrant celebration
    
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const allCompleted = checkboxes.length === checkedBoxes.length;
    
    if (allCompleted) {
        // Find which note this container belongs to
        const noteElement = container.closest('.note-item, .note-content');
        const noteIndex = findNoteIndexFromElement(noteElement);
        
        if (noteIndex !== -1) {
            // Mark the note as completed and move to bottom
            markNoteAsCompleted(noteIndex);
            
            // Small delay to let the final checkbox animation complete, then celebrate
            setTimeout(triggerCelebration, 300);
        }
        
        return true;
    }
    
    return false;
}

// Enhanced task list interaction with better checkbox state management
function setupTaskListInteraction() {
    document.getElementById('notesContainer').addEventListener('click', function(event) {
        var listItem = event.target.closest('li');
        
        if (listItem && listItem.querySelector('input[type="checkbox"]')) {
            var checkbox = listItem.querySelector('input[type="checkbox"]');
            var wasChecked = checkbox.checked;
            
            // Always prevent the default checkbox behavior and handle it manually
            event.preventDefault();
            
            // Toggle the checkbox state
            checkbox.checked = !checkbox.checked;
            
            // Update checkbox state in the data model immediately
            updateCheckboxInNoteData(checkbox);
            
            // Visual feedback for checked state
            listItem.style.backgroundColor = checkbox.checked ? 
                'rgba(46, 204, 113, 0.2)' : '';
            
            // Add strikethrough for completed tasks
            var textNodes = [];
            function findTextNodes(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    textNodes.push(node);
                } else {
                    for (var i = 0; i < node.childNodes.length; i++) {
                        findTextNodes(node.childNodes[i]);
                    }
                }
            }
            findTextNodes(listItem);
            
            // Apply styling to the list item itself
            if (checkbox.checked) {
                listItem.style.textDecoration = 'line-through';
                listItem.style.opacity = '0.7';
            } else {
                listItem.style.textDecoration = 'none';
                listItem.style.opacity = '1';
            }
            
            // Find the parent container
            var noteContainer = listItem.closest('.note-content, .note-item-content');
            if (noteContainer) {
                // Check for completion only if we just checked a box
                if (checkbox.checked && !wasChecked) {
                    checkTaskCompletion(noteContainer);
                }
                // Check for resurrection if we just unchecked a box
                else if (!checkbox.checked && wasChecked) {
                    checkTaskResurrection(noteContainer);
                }
            }
        }
    });
}

// Check if all tasks are now UNchecked (resurrection!)
function checkTaskResurrection(container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    
    if (checkboxes.length === 0) return false; // No checkboxes
    
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const allUnchecked = checkedBoxes.length === 0;
    
    if (allUnchecked) {
        // Find which note this container belongs to
        const noteElement = container.closest('.note-item, .note-content');
        const noteIndex = findNoteIndexFromElement(noteElement);
        
        if (noteIndex !== -1) {
            const note = allNotes[noteIndex];
            
            // Only resurrect if it was previously completed
            if (note.completed) {
                console.log('🧟 Resurrecting note from the dead!');
                resurrectNote(noteIndex);
                return true;
            }
        }
    }
    
    return false;
}

// Resurrect a note by moving it back to active status and top of list
function resurrectNote(noteIndex) {
    if (noteIndex < 0 || noteIndex >= allNotes.length) return;
    
    const resurrectedNote = allNotes[noteIndex];
    
    // Remove completion metadata
    resurrectedNote.completed = false;
    delete resurrectedNote.completedAt;
    
    // Remove from current position
    allNotes.splice(noteIndex, 1);
    
    // Find where to insert it (after other active notes, before completed ones)
    let insertIndex = 0;
    for (let i = 0; i < allNotes.length; i++) {
        if (allNotes[i].completed) {
            insertIndex = i;
            break;
        }
        insertIndex = i + 1;
    }
    
    // Add back to active section
    allNotes.splice(insertIndex, 0, resurrectedNote);
    
    console.log('📝 Resurrected note moved back to active:', resurrectedNote.id || resurrectedNote.timestamp);
    
    // Adjust current page if needed
    const totalPages = Math.ceil(allNotes.length / notesPerPage);
    if (currentPage >= totalPages && currentPage > 0) {
        currentPage = Math.max(0, totalPages - 1);
    }
    
    // Re-render with the new order
    setTimeout(() => {
        renderCurrentPage();
        updatePagination();
        
        // Update status to reflect the resurrection
        const totalNotes = allNotes.length;
        const completedNotes = allNotes.filter(note => note.completed).length;
        const activeNotes = totalNotes - completedNotes;
        
        document.getElementById('statusText').textContent = 
            `📧 ${activeNotes} active` + (completedNotes > 0 ? `, ${completedNotes} completed` : '') + ' • Note resurrected! 🧟';
        
        // Clear the resurrection message after a few seconds
        setTimeout(() => {
            if (activeNotes > 0) {
                document.getElementById('statusText').textContent = 
                    `📧 ${activeNotes} active` + (completedNotes > 0 ? `, ${completedNotes} completed` : '');
            } else {
                document.getElementById('statusText').textContent = 
                    `🎉 All ${totalNotes} notes completed!`;
            }
        }, 3000);
    }, 100);
}
