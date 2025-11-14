/**
 * Reusable Check-In Module
 * Works for Admin, EventAdmin, and ClubDirector
 * Admin/EventAdmin can check in anyone
 * ClubDirector can only check in their club's students
 */

let checkInEventId = null;
let checkInParticipants = [];
let checkInFilter = '';

/**
 * Initialize check-in module
 * @param {Object} config - Configuration object
 * @param {number|null} config.eventId - Event ID (null for admin, specific event for EventAdmin/ClubDirector)
 * @param {string} config.userRole - Current user role
 * @param {number|null} config.userClubId - Current user's club ID (for ClubDirector)
 * @returns {string} HTML for check-in tab
 */
function getCheckInTab(config) {
  checkInEventId = config.eventId;
  
  // Admin can see all events, EventAdmin/ClubDirector see their event
  const eventSelectorHtml = config.userRole === 'Admin' ? `
    <div class="form-group" style="margin-bottom: 20px;">
      <label for="checkInEventSelect"><strong>Select Event</strong></label>
      <select id="checkInEventSelect" class="form-control" onchange="checkInLoadParticipants()">
        <option value="">Select Event</option>
      </select>
    </div>
  ` : '';

  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Check-In</h2>
      </div>
      <div style="padding: 20px;">
        ${eventSelectorHtml}
        
        <div class="form-group" style="margin-bottom: 20px;">
          <label for="checkInNumberFilter"><strong>Filter by Check-In Number</strong></label>
          <input type="number" id="checkInNumberFilter" class="form-control" 
                 placeholder="Enter check-in number to filter..." 
                 oninput="checkInFilterByNumber(this.value)"
                 style="max-width: 300px;">
        </div>

        <div id="checkInParticipantsList">
          <p class="text-center" style="color: #666;">${config.userRole === 'Admin' ? 'Select an event to view participants' : 'Loading participants...'}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load participants for the selected event
 */
async function checkInLoadParticipants() {
  const eventSelect = document.getElementById('checkInEventSelect');
  const targetEventId = eventSelect ? eventSelect.value : checkInEventId;
  
  if (!targetEventId) {
    document.getElementById('checkInParticipantsList').innerHTML = 
      '<p class="text-center" style="color: #666;">Please select an event</p>';
    return;
  }

  try {
    const user = getCurrentUser();
    let url = `/api/checkin/participants/${targetEventId}`;
    
    // ClubDirector can only see their club's students
    if (user.role === 'ClubDirector' && user.clubId) {
      url += `?clubId=${user.clubId}`;
    }
    
    const response = await fetchWithAuth(url);
    const participants = await response.json();
    
    if (!response.ok) {
      showNotification(participants.error || 'Error loading participants', 'error');
      return;
    }
    
    checkInParticipants = participants;
    checkInEventId = targetEventId;
    
    // Update Confirm Attendance button if ClubDirector
    if (user.role === 'ClubDirector' && user.clubId) {
      updateConfirmAttendanceButton(targetEventId, user.clubId);
    }
    
    checkInRenderParticipants();
  } catch (error) {
    showNotification('Error loading participants: ' + error.message, 'error');
  }
}

/**
 * Update or add Confirm Attendance button dynamically
 */
function updateConfirmAttendanceButton(eventId, clubId) {
  // Remove existing button if present
  const existingButton = document.getElementById('confirmAttendanceButton');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Add button before participants list
  const participantsList = document.getElementById('checkInParticipantsList');
  if (!participantsList || !eventId) return;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'confirmAttendanceButton';
  buttonContainer.innerHTML = `
    <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px;">
      <h3 style="margin-top: 0; color: #856404;">Confirm Attendance</h3>
      <p style="margin-bottom: 10px; color: #856404;">
        <strong>This will ONLY affect members of your club.</strong> Click the button below to remove all students from your club who are not checked in from their registered classes. 
        This will update waitlists for all affected classes.
      </p>
      <p style="margin-bottom: 10px; color: #856404;">
        <strong>Important:</strong> If someone arrives that was not checked in, they will need to re-register for classes after being checked in.
      </p>
      <button onclick="checkInConfirmAttendance(${eventId}, ${clubId || 'null'})" 
              class="btn btn-warning" 
              style="background: #ffc107; color: #000; border: none; font-weight: bold;">
        Confirm Attendance & Remove Unchecked-In Students from Your Club
      </button>
      <small style="display: block; margin-top: 5px; color: #856404;">
        ⚠️ This action cannot be undone. Only students from your club who are NOT checked in will be removed from classes. Students from other clubs are not affected.
      </small>
    </div>
  `;
  
  participantsList.parentNode.insertBefore(buttonContainer, participantsList);
}

window.updateConfirmAttendanceButton = updateConfirmAttendanceButton;

/**
 * Filter participants by check-in number
 */
function checkInFilterByNumber(checkInNumber) {
  checkInFilter = checkInNumber;
  checkInRenderParticipants();
}

/**
 * Render the participants list with checkboxes
 */
function checkInRenderParticipants() {
  const container = document.getElementById('checkInParticipantsList');
  if (!container) return;
  
  // Filter by check-in number if provided
  let filtered = [...checkInParticipants];
  if (checkInFilter) {
    const filterNum = parseInt(checkInFilter);
    filtered = filtered.filter(p => p.CheckInNumber === filterNum);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-center" style="color: #666;">
      ${checkInFilter ? 'No participants found with that check-in number' : 'No participants found for this event'}
    </p>`;
    return;
  }
  
  // Helper function to calculate age
  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  
  // Helper function to check if over 18
  function isOver18(dateOfBirth) {
    const age = calculateAge(dateOfBirth);
    return age !== null && age >= 18;
  }
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Check-In #</th>
          <th>Name</th>
          <th>Role</th>
          <th>Club</th>
          <th>Age</th>
          <th>Checked In</th>
          <th>BG Check</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(participant => {
          const age = calculateAge(participant.DateOfBirth);
          const over18 = isOver18(participant.DateOfBirth);
          
          return `
            <tr id="checkInRow_${participant.ID}">
              <td><strong>#${participant.CheckInNumber || 'N/A'}</strong></td>
              <td>${participant.FirstName} ${participant.LastName}</td>
              <td>${participant.Role}</td>
              <td>${participant.ClubName || 'None'}</td>
              <td>${age !== null ? age : 'N/A'}</td>
              <td>
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                  <input type="checkbox" 
                         ${participant.CheckedIn ? 'checked' : ''}
                         onchange="checkInToggleCheckedIn(${participant.ID}, this.checked)"
                         style="cursor: pointer;">
                  <span>${participant.CheckedIn ? '✓' : ''}</span>
                </label>
              </td>
              <td>
                ${over18 ? `
                  <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    <input type="checkbox" 
                           ${participant.BackgroundCheck ? 'checked' : ''}
                           onchange="checkInToggleBackgroundCheck(${participant.ID}, this.checked)"
                           style="cursor: pointer;">
                    <span>${participant.BackgroundCheck ? '✓' : ''}</span>
                  </label>
                ` : '<span style="color: #999;">N/A</span>'}
              </td>
              <td>
                <button onclick="checkInViewDetails(${participant.ID})" class="btn btn-sm btn-secondary">View Details</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  // Mobile card view
  const mobileCards = filtered.map(participant => {
    const age = calculateAge(participant.DateOfBirth);
    const over18 = isOver18(participant.DateOfBirth);
    
    const actionsHtml = `
      <button onclick="checkInViewDetails(${participant.ID})" class="btn btn-sm btn-secondary">View</button>
    `;
    
    const cardData = {
      'Check-In #': `#${participant.CheckInNumber || 'N/A'}`,
      'Name': `${participant.FirstName} ${participant.LastName}`,
      'Role': participant.Role,
      'Club': participant.ClubName || 'None',
      'Age': age !== null ? age : 'N/A'
    };
    
    return createMobileCard(cardData, `${participant.FirstName} ${participant.LastName}`, `
      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
          <input type="checkbox" 
                 ${participant.CheckedIn ? 'checked' : ''}
                 onchange="checkInToggleCheckedIn(${participant.ID}, this.checked)"
                 style="cursor: pointer;">
          <span>Checked In</span>
        </label>
      </div>
      ${over18 ? `
        <div style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" 
                   ${participant.BackgroundCheck ? 'checked' : ''}
                   onchange="checkInToggleBackgroundCheck(${participant.ID}, this.checked)"
                   style="cursor: pointer;">
            <span>Background Check</span>
          </label>
        </div>
      ` : ''}
      ${actionsHtml}
    `);
  }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
}

/**
 * Toggle checked-in status
 */
async function checkInToggleCheckedIn(userId, checkedIn) {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CheckedIn: checkedIn })
    });
    
    if (response.ok) {
      const updated = await response.json();
      // Update local data
      const participant = checkInParticipants.find(p => p.ID === userId);
      if (participant) {
        participant.CheckedIn = updated.CheckedIn;
      }
      showNotification(checkedIn ? 'User checked in successfully' : 'User check-in removed', 'success');
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error updating check-in status', 'error');
      // Revert checkbox
      const checkbox = document.querySelector(`input[onchange*="checkInToggleCheckedIn(${userId}"]`);
      if (checkbox) checkbox.checked = !checkedIn;
    }
  } catch (error) {
    showNotification('Error updating check-in status: ' + error.message, 'error');
    // Revert checkbox
    const checkbox = document.querySelector(`input[onchange*="checkInToggleCheckedIn(${userId}"]`);
    if (checkbox) checkbox.checked = !checkedIn;
  }
}

/**
 * Toggle background check status
 */
async function checkInToggleBackgroundCheck(userId, backgroundCheck) {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ BackgroundCheck: backgroundCheck })
    });
    
    if (response.ok) {
      const updated = await response.json();
      // Update local data
      const participant = checkInParticipants.find(p => p.ID === userId);
      if (participant) {
        participant.BackgroundCheck = updated.BackgroundCheck;
      }
      showNotification(backgroundCheck ? 'Background check marked as complete' : 'Background check removed', 'success');
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error updating background check', 'error');
      // Revert checkbox
      const checkbox = document.querySelector(`input[onchange*="checkInToggleBackgroundCheck(${userId}"]`);
      if (checkbox) checkbox.checked = !backgroundCheck;
    }
  } catch (error) {
    showNotification('Error updating background check: ' + error.message, 'error');
    // Revert checkbox
    const checkbox = document.querySelector(`input[onchange*="checkInToggleBackgroundCheck(${userId}"]`);
    if (checkbox) checkbox.checked = !backgroundCheck;
  }
}

/**
 * View full details for a participant
 */
async function checkInViewDetails(userId) {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`);
    const user = await response.json();
    
    if (!response.ok) {
      showNotification(user.error || 'Error loading user details', 'error');
      return;
    }
    
    // Create modal with full user details
    const modal = document.createElement('div');
    modal.id = 'checkInDetailsModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    const age = user.DateOfBirth ? (() => {
      const today = new Date();
      const birthDate = new Date(user.DateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    })() : null;
    const over18 = age !== null && age >= 18;
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2>Participant Details: ${user.FirstName} ${user.LastName}</h2>
          <button onclick="closeModal('checkInDetailsModal')" class="btn btn-outline">×</button>
        </div>
        <div style="padding: 20px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>Check-In Number:</strong> #${user.CheckInNumber || 'N/A'}</p>
            <p><strong>Name:</strong> ${user.FirstName} ${user.LastName}</p>
            <p><strong>Email:</strong> ${user.Email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${user.Phone || 'N/A'}</p>
            <p><strong>Date of Birth:</strong> ${user.DateOfBirth || 'N/A'}</p>
            <p><strong>Age:</strong> ${age !== null ? age : 'N/A'}</p>
            <p><strong>Role:</strong> ${user.Role}</p>
            <p><strong>Club:</strong> ${user.ClubName || 'None'}</p>
            <p><strong>Investiture Level:</strong> ${user.InvestitureLevel || 'None'}</p>
          </div>
          
          <form onsubmit="checkInUpdateUser(event, ${user.ID})">
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="detailCheckedIn" ${user.CheckedIn ? 'checked' : ''}>
                <strong>Checked In</strong>
              </label>
            </div>
            
            ${over18 ? `
              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 10px;">
                  <input type="checkbox" id="detailBackgroundCheck" ${user.BackgroundCheck ? 'checked' : ''}>
                  <strong>Background Check Complete</strong>
                </label>
              </div>
            ` : ''}
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Update</button>
              <button type="button" onclick="closeModal('checkInDetailsModal')" class="btn btn-outline">Close</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (error) {
    showNotification('Error loading user details: ' + error.message, 'error');
  }
}

/**
 * Update user from details modal
 */
async function checkInUpdateUser(event, userId) {
  event.preventDefault();
  
  const checkedIn = document.getElementById('detailCheckedIn').checked;
  const backgroundCheck = document.getElementById('detailBackgroundCheck')?.checked || false;
  
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CheckedIn: checkedIn, BackgroundCheck: backgroundCheck })
    });
    
    if (response.ok) {
      const updated = await response.json();
      // Update local data
      const participant = checkInParticipants.find(p => p.ID === userId);
      if (participant) {
        participant.CheckedIn = updated.CheckedIn;
        participant.BackgroundCheck = updated.BackgroundCheck;
      }
      showNotification('User updated successfully', 'success');
      closeModal('checkInDetailsModal');
      checkInRenderParticipants();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error updating user', 'error');
    }
  } catch (error) {
    showNotification('Error updating user: ' + error.message, 'error');
  }
}

/**
 * Populate event selector (for Admin)
 */
async function checkInPopulateEventSelector() {
  const eventSelect = document.getElementById('checkInEventSelect');
  if (!eventSelect) return;
  
  try {
    const response = await fetchWithAuth('/api/events');
    const events = await response.json();
    
    events.forEach(event => {
      const option = document.createElement('option');
      option.value = event.ID;
      option.textContent = event.Name;
      if (event.ID === checkInEventId) {
        option.selected = true;
      }
      eventSelect.appendChild(option);
    });
    
    // Auto-load if event is pre-selected
    if (checkInEventId) {
      await checkInLoadParticipants();
    }
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

/**
 * Confirm attendance - Remove all unchecked-in students from classes
 */
async function checkInConfirmAttendance(eventId, clubId) {
  if (!eventId) {
    showNotification('Please select an event first', 'error');
    return;
  }

  // Confirm action
  const confirmed = confirm(
    '⚠️ WARNING: This will remove students from YOUR CLUB who are NOT checked in from their registered classes.\n\n' +
    'ONLY members of your club will be affected. Students from other clubs are not affected.\n\n' +
    'Students from your club who are checked in will keep their registrations.\n' +
    'Students from your club who are NOT checked in will be removed from all classes.\n\n' +
    'If someone arrives that was not checked in, they will need to re-register for classes after being checked in.\n\n' +
    'Waitlists will be automatically updated.\n\n' +
    'This action cannot be undone. Are you sure you want to continue?'
  );

  if (!confirmed) {
    return;
  }

  try {
    showNotification('Processing attendance confirmation...', 'info');
    
    const response = await fetchWithAuth(`/api/checkin/confirm-attendance/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: clubId || null })
    });

    const result = await response.json();

    if (response.ok) {
      // Use the backend message if available, otherwise use a generic one
      const message = result.message || `Attendance confirmed! Removed ${result.removedCount || 0} student(s) from your club from classes. Waitlists updated. If someone arrives that was not checked in, they will need to re-register for classes.`;
      showNotification(message, 'success');
      // Reload participants to reflect changes
      await checkInLoadParticipants();
    } else {
      showNotification(result.error || 'Error confirming attendance', 'error');
    }
  } catch (error) {
    showNotification('Error confirming attendance: ' + error.message, 'error');
  }
}

// Make functions globally available
window.getCheckInTab = getCheckInTab;
window.checkInLoadParticipants = checkInLoadParticipants;
window.checkInFilterByNumber = checkInFilterByNumber;
window.checkInToggleCheckedIn = checkInToggleCheckedIn;
window.checkInToggleBackgroundCheck = checkInToggleBackgroundCheck;
window.checkInViewDetails = checkInViewDetails;
window.checkInUpdateUser = checkInUpdateUser;
window.checkInPopulateEventSelector = checkInPopulateEventSelector;
window.checkInConfirmAttendance = checkInConfirmAttendance;

