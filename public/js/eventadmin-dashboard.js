// Event Admin Dashboard - Full Implementation

let currentTab = 'events';
let allEvents = [];
let allUsers = [];
let allLocations = [];
let allTimeslots = [];
let allClubs = [];
let allClasses = [];
let currentUser = null;
let assignedEventId = null;
let assignedEvent = null;

function populateEventOptions(selectEl, events, placeholderText = 'Select Event') {
  if (!selectEl || !Array.isArray(events)) return;

  const previousValue = selectEl.value;
  if (placeholderText !== null) {
    selectEl.innerHTML = `<option value="">${placeholderText}</option>`;
  } else {
    selectEl.innerHTML = '';
  }

  const seenKeys = new Set();
  events.forEach(event => {
    if (!event) return;
    const key = `${event.ID ?? ''}::${event.Name ?? ''}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const option = document.createElement('option');
    option.value = event.ID;
    option.textContent = event.Name;
    selectEl.appendChild(option);
  });

  if (previousValue && Array.from(selectEl.options).some(opt => opt.value === previousValue)) {
    selectEl.value = previousValue;
  }
}

function formatClubOptionLabel(club) {
  if (!club) return '';
  const eventNames = (club.Events || [])
    .map(event => event?.Name)
    .filter(Boolean);
  const eventSummary = eventNames.length
    ? `— Events: ${eventNames.join(', ')}`
    : '— No linked events';
  return `${club.Name} ${eventSummary}`;
}

function updateClubEventSummaryFromSelect(selectEl, summaryEl) {
  if (!summaryEl) return;

  if (!selectEl || !selectEl.value) {
    summaryEl.textContent = 'Select a club to view linked events.';
    summaryEl.style.display = 'block';
    return;
  }

  const selectedId = parseInt(selectEl.value, 10);
  if (Number.isNaN(selectedId)) {
    summaryEl.textContent = 'Select a club to view linked events.';
    summaryEl.style.display = 'block';
    return;
  }

  const clubs = selectEl._clubData || [];
  const club = clubs.find(c => c.ID === selectedId);

  if (!club) {
    summaryEl.textContent = 'Select a club to view linked events.';
    summaryEl.style.display = 'block';
    return;
  }

  const eventNames = (club.Events || [])
    .map(event => event?.Name)
    .filter(Boolean);

  summaryEl.textContent = eventNames.length
    ? `Linked events: ${eventNames.join(', ')}`
    : 'This club is not currently linked to any events.';
  summaryEl.style.display = 'block';
}

// Filter state for user table
let userFilters = {};
let userSortColumn = null;
let userSortDirection = 'asc';
let showDeactivatedUsers = false;

// Filter state for classes table
let classFilters = {};
let classSortColumn = null;
let classSortDirection = 'asc';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // Clear any previous dashboard state
  if (window.preventBackNavigationInitialized) {
    window.preventBackNavigationInitialized = false;
  }
  if (window.setupVisibilityChecksInitialized) {
    window.setupVisibilityChecksInitialized = false;
  }
  
  // Verify authentication first
  const token = localStorage.getItem('token');
  if (!token) {
    logout();
    return;
  }
  
  // Check token validity
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      logout();
      return;
    }
  } catch (error) {
    logout();
    return;
  }
  
  const user = getCurrentUser();
  if (!user || !user.role) {
    logout();
    return;
  }
  
  // Only EventAdmin should use this dashboard
  if (user.role !== 'EventAdmin') {
    // Redirect to appropriate dashboard
    if (user.role === 'Admin') {
      window.location.href = '/admin-dashboard.html';
      return;
    } else if (user.role === 'ClubDirector') {
      window.location.href = '/clubdirector-dashboard.html';
      return;
    } else {
      window.location.href = '/student-dashboard.html';
      return;
    }
  }
  
  await applyBranding('Event Admin Dashboard');

  currentUser = user;
  assignedEventId = user.eventId;

  const userDetails = await fetchUserDetails(user.id);
  setClubName(userDetails?.ClubName || null);
  
  // Display user name
  const userDisplayNameEl = document.getElementById('userDisplayName');
  if (userDisplayNameEl) {
    userDisplayNameEl.textContent = `${user.firstName} ${user.lastName}`;
  }

  // Make switchTab available globally
  window.switchTab = switchTab;
  window.toggleEventDropdown = toggleEventDropdown;
  window.toggleEditEventDropdown = toggleEditEventDropdown;
  
  // Load assigned event first
  if (assignedEventId) {
    await loadAssignedEvent();
  } else {
    showNotification('No event assigned. Please contact an administrator.', 'error');
  }
  
  // Load data filtered by assigned event
  await loadUsers();
  await loadLocations(assignedEventId);
  await loadTimeslots(assignedEventId);
  await loadClubs(assignedEventId);
  await loadClasses(assignedEventId);
  
  // Update event name in banner
  if (assignedEvent) {
    const eventNameEl = document.getElementById('eventName');
    if (eventNameEl) {
      eventNameEl.textContent = `Event: ${assignedEvent.Name}`;
    }
  }
  
  const savedTab = localStorage.getItem('eventadminCurrentTab') || 'events';
  switchTab(savedTab);
});

// Helper function to get role label from event
function getRoleLabel(role, eventId) {
  if (!assignedEvent) return role;
  
  const labelMap = {
    'Student': assignedEvent.RoleLabelStudent || 'Student',
    'Teacher': assignedEvent.RoleLabelTeacher || 'Teacher',
    'Staff': assignedEvent.RoleLabelStaff || 'Staff',
    'ClubDirector': assignedEvent.RoleLabelClubDirector || 'Club Director',
    'EventAdmin': assignedEvent.RoleLabelEventAdmin || 'Event Admin',
    'Admin': 'Admin'
  };
  
  return labelMap[role] || role;
}

// Toggle event dropdown (disabled for EventAdmin - event is fixed)
async function toggleEventDropdown(role) {
  const eventContainer = document.getElementById('eventContainer');
  const clubContainer = document.getElementById('clubContainer');
  const eventSelect = document.getElementById('eventId');
  const clubSelect = document.getElementById('clubId');
  const summaryEl = document.getElementById('clubEventSummary');
  const clubOnlyRoles = ['ClubDirector', 'Teacher', 'Student', 'Staff'];
  const requiresEventSelection = role === 'EventAdmin';
  const requiresClubSelection = clubOnlyRoles.includes(role);
  
  if (!eventContainer || !clubContainer) return;
  
  if (requiresEventSelection) {
    eventContainer.style.display = 'none';
    clubContainer.style.display = 'none';
    if (summaryEl) {
      summaryEl.style.display = 'none';
    }
    return;
  }
  
  eventContainer.style.display = 'none';
  if (eventSelect) {
    eventSelect.value = '';
  }

  if (requiresClubSelection) {
    clubContainer.style.display = 'block';
    await loadClubsForCreateUser();
    updateClubEventSummaryFromSelect(clubSelect, summaryEl);
    return;
  }

  clubContainer.style.display = 'none';
  if (summaryEl) {
    summaryEl.style.display = 'none';
  }
}

// Toggle event dropdown in edit modal
async function toggleEditEventDropdown(role) {
  const eventContainer = document.getElementById('editEventContainer');
  const clubContainer = document.getElementById('editClubContainer');
  const eventSelect = document.getElementById('editEventId');
  const clubSelect = document.getElementById('editClubId');
  const summaryEl = document.getElementById('editClubEventSummary');
  const clubOnlyRoles = ['ClubDirector', 'Teacher', 'Student', 'Staff'];
  const requiresEventSelection = role === 'EventAdmin';
  const requiresClubSelection = clubOnlyRoles.includes(role);
  
  if (!eventContainer || !clubContainer) return;
  
  async function ensureEventOptions() {
    if (!eventSelect || eventSelect.dataset.loaded === 'true') return;
    const response = await fetchWithAuth('/api/events');
    const events = await response.json();
    populateEventOptions(eventSelect, events, 'Select Event');
    eventSelect.dataset.loaded = 'true';
    
    const formEl = document.getElementById('editUserForm');
    const userId = formEl ? parseInt(formEl.dataset.userId) : null;
    const currentUser = allUsers.find(u => u.ID === userId);
    if (currentUser?.EventID && eventSelect) {
      eventSelect.value = currentUser.EventID;
    }
  }
  
  if (requiresEventSelection) {
    eventContainer.style.display = 'block';
    await ensureEventOptions();
  } else {
    eventContainer.style.display = 'none';
    if (eventSelect) {
      eventSelect.value = '';
    }
  }

  if (requiresClubSelection) {
    clubContainer.style.display = 'block';
    await loadClubsForEditUser();
    updateClubEventSummaryFromSelect(clubSelect, summaryEl);
  } else {
    clubContainer.style.display = 'none';
  }

  if (summaryEl) {
    summaryEl.style.display = 'none';
  }
}

// Load clubs for create user form when event is selected
async function loadClubsForCreateUser(eventId) {
  const clubContainer = document.getElementById('clubContainer');
  const clubSelect = document.getElementById('clubId');
  const summaryEl = document.getElementById('clubEventSummary');
  const role = document.getElementById('role')?.value || '';
  const clubOnlyRoles = ['ClubDirector', 'Teacher', 'Student', 'Staff'];
  const useAllClubs = clubOnlyRoles.includes(role);
  const explicitEventId = eventId ? parseInt(eventId, 10) : null;
  const targetEventId = useAllClubs ? assignedEventId : (explicitEventId || assignedEventId || null);

  if (!clubSelect) return;

  if (!useAllClubs && !targetEventId) {
    if (clubContainer) clubContainer.style.display = 'none';
    clubSelect.innerHTML = '<option value="">No Club</option>';
    clubSelect._clubData = [];
    if (summaryEl) {
      summaryEl.textContent = 'Select an event to view available clubs.';
      summaryEl.style.display = 'block';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs?includeEvents=true`);
    const clubsResponse = await response.json();
    allClubs = clubsResponse;
    let clubs = clubsResponse;

    if (!useAllClubs && targetEventId) {
      clubs = clubs.filter(club =>
        (club.Events || []).some(event => event.ID === targetEventId)
      );
    }
    
    if (clubSelect) {
      clubSelect.innerHTML = '<option value="">No Club</option>';
      
      if (clubs.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = useAllClubs
          ? 'No clubs available'
          : 'No clubs linked to this event';
        emptyOption.disabled = true;
        clubSelect.appendChild(emptyOption);
        clubSelect.disabled = true;
        if (summaryEl) {
          summaryEl.textContent = useAllClubs
            ? 'No clubs are available yet. Create a club to assign a director.'
            : 'No clubs are currently linked to the selected event.';
          summaryEl.style.display = 'block';
        }
      } else {
        clubSelect.disabled = false;
        const seen = new Set();
        clubs.forEach(club => {
          if (seen.has(club.ID)) return;
          seen.add(club.ID);
          const option = document.createElement('option');
          option.value = club.ID;
          option.textContent = formatClubOptionLabel(club);
          clubSelect.appendChild(option);
        });
      }

      clubSelect._clubData = clubs;
      clubSelect.onchange = () => updateClubEventSummaryFromSelect(clubSelect, summaryEl);
    }
    
    if (clubContainer) clubContainer.style.display = 'block';
    if (clubs.length > 0) {
      updateClubEventSummaryFromSelect(clubSelect, summaryEl);
    }
  } catch (error) {
    console.error('Error loading clubs:', error);
    if (summaryEl) {
      summaryEl.textContent = 'Error loading clubs. Please try again.';
      summaryEl.style.display = 'block';
    }
  }
}

// Load clubs for edit user form when event is selected
async function loadClubsForEditUser(eventId) {
  const clubContainer = document.getElementById('editClubContainer');
  const clubSelect = document.getElementById('editClubId');
  const user = allUsers.find(u => u.ID === parseInt(document.getElementById('editUserForm')?.dataset.userId || 0));
  const summaryEl = document.getElementById('editClubEventSummary');
  const role = document.getElementById('editRole')?.value || user?.Role || '';
  const clubOnlyRoles = ['ClubDirector', 'Teacher', 'Student', 'Staff'];
  const useAllClubs = clubOnlyRoles.includes(role);
  const explicitEventId = eventId ? parseInt(eventId, 10) : null;
  const targetEventId = useAllClubs ? assignedEventId : (explicitEventId || assignedEventId || null);

  if (!clubSelect) return;

  if (!useAllClubs && !targetEventId) {
    if (clubContainer) clubContainer.style.display = 'none';
    clubSelect.innerHTML = '<option value="">No Club</option>';
    clubSelect._clubData = [];
    if (summaryEl) {
      summaryEl.textContent = 'Select an event to view available clubs.';
      summaryEl.style.display = 'block';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs?includeEvents=true`);
    const clubsResponse = await response.json();
    allClubs = clubsResponse;
    let clubs = clubsResponse;

    if (!useAllClubs && targetEventId) {
      clubs = clubs.filter(club =>
        (club.Events || []).some(event => event.ID === targetEventId)
      );
    }

    if (user?.ClubID && !clubs.some(club => club.ID === user.ClubID)) {
      const existingClub = clubsResponse.find(club => club.ID === user.ClubID);
      if (existingClub) {
        clubs = [existingClub, ...clubs];
      }
    }
    
    if (clubSelect) {
      clubSelect.innerHTML = '<option value="">No Club</option>';
      
      if (clubs.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = useAllClubs
          ? 'No clubs available'
          : 'No clubs linked to this event';
        emptyOption.disabled = true;
        clubSelect.appendChild(emptyOption);
        clubSelect.disabled = true;
        if (summaryEl) {
          summaryEl.textContent = useAllClubs
            ? 'No clubs are available yet. Create a club to assign a director.'
            : 'No clubs are currently linked to the selected event.';
          summaryEl.style.display = 'block';
        }
      } else {
        clubSelect.disabled = false;
        const seen = new Set();
        clubs.forEach(club => {
          if (seen.has(club.ID)) return;
          seen.add(club.ID);
          const option = document.createElement('option');
          option.value = club.ID;
          option.textContent = formatClubOptionLabel(club);
          if (user && user.ClubID === club.ID) {
            option.selected = true;
          }
          clubSelect.appendChild(option);
        });
      }

      clubSelect._clubData = clubs;
      clubSelect.onchange = () => updateClubEventSummaryFromSelect(clubSelect, summaryEl);
    }
    
    if (clubContainer) clubContainer.style.display = 'block';
    if (clubs.length > 0) {
      updateClubEventSummaryFromSelect(clubSelect, summaryEl);
    }
  } catch (error) {
    console.error('Error loading clubs:', error);
    if (summaryEl) {
      summaryEl.textContent = 'Error loading clubs. Please try again.';
      summaryEl.style.display = 'block';
    }
  }
}

// Make function globally available
window.loadClubsForCreateUser = loadClubsForCreateUser;
window.loadClubsForEditUser = loadClubsForEditUser;

async function switchTab(tabName, clickedElement = null) {
  currentTab = tabName;
  try { localStorage.setItem('eventadminCurrentTab', tabName); } catch (e) {}
  
  // Update tab UI
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  if (clickedElement) {
    clickedElement.classList.add('active');
  } else {
    // Find the clicked tab by text content
    document.querySelectorAll('.tab').forEach(t => {
      if (t.textContent.trim().toLowerCase() === tabName.toLowerCase()) {
        t.classList.add('active');
      }
    });
  }
  
  // Load tab content
  const content = document.getElementById('content');
  
  switch(tabName) {
    case 'events':
      content.innerHTML = await getEventsTab();
      await loadSystemStats();
      await renderEvents();
      if (assignedEventId) {
        await loadEventDashboard(assignedEventId);
      }
      break;
    case 'users':
      content.innerHTML = await getUsersTab();
      await loadUsers(); // Reload fresh data when switching to users tab
      break;
    case 'timeslots':
      content.innerHTML = await getTimeslotsTab();
      await renderTimeslots();
      break;
    case 'locations':
      content.innerHTML = getLocationsTab();
      await renderLocations();
      break;
    case 'clubs':
      content.innerHTML = await getClubsTab();
      await loadClubs(); // Reload fresh data when switching to clubs tab
      break;
    case 'classes':
      content.innerHTML = await getClassesTab();
      // Auto-populate and select assigned event in classEventFilter
      await setupClassesEventFilter();
      await renderClasses();
      break;
    case 'checkin':
      content.innerHTML = getCheckInTab({ eventId: assignedEventId, userRole: currentUser.role, userClubId: null });
      if (assignedEventId) {
        await checkInLoadParticipants();
      } else {
        await checkInPopulateEventSelector();
      }
      break;
    case 'reports':
      content.innerHTML = await getReportsTab();
      break;
    case 'system':
      content.innerHTML = getSystemTab();
      await initializeSystemTab();
      break;
    default:
      content.innerHTML = await getEventsTab();
      await renderEvents();
      break;
  }
}

function getEventsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Event</h2>
      </div>
      <div id="systemStats" style="padding: 15px; margin-bottom: 20px; background: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 1.1rem;">System Statistics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div id="systemStatsContent">Loading system statistics...</div>
        </div>
      </div>
      <div id="eventDashboardContent" style="margin-bottom: 20px;"></div>
      <div id="eventsList"></div>
    </div>
  `;
}

function getUsersTab() {
  const hasActiveFilters = Object.keys(userFilters).length > 0;
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Users</h2>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="toggleUserFilters()" class="btn btn-outline ${hasActiveFilters ? 'btn-primary' : ''}" id="toggleFiltersBtn" title="Toggle filter row">
            ${hasActiveFilters ? '🔍 Filters Active' : '🔍 Filter'}
          </button>
          ${hasActiveFilters ? `<button onclick="clearUserFilters()" class="btn btn-outline" title="Clear all filters">Clear Filters</button>` : ''}
          <button onclick="toggleDeactivatedUsers()" class="btn btn-outline" id="toggleDeactivatedBtn">
            ${showDeactivatedUsers ? 'Hide Deactivated' : 'Show Deactivated'}
          </button>
          <button onclick="showCreateUserForm()" class="btn btn-primary">Add User</button>
        </div>
      </div>
      <div id="usersList"></div>
    </div>
  `;
}

function getLocationsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Class Locations</h2>
        <button onclick="showCreateLocationForm()" class="btn btn-primary">Create Location</button>
      </div>
      <div id="locationsList"></div>
    </div>
  `;
}

function getTimeslotsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Timeslots</h2>
        <button onclick="showCreateTimeslotForm()" class="btn btn-primary">Create Timeslot</button>
      </div>
      <div id="timeslotsList"></div>
    </div>
  `;
}

function getClubsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Clubs</h2>
        <button onclick="showCreateClubForm()" class="btn btn-primary">Create Club</button>
      </div>
      <div id="clubsList"></div>
    </div>
  `;
}

function getClassesTab() {
  const hasActiveFilters = Object.keys(classFilters).length > 0;
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Classes</h2>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="toggleEventAdminClassFilters()" class="btn btn-outline ${hasActiveFilters ? 'btn-primary' : ''}" id="toggleEventAdminClassFiltersBtn" title="Toggle filter row">
            ${hasActiveFilters ? '🔍 Filters Active' : '🔍 Filter'}
          </button>
          ${hasActiveFilters ? `<button onclick="clearEventAdminClassFilters()" class="btn btn-outline" title="Clear all filters">Clear Filters</button>` : ''}
          <button onclick="showCreateClassForm()" class="btn btn-primary" id="createClassBtn" disabled>Create Class</button>
        </div>
      </div>
      <select id="classEventFilter" class="form-control mb-2" onchange="renderClasses()">
        <option value="">Select Event</option>
      </select>
      <div id="classesList"></div>
    </div>
  `;
}

function getReportsTab() {
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Reports for ${assignedEvent ? assignedEvent.Name : 'Assigned Event'}</h2>
      </div>
      <p class="mb-2"><strong>Event:</strong> ${assignedEvent ? assignedEvent.Name : 'N/A'}</p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button id="generateReportBtn" onclick="generateEventReport()" class="btn btn-primary">Generate CSV Report</button>
        <button id="generateTimeslotRosterBtn" onclick="generateTimeslotRosterReport()" class="btn btn-primary">Generate Timeslot Roster Report</button>
        <button id="generateUsersExportBtn" onclick="generateUsersExport()" class="btn btn-secondary">Export Users CSV</button>
      </div>
    </div>
  `;
}

// Check-in tab now uses the reusable module in checkin.js
// Old getCheckInTab function removed

let checkInSearchTimeout = null;
let checkInSearchResults = [];

async function searchByCheckInNumber() {
  const number = document.getElementById('checkInNumberInput').value;
  if (!number) {
    showNotification('Please enter a check-in number', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/users/checkin/${number}`);
    const user = await response.json();
    
    if (response.ok) {
      displayCheckInUser(user);
    } else {
      showNotification(user.error || 'User not found', 'error');
    }
  } catch (error) {
    showNotification('Error searching: ' + error.message, 'error');
  }
}

async function searchByFirstName(firstName) {
  const dropdown = document.getElementById('userDropdown');
  const selectBtn = document.getElementById('selectUserBtn');
  
  if (!firstName || firstName.length < 2) {
    dropdown.style.display = 'none';
    selectBtn.style.display = 'none';
    return;
  }
  
  clearTimeout(checkInSearchTimeout);
  checkInSearchTimeout = setTimeout(async () => {
    try {
      const response = await fetchWithAuth(`/api/users/search?firstName=${encodeURIComponent(firstName)}`);
      checkInSearchResults = await response.json();
      
      if (checkInSearchResults.length === 0) {
        dropdown.style.display = 'none';
        selectBtn.style.display = 'none';
      } else {
        dropdown.innerHTML = checkInSearchResults.map(u => 
          `<option value="${u.ID}">${u.FirstName} ${u.LastName} - #${u.CheckInNumber || 'N/A'} (${u.Role})</option>`
        ).join('');
        dropdown.style.display = 'block';
        selectBtn.style.display = 'block';
      }
    } catch (error) {
      console.error('Error searching:', error);
    }
  }, 300);
}

async function selectUserFromDropdown() {
  const dropdown = document.getElementById('userDropdown');
  const selectedId = dropdown.value;
  
  if (!selectedId) {
    showNotification('Please select a user', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/users/${selectedId}`);
    const user = await response.json();
    
    if (response.ok) {
      displayCheckInUser(user);
    }
  } catch (error) {
    showNotification('Error loading user: ' + error.message, 'error');
  }
}

function displayCheckInUser(user) {
  const container = document.getElementById('checkInUserDetails');
  container.style.display = 'block';
  
  // Use the existing edit user form
  container.innerHTML = `
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; border: 2px solid var(--primary);">
      <h3 style="margin-bottom: 20px;">Check-In User: ${user.FirstName} ${user.LastName}</h3>
      <div style="background: #fff; padding: 20px; border-radius: 8px;">
        <p><strong>Check-In Number:</strong> #${user.CheckInNumber || 'N/A'}</p>
        <p><strong>Current Check-In Status:</strong> ${user.CheckedIn ? '<span style="color: green;">✓ Checked In</span>' : '<span style="color: red;">Not Checked In</span>'}</p>
        <hr style="margin: 20px 0;">
        <form id="checkInUserForm" onsubmit="handleCheckInUser(event, ${user.ID})">
          <div class="form-group">
            <label for="checkInFirstName">First Name *</label>
            <input type="text" id="checkInFirstName" class="form-control" value="${user.FirstName || ''}" required>
          </div>
          
          <div class="form-group">
            <label for="checkInLastName">Last Name *</label>
            <input type="text" id="checkInLastName" class="form-control" value="${user.LastName || ''}" required>
          </div>
          
          <div class="form-group">
            <label for="checkInEmail">Email</label>
            <input type="email" id="checkInEmail" class="form-control" value="${user.Email || ''}">
          </div>
          
          <div class="form-group">
            <label for="checkInPhone">Phone</label>
            <input type="tel" id="checkInPhone" class="form-control" value="${user.Phone || ''}">
          </div>
          
          <div class="form-group">
            <label for="checkInDateOfBirth">Date of Birth</label>
            <input type="date" id="checkInDateOfBirth" class="form-control" value="${user.DateOfBirth || ''}">
          </div>
          
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" id="checkInBackgroundCheck" ${user.BackgroundCheck ? 'checked' : ''}>
              Background Check Completed
            </label>
          </div>
          
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" id="checkInCheckedIn" ${user.CheckedIn ? 'checked' : ''}>
              Check In User
            </label>
          </div>
          
          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="submit" class="btn btn-primary">Update & Check In</button>
            <button type="button" onclick="clearCheckInForm()" class="btn btn-outline">Clear</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // Scroll to the form
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleCheckInUser(event, userId) {
  event.preventDefault();
  
  const updates = {
    FirstName: document.getElementById('checkInFirstName').value,
    LastName: document.getElementById('checkInLastName').value,
    Email: document.getElementById('checkInEmail').value,
    Phone: document.getElementById('checkInPhone').value,
    DateOfBirth: document.getElementById('checkInDateOfBirth').value,
    BackgroundCheck: document.getElementById('checkInBackgroundCheck').checked,
    CheckedIn: document.getElementById('checkInCheckedIn').checked
  };
  
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('User updated and checked in successfully!', 'success');
      // Refresh the display
      displayCheckInUser(result);
      // Clear search inputs
      document.getElementById('checkInNumberInput').value = '';
      document.getElementById('firstNameSearch').value = '';
      document.getElementById('userDropdown').style.display = 'none';
      document.getElementById('selectUserBtn').style.display = 'none';
    } else {
      showNotification(result.error || 'Error updating user', 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function clearCheckInForm() {
  document.getElementById('checkInUserDetails').style.display = 'none';
  document.getElementById('checkInNumberInput').value = '';
  document.getElementById('firstNameSearch').value = '';
  document.getElementById('userDropdown').style.display = 'none';
  document.getElementById('selectUserBtn').style.display = 'none';
}

function getSystemTab() {
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Branding</h2>
      </div>
      <div style="padding: 20px;">
        <div class="branding-preview" id="brandingPreview">
          <img id="brandingPreviewImage" alt="Logo preview">
          <span id="brandingPreviewPlaceholder">No logo uploaded</span>
        </div>
        <p style="margin-top: 12px;">Current Site Name: <strong id="brandingSiteNameDisplay"></strong></p>
        <p style="margin-top: 12px; color: var(--text-light);">
          Branding settings can be managed by an Admin.
        </p>
      </div>
    </div>
  `;
}

async function initializeSystemTab() {
  const previewImage = document.getElementById('brandingPreviewImage');
  const previewPlaceholder = document.getElementById('brandingPreviewPlaceholder');
  const siteNameDisplay = document.getElementById('brandingSiteNameDisplay');

  if (!previewImage || !previewPlaceholder || !siteNameDisplay) {
    return;
  }

  try {
    const branding = await fetchBrandingSettings();
    siteNameDisplay.textContent = branding.siteName || 'Honors Festival';

    if (branding.logoData) {
      previewImage.src = branding.logoData;
      previewImage.style.display = 'block';
      previewPlaceholder.style.display = 'none';
    } else {
      previewImage.removeAttribute('src');
      previewImage.style.display = 'none';
      previewPlaceholder.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading branding settings:', error);
    siteNameDisplay.textContent = 'Honors Festival';
    previewImage.style.display = 'none';
    previewPlaceholder.style.display = 'block';
  }
}

// Load data
async function loadAssignedEvent() {
  try {
    if (!assignedEventId) {
      showNotification('No event assigned. Please contact an administrator.', 'error');
      return;
    }
    
    const response = await fetchWithAuth(`/api/events/${assignedEventId}`);
    const event = await response.json();
    
    if (response.ok && event) {
      assignedEvent = event;
      allEvents = [event]; // Only one event for EventAdmin
      
      // Update event name in banner
      const eventNameEl = document.getElementById('eventName');
      if (eventNameEl) {
        eventNameEl.textContent = `Event: ${event.Name}`;
      }
    } else {
      showNotification('Error loading assigned event', 'error');
    }
  } catch (error) {
    console.error('Error loading assigned event:', error);
    showNotification('Error loading assigned event', 'error');
  }
}

async function loadEvents() {
  // EventAdmin only has one event - already loaded in loadAssignedEvent
  if (assignedEvent) {
    allEvents = [assignedEvent];
    renderEvents();
  }
}

function updateEventDropdowns() {
  const locationFilter = document.getElementById('locationEventFilter');
  const timeslotFilter = document.getElementById('timeslotEventFilter');
  const clubFilter = document.getElementById('clubEventFilter');
  const classFilter = document.getElementById('classEventFilter');
  const reportFilter = document.getElementById('reportEventFilter');
  
  [locationFilter, timeslotFilter, clubFilter, classFilter, reportFilter].forEach(select => {
    if (select) {
      select.innerHTML = '<option value="">Select Event</option>';
      allEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event.ID;
        option.textContent = event.Name;
        select.appendChild(option);
      });

      // Restore saved selection per filter
      const keyMap = {
        'locationEventFilter': 'adminFilter_location',
        'timeslotEventFilter': 'adminFilter_timeslot',
        'clubEventFilter': 'adminFilter_club',
        'classEventFilter': 'adminFilter_class',
        'reportEventFilter': 'adminFilter_report'
      };
      const storageKey = keyMap[select.id];
      try {
        const saved = storageKey ? localStorage.getItem(storageKey) : null;
        if (saved) select.value = saved;
      } catch (e) {}

      // Save on change
      select.addEventListener('change', () => {
        const k = keyMap[select.id];
        try { if (k) localStorage.setItem(k, select.value || ''); } catch (e) {}
      }, { once: false });
    }
  });
}

async function loadUsers() {
  try {
    // EventAdmin can only see users for their assigned event
    const url = assignedEventId ? `/api/users?eventId=${assignedEventId}` : '/api/users';
    const response = await fetchWithAuth(url);
    allUsers = await response.json();
    
    // Filter to only users for the assigned event
    if (assignedEventId) {
      allUsers = allUsers.filter(user => user.EventID === assignedEventId);
    }
    
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showNotification('Error loading users', 'error');
  }
}

async function loadLocations(eventId) {
  const targetEventId = eventId || assignedEventId;
  
  if (!targetEventId) {
    const container = document.getElementById('locationsList');
    if (container) {
      container.innerHTML = '<p class="text-center">No event assigned</p>';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/events/${targetEventId}/locations`);
    allLocations = await response.json();
    renderLocationsList();
  } catch (error) {
    console.error('Error loading locations:', error);
    showNotification('Error loading locations', 'error');
  }
}

async function loadClasses(eventId) {
  const targetEventId = eventId || assignedEventId;
  
  if (!targetEventId) {
    const container = document.getElementById('classesList');
    if (container) {
      container.innerHTML = '<p class="text-center">No event assigned</p>';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/classes/${targetEventId}`);
    allClasses = await response.json();
    renderClasses();
  } catch (error) {
    console.error('Error loading classes:', error);
    showNotification('Error loading classes', 'error');
  }
}

async function loadClubs(eventId) {
  const targetEventId = eventId || assignedEventId;
  
  if (!targetEventId) {
    const container = document.getElementById('clubsList');
    if (container) {
      container.innerHTML = '<p class="text-center">No event assigned</p>';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs/event/${targetEventId}`);
    allClubs = await response.json();
    renderClubs();
  } catch (error) {
    console.error('Error loading clubs:', error);
    showNotification('Error loading clubs', 'error');
  }
}

async function renderClubs() {
  const container = document.getElementById('clubsList');
  if (!container) return;
  
  if (allClubs.length === 0) {
    container.innerHTML = '<p class="text-center">No clubs found for this event</p>';
    return;
  }
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Club Name</th>
          <th>Church</th>
          <th>Director</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${allClubs.map(club => `
          <tr>
            <td><strong>${club.Name}</strong></td>
            <td>${club.Church || '-'}</td>
            <td>${club.DirectorFirstName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : '<span style="color: #999;">Unassigned</span>'}</td>
            <td>
              <button onclick="editClub(${club.ID})" class="btn btn-sm btn-secondary">Edit</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  const mobileCards = allClubs.map(club => {
    const actionsHtml = `
      <button onclick="editClub(${club.ID})" class="btn btn-sm btn-secondary">Edit</button>
    `;
    
    return createMobileCard({
      'Club Name': club.Name,
      'Church': club.Church || '-',
      'Director': club.DirectorFirstName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : 'Unassigned'
    }, club.Name, actionsHtml);
  }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
}

// Render functions
async function renderEvents() {
  const container = document.getElementById('eventsList');
  if (!container) return;
  
  if (!assignedEvent) {
    container.innerHTML = '<p class="text-center">Loading event...</p>';
    await loadAssignedEvent();
    if (!assignedEvent) {
      container.innerHTML = '<p class="text-center" style="color: red;">Error loading assigned event</p>';
      return;
    }
  }
  
  const isActive = assignedEvent.Active === 1 || assignedEvent.Active === true || assignedEvent.Active === '1';
  const eventStatus = assignedEvent.Status || 'Closed';
  
  // Get class count for this event
  const classCount = allClasses.length;
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Classes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${assignedEvent.Name}</strong>
          </td>
          <td>${assignedEvent.StartDate || 'N/A'}</td>
          <td>${assignedEvent.EndDate || 'N/A'}</td>
          <td>${classCount}</td>
          <td>
            <button onclick="toggleEventActive(${assignedEvent.ID}, ${isActive ? 'true' : 'false'})" class="btn btn-sm ${isActive ? 'btn-success' : 'btn-secondary'}" style="margin-right: 5px;">
              ${isActive ? 'Event Open' : 'Event Closed'}
            </button>
            <button onclick="toggleEventStatus(${assignedEvent.ID}, '${eventStatus}')" class="btn btn-sm ${eventStatus === 'Live' ? 'btn-success' : 'btn-secondary'}" style="margin-right: 5px;">
              ${eventStatus === 'Live' ? 'Registration Open' : 'Registration Closed'}
            </button>
            <button onclick="manageEventClubs(${assignedEvent.ID})" class="btn btn-sm btn-info" style="margin-right: 5px;">Manage Clubs</button>
            <button onclick="editEvent(${assignedEvent.ID})" class="btn btn-sm btn-primary">Edit</button>
          </td>
        </tr>
      </tbody>
    </table>
  `;
  
  const mobileCards = createMobileCard({
    'Name': assignedEvent.Name,
    'Start Date': assignedEvent.StartDate || 'N/A',
    'End Date': assignedEvent.EndDate || 'N/A',
    'Classes': classCount
  }, assignedEvent.Name, `
    <button onclick="toggleEventActive(${assignedEvent.ID}, ${isActive ? 'true' : 'false'})" class="btn btn-sm ${isActive ? 'btn-success' : 'btn-secondary'}">
      ${isActive ? 'Event Open' : 'Event Closed'}
    </button>
    <button onclick="toggleEventStatus(${assignedEvent.ID}, '${eventStatus}')" class="btn btn-sm ${eventStatus === 'Live' ? 'btn-success' : 'btn-secondary'}">
      ${eventStatus === 'Live' ? 'Registration Open' : 'Registration Closed'}
    </button>
    <button onclick="manageEventClubs(${assignedEvent.ID})" class="btn btn-sm btn-info">Manage Clubs</button>
    <button onclick="editEvent(${assignedEvent.ID})" class="btn btn-sm btn-primary">Edit</button>
  `);
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
}

async function loadEventDashboard(eventId) {
  const dashboardContainer = document.getElementById('eventDashboardContent');
  if (!dashboardContainer || !eventId) return;
  
  try {
    const response = await fetchWithAuth(`/api/events/${eventId}/dashboard`);
    if (!response.ok) {
      throw new Error('Failed to load event dashboard');
    }
    
    const data = await response.json();
    const { event, statistics, clubs, locations, timeslots } = data;
    
    // Format address
    const addressParts = [event.Street, event.City, event.State, event.ZIP].filter(p => p);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Not specified';
    
    // Aggregate user counts from clubs data
    const totalDirectors = clubs.reduce((sum, c) => sum + (c.DirectorCount || 0), 0);
    const totalTeachers = clubs.reduce((sum, c) => sum + (c.TeacherCount || 0), 0);
    const totalStaff = clubs.reduce((sum, c) => sum + (c.StaffCount || 0), 0);
    const totalStudents = clubs.reduce((sum, c) => sum + (c.StudentCount || 0), 0);

    // Create compact event overview using stats-grid
    const eventOverviewHtml = `
      <div class="stats-grid">
        <div class="stat-item"><span class="stat-label">Start:</span><span class="stat-value">${event.StartDate}</span></div>
        <div class="stat-item"><span class="stat-label">End:</span><span class="stat-value">${event.EndDate}</span></div>
        <div class="stat-item"><span class="stat-label">Status:</span><span class="stat-value" style="color:${event.Status === 'Live' ? '#28a745' : '#6c757d'}">${event.Status}</span></div>
        <div class="stat-item"><span class="stat-label">Active:</span><span class="stat-value" style="color:${event.Active ? '#28a745' : '#6c757d'}">${event.Active ? 'Yes' : 'No'}</span></div>
        <div class="stat-item"><span class="stat-label">Coordinator:</span><span class="stat-value">${event.CoordinatorName || 'N/A'}</span></div>
        <div class="stat-item"><span class="stat-label">Classes:</span><span class="stat-value" style="color:#007bff">${statistics.classes}</span></div>
        <div class="stat-item"><span class="stat-label">Enrolled:</span><span class="stat-value" style="color:#28a745">${statistics.enrolled}</span></div>
        <div class="stat-item"><span class="stat-label">Waitlisted:</span><span class="stat-value" style="color:#ffc107">${statistics.waitlisted}</span></div>
        <div class="stat-item"><span class="stat-label">Offered Seats:</span><span class="stat-value" style="color:#007bff">${statistics.offeredSeats || 0}</span></div>
        <div class="stat-item"><span class="stat-label">Club Directors:</span><span class="stat-value" style="color:#fd7e14">${totalDirectors}</span></div>
        <div class="stat-item"><span class="stat-label">Teachers:</span><span class="stat-value" style="color:#20c997">${totalTeachers}</span></div>
        <div class="stat-item"><span class="stat-label">Staff:</span><span class="stat-value" style="color:#17a2b8">${totalStaff}</span></div>
        <div class="stat-item"><span class="stat-label">Students:</span><span class="stat-value" style="color:#28a745">${totalStudents}</span></div>
        <div class="stat-item"><span class="stat-label">Clubs:</span><span class="stat-value">${statistics.clubs}</span></div>
        <div class="stat-item"><span class="stat-label">Locations:</span><span class="stat-value">${statistics.locations}</span></div>
        <div class="stat-item"><span class="stat-label">Timeslots:</span><span class="stat-value">${statistics.timeslots}</span></div>
        ${event.LocationDescription ? `<div class="stat-item"><span class="stat-label">Location:</span><span class="stat-value">${event.LocationDescription}</span></div>` : ''}
        ${fullAddress !== 'Not specified' ? `<div class="stat-item"><span class="stat-label">Address:</span><span class="stat-value">${fullAddress}</span></div>` : ''}
      </div>
    `;

    const dashboardHtml = `
      <div style="margin-bottom: 20px; background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
        <h3 style="margin: 0 0 12px 0; color: #495057; font-size: 1.1rem;">Event Overview: <span style="color: #007bff;">${event.Name}</span></h3>
        ${eventOverviewHtml}
      </div>
      
      ${clubs.length > 0 ? `
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 1.1rem;">Linked Clubs (${clubs.length})</h3>
          ${wrapResponsiveTable(`
            <table class="table" style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th>Club Name</th>
                  <th>Director</th>
                  <th>Directors</th>
                  <th>Teachers</th>
                  <th>Staff</th>
                  <th>Students</th>
                  <th>Classes</th>
                  <th>Seats</th>
                  <th>Classes Completed</th>
                </tr>
              </thead>
              <tbody>
                ${clubs.map(club => `
                  <tr>
                    <td><strong>${club.Name}</strong></td>
                    <td>${club.DirectorFirstName && club.DirectorLastName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : '<span style="color: #999;">Unassigned</span>'}</td>
                    <td>${club.DirectorCount || 0}</td>
                    <td>${club.TeacherCount || 0}</td>
                    <td>${club.StaffCount || 0}</td>
                    <td>${club.StudentCount || 0}</td>
                    <td>${club.ClassCount || 0}</td>
                    <td>${club.SeatsOffered || 0}</td>
                    <td>${club.ClassesCompletedCount || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `, clubs.map(club => createMobileCard({
            'Club Name': club.Name,
            'Director': club.DirectorFirstName && club.DirectorLastName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : 'Unassigned',
            'Directors': club.DirectorCount || 0,
            'Teachers': club.TeacherCount || 0,
            'Staff': club.StaffCount || 0,
            'Students': club.StudentCount || 0,
            'Classes': club.ClassCount || 0,
            'Seats': club.SeatsOffered || 0,
            'Classes Completed': club.ClassesCompletedCount || 0
          }, club.Name)).join(''))}
        </div>
      ` : ''}
      
      ${locations.length > 0 ? `
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 1.1rem;">Locations (${locations.length})</h3>
          ${wrapResponsiveTable(`
            <table class="table" style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Capacity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${locations.map(loc => `
                  <tr>
                    <td><strong>${loc.Name}</strong></td>
                    <td>${loc.MaxCapacity}</td>
                    <td>${loc.Description || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `, locations.map(loc => createMobileCard({
            'Name': loc.Name,
            'Capacity': loc.MaxCapacity,
            'Description': loc.Description || '-'
          }, loc.Name)).join(''))}
        </div>
      ` : ''}
      
      ${timeslots.length > 0 ? `
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
          <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 1.1rem;">Timeslots (${timeslots.length})</h3>
          ${wrapResponsiveTable(`
            <table class="table" style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${timeslots.map(ts => `
                  <tr>
                    <td><strong>${ts.Date}</strong></td>
                    <td>${convertTo12Hour(ts.StartTime)} - ${convertTo12Hour(ts.EndTime)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `, timeslots.map(ts => createMobileCard({
            'Date': ts.Date,
            'Time': `${convertTo12Hour(ts.StartTime)} - ${convertTo12Hour(ts.EndTime)}`
          }, ts.Date)).join(''))}
        </div>
      ` : ''}
    `;
    
    dashboardContainer.innerHTML = dashboardHtml;
  } catch (error) {
    dashboardContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc3545;">Error loading dashboard: ${error.message}</div>`;
  }
}

async function loadSystemStats() {
  const statsContainer = document.getElementById('systemStatsContent');
  if (!statsContainer) return;
  
  try {
    // Event Admin should see stats filtered to their assigned event only
    const url = assignedEventId 
      ? `/api/events/${assignedEventId}/system-stats`
      : '/api/events/system-stats';
    
    const response = await fetchWithAuth(url);
    if (!response.ok) {
      throw new Error('Failed to load system statistics');
    }
    
    const stats = await response.json();
    
    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-item"><span class="stat-label">Total Users:</span><span class="stat-value" style="color:#007bff">${stats.users.total}</span></div>
        <div class="stat-item"><span class="stat-label">Admins:</span><span class="stat-value" style="color:#6f42c1">${stats.users.admin}</span></div>
        <div class="stat-item"><span class="stat-label">Teachers:</span><span class="stat-value" style="color:#20c997">${stats.users.teacher}</span></div>
        <div class="stat-item"><span class="stat-label">Students:</span><span class="stat-value" style="color:#28a745">${stats.users.student}</span></div>
        <div class="stat-item"><span class="stat-label">Total Classes:</span><span class="stat-value" style="color:#007bff">${stats.classes}</span></div>
        <div class="stat-item"><span class="stat-label">Event Admins:</span><span class="stat-value" style="color:#e83e8c">${stats.users.eventAdmin}</span></div>
        <div class="stat-item"><span class="stat-label">Staff:</span><span class="stat-value" style="color:#17a2b8">${stats.users.staff}</span></div>
        <div class="stat-item"><span class="stat-label">Club Directors:</span><span class="stat-value" style="color:#fd7e14">${stats.users.clubDirector}</span></div>
        <div class="stat-item"><span class="stat-label">Enrolled:</span><span class="stat-value" style="color:#28a745">${stats.enrolled}</span></div>
        <div class="stat-item"><span class="stat-label">Waitlisted:</span><span class="stat-value" style="color:#ffc107">${stats.waitlisted}</span></div>
        <div class="stat-item"><span class="stat-label">Offered Seats:</span><span class="stat-value" style="color:#007bff">${stats.offeredSeats || 0}</span></div>
      </div>
    `;
  } catch (error) {
    statsContainer.innerHTML = `<div style="color: #dc3545;">Error loading system statistics: ${error.message}</div>`;
  }
}

function renderUsers() {
  const container = document.getElementById('usersList');
  if (!container) return;
  
  if (allUsers.length === 0) {
    container.innerHTML = '<p class="text-center">No users yet. Create your first user!</p>';
    return;
  }
  
  // Apply filters
  let filteredUsers = [...allUsers];
  
  // Filter out deactivated users by default, but show invited users even if inactive
  if (!showDeactivatedUsers) {
    filteredUsers = filteredUsers.filter(user => {
      // Show active users
      if (user.Active === 1 || user.Active === true) return true;
      // Also show invited users even if inactive (they need to be visible so we can track them)
      if (user.Invited && !user.InviteAccepted) return true;
      // Hide other inactive users
      return false;
    });
  }
  
  if (Object.keys(userFilters).length > 0) {
    filteredUsers = filteredUsers.filter(user => {
      return Object.entries(userFilters).every(([column, filterValue]) => {
        if (!filterValue) return true;
        const lowerFilter = filterValue.toLowerCase();
        
        switch(column) {
          case 'name':
            return `${user.FirstName} ${user.LastName}`.toLowerCase().includes(lowerFilter);
          case 'username':
            return user.Username.toLowerCase().includes(lowerFilter);
          case 'role':
            return getRoleLabel(user.Role, user.EventID).toLowerCase().includes(lowerFilter);
          case 'event':
            return (user.EventName || 'N/A').toLowerCase().includes(lowerFilter);
          case 'club':
            return (user.ClubName || 'None').toLowerCase().includes(lowerFilter);
          case 'age':
            return (user.Age !== null ? user.Age.toString() : 'N/A').toLowerCase().includes(lowerFilter);
          case 'bgcheck':
            return (user.BackgroundCheck ? 'yes' : 'no').includes(lowerFilter);
          default:
            return true;
        }
      });
    });
  }
  
  // Apply sorting
  if (userSortColumn) {
    filteredUsers.sort((a, b) => {
      let aVal, bVal;
      
      switch(userSortColumn) {
        case 'name':
          aVal = `${a.FirstName} ${a.LastName}`;
          bVal = `${b.FirstName} ${b.LastName}`;
          break;
        case 'username':
          aVal = a.Username;
          bVal = b.Username;
          break;
        case 'role':
          aVal = getRoleLabel(a.Role, a.EventID);
          bVal = getRoleLabel(b.Role, b.EventID);
          break;
        case 'event':
          aVal = a.EventName || '';
          bVal = b.EventName || '';
          break;
        case 'club':
          aVal = a.ClubName || '';
          bVal = b.ClubName || '';
          break;
        case 'age':
          aVal = a.Age !== null ? a.Age : 0;
          bVal = b.Age !== null ? b.Age : 0;
          break;
        case 'bgcheck':
          aVal = a.BackgroundCheck ? 1 : 0;
          bVal = b.BackgroundCheck ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        return userSortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return userSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th class="filterable ${userFilters.name ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('name')">Name ${userSortColumn === 'name' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${userFilters.username ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('username')">Username ${userSortColumn === 'username' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${userFilters.role ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('role')">Role ${userSortColumn === 'role' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${userFilters.event ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('event')">Event ${userSortColumn === 'event' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${userFilters.club ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('club')">Club ${userSortColumn === 'club' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${userFilters.age ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('age')">Age (DOB) ${userSortColumn === 'age' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${userFilters.bgcheck ? 'filter-active' : ''}" onclick="toggleUserColumnFilter('bgcheck')">BG Check ${userSortColumn === 'bgcheck' ? (userSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th>Actions</th>
        </tr>
        <tr class="filter-row" id="userFilterRow" style="display: ${Object.keys(userFilters).length > 0 ? 'table-row' : 'none'}; background-color: #f8fafc;">
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-name" value="${userFilters.name || ''}" oninput="debouncedUpdateUserFilter('name', this.value)" placeholder="Filter by name...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-username" value="${userFilters.username || ''}" oninput="debouncedUpdateUserFilter('username', this.value)" placeholder="Filter by username...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-role" value="${userFilters.role || ''}" oninput="debouncedUpdateUserFilter('role', this.value)" placeholder="Filter by role...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-event" value="${userFilters.event || ''}" oninput="debouncedUpdateUserFilter('event', this.value)" placeholder="Filter by event...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-club" value="${userFilters.club || ''}" oninput="debouncedUpdateUserFilter('club', this.value)" placeholder="Filter by club...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-age" value="${userFilters.age || ''}" oninput="debouncedUpdateUserFilter('age', this.value)" placeholder="Filter by age...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-bgcheck" value="${userFilters.bgcheck || ''}" oninput="debouncedUpdateUserFilter('bgcheck', this.value)" placeholder="yes/no...">
          </td>
          <td class="filter-cell"></td>
        </tr>
      </thead>
      <tbody>
        ${filteredUsers.length === 0 ? '<tr><td colspan="8" class="text-center">No users match the current filters</td></tr>' : filteredUsers.map(user => {
          const isInvitedNotAccepted = user.Invited && !user.InviteAccepted;
          const rowStyle = isInvitedNotAccepted ? 'style="color: #1565c0; font-weight: 500;"' : '';
          return `
          <tr ${rowStyle}>
            <td>${user.FirstName} ${user.LastName}${isInvitedNotAccepted ? ' <span style="font-size: 0.85em; opacity: 0.8;">(Invited)</span>' : ''}</td>
            <td>${user.Username}</td>
            <td>${getRoleLabel(user.Role, user.EventID)}</td>
            <td>${user.EventName ? user.EventName : '<span style="color: #999;">N/A</span>'}</td>
            <td>${user.ClubName ? `<strong>${user.ClubName}</strong>` : '<span style="color: #d32f2f;">None</span>'}</td>
            <td>${user.Age !== null ? user.Age : 'N/A'}</td>
            <td>${user.BackgroundCheck ? '✓' : '-'}</td>
            <td>
              <button onclick="editUser(${user.ID})" class="btn btn-sm btn-secondary">Edit</button>
              ${isInvitedNotAccepted ? `
                <button onclick="resendInvite('${user.Email}')" class="btn btn-sm btn-info">Resend Invite</button>
              ` : ''}
              <button onclick="toggleUserStatus(${user.ID}, ${user.Active})" class="btn btn-sm ${user.Active ? 'btn-warning' : 'btn-success'}">
                ${user.Active ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  const mobileCards = filteredUsers.length === 0 
    ? '<div class="card-row"><div class="card-row-value text-center">No users match the current filters</div></div>'
    : filteredUsers.map(user => {
        const isInvitedNotAccepted = user.Invited && !user.InviteAccepted;
        const nameStyle = isInvitedNotAccepted ? 'style="color: #1565c0; font-weight: 500;"' : '';
        const actionsHtml = `
          <button onclick="editUser(${user.ID})" class="btn btn-sm btn-secondary">Edit</button>
          ${isInvitedNotAccepted ? `
            <button onclick="resendInvite('${user.Email}')" class="btn btn-sm btn-info">Resend Invite</button>
          ` : ''}
          <button onclick="toggleUserStatus(${user.ID}, ${user.Active})" class="btn btn-sm ${user.Active ? 'btn-warning' : 'btn-success'}">
            ${user.Active ? 'Deactivate' : 'Activate'}
          </button>
        `;
        
        const cardData = {
          'Name': `${user.FirstName} ${user.LastName}${isInvitedNotAccepted ? ' (Invited)' : ''}`,
          'Username': user.Username,
          'Role': getRoleLabel(user.Role, user.EventID),
          'Event': user.EventName || 'N/A',
          'Club': user.ClubName || 'None',
          'Age (DOB)': user.Age !== null ? user.Age : 'N/A',
          'BG Check': user.BackgroundCheck ? '✓' : '-'
        };
        
        return createMobileCard(cardData, `${user.FirstName} ${user.LastName}`, actionsHtml);
      }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
  
  // Update filter button state after rendering
  updateFilterButtonState();
}

function toggleUserColumnFilter(column) {
  // Show filter row if hidden and add filter for this column
  const filterRow = document.getElementById('userFilterRow');
  if (filterRow && filterRow.style.display === 'none') {
    filterRow.style.display = 'table-row';
  }
  
  // Focus on the filter input for this column
  const filterInput = document.getElementById(`filter-${column}`);
  if (filterInput) {
    filterInput.focus();
  }
  
  // Update filter button state
  const filterBtn = document.getElementById('toggleFiltersBtn');
  if (filterBtn && filterRow && filterRow.style.display !== 'none') {
    filterBtn.classList.add('btn-primary');
    filterBtn.textContent = '🔍 Filters Active';
  }
  
  // Toggle sorting
  if (userSortColumn === column) {
    userSortDirection = userSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    userSortColumn = column;
    userSortDirection = 'asc';
  }
  
  renderUsers();
}

function updateUserFilter(column, value) {
  if (value.trim()) {
    userFilters[column] = value.trim();
  } else {
    delete userFilters[column];
    // Hide filter row if no filters active
    if (Object.keys(userFilters).length === 0) {
      const filterRow = document.getElementById('userFilterRow');
      if (filterRow) filterRow.style.display = 'none';
      // Update filter button state
      const filterBtn = document.getElementById('toggleFiltersBtn');
      if (filterBtn) {
        filterBtn.classList.remove('btn-primary');
        filterBtn.textContent = '🔍 Filter';
      }
      // Remove clear filters button
      const clearBtn = filterBtn?.nextElementSibling;
      if (clearBtn && clearBtn.onclick?.toString().includes('clearUserFilters')) {
        clearBtn.remove();
      }
    }
  }
  renderUsers();
  // Update filter button state
  updateFilterButtonState();
}

// Debounced version of updateUserFilter (400ms delay)
const debouncedUpdateUserFilter = debounce(updateUserFilter, 400);

function toggleUserFilters() {
  const filterRow = document.getElementById('userFilterRow');
  if (!filterRow) return;
  
  const isVisible = filterRow.style.display !== 'none';
  filterRow.style.display = isVisible ? 'none' : 'table-row';
  
  // Update button text
  const filterBtn = document.getElementById('toggleFiltersBtn');
  if (filterBtn) {
    if (isVisible) {
      filterBtn.classList.remove('btn-primary');
      filterBtn.textContent = '🔍 Filter';
    } else {
      filterBtn.classList.add('btn-primary');
      filterBtn.textContent = '🔍 Filters Active';
    }
  }
}

function clearUserFilters() {
  userFilters = {};
  userSortColumn = null;
  userSortDirection = 'asc';
  
  // Clear all filter inputs
  const filterInputs = document.querySelectorAll('.filter-input');
  filterInputs.forEach(input => input.value = '');
  
  // Hide filter row
  const filterRow = document.getElementById('userFilterRow');
  if (filterRow) filterRow.style.display = 'none';
  
  // Update filter button
  const filterBtn = document.getElementById('toggleFiltersBtn');
  if (filterBtn) {
    filterBtn.classList.remove('btn-primary');
    filterBtn.textContent = '🔍 Filter';
  }
  
  // Remove clear filters button
  const clearBtn = filterBtn?.nextElementSibling;
  if (clearBtn && clearBtn.onclick?.toString().includes('clearUserFilters')) {
    clearBtn.remove();
  }
  
  renderUsers();
}

function updateFilterButtonState() {
  const filterBtn = document.getElementById('toggleFiltersBtn');
  if (!filterBtn) return;
  
  const hasActiveFilters = Object.keys(userFilters).length > 0;
  if (hasActiveFilters) {
    filterBtn.classList.add('btn-primary');
    filterBtn.textContent = '🔍 Filters Active';
    
    // Add clear filters button if it doesn't exist
    if (!filterBtn.nextElementSibling || !filterBtn.nextElementSibling.onclick?.toString().includes('clearUserFilters')) {
      const clearBtn = document.createElement('button');
      clearBtn.onclick = clearUserFilters;
      clearBtn.className = 'btn btn-outline';
      clearBtn.textContent = 'Clear Filters';
      clearBtn.title = 'Clear all filters';
      filterBtn.insertAdjacentElement('afterend', clearBtn);
    }
  } else {
    filterBtn.classList.remove('btn-primary');
    filterBtn.textContent = '🔍 Filter';
    
    // Remove clear filters button
    const clearBtn = filterBtn.nextElementSibling;
    if (clearBtn && clearBtn.onclick?.toString().includes('clearUserFilters')) {
      clearBtn.remove();
    }
  }
}

async function renderLocations() {
  await loadLocations();
  renderLocationsList();
}

function renderLocationsList() {
  const container = document.getElementById('locationsList');
  if (!container) return;
  
  if (allLocations.length === 0) {
    container.innerHTML = '<p class="text-center">No locations for this event. Create your first location!</p>';
    return;
  }
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Max Capacity</th>
          <th>Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${allLocations.map(loc => `
          <tr>
            <td><strong>${loc.Name}</strong></td>
            <td>${loc.MaxCapacity}</td>
            <td>${loc.Description || '-'}</td>
            <td>
              <button onclick="editLocation(${loc.ID})" class="btn btn-sm btn-secondary">Edit</button>
              <button onclick="deleteLocation(${loc.ID})" class="btn btn-sm btn-danger">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  const mobileCards = allLocations.map(loc => {
    const actionsHtml = `
      <button onclick="editLocation(${loc.ID})" class="btn btn-sm btn-secondary">Edit</button>
      <button onclick="deleteLocation(${loc.ID})" class="btn btn-sm btn-danger">Delete</button>
    `;
    
    return createMobileCard({
      'Name': loc.Name,
      'Max Capacity': loc.MaxCapacity,
      'Description': loc.Description || '-'
    }, loc.Name, actionsHtml);
  }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
}

// Actions
async function editEvent(eventId) {
  const event = allEvents.find(e => e.ID === eventId);
  if (!event) return;

  const modal = document.createElement('div');
  modal.id = 'editEventModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h2>Edit Event</h2>
        <button onclick="closeModal('editEventModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editEventForm" onsubmit="handleEditEvent(event, ${eventId})">
        <div class="form-group">
          <label for="editEventName">Event Name *</label>
          <input type="text" id="editEventName" name="editEventName" class="form-control" value="${event.Name}" required>
        </div>
        <div class="form-group">
          <label for="editStartDate">Start Date *</label>
          <input type="date" id="editStartDate" name="editStartDate" class="form-control" value="${event.StartDate}" required>
        </div>
        <div class="form-group">
          <label for="editEndDate">End Date *</label>
          <input type="date" id="editEndDate" name="editEndDate" class="form-control" value="${event.EndDate}" required>
        </div>
        <div class="form-group">
          <label for="editCoordinatorName">Coordinator Name *</label>
          <input type="text" id="editCoordinatorName" name="editCoordinatorName" class="form-control" value="${event.CoordinatorName || ''}" required>
        </div>
        <div class="form-group">
          <label for="editDescription">Description</label>
          <textarea id="editDescription" name="editDescription" class="form-control" rows="3">${event.Description || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="editStreet">Street Address</label>
          <input type="text" id="editStreet" name="editStreet" class="form-control" value="${event.Street || ''}">
        </div>
        <div class="form-group">
          <label for="editCity">City</label>
          <input type="text" id="editCity" name="editCity" class="form-control" value="${event.City || ''}">
        </div>
        <div class="form-group">
          <label for="editState">State</label>
          <input type="text" id="editState" name="editState" class="form-control" value="${event.State || ''}">
        </div>
        <div class="form-group">
          <label for="editZIP">ZIP Code</label>
          <input type="text" id="editZIP" name="editZIP" class="form-control" value="${event.ZIP || ''}">
        </div>
        <div class="form-group">
          <label for="editLocationDescription">Location Description</label>
          <input type="text" id="editLocationDescription" name="editLocationDescription" class="form-control" value="${event.LocationDescription || ''}">
        </div>
        <hr style="margin: 20px 0; border-color: var(--border);">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--primary);">Event Status</h3>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="editEventActive" name="editEventActive" ${event.Active ? 'checked' : ''} style="width: auto;">
            <strong>Active</strong>
          </label>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">
            Active events are visible to clubs and participants. Inactive events are hidden.
          </small>
        </div>
        <div class="form-group">
          <label for="editEventStatus">Registration Status *</label>
          <select id="editEventStatus" name="editEventStatus" class="form-control" required>
            <option value="Closed" ${event.Status === 'Closed' ? 'selected' : ''}>Closed (View Only)</option>
            <option value="Live" ${event.Status === 'Live' ? 'selected' : ''}>Live (Registration Open)</option>
          </select>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">
            <strong>Closed:</strong> Clubs can view classes but cannot register.<br>
            <strong>Live:</strong> Clubs can view and register for classes.
          </small>
        </div>
        <hr style="margin: 20px 0; border-color: var(--border);">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--primary);">Custom Role Names</h3>
        <small style="color: var(--text-light); margin-bottom: 15px; display: block;">Configure how role names appear for this event.</small>
        <div class="form-group">
          <label for="editRoleLabelStudent">Student Label</label>
          <input type="text" id="editRoleLabelStudent" name="editRoleLabelStudent" class="form-control" value="${event.RoleLabelStudent || 'Student'}">
        </div>
        <div class="form-group">
          <label for="editRoleLabelTeacher">Teacher Label</label>
          <input type="text" id="editRoleLabelTeacher" name="editRoleLabelTeacher" class="form-control" value="${event.RoleLabelTeacher || 'Teacher'}">
        </div>
        <div class="form-group">
          <label for="editRoleLabelStaff">Staff Label</label>
          <input type="text" id="editRoleLabelStaff" name="editRoleLabelStaff" class="form-control" value="${event.RoleLabelStaff || 'Staff'}">
        </div>
        <div class="form-group">
          <label for="editRoleLabelClubDirector">Club Director Label</label>
          <input type="text" id="editRoleLabelClubDirector" name="editRoleLabelClubDirector" class="form-control" value="${event.RoleLabelClubDirector || 'Club Director'}">
        </div>
        <div class="form-group">
          <label for="editRoleLabelEventAdmin">Event Admin Label</label>
          <input type="text" id="editRoleLabelEventAdmin" name="editRoleLabelEventAdmin" class="form-control" value="${event.RoleLabelEventAdmin || 'Event Admin'}">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 20px;">Update Event</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleEditEvent(event, eventId) {
  event.preventDefault();
  
  const form = event.target;
  const eventData = {
    Name: form.editEventName.value.trim(),
    StartDate: form.editStartDate.value,
    EndDate: form.editEndDate.value,
    CoordinatorName: form.editCoordinatorName.value.trim(),
    Description: form.editDescription.value.trim() || null,
    Street: form.editStreet.value.trim() || null,
    City: form.editCity.value.trim() || null,
    State: form.editState.value.trim() || null,
    ZIP: form.editZIP.value.trim() || null,
    LocationDescription: form.editLocationDescription.value.trim() || null,
    Active: form.editEventActive?.checked ?? true,
    Status: form.editEventStatus.value,
    RoleLabelStudent: form.editRoleLabelStudent.value.trim() || 'Student',
    RoleLabelTeacher: form.editRoleLabelTeacher.value.trim() || 'Teacher',
    RoleLabelStaff: form.editRoleLabelStaff.value.trim() || 'Staff',
    RoleLabelClubDirector: form.editRoleLabelClubDirector.value.trim() || 'Club Director',
    RoleLabelEventAdmin: form.editRoleLabelEventAdmin.value.trim() || 'Event Admin'
  };

  try {
    const response = await fetchWithAuth(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });

    if (response.ok) {
      showNotification('Event updated successfully', 'success');
      closeModal('editEventModal');
      await loadEvents();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error updating event', 'error');
    }
  } catch (error) {
    showNotification('Error updating event: ' + error.message, 'error');
  }
}

async function toggleEventActive(eventId, currentActiveStr) {
  try {
    // Handle string 'true'/'false' from onclick, or boolean/number from API
    const isCurrentlyActive = currentActiveStr === 'true' || currentActiveStr === true || currentActiveStr === 1 || currentActiveStr === '1';
    const newActive = !isCurrentlyActive;
    
    // Send as integer (1 or 0) to match SQLite BOOLEAN storage
    const updates = { Active: newActive ? 1 : 0 };
    
    // If closing event (Active = 0), automatically close registration
    // The backend will handle this automatically, but we can also set it here for clarity
    if (!newActive) {
      updates.Status = 'Closed';
    }
    // Note: If opening event (Active = 1), we do NOT automatically open registration
    // Registration status remains unchanged and must be toggled separately
    
    const response = await fetchWithAuth(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (response.ok) {
      const updatedEvent = await response.json();
      
      // Determine the actual Active value (SQLite returns 1/0 as integers)
      const isActive = updatedEvent.Active === 1 || updatedEvent.Active === true || updatedEvent.Active === '1';
      
      // Verify the update worked - if not, show error
      if (isActive !== newActive) {
        showNotification('Warning: Event status may not have updated correctly. Please refresh the page.', 'error');
        // Still reload to show current state
        await loadEvents();
        return;
      }
      
      // Force immediate update of the specific event in allEvents array
      const eventIndex = allEvents.findIndex(e => e.ID === eventId);
      if (eventIndex !== -1) {
        allEvents[eventIndex] = {
          ...allEvents[eventIndex],
          Active: isActive,  // Store as boolean for consistency
          Status: updatedEvent.Status
        };
        
        // Immediately re-render with updated data
        renderEvents();
      }
      
      showNotification(`Event ${newActive ? 'opened' : 'closed'} successfully`, 'success');
      
      // Reload from server to ensure we have the latest data (this will call renderEvents again)
      await loadEvents();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error updating event status', 'error');
    }
  } catch (error) {
    console.error('Error in toggleEventActive:', error);
    showNotification('Error updating event active status: ' + error.message, 'error');
  }
}

async function toggleEventStatus(eventId, currentStatus) {
  try {
    const newStatus = currentStatus === 'Live' ? 'Closed' : 'Live';
    const response = await fetchWithAuth(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status: newStatus })
    });
    
    if (response.ok) {
      showNotification(`Class registration ${newStatus === 'Live' ? 'opened' : 'closed'} successfully`, 'success');
      await loadEvents();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error updating registration status', 'error');
    }
  } catch (error) {
    showNotification('Error updating event status', 'error');
  }
}

function toggleDeactivatedUsers() {
  showDeactivatedUsers = !showDeactivatedUsers;
  const btn = document.getElementById('toggleDeactivatedBtn');
  if (btn) {
    btn.textContent = showDeactivatedUsers ? 'Hide Deactivated' : 'Show Deactivated';
  }
  renderUsers();
}

async function toggleUserStatus(userId, currentActive) {
  if (!confirm(`Are you sure you want to ${currentActive ? 'deactivate' : 'activate'} this user?`)) return;
  
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ Active: !currentActive })
    });
    
    if (response.ok) {
      showNotification('User status updated', 'success');
      await loadUsers();
    }
  } catch (error) {
    showNotification('Error updating user status', 'error');
  }
}

async function editClass(classId) {
  const cls = allClasses.find(c => c.ID === classId);
  if (!cls) return;
  
  const select = document.getElementById('classEventFilter');
  const eventId = select?.value || cls.EventID;
  
  // Load honors, teachers, locations, and clubs for dropdowns
  const [honorsRes, locationsRes, teachersRes, directorsRes, clubsRes] = await Promise.all([
    fetchWithAuth('/api/classes/honors'),
    fetchWithAuth(`/api/events/${eventId}/locations`),
    fetchWithAuth(`/api/users?role=Teacher&eventId=${eventId}`),
    fetchWithAuth(`/api/users?role=ClubDirector&eventId=${eventId}`),
    fetchWithAuth(`/api/clubs/event/${eventId}`)
  ]);
  
  const honors = await honorsRes.json();
  const locations = await locationsRes.json();
  const teachers = await teachersRes.json();
  const directors = await directorsRes.json();
  const clubs = await clubsRes.json();
  // Merge teachers and club directors for teacher selection
  const allTeachers = [...teachers, ...directors].sort((a, b) => {
    if (a.LastName !== b.LastName) return a.LastName.localeCompare(b.LastName);
    return a.FirstName.localeCompare(b.FirstName);
  });
  
  const modal = document.createElement('div');
  modal.id = 'editClassModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h2>Edit Class</h2>
        <button onclick="closeModal('editClassModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editClassForm" onsubmit="handleEditClass(event, ${classId})">
        <div class="form-group">
          <label>Honor</label>
          <input type="text" value="${cls.HonorName || 'Unknown'}" class="form-control" disabled>
          <small style="color: var(--text-light);">Cannot change honor after creation</small>
        </div>
        <div class="form-group">
          <label for="editClassClub">Club</label>
          <select id="editClassClub" name="editClassClub" class="form-control">
            <option value="">No Club</option>
            ${clubs.map(c => `<option value="${c.ID}" ${cls.ClubID === c.ID ? 'selected' : ''}>${c.Name}</option>`).join('')}
          </select>
          <small style="color: var(--text-light);">The club offering this class</small>
        </div>
        <div class="form-group">
          <label for="editClassTeacher">Teacher</label>
          <select id="editClassTeacher" name="editClassTeacher" class="form-control">
            <option value="">Unassigned</option>
            ${allTeachers.map(t => `<option value="${t.ID}" ${cls.TeacherID === t.ID ? 'selected' : ''}>${t.FirstName} ${t.LastName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="editClassLocation">Location</label>
          <select id="editClassLocation" name="editClassLocation" class="form-control">
            <option value="">No Location</option>
            ${locations.map(l => `<option value="${l.ID}" ${cls.LocationID === l.ID ? 'selected' : ''}>${l.Name} (Capacity: ${l.MaxCapacity})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="editClassMaxCapacity">Max Capacity</label>
          <input type="number" id="editClassMaxCapacity" name="editClassMaxCapacity" class="form-control" min="1" value="${cls.TeacherMaxStudents || cls.MaxCapacity}">
          <small style="color: var(--text-light);">Will be limited by location capacity</small>
        </div>
        <div class="form-group">
          <label for="editClassMinimumLevel">Minimum Level Requirement</label>
          <select id="editClassMinimumLevel" name="editClassMinimumLevel" class="form-control">
            <option value="" ${!cls.MinimumLevel ? 'selected' : ''}>All Levels Welcome</option>
            <option value="Friend" ${cls.MinimumLevel === 'Friend' ? 'selected' : ''}>Friend and above</option>
            <option value="Companion" ${cls.MinimumLevel === 'Companion' ? 'selected' : ''}>Companion and above</option>
            <option value="Explorer" ${cls.MinimumLevel === 'Explorer' ? 'selected' : ''}>Explorer and above</option>
            <option value="Ranger" ${cls.MinimumLevel === 'Ranger' ? 'selected' : ''}>Ranger and above</option>
            <option value="Voyager" ${cls.MinimumLevel === 'Voyager' ? 'selected' : ''}>Voyager and above</option>
            <option value="Guide" ${cls.MinimumLevel === 'Guide' ? 'selected' : ''}>Guide and above</option>
            <option value="MasterGuide" ${cls.MinimumLevel === 'MasterGuide' ? 'selected' : ''}>Master Guide only</option>
          </select>
          <small style="color: var(--text-light);">Leave as "All Levels" if no restriction needed</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Class</button>
          <button type="button" onclick="closeModal('editClassModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleEditClass(e, classId) {
  e.preventDefault();
  const form = e.target;
  
  const classData = {
    ClubID: form.editClassClub?.value || null,
    TeacherID: form.editClassTeacher?.value || null,
    LocationID: form.editClassLocation?.value || null,
    TeacherMaxStudents: parseInt(form.editClassMaxCapacity?.value) || 0,
    MinimumLevel: form.editClassMinimumLevel?.value || null
  };
  
  try {
    const response = await fetchWithAuth(`/api/classes/${classId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Class updated successfully', 'success');
      closeModal('editClassModal');
      await renderClasses();
    } else {
      showNotification(result.error || 'Error updating class', 'error');
    }
  } catch (error) {
    showNotification('Error updating class: ' + error.message, 'error');
  }
}

async function deactivateClass(classId) {
  if (!confirm('Are you sure? All students will be removed from this class. The class will remain in the list but marked as inactive.')) return;
  
  try {
    const response = await fetchWithAuth(`/api/classes/${classId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showNotification('Class deactivated. All students have been removed from the class.', 'success');
      await renderClasses();
    }
  } catch (error) {
    showNotification('Error deactivating class', 'error');
  }
}

async function activateClass(classId) {
  if (!confirm('Activate this class? The class will be available for student registration. (No students will be registered from previous enrollment.)')) return;

  try {
    const response = await fetchWithAuth(`/api/classes/${classId}/activate`, {
      method: 'POST'
    });

    if (response.ok) {
      showNotification('Class activated successfully.', 'success');
      await renderClasses();
    }
  } catch (error) {
    showNotification('Error activating class', 'error');
  }
}

async function removeClass(classId) {
  // Get class info to check if it's multi-session
  try {
    const classResponse = await fetchWithAuth(`/api/classes/details/${classId}`);
    if (!classResponse.ok) {
      showNotification('Error loading class details', 'error');
      return;
    }
    const classData = await classResponse.json();
    
    const isMultiSession = classData.IsMultiSession && classData.TotalSessions > 1;
    const confirmMessage = isMultiSession
      ? `Are you sure you want to permanently remove this class and all ${classData.TotalSessions} sessions? This action cannot be undone. All registrations and attendance records will be deleted.`
      : 'Are you sure you want to permanently remove this class? This action cannot be undone. All registrations and attendance records will be deleted.';
    
    if (!confirm(confirmMessage)) return;

    const response = await fetchWithAuth(`/api/classes/${classId}/remove`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showNotification('Class removed successfully.', 'success');
      await renderClasses();
    } else {
      const errorData = await response.json();
      showNotification(errorData.error || 'Error removing class', 'error');
    }
  } catch (error) {
    showNotification('Error removing class', 'error');
  }
}

async function viewClassStudents(classId) {
  try {
    // Remove existing modal if present
    const existingModal = document.getElementById('viewStudentsModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Fetch the roster
    const [classResponse, rosterResponse] = await Promise.all([
      fetchWithAuth(`/api/classes/details/${classId}`),
      fetchWithAuth(`/api/registrations/class/${classId}/roster`)
    ]);
    
    const classData = await classResponse.json();
    const roster = await rosterResponse.json();
    
    // Create the modal
    const modal = document.createElement('div');
    modal.id = 'viewStudentsModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    // Fetch event name for display
    const eventResponse = await fetchWithAuth(`/api/events/${classData.EventID}`);
    const event = await eventResponse.json();
    
    // Format timeslot for display (using global convertTo12Hour from utils.js)
    
    const timeslotText = classData.TimeslotDate && classData.TimeslotStartTime && classData.TimeslotEndTime
      ? `${classData.TimeslotDate} from ${convertTo12Hour(classData.TimeslotStartTime)} - ${convertTo12Hour(classData.TimeslotEndTime)}`
      : 'Not set';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>Manage Students: ${classData.HonorName || 'Unknown'}</h2>
          <button onclick="closeModal('viewStudentsModal')" class="btn btn-outline">×</button>
        </div>
        <div style="padding: 20px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
              <div>
                <strong style="color: var(--text-light); font-size: 0.875rem;">Event:</strong>
                <div style="font-size: 1rem; margin-top: 4px;">${event.Name || 'Unknown'}</div>
              </div>
              <div>
                <strong style="color: var(--text-light); font-size: 0.875rem;">Location:</strong>
                <div style="font-size: 1rem; margin-top: 4px;">${classData.LocationName || 'Not assigned'}</div>
              </div>
              <div>
                <strong style="color: var(--text-light); font-size: 0.875rem;">Timeslot:</strong>
                <div style="font-size: 1rem; margin-top: 4px;">${timeslotText}</div>
              </div>
            </div>
          </div>
              ${(() => {
                const enrolled = roster.filter(s => s.Status === 'Enrolled');
                const waitlisted = roster.filter(s => s.Status === 'Waitlisted');
                
                return `
                  <h3 style="margin-bottom: 15px;">Enrolled Students (${enrolled.length}/${classData.ActualMaxCapacity || classData.MaxCapacity})</h3>
                  ${enrolled.length > 0 ? `
                    <table class="table" style="margin-bottom: 30px;">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Club</th>
                          <th>Investiture Level</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody id="studentsList">
                        ${enrolled.map(student => `
                          <tr>
                            <td>${student.FirstName} ${student.LastName}</td>
                            <td>${student.ClubName || 'No Club'}</td>
                            <td>${student.InvestitureLevel || 'None'}</td>
                            <td>
                              <button onclick="removeStudentFromClass(${student.RegistrationID}, ${classId})" class="btn btn-sm btn-danger">Remove</button>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : '<p style="margin-bottom: 30px; color: #666;">No enrolled students</p>'}
                  
                  ${waitlisted.length > 0 ? `
                    <hr style="margin: 20px 0;">
                    <h3 style="margin-bottom: 15px;">Waitlist (${waitlisted.length})</h3>
                    <table class="table" style="margin-bottom: 30px;">
                      <thead>
                        <tr>
                          <th>Position</th>
                          <th>Student Name</th>
                          <th>Club</th>
                          <th>Investiture Level</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${waitlisted.map(student => `
                          <tr>
                            <td><strong>#${student.WaitlistOrder}</strong></td>
                            <td>${student.FirstName} ${student.LastName}</td>
                            <td>${student.ClubName || 'No Club'}</td>
                            <td>${student.InvestitureLevel || 'None'}</td>
                            <td>
                              <button onclick="removeStudentFromClass(${student.RegistrationID}, ${classId})" class="btn btn-sm btn-danger">Remove</button>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                `;
              })()}
          <hr style="margin: 20px 0;">
          <h3 style="margin-bottom: 15px;">Add Student</h3>
          <div class="form-group">
            <label for="addStudentSelect">Select Student</label>
            <select id="addStudentSelect" class="form-control" style="margin-bottom: 10px;">
              <option value="">Loading...</option>
            </select>
            <button onclick="handleAddStudentToClass(${classId})" class="btn btn-primary">Add Student</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
  // Load available students - check if we need to filter (Club Directors or Event Admins)
  const user = getCurrentUser();
  let availableUrl = `/api/registrations/available/${classId}`;
  if (user.role === 'ClubDirector' && user.clubId) {
    availableUrl += `?clubId=${user.clubId}`;
  }
  // Note: Event Admins can see all students in their event (no club filter needed)
  
  const availableResponse = await fetchWithAuth(availableUrl);
  const availableStudents = await availableResponse.json();
    
    const select = document.getElementById('addStudentSelect');
    select.innerHTML = '<option value="">Select a student...</option>';
    if (availableStudents.length === 0) {
      select.innerHTML = '<option value="">No available students</option>';
      select.disabled = true;
    } else {
      select.innerHTML += availableStudents.map(s => 
        `<option value="${s.id}">${s.lastName}, ${s.firstName} (${s.clubName})</option>`
      ).join('');
    }
  } catch (error) {
    showNotification('Error loading students: ' + error.message, 'error');
  }
}

async function handleAddStudentToClass(classId) {
  const select = document.getElementById('addStudentSelect');
  const studentId = select.value;
  
  if (!studentId) {
    showNotification('Please select a student', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth('/api/registrations/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ UserID: studentId, ClassID: classId })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Student added successfully', 'success');
      // Don't close or refresh - just reload the modal content
      await viewClassStudents(classId);
    } else if (response.status === 409 && result.conflict) {
      // Show conflict modal
      showConflictModal(classId, studentId, result.conflictClassName, result.conflictRegistrationId);
    } else {
      showNotification(result.error || 'Error adding student', 'error');
    }
  } catch (error) {
    showNotification('Error adding student: ' + error.message, 'error');
  }
}

function showConflictModal(newClassId, userId, conflictClassName, conflictRegistrationId) {
  const modal = document.createElement('div');
  modal.id = 'conflictModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2>Timeslot Conflict</h2>
        <button onclick="closeModal('conflictModal')" class="btn btn-outline">×</button>
      </div>
      <div style="padding: 20px;">
        <p style="margin-bottom: 20px;">This student is already enrolled in another class during this timeslot.</p>
        <p style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <strong>Current Class:</strong> ${conflictClassName}
        </p>
        <p style="margin-bottom: 20px;">Would you like to move the student to the new class?</p>
        <div style="display: flex; gap: 10px;">
          <button onclick="resolveConflict('${newClassId}', '${userId}', '${conflictRegistrationId}')" class="btn btn-primary" style="flex: 1;">
            Yes, Move Student
          </button>
          <button onclick="closeModal('conflictModal')" class="btn btn-outline" style="flex: 1;">
            No, Cancel
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function resolveConflict(newClassId, userId, conflictRegistrationId) {
  try {
    // First, remove from the conflict class
    const removeResponse = await fetchWithAuth(`/api/registrations/admin/${conflictRegistrationId}`, {
      method: 'DELETE'
    });
    
    if (!removeResponse.ok) {
      throw new Error('Failed to remove student from conflict class');
    }
    
    // Then, add to the new class
    const addResponse = await fetchWithAuth('/api/registrations/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ UserID: userId, ClassID: newClassId })
    });
    
    if (!addResponse.ok) {
      throw new Error('Failed to add student to new class');
    }
    
    // Close conflict modal
    closeModal('conflictModal');
    
    // Refresh the manage students modal
    await viewClassStudents(newClassId);
    
    showNotification('Student moved successfully', 'success');
  } catch (error) {
    showNotification('Error moving student: ' + error.message, 'error');
  }
}

async function removeStudentFromClass(registrationId, classId) {
  if (!confirm('Are you sure you want to remove this student from the class?')) return;
  
  try {
    const response = await fetchWithAuth(`/api/registrations/admin/${registrationId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showNotification('Student removed successfully', 'success');
      // Don't close or refresh - just reload the modal content
      await viewClassStudents(classId);
    } else {
      const result = await response.json();
      showNotification(result.error || 'Error removing student', 'error');
    }
  } catch (error) {
    showNotification('Error removing student: ' + error.message, 'error');
  }
}

// Manage clubs for an event
async function manageEventClubs(eventId) {
  try {
    // Remove existing modal if present
    const existingModal = document.getElementById('manageClubsModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Fetch event details and assigned clubs
    const [eventResponse, assignedClubsResponse, allClubsResponse] = await Promise.all([
      fetchWithAuth(`/api/events/${eventId}`),
      fetchWithAuth(`/api/clubs/event/${eventId}`),
      fetchWithAuth('/api/clubs')
    ]);
    
    const event = await eventResponse.json();
    const assignedClubs = await assignedClubsResponse.json();
    const allClubs = await allClubsResponse.json();
    
    // Get clubs not yet assigned to this event
    const assignedClubIds = new Set(assignedClubs.map(c => c.ID));
    const availableClubs = allClubs.filter(c => !assignedClubIds.has(c.ID));
    
    // Create the modal
    const modal = document.createElement('div');
    modal.id = 'manageClubsModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>Manage Clubs: ${event.Name || 'Unknown Event'}</h2>
          <button onclick="closeModal('manageClubsModal')" class="btn btn-outline">×</button>
        </div>
        <div style="padding: 20px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
              <div>
                <strong style="color: var(--text-light); font-size: 0.875rem;">Event:</strong>
                <div style="font-size: 1rem; margin-top: 4px;">${event.Name || 'Unknown'}</div>
              </div>
              <div>
                <strong style="color: var(--text-light); font-size: 0.875rem;">Start Date:</strong>
                <div style="font-size: 1rem; margin-top: 4px;">${event.StartDate || 'Not set'}</div>
              </div>
              <div>
                <strong style="color: var(--text-light); font-size: 0.875rem;">End Date:</strong>
                <div style="font-size: 1rem; margin-top: 4px;">${event.EndDate || 'Not set'}</div>
              </div>
            </div>
          </div>
          
          <h3 style="margin-bottom: 15px;">Assigned Clubs (${assignedClubs.length})</h3>
          ${assignedClubs.length > 0 ? `
            <table class="table" style="margin-bottom: 30px;">
              <thead>
                <tr>
                  <th>Club Name</th>
                  <th>Church</th>
                  <th>Director</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="assignedClubsList">
                ${assignedClubs.map(club => `
                  <tr>
                    <td><strong>${club.Name}</strong></td>
                    <td>${club.Church || '-'}</td>
                    <td>${club.DirectorFirstName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : '<span style="color: #999;">Unassigned</span>'}</td>
                    <td>
                      <button onclick="removeClubFromEvent(${club.ID}, ${eventId})" class="btn btn-sm btn-danger">Remove</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="margin-bottom: 30px; color: #666;">No clubs assigned to this event</p>'}
          
          <hr style="margin: 20px 0;">
          <h3 style="margin-bottom: 15px;">Add Club</h3>
          <div class="form-group">
            <label for="addClubSelect">Select Club</label>
            <select id="addClubSelect" class="form-control" style="margin-bottom: 10px;">
              <option value="">Loading...</option>
            </select>
            <button onclick="handleAddClubToEvent(${eventId})" class="btn btn-primary">Add Club</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate the club dropdown
    const select = document.getElementById('addClubSelect');
    select.innerHTML = '<option value="">Select a club...</option>';
    if (availableClubs.length === 0) {
      select.innerHTML = '<option value="">No available clubs</option>';
      select.disabled = true;
    } else {
      select.innerHTML += availableClubs.map(c => 
        `<option value="${c.ID}">${c.Name}${c.Church ? ` (${c.Church})` : ''}</option>`
      ).join('');
    }
  } catch (error) {
    console.error('Error loading clubs:', error);
    showNotification('Error loading clubs: ' + error.message, 'error');
  }
}

async function handleAddClubToEvent(eventId) {
  const select = document.getElementById('addClubSelect');
  const clubId = select.value;
  
  if (!clubId) {
    showNotification('Please select a club', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs/${clubId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ EventID: eventId })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Club added successfully', 'success');
      // Reload the modal content
      await manageEventClubs(eventId);
      // Refresh clubs list if on clubs tab
      if (currentTab === 'clubs') {
        await renderClubs();
      }
    } else {
      showNotification(result.error || 'Error adding club', 'error');
    }
  } catch (error) {
    showNotification('Error adding club: ' + error.message, 'error');
  }
}

async function removeClubFromEvent(clubId, eventId) {
  if (!confirm('Are you sure you want to remove this club from the event?')) return;
  
  try {
    const response = await fetchWithAuth(`/api/clubs/${clubId}/events/${eventId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showNotification('Club removed successfully', 'success');
      await manageEventClubs(eventId);
      // Refresh clubs list if on clubs tab
      if (currentTab === 'clubs') {
        await renderClubs();
      }
    } else {
      const result = await response.json();
      showNotification(result.error || 'Error removing club', 'error');
    }
  } catch (error) {
    showNotification('Error removing club: ' + error.message, 'error');
  }
}

// Make functions globally available
window.manageEventClubs = manageEventClubs;
window.handleAddClubToEvent = handleAddClubToEvent;
window.removeClubFromEvent = removeClubFromEvent;

function updateReportButton() {
  const select = document.getElementById('reportEventFilter');
  const btn = document.getElementById('generateReportBtn');
  btn.disabled = !select || !select.value;
}

async function generateEventReport() {
  try {
    const response = await fetchWithAuth(`/api/reports/event/${assignedEventId}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-${assignedEventId}-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showNotification('Report generated successfully', 'success');
  } catch (error) {
    showNotification('Error generating report', 'error');
  }
}

async function generateTimeslotRosterReport() {
  if (!assignedEventId) {
    showNotification('No event assigned', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/reports/event/${assignedEventId}/timeslot-roster`);
    if (!response.ok) {
      const error = await response.json();
      showNotification(error.error || 'Error generating report', 'error');
      return;
    }
    const html = await response.text();
    const newWindow = window.open('', '_blank');
    newWindow.document.write(html);
    newWindow.document.close();
    showNotification('Report opened in new window. Use browser print function to print.', 'success');
  } catch (error) {
    showNotification('Error generating report: ' + error.message, 'error');
  }
}

async function generateUsersExport() {
  try {
    const response = await fetchWithAuth('/api/reports/users');
    if (!response.ok) {
      const error = await response.json();
      showNotification(error.error || 'Error generating users export', 'error');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showNotification('Users export generated successfully', 'success');
  } catch (error) {
    showNotification('Error generating users export: ' + error.message, 'error');
  }
}

// Modal functions
// EventAdmin cannot create events - function disabled
function showCreateEventForm() {
  showNotification('EventAdmins cannot create events. Please contact a system administrator.', 'error');
  return;
  const modal = document.createElement('div');
  modal.id = 'createEventModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create New Event</h2>
        <button onclick="closeModal('createEventModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createEventForm" onsubmit="handleCreateEvent(event)">
        <div class="form-group">
          <label for="eventName">Event Name *</label>
          <input type="text" id="eventName" name="eventName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="startDate">Start Date *</label>
          <input type="date" id="startDate" name="startDate" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="endDate">End Date *</label>
          <input type="date" id="endDate" name="endDate" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="coordinatorName">Coordinator Name *</label>
          <input type="text" id="coordinatorName" name="coordinatorName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea id="description" name="description" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="street">Street Address</label>
          <input type="text" id="street" name="street" class="form-control">
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label for="city">City</label>
            <input type="text" id="city" name="city" class="form-control">
          </div>
          <div class="form-group">
            <label for="state">State</label>
            <input type="text" id="state" name="state" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label for="zip">ZIP Code</label>
          <input type="text" id="zip" name="zip" class="form-control">
        </div>
        <div class="form-group">
          <label for="locationDescription">Location Description</label>
          <input type="text" id="locationDescription" name="locationDescription" class="form-control" placeholder="e.g., Community Center Main Hall">
        </div>
        <hr style="margin: 20px 0; border-color: var(--border);">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--primary);">Event Status</h3>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="eventActive" name="eventActive" checked style="width: auto;">
            <strong>Active</strong>
          </label>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">
            Active events are visible to clubs and participants. Inactive events are hidden.
          </small>
        </div>
        <div class="form-group">
          <label for="eventStatus">Registration Status *</label>
          <select id="eventStatus" name="eventStatus" class="form-control" required>
            <option value="Closed" selected>Closed (View Only)</option>
            <option value="Live">Live (Registration Open)</option>
          </select>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">
            <strong>Closed:</strong> Clubs can view classes but cannot register.<br>
            <strong>Live:</strong> Clubs can view and register for classes.
          </small>
        </div>
        <hr style="margin: 20px 0; border-color: var(--border);">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--primary);">Custom Role Names</h3>
        <small style="color: var(--text-light); margin-bottom: 15px; display: block;">Optional: Configure how role names appear for this event.</small>
        <div class="form-group">
          <label for="roleLabelStudent">Student Label</label>
          <input type="text" id="roleLabelStudent" name="roleLabelStudent" class="form-control" value="Student">
        </div>
        <div class="form-group">
          <label for="roleLabelTeacher">Teacher Label</label>
          <input type="text" id="roleLabelTeacher" name="roleLabelTeacher" class="form-control" value="Teacher">
        </div>
        <div class="form-group">
          <label for="roleLabelStaff">Staff Label</label>
          <input type="text" id="roleLabelStaff" name="roleLabelStaff" class="form-control" value="Staff">
        </div>
        <div class="form-group">
          <label for="roleLabelClubDirector">Club Director Label</label>
          <input type="text" id="roleLabelClubDirector" name="roleLabelClubDirector" class="form-control" value="Club Director">
        </div>
        <div class="form-group">
          <label for="roleLabelEventAdmin">Event Admin Label</label>
          <input type="text" id="roleLabelEventAdmin" name="roleLabelEventAdmin" class="form-control" value="Event Admin">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create Event</button>
          <button type="button" onclick="closeModal('createEventModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
    
    // If closing the viewStudentsModal, refresh the classes list to update counts
    if (modalId === 'viewStudentsModal') {
      const currentTab = localStorage.getItem('adminCurrentTab') || 'events';
      if (currentTab === 'classes') {
        renderClasses();
      }
    }
  }
}

// EventAdmin cannot create events - function disabled
async function handleCreateEvent(e) {
  e.preventDefault();
  showNotification('EventAdmins cannot create events. Please contact a system administrator.', 'error');
  return;
  e.preventDefault();
  
  // Get form element
  const form = e.target;
  
  // Get all form values using form elements
  const eventData = {
    Name: form.eventName?.value?.trim() || '',
    StartDate: form.startDate?.value || '',
    EndDate: form.endDate?.value || '',
    CoordinatorName: form.coordinatorName?.value?.trim() || '',
    Description: form.description?.value?.trim() || null,
    Street: form.street?.value?.trim() || null,
    City: form.city?.value?.trim() || null,
    State: form.state?.value?.trim() || null,
    ZIP: form.zip?.value?.trim() || null,
    LocationDescription: form.locationDescription?.value?.trim() || null,
    RoleLabelStudent: form.roleLabelStudent?.value?.trim() || 'Student',
    RoleLabelTeacher: form.roleLabelTeacher?.value?.trim() || 'Teacher',
    RoleLabelStaff: form.roleLabelStaff?.value?.trim() || 'Staff',
    RoleLabelClubDirector: form.roleLabelClubDirector?.value?.trim() || 'Club Director',
    RoleLabelEventAdmin: form.roleLabelEventAdmin?.value?.trim() || 'Event Admin',
    Active: form.eventActive?.checked ?? true,
    Status: form.eventStatus?.value || 'Closed'
  };


  // Validate required fields
  const missingFields = [];
  if (!eventData.Name) missingFields.push('Event Name');
  if (!eventData.StartDate) missingFields.push('Start Date');
  if (!eventData.EndDate) missingFields.push('End Date');
  if (!eventData.CoordinatorName) missingFields.push('Coordinator Name');
  
  if (missingFields.length > 0) {
    showNotification(`Please fill in: ${missingFields.join(', ')}`, 'error');
    return;
  }

  // Convert empty strings to null for optional fields
  eventData.Description = eventData.Description || null;
  eventData.Street = eventData.Street || null;
  eventData.City = eventData.City || null;
  eventData.State = eventData.State || null;
  eventData.ZIP = eventData.ZIP || null;
  eventData.LocationDescription = eventData.LocationDescription || null;

  try {
    const response = await fetchWithAuth('/api/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('Event created successfully', 'success');
      closeModal('createEventModal');
      await loadEvents();
    } else {
      showNotification(result.error || 'Error creating event', 'error');
      console.error('Error response:', result);
    }
  } catch (error) {
    console.error('Error creating event:', error);
    showNotification('Error creating event: ' + error.message, 'error');
  }
}

// Helper function to calculate age from date of birth
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

// User management functions
function showCreateUserForm() {
  const modal = document.createElement('div');
  modal.id = 'createUserModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create New User</h2>
        <button onclick="closeModal('createUserModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createUserForm" onsubmit="handleCreateUser(event)">
        <div class="form-group">
          <label for="role">Role *</label>
          <select id="role" name="role" class="form-control" required>
            <option value="">Select Role</option>
            <option value="Admin">Admin</option>
            <option value="EventAdmin">Event Admin</option>
            <option value="ClubDirector">Club Director</option>
            <option value="Teacher">Teacher</option>
            <option value="Student">Student</option>
            <option value="Staff">Staff</option>
          </select>
          <small style="display: block; color: var(--text-light);">Note: Admin, Event Admin, and Club Directors will receive invitation codes. Other roles are created directly.</small>
        </div>
        <div class="form-group">
          <label for="firstName">First Name *</label>
          <input type="text" id="firstName" name="firstName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="lastName">Last Name *</label>
          <input type="text" id="lastName" name="lastName" class="form-control" required>
        </div>
        <div class="form-group" id="dateOfBirthContainer">
          <label for="dateOfBirth">Date of Birth *</label>
          <input type="date" id="dateOfBirth" name="dateOfBirth" class="form-control" required>
          <small style="color: var(--text-light);">Age will be calculated automatically</small>
        </div>
        <div class="form-group">
          <label for="email" id="emailLabel">Email *</label>
          <input type="email" id="email" name="email" class="form-control" required>
          <small id="emailHelp" style="color: var(--text-light);">Required for Admin, Event Admin, and Club Director invitations</small>
        </div>
        <div class="form-group" id="phoneContainer">
          <label for="phone">Phone</label>
          <input type="text" id="phone" name="phone" class="form-control">
        </div>
        <div class="form-group" id="eventContainer" style="display: none;">
          <label for="eventId">Event *</label>
          <select id="eventId" name="eventId" class="form-control" onchange="loadClubsForCreateUser(this.value)">
            <option value="">Select Event</option>
          </select>
        </div>
        <div class="form-group" id="clubContainer" style="display: none;">
          <label for="clubId">Club <span style="color: #999;">(None = cannot register)</span></label>
          <select id="clubId" name="clubId" class="form-control">
            <option value="">No Club</option>
          </select>
          <div id="clubEventSummary" style="margin-top: 6px; color: var(--text-light); display: none; font-size: 0.9rem;">Select a club to view linked events.</div>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">Users without a club cannot register for classes</small>
        </div>
        <div class="form-group">
          <label for="investitureLevel">Investiture Level</label>
          <select id="investitureLevel" name="investitureLevel" class="form-control">
            <option value="None">None</option>
            <option value="Friend">Friend</option>
            <option value="Companion">Companion</option>
            <option value="Explorer">Explorer</option>
            <option value="Ranger">Ranger</option>
            <option value="Voyager">Voyager</option>
            <option value="Guide">Guide</option>
            <option value="MasterGuide">Master Guide</option>
          </select>
        </div>
        <div class="form-group" id="passwordContainer" style="display: none;">
          <label for="password">Password *</label>
          <input type="password" id="password" name="password" class="form-control">
          <small style="color: var(--text-light);">Default: password123</small>
        </div>
        <div class="form-group" id="backgroundCheckContainer" style="display: none;">
          <label>
            <input type="checkbox" id="backgroundCheck" name="backgroundCheck">
            Background Check Verified (Optional)
          </label>
          <small style="display: block; color: var(--text-light);">Can be verified later by Admin</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="createUserSubmitBtn">Create User</button>
          <button type="button" onclick="closeModal('createUserModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Populate event dropdown
  const eventSelect = document.getElementById('eventId');
  if (eventSelect) {
    fetchWithAuth('/api/events')
      .then(response => response.json())
      .then(events => {
        events.forEach(event => {
          const option = document.createElement('option');
          option.value = event.ID;
          option.textContent = event.Name;
          eventSelect.appendChild(option);
        });
      });
  }
  
  // Function to update form fields based on role
  function updateFormFieldsForRole() {
    const roleSelect = document.getElementById('role');
    const passwordContainer = document.getElementById('passwordContainer');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('createUserSubmitBtn');
    const dateOfBirthContainer = document.getElementById('dateOfBirthContainer');
    const dateOfBirthInput = document.getElementById('dateOfBirth');
    const phoneContainer = document.getElementById('phoneContainer');
    const emailInput = document.getElementById('email');
    const emailLabel = document.getElementById('emailLabel');
    const emailHelp = document.getElementById('emailHelp');
    
    if (!roleSelect) return;
    
    const role = roleSelect.value;
    const emailRequiredRoles = ['Admin', 'EventAdmin', 'ClubDirector'];
    const emailOptionalRoles = ['Teacher', 'Student', 'Staff'];
    
    if (emailRequiredRoles.includes(role)) {
      // Email required for Admin, EventAdmin, ClubDirector
      if (emailInput) {
        emailInput.required = true;
      }
      if (emailLabel) {
        emailLabel.textContent = 'Email *';
      }
      if (emailHelp) {
        emailHelp.textContent = 'Required for Admin, Event Admin, and Club Director invitations';
      }
    } else if (emailOptionalRoles.includes(role)) {
      // Email optional for Teacher, Student, Staff
      if (emailInput) {
        emailInput.required = false;
      }
      if (emailLabel) {
        emailLabel.textContent = 'Email';
      }
      if (emailHelp) {
        emailHelp.textContent = 'Optional - Not required for Teachers, Staff, and Students';
      }
    } else {
      // Default: email required (for safety)
      if (emailInput) {
        emailInput.required = true;
      }
      if (emailLabel) {
        emailLabel.textContent = 'Email *';
      }
      if (emailHelp) {
        emailHelp.textContent = 'Required for Admin, Event Admin, and Club Director invitations';
      }
    }
    
    if (['Admin', 'EventAdmin', 'ClubDirector'].includes(role)) {
      // Invite roles: hide password, date of birth, and phone, change button text
      if (passwordContainer) passwordContainer.style.display = 'none';
      if (passwordInput) {
        passwordInput.required = false;
        passwordInput.value = '';
      }
      if (submitBtn) submitBtn.textContent = 'Invite User';
      if (dateOfBirthContainer) dateOfBirthContainer.style.display = 'none';
      if (dateOfBirthInput) {
        dateOfBirthInput.required = false;
        dateOfBirthInput.value = '';
      }
      if (phoneContainer) phoneContainer.style.display = 'none';
    } else {
      // Direct creation roles: show password, date of birth, and phone, keep button text
      if (passwordContainer) passwordContainer.style.display = 'block';
      if (passwordInput) passwordInput.required = true;
      if (submitBtn) submitBtn.textContent = 'Create User';
      if (dateOfBirthContainer) dateOfBirthContainer.style.display = 'block';
      if (dateOfBirthInput) dateOfBirthInput.required = true;
      if (phoneContainer) phoneContainer.style.display = 'block';
    }
    
    toggleEventDropdown(role);
  }
  
  // Show/hide password field and date of birth based on role, update button text
  const roleSelect = document.getElementById('role');
  if (roleSelect) {
    // Set initial state
    updateFormFieldsForRole();
    
    // Add change listener
    roleSelect.addEventListener('change', updateFormFieldsForRole);
  }
  
  // Add listener for date of birth changes to show/hide background check
  if (dateOfBirthInput) {
    dateOfBirthInput.addEventListener('change', function() {
      const age = calculateAge(this.value);
      const backgroundCheckContainer = document.getElementById('backgroundCheckContainer');
      if (age >= 18) {
        if (backgroundCheckContainer) backgroundCheckContainer.style.display = 'block';
        // Note: Background check is NOT required, it's optional
      } else {
        if (backgroundCheckContainer) backgroundCheckContainer.style.display = 'none';
      }
    });
  }
}

async function editUser(userId) {
  const user = allUsers.find(u => u.ID === userId);
  if (!user) return;
  
  // Determine auth method
  const authMethod = user.auth_method || 'local';
  const isLocal = authMethod === 'local';
  const isStytch = authMethod === 'stytch';
  
  const modal = document.createElement('div');
  modal.id = 'editUserModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit User${isLocal ? ' <span style="font-size: 0.8em; font-weight: normal; color: #666;">(Local)</span>' : ''}</h2>
        <button onclick="closeModal('editUserModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editUserForm" data-user-id="${userId}" onsubmit="handleEditUser(event, ${userId})">
        <div class="form-group">
          <label>Username</label>
          <input type="text" value="${user.Username}" class="form-control" disabled>
        </div>
        <div class="form-group">
          <label for="editFirstName">First Name *</label>
          <input type="text" id="editFirstName" name="editFirstName" class="form-control" value="${user.FirstName}" required>
        </div>
        <div class="form-group">
          <label for="editLastName">Last Name *</label>
          <input type="text" id="editLastName" name="editLastName" class="form-control" value="${user.LastName}" required>
        </div>
        <div class="form-group">
          <label for="editDateOfBirth">Date of Birth *</label>
          <input type="date" id="editDateOfBirth" name="editDateOfBirth" class="form-control" value="${user.DateOfBirth || ''}" required>
          ${user.Age !== null ? `<small style="color: var(--text-light);">Current age: ${user.Age}</small>` : ''}
        </div>
        ${user.IsAdult ? `
        <div class="form-group">
          <label>
            <input type="checkbox" id="editBackgroundCheck" name="editBackgroundCheck" ${user.BackgroundCheck ? 'checked' : ''}>
            Background Check Verified
          </label>
          <small style="display: block; color: var(--text-light);">Only Admin or EventAdmin can edit</small>
        </div>
        ` : ''}
        <div class="form-group">
          <label for="editEmail" id="editEmailLabel">Email${['Admin', 'EventAdmin', 'ClubDirector'].includes(user.Role) ? ' *' : ''}</label>
          <input type="email" id="editEmail" name="editEmail" class="form-control" value="${user.Email || ''}" ${['Admin', 'EventAdmin', 'ClubDirector'].includes(user.Role) ? 'required' : ''}>
          <small id="editEmailHelp" style="color: var(--text-light);">${['Admin', 'EventAdmin', 'ClubDirector'].includes(user.Role) ? 'Required for Admin, Event Admin, and Club Director' : 'Optional - Not required for Teachers, Staff, and Students'}</small>
          ${isStytch ? `<small style="color: #856404; display: block; margin-top: 5px;">⚠️ For Stytch users, changing email will send a verification email to the new address. The user must verify the new email to complete the update.</small>` : ''}
        </div>
        <div class="form-group">
          <label for="editPhone">Phone</label>
          <input type="text" id="editPhone" name="editPhone" class="form-control" value="${user.Phone || ''}">
        </div>
        <div class="form-group">
          <label for="editRole">Role *</label>
          <select id="editRole" name="editRole" class="form-control" required onchange="toggleEditEventDropdown(this.value)">
            <option value="Admin" ${user.Role === 'Admin' ? 'selected' : ''}>Admin</option>
            <option value="EventAdmin" ${user.Role === 'EventAdmin' ? 'selected' : ''}>Event Admin</option>
            <option value="ClubDirector" ${user.Role === 'ClubDirector' ? 'selected' : ''}>Club Director</option>
            <option value="Teacher" ${user.Role === 'Teacher' ? 'selected' : ''}>Teacher</option>
            <option value="Student" ${user.Role === 'Student' ? 'selected' : ''}>Student</option>
            <option value="Staff" ${user.Role === 'Staff' ? 'selected' : ''}>Staff</option>
          </select>
        </div>
        <div class="form-group" id="editEventContainer" style="display: ${['EventAdmin', 'Student', 'Teacher'].includes(user.Role) ? 'block' : 'none'};">
          <label for="editEventId">Event${user.Role === 'EventAdmin' ? ' *' : ''}</label>
          <select id="editEventId" name="editEventId" class="form-control" onchange="loadClubsForEditUser(this.value)">
            <option value="">Select Event</option>
          </select>
        </div>
        <div class="form-group" id="editClubContainer" style="display: ${['Student', 'Teacher', 'ClubDirector'].includes(user.Role) ? 'block' : 'none'};">
          <label for="editClubId">Club <span style="color: #999;">(None = cannot register)</span></label>
          <select id="editClubId" name="editClubId" class="form-control">
            <option value="">No Club</option>
          </select>
          <div id="editClubEventSummary" style="margin-top: 6px; color: var(--text-light); display: none; font-size: 0.9rem;">Select a club to view linked events.</div>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">Users without a club cannot register for classes</small>
        </div>
        <div class="form-group">
          <label for="editInvestitureLevel">Investiture Level</label>
          <select id="editInvestitureLevel" name="editInvestitureLevel" class="form-control">
            <option value="None" ${user.InvestitureLevel === 'None' ? 'selected' : ''}>None</option>
            <option value="Friend" ${user.InvestitureLevel === 'Friend' ? 'selected' : ''}>Friend</option>
            <option value="Companion" ${user.InvestitureLevel === 'Companion' ? 'selected' : ''}>Companion</option>
            <option value="Explorer" ${user.InvestitureLevel === 'Explorer' ? 'selected' : ''}>Explorer</option>
            <option value="Ranger" ${user.InvestitureLevel === 'Ranger' ? 'selected' : ''}>Ranger</option>
            <option value="Voyager" ${user.InvestitureLevel === 'Voyager' ? 'selected' : ''}>Voyager</option>
            <option value="Guide" ${user.InvestitureLevel === 'Guide' ? 'selected' : ''}>Guide</option>
            <option value="MasterGuide" ${user.InvestitureLevel === 'MasterGuide' ? 'selected' : ''}>Master Guide</option>
          </select>
        </div>
        <div class="form-group">
          <label>Password Reset</label>
          ${isStytch ? `
            <div style="padding: 10px; background: #f5f5f5; border-radius: 5px; margin-bottom: 10px;">
              <small style="color: var(--text-light); display: block; margin-bottom: 5px;">This user's account uses Stytch authentication. Password changes must be done through Stytch's password reset feature.</small>
              <small style="color: #856404; display: block;">The user can reset their password using the "Forgot Password" feature on the login page.</small>
            </div>
          ` : `
            <input type="password" id="editPassword" name="editPassword" class="form-control" placeholder="Leave blank to keep current password">
            <small style="color: var(--text-light);">Enter new password to change it, or leave blank to keep current password</small>
          `}
        </div>
        <div class="form-group">
          <label>Database ID</label>
          <input type="text" value="${user.ID}" class="form-control" disabled>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update User</button>
          <button type="button" onclick="closeModal('editUserModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Populate events and clubs based on role
  if (['EventAdmin', 'Student', 'Teacher'].includes(user.Role)) {
    const eventSelect = document.getElementById('editEventId');
    if (eventSelect) {
      fetchWithAuth('/api/events')
        .then(response => response.json())
        .then(events => {
          events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.ID;
            option.textContent = event.Name;
            if (user.EventID === event.ID) {
              option.selected = true;
            }
            eventSelect.appendChild(option);
          });
          
          // Load clubs if user has an event
          const selectedEventId = user.EventID;
          if (selectedEventId) {
            loadClubsForEditUser(selectedEventId);
          }
        });
    }
  }

  if (user.Role === 'ClubDirector') {
    await loadClubsForEditUser(null);
  }
  
  // Function to update email field based on role for edit form
  function updateEditEmailField(role) {
    const emailInput = document.getElementById('editEmail');
    const emailLabel = document.getElementById('editEmailLabel');
    const emailHelp = document.getElementById('editEmailHelp');
    const emailRequiredRoles = ['Admin', 'EventAdmin', 'ClubDirector'];
    const emailOptionalRoles = ['Teacher', 'Student', 'Staff'];
    
    if (emailRequiredRoles.includes(role)) {
      // Email required for Admin, EventAdmin, ClubDirector
      if (emailInput) {
        emailInput.required = true;
      }
      if (emailLabel) {
        emailLabel.textContent = 'Email *';
      }
      if (emailHelp) {
        emailHelp.textContent = 'Required for Admin, Event Admin, and Club Director';
      }
    } else if (emailOptionalRoles.includes(role)) {
      // Email optional for Teacher, Student, Staff
      if (emailInput) {
        emailInput.required = false;
      }
      if (emailLabel) {
        emailLabel.textContent = 'Email';
      }
      if (emailHelp) {
        emailHelp.textContent = 'Optional - Not required for Teachers, Staff, and Students';
      }
    } else {
      // Default: email required (for safety)
      if (emailInput) {
        emailInput.required = true;
      }
      if (emailLabel) {
        emailLabel.textContent = 'Email *';
      }
      if (emailHelp) {
        emailHelp.textContent = 'Required for Admin, Event Admin, and Club Director';
      }
    }
  }
  
  // Add change listener for role dropdown
  const editRoleSelect = document.getElementById('editRole');
  if (editRoleSelect) {
    editRoleSelect.addEventListener('change', function() {
      const role = this.value;
      toggleEditEventDropdown(role);
      updateEditEmailField(role);
    });
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const form = e.target;
  
  const role = form.role?.value || '';
  const firstName = form.firstName?.value?.trim() || '';
  const lastName = form.lastName?.value?.trim() || '';
  const email = form.email?.value?.trim() || null;
  
  // For Admin, EventAdmin, and ClubDirector - generate invite code
  if (['Admin', 'EventAdmin', 'ClubDirector'].includes(role)) {
    if (!firstName || !lastName || !email || !role) {
      showNotification('First Name, Last Name, Email, and Role are required', 'error');
      return;
    }
    
    // Validate EventAdmin must have EventID
    if (role === 'EventAdmin' && !assignedEventId) {
      showNotification('EventAdmin must be assigned to an event', 'error');
      return;
    }
    
    // Validate ClubDirector must have ClubID
    if (role === 'ClubDirector' && !form.clubId?.value) {
      showNotification('ClubDirector must be assigned to a club', 'error');
      return;
    }
    
    try {
      const inviteData = {
        firstName,
        lastName,
        email,
        role,
        clubId: form.clubId?.value || null,
        eventId: assignedEventId,
        expiresInDays: 30
      };
      
      const response = await fetchWithAuth('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteData)
      });
      
      const invite = await response.json();
      
      if (!response.ok) {
        showNotification(invite.error || 'Error generating invite code', 'error');
        return;
      }
      
      // Show invite code and email template
      showInviteModal(invite, inviteData);
      closeModal('createUserModal');
      await loadUsers();
      await loadClubs();
    } catch (error) {
      showNotification('Error generating invite: ' + error.message, 'error');
    }
    return;
  }
  
  // For other roles (Student, Teacher, Staff) - create user directly
  // Email is optional for Teachers, Staff, and Students
  const emailOptionalRoles = ['Teacher', 'Student', 'Staff'];
  const emailRequired = !emailOptionalRoles.includes(role);
  
  // Validate email only if required for this role
  if (emailRequired && !email) {
    showNotification('Email is required for this role', 'error');
    return;
  }
  
  const userData = {
    FirstName: firstName,
    LastName: lastName,
    DateOfBirth: form.dateOfBirth?.value || '',
    Email: email || null, // Allow null for Teachers, Staff, and Students
    Phone: form.phone?.value?.trim() || null,
    Role: role,
    InvestitureLevel: form.investitureLevel?.value || 'None',
    EventID: form.eventId?.value || assignedEventId,
    ClubID: form.clubId?.value || null,
    Password: form.password?.value || 'password123',
    BackgroundCheck: form.backgroundCheck?.checked || false
  };

  // Validate
  if (!userData.FirstName || !userData.LastName || !userData.DateOfBirth || !userData.Role) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  try {
    const response = await fetchWithAuth('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('User created successfully', 'success');
      closeModal('createUserModal');
      await loadUsers();
      await loadClubs();
    } else {
      showNotification(result.error || 'Error creating user', 'error');
    }
  } catch (error) {
    showNotification('Error creating user: ' + error.message, 'error');
  }
}

function showInviteModal(invite, inviteData) {
  const modal = document.createElement('div');
  modal.id = 'inviteModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  
  // Get base URL for invite link
  const baseUrl = window.location.origin;
  const inviteUrl = `${baseUrl}/invite-register.html?code=${invite.Code}`;
  
  // Get event and club names if applicable
  const eventName = inviteData.eventId ? (assignedEvent ? assignedEvent.Name : 'Event') : '';
  const clubName = inviteData.clubId ? (allClubs.find(c => c.ID === parseInt(inviteData.clubId))?.Name || 'Club') : '';
  
  // Calculate expiration date
  const expiresAt = new Date(invite.ExpiresAt);
  const expiresInDays = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
  
  // Generate email template
  const emailSubject = `Invitation to Honors Festival - ${inviteData.role}`;
  const emailBody = `Dear ${inviteData.firstName} ${inviteData.lastName},

You have been invited to join the Honors Festival system as a ${inviteData.role}${eventName ? ` for ${eventName}` : ''}${clubName ? ` at ${clubName}` : ''}.

To complete your registration, please follow these steps:

1. Click on the following link or copy it into your browser:
   ${inviteUrl}

2. Enter your invitation code: ${invite.Code}

3. Set up your password (must be at least 8 characters with uppercase, lowercase, number, and special character).

This invitation code will expire in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString()}).

If you have any questions, please contact the system administrator.

Best regards,
Honors Festival Team`;
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h2>Invitation Code Generated</h2>
        <button onclick="closeModal('inviteModal')" class="btn btn-outline">×</button>
      </div>
      <div style="padding: 20px;">
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p><strong>Name:</strong> ${inviteData.firstName} ${inviteData.lastName}</p>
          <p><strong>Email:</strong> ${inviteData.email}</p>
          <p><strong>Role:</strong> ${inviteData.role}</p>
          ${inviteData.eventId ? `<p><strong>Event:</strong> ${eventName}</p>` : ''}
          ${inviteData.clubId ? `<p><strong>Club:</strong> ${clubName}</p>` : ''}
        </div>
        
        <div class="form-group">
          <label><strong>Invitation Code:</strong></label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" id="inviteCodeDisplay" value="${invite.Code}" readonly class="form-control" style="font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px;">
            <button onclick="copyInviteCode()" class="btn btn-secondary">Copy</button>
          </div>
        </div>
        
        <div class="form-group">
          <label><strong>Invitation Link:</strong></label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" id="inviteUrlDisplay" value="${inviteUrl}" readonly class="form-control">
            <button onclick="copyInviteUrl()" class="btn btn-secondary">Copy</button>
          </div>
        </div>
        
        <div class="form-group">
          <label><strong>Email Template:</strong></label>
          <div style="margin-bottom: 10px;">
            <button onclick="copyEmailTemplate()" class="btn btn-secondary">Copy Email Template</button>
          </div>
          <textarea id="emailTemplate" readonly class="form-control" rows="15" style="font-family: monospace; font-size: 12px;">Subject: ${emailSubject}

${emailBody}</textarea>
        </div>
        
        <div class="form-actions">
          <button onclick="closeModal('inviteModal')" class="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Store invite code for copy functions
  window.currentInviteCode = invite.Code;
  window.currentInviteUrl = inviteUrl;
  window.currentEmailTemplate = `Subject: ${emailSubject}\n\n${emailBody}`;
}

async function handleEditUser(e, userId) {
  e.preventDefault();
  const form = e.target;
  
  const userData = {
    FirstName: form.editFirstName?.value?.trim() || '',
    LastName: form.editLastName?.value?.trim() || '',
    DateOfBirth: form.editDateOfBirth?.value || '',
    Email: form.editEmail?.value?.trim() || null,
    Phone: form.editPhone?.value?.trim() || null,
    Role: form.editRole?.value || '',
    InvestitureLevel: form.editInvestitureLevel?.value || 'None'
  };
  
  // Add EventID for roles that need it
  if (['EventAdmin', 'Student', 'Teacher', 'ClubDirector'].includes(userData.Role)) {
    userData.EventID = form.editEventId?.value || assignedEventId;
  }
  
  // Add ClubID if provided
  const clubId = form.editClubId?.value;
  if (clubId) {
    userData.ClubID = clubId;
  } else {
    userData.ClubID = null; // Explicitly set to null if no club selected
  }
  
  // Only Admin or EventAdmin can update background check
  const currentUser = getCurrentUser();
  if (['Admin', 'EventAdmin'].includes(currentUser.role)) {
    userData.BackgroundCheck = form.editBackgroundCheck?.checked || false;
  }
  
  // Add password if provided (only for local users - Stytch users don't have this field)
  const newPassword = form.editPassword?.value?.trim();
  if (newPassword) {
    userData.Password = newPassword;
  }

  // Validate
  if (!userData.FirstName || !userData.LastName || !userData.DateOfBirth || !userData.Role) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  // Validate EventAdmin must have EventID
  if (userData.Role === 'EventAdmin' && !userData.EventID) {
    showNotification('EventAdmin must be assigned to an event', 'error');
    return;
  }

  // Validate email requirement based on role
  // Email is required for Admin, EventAdmin, and ClubDirector
  // Email is optional for Teacher, Student, and Staff
  const emailRequiredRoles = ['Admin', 'EventAdmin', 'ClubDirector'];
  const emailOptionalRoles = ['Teacher', 'Student', 'Staff'];
  if (emailRequiredRoles.includes(userData.Role) && !userData.Email) {
    showNotification('Email is required for ' + userData.Role, 'error');
    return;
  }

  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (response.ok) {
      // Show email verification message if Stytch user email was updated
      if (result.emailVerificationSent && result.emailVerificationMessage) {
        showNotification(result.emailVerificationMessage, 'success');
      } else {
        showNotification('User updated successfully', 'success');
      }
      closeModal('editUserModal');
      await loadUsers();
      // Only refresh clubs if clubs tab is active (will refresh when tab is clicked anyway)
      if (currentTab === 'clubs') {
        // Small delay to ensure backend sync before refreshing clubs
        await new Promise(resolve => setTimeout(resolve, 100));
        await loadClubs();
      }
    } else {
      showNotification(result.error || 'Error updating user', 'error');
    }
  } catch (error) {
    showNotification('Error updating user: ' + error.message, 'error');
  }
}

// Location management functions
function showCreateLocationForm() {
  // Event admins have a fixed assigned event
  const eventId = assignedEventId;
  
  if (!eventId) {
    showNotification('No event assigned. Please contact an administrator.', 'error');
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'createLocationModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create New Location</h2>
        <button onclick="closeModal('createLocationModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createLocationForm" onsubmit="handleCreateLocation(event)">
        <input type="hidden" id="locationEventId" value="${eventId}">
        <div class="form-group">
          <label for="locationName">Location Name *</label>
          <input type="text" id="locationName" name="locationName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="locationMaxCapacity">Max Capacity *</label>
          <input type="number" id="locationMaxCapacity" name="locationMaxCapacity" class="form-control" required min="1">
        </div>
        <div class="form-group">
          <label for="locationDescription">Description</label>
          <textarea id="locationDescription" name="locationDescription" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create Location</button>
          <button type="button" onclick="closeModal('createLocationModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function editLocation(locationId) {
  const location = allLocations.find(l => l.ID === locationId);
  if (!location) return;
  
  const modal = document.createElement('div');
  modal.id = 'editLocationModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Location</h2>
        <button onclick="closeModal('editLocationModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editLocationForm" onsubmit="handleEditLocation(event, ${locationId})">
        <div class="form-group">
          <label for="editLocationName">Location Name *</label>
          <input type="text" id="editLocationName" name="editLocationName" class="form-control" value="${location.Name}" required>
        </div>
        <div class="form-group">
          <label for="editLocationMaxCapacity">Max Capacity *</label>
          <input type="number" id="editLocationMaxCapacity" name="editLocationMaxCapacity" class="form-control" value="${location.MaxCapacity}" required min="1">
        </div>
        <div class="form-group">
          <label for="editLocationDescription">Description</label>
          <textarea id="editLocationDescription" name="editLocationDescription" class="form-control" rows="3">${location.Description || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Location</button>
          <button type="button" onclick="closeModal('editLocationModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function deleteLocation(locationId) {
  if (!confirm('Are you sure you want to delete this location? This will also delete all classes at this location.')) return;
  
  try {
    const response = await fetchWithAuth(`/api/locations/${locationId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showNotification('Location deleted', 'success');
      await renderLocations();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Error deleting location', 'error');
    }
  } catch (error) {
    showNotification('Error deleting location', 'error');
  }
}

async function handleCreateLocation(e) {
  e.preventDefault();
  const form = e.target;
  const eventId = form.locationEventId.value;
  
  const locationData = {
    EventID: parseInt(eventId),
    Name: form.locationName?.value?.trim() || '',
    MaxCapacity: parseInt(form.locationMaxCapacity?.value) || 0,
    Description: form.locationDescription?.value?.trim() || null
  };
  
  if (!locationData.Name || !locationData.MaxCapacity) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/events/${assignedEventId}/locations`, {
      method: 'POST',
      body: JSON.stringify(locationData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Location created successfully', 'success');
      closeModal('createLocationModal');
      await renderLocations();
    } else {
      showNotification(result.error || 'Error creating location', 'error');
    }
  } catch (error) {
    showNotification('Error creating location', 'error');
  }
}

async function handleEditLocation(e, locationId) {
  e.preventDefault();
  const form = e.target;
  
  const locationData = {
    Name: form.editLocationName?.value?.trim() || '',
    MaxCapacity: parseInt(form.editLocationMaxCapacity?.value) || 0,
    Description: form.editLocationDescription?.value?.trim() || null
  };
  
  if (!locationData.Name || !locationData.MaxCapacity) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(locationData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Location updated successfully', 'success');
      closeModal('editLocationModal');
      await renderLocations();
    } else {
      showNotification(result.error || 'Error updating location', 'error');
    }
  } catch (error) {
    showNotification('Error updating location', 'error');
  }
}

// Make functions globally available
window.toggleEventStatus = toggleEventStatus;
window.toggleEventActive = toggleEventActive;
window.toggleUserStatus = toggleUserStatus;
window.deactivateClass = deactivateClass;
window.activateClass = activateClass;
window.removeClass = removeClass;
window.editClass = editClass;
window.editEvent = editEvent;
window.handleEditEvent = handleEditEvent;
window.handleEditClass = handleEditClass;
window.viewClassStudents = viewClassStudents;
window.handleAddStudentToClass = handleAddStudentToClass;
window.removeStudentFromClass = removeStudentFromClass;
window.showConflictModal = showConflictModal;
window.resolveConflict = resolveConflict;
// generateReport removed - use generateEventReport instead
window.generateEventReport = generateEventReport;
window.generateTimeslotRosterReport = generateTimeslotRosterReport;
window.generateUsersExport = generateUsersExport;
window.updateReportButton = updateReportButton;
window.renderLocations = renderLocations;
// Timeslot management functions
async function loadTimeslots(eventId) {
  const targetEventId = eventId || assignedEventId;
  
  if (!targetEventId) {
    const container = document.getElementById('timeslotsList');
    if (container) {
      container.innerHTML = '<p class="text-center">No event assigned</p>';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/events/${targetEventId}/timeslots`);
    allTimeslots = await response.json();
    renderTimeslotsList();
  } catch (error) {
    console.error('Error loading timeslots:', error);
    showNotification('Error loading timeslots', 'error');
  }
}

async function renderTimeslots() {
  await loadTimeslots();
}

function renderTimeslotsList() {
  const container = document.getElementById('timeslotsList');
  if (!container) return;
  
  if (allTimeslots.length === 0) {
    container.innerHTML = '<p class="text-center">No timeslots found for this event</p>';
    return;
  }
    
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25%; text-align: left;">Date</th>
          <th style="width: 20%; text-align: left;">Start Time</th>
          <th style="width: 20%; text-align: left;">End Time</th>
          <th style="width: 20%; text-align: left;">Duration</th>
          <th style="width: 15%; text-align: left;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${allTimeslots.map(slot => `
        <tr>
          <td style="text-align: left;">${slot.Date}</td>
          <td style="text-align: left;">${convertTo12Hour(slot.StartTime)}</td>
          <td style="text-align: left;">${convertTo12Hour(slot.EndTime)}</td>
          <td style="text-align: left;">${calculateDuration(slot.StartTime, slot.EndTime)}</td>
          <td style="text-align: left;">
            <button onclick="editTimeslot(${slot.ID})" class="btn btn-sm btn-secondary">Edit</button>
            <button onclick="deleteTimeslot(${slot.ID})" class="btn btn-sm btn-danger">Delete</button>
          </td>
        </tr>
      `).join('')}
      </tbody>
    </table>
  `;
}

function calculateDuration(startTime, endTime) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// convertTo12Hour is now in utils.js and available globally

function showCreateTimeslotForm() {
  // For EventAdmin, use assignedEventId directly (no dropdown needed)
  const eventId = assignedEventId;
  
  if (!eventId) {
    showNotification('No event assigned. Please contact an administrator.', 'error');
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'createTimeslotModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create New Timeslot</h2>
        <button onclick="closeModal('createTimeslotModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createTimeslotForm" onsubmit="handleCreateTimeslot(event)">
        <div class="form-group">
          <label for="slotDate">Date *</label>
          <input type="date" id="slotDate" name="slotDate" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="slotStartTime">Start Time *</label>
          <input type="time" id="slotStartTime" name="slotStartTime" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="slotEndTime">End Time *</label>
          <input type="time" id="slotEndTime" name="slotEndTime" class="form-control" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create Timeslot</button>
          <button type="button" onclick="closeModal('createTimeslotModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleCreateTimeslot(e) {
  e.preventDefault();
  const form = e.target;
  // For EventAdmin, use assignedEventId directly
  const eventId = assignedEventId;
  
  const timeslotData = {
    Date: form.slotDate?.value || '',
    StartTime: form.slotStartTime?.value || '',
    EndTime: form.slotEndTime?.value || ''
  };
  
  if (!timeslotData.Date || !timeslotData.StartTime || !timeslotData.EndTime) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/events/${eventId}/timeslots`, {
      method: 'POST',
      body: JSON.stringify(timeslotData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Timeslot created successfully', 'success');
      closeModal('createTimeslotModal');
      await renderTimeslots();
    } else {
      showNotification(result.error || 'Error creating timeslot', 'error');
    }
  } catch (error) {
    showNotification('Error creating timeslot: ' + error.message, 'error');
  }
}

async function editTimeslot(timeslotId) {
  const slot = allTimeslots.find(s => s.ID === timeslotId);
  if (!slot) return;
  
  // Convert 24-hour time to value format
  const convertTimeForInput = (time24) => {
    return time24;
  };
  
  const modal = document.createElement('div');
  modal.id = 'editTimeslotModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Timeslot</h2>
        <button onclick="closeModal('editTimeslotModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editTimeslotForm" onsubmit="handleEditTimeslot(event, ${timeslotId})">
        <div class="form-group">
          <label for="editSlotDate">Date *</label>
          <input type="date" id="editSlotDate" name="editSlotDate" class="form-control" value="${slot.Date}" required>
        </div>
        <div class="form-group">
          <label for="editSlotStartTime">Start Time *</label>
          <input type="time" id="editSlotStartTime" name="editSlotStartTime" class="form-control" value="${convertTimeForInput(slot.StartTime)}" required>
        </div>
        <div class="form-group">
          <label for="editSlotEndTime">End Time *</label>
          <input type="time" id="editSlotEndTime" name="editSlotEndTime" class="form-control" value="${convertTimeForInput(slot.EndTime)}" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Timeslot</button>
          <button type="button" onclick="closeModal('editTimeslotModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleEditTimeslot(e, timeslotId) {
  e.preventDefault();
  const form = e.target;
  
  const timeslotData = {
    Date: form.editSlotDate?.value || '',
    StartTime: form.editSlotStartTime?.value || '',
    EndTime: form.editSlotEndTime?.value || ''
  };
  
  if (!timeslotData.Date || !timeslotData.StartTime || !timeslotData.EndTime) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/timeslots/${timeslotId}`, {
      method: 'PUT',
      body: JSON.stringify(timeslotData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Timeslot updated successfully', 'success');
      closeModal('editTimeslotModal');
      await renderTimeslots();
    } else {
      showNotification(result.error || 'Error updating timeslot', 'error');
    }
  } catch (error) {
    showNotification('Error updating timeslot: ' + error.message, 'error');
  }
}

async function deleteTimeslot(timeslotId) {
  if (!confirm('Are you sure you want to delete this timeslot? This will also remove all classes and registrations for this timeslot.')) return;
  
  try {
    const response = await fetchWithAuth(`/api/timeslots/${timeslotId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showNotification('Timeslot deleted', 'success');
      await renderTimeslots();
    } else {
      const result = await response.json();
      showNotification(result.error || 'Error deleting timeslot', 'error');
    }
  } catch (error) {
    showNotification('Error deleting timeslot', 'error');
  }
}

// Class management functions
async function showCreateClassForm() {
  // For EventAdmin, use assignedEventId directly (dropdown is auto-selected)
  const select = document.getElementById('classEventFilter');
  let eventId = select?.value;
  if (!eventId && assignedEventId) {
    eventId = assignedEventId;
  }
  
  if (!eventId) {
    showNotification('No event assigned. Please contact an administrator.', 'error');
    return;
  }
  
  // Load honors, teachers, locations, timeslots, and clubs for the event
  const [honorsRes, teachersRes, directorsRes, locationsRes, timeslotsRes, clubsRes] = await Promise.all([
    fetchWithAuth('/api/classes/honors'),
    fetchWithAuth(`/api/users?role=Teacher&eventId=${eventId}`),
    fetchWithAuth(`/api/users?role=ClubDirector&eventId=${eventId}`),
    fetchWithAuth(`/api/events/${eventId}/locations`),
    fetchWithAuth(`/api/events/${eventId}/timeslots`),
    fetchWithAuth(`/api/clubs/event/${eventId}`)
  ]);
  
  const honors = await honorsRes.json();
  const teachers = await teachersRes.json();
  const directors = await directorsRes.json();
  const locations = await locationsRes.json();
  const timeslots = await timeslotsRes.json();
  const clubs = await clubsRes.json();
  
  // Merge teachers and club directors for teacher selection
  const allTeachers = [...teachers, ...directors].sort((a, b) => {
    if (a.LastName !== b.LastName) return a.LastName.localeCompare(b.LastName);
    return a.FirstName.localeCompare(b.FirstName);
  });
  
  // Sort honors by category, then by name
  const sortedHonors = [...honors].sort((a, b) => {
    if (a.Category !== b.Category) {
      return a.Category.localeCompare(b.Category);
    }
    return a.Name.localeCompare(b.Name);
  });
  
  const modal = document.createElement('div');
  modal.id = 'createClassModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h2>Create New Class</h2>
        <button onclick="closeModal('createClassModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createClassForm" onsubmit="handleCreateClass(event)">
        <div class="form-group">
          <label for="classHonor">Honor *</label>
          <select id="classHonor" name="classHonor" class="form-control" required>
            <option value="">Select Honor</option>
            ${sortedHonors.map(h => `<option value="${h.ID}">${h.Category}: ${h.Name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="classClub">Club *</label>
          <select id="classClub" name="classClub" class="form-control" required>
            <option value="">Select Club</option>
            ${clubs.map(c => `<option value="${c.ID}">${c.Name}</option>`).join('')}
          </select>
          <small style="color: var(--text-light);">The club offering this class</small>
        </div>
        <div class="form-group">
          <label for="classTeacher">Teacher</label>
          <select id="classTeacher" name="classTeacher" class="form-control">
            <option value="">No Teacher (Unassigned)</option>
            ${allTeachers.map(t => `<option value="${t.ID}">${t.FirstName} ${t.LastName}</option>`).join('')}
          </select>
          <small style="color: var(--text-light);">Optional - Teacher can be assigned later</small>
        </div>
        <div class="form-group">
          <label for="classLocation">Location *</label>
          <select id="classLocation" name="classLocation" class="form-control" required>
            <option value="">Select Location</option>
            ${locations.map(l => `<option value="${l.ID}">${l.Name} (Capacity: ${l.MaxCapacity})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="classMaxCapacity">Max Capacity *</label>
          <input type="number" id="classMaxCapacity" name="classMaxCapacity" class="form-control" min="1" required>
          <small style="color: var(--text-light);">Will be limited by location capacity</small>
        </div>
        <div class="form-group">
          <label for="classMinimumLevel">Minimum Level Requirement</label>
          <select id="classMinimumLevel" name="classMinimumLevel" class="form-control">
            <option value="">All Levels Welcome</option>
            <option value="Friend">Friend and above</option>
            <option value="Companion">Companion and above</option>
            <option value="Explorer">Explorer and above</option>
            <option value="Ranger">Ranger and above</option>
            <option value="Voyager">Voyager and above</option>
            <option value="Guide">Guide and above</option>
            <option value="MasterGuide">Master Guide only</option>
          </select>
          <small style="color: var(--text-light);">Leave as "All Levels" if no restriction needed</small>
        </div>
        <div class="form-group">
          <label>Select Timeslots (Sessions) for this Class *</label>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto;">
            ${timeslots.map(slot => `
              <label style="display: block; padding: 8px; margin-bottom: 4px; border: 1px solid #eee; border-radius: 3px; cursor: pointer; transition: background 0.2s;" 
                     onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                <input type="checkbox" name="classTimeslots" value="${slot.ID}" style="margin-right: 8px;">
                <strong>${convertTo12Hour(slot.StartTime)} - ${convertTo12Hour(slot.EndTime)}</strong> on ${slot.Date}
              </label>
            `).join('')}
          </div>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">Select all timeslots (sessions) when this class will be offered</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create Class</button>
          <button type="button" onclick="closeModal('createClassModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleCreateClass(e) {
  e.preventDefault();
  const form = e.target;
  // For EventAdmin, use assignedEventId if dropdown is empty
  const select = document.getElementById('classEventFilter');
  let eventId = select?.value;
  if (!eventId && assignedEventId) {
    eventId = assignedEventId;
  }
  
  const selectedTimeslots = Array.from(form.querySelectorAll('input[name="classTimeslots"]:checked')).map(cb => cb.value);
  
  if (selectedTimeslots.length === 0) {
    showNotification('Please select at least one timeslot (session) for this class', 'error');
    return;
  }
  
  const classData = {
    HonorID: form.classHonor?.value,
    ClubID: form.classClub?.value,
    TeacherID: form.classTeacher?.value || null, // Teacher is optional
    LocationID: form.classLocation?.value,
    TeacherMaxStudents: parseInt(form.classMaxCapacity?.value) || 0,
    MinimumLevel: form.classMinimumLevel?.value || null
  };

  if (!classData.HonorID || !classData.ClubID || !classData.LocationID || !classData.TeacherMaxStudents) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    // For EventAdmin, ensure we use the correct eventId
    const targetEventId = eventId || assignedEventId;
    if (!targetEventId) {
      showNotification('No event assigned. Please contact an administrator.', 'error');
      return;
    }
    
    // Create a separate class for each selected timeslot
    const results = [];
    for (const timeslotId of selectedTimeslots) {
      const response = await fetchWithAuth(`/api/classes`, {
        method: 'POST',
        body: JSON.stringify({ ...classData, EventID: targetEventId, TimeslotID: timeslotId })
      });
      const result = await response.json();
      results.push(result);
    }
    
    showNotification(`Successfully created ${results.length} class session(s)`, 'success');
    closeModal('createClassModal');
    await renderClasses();
  } catch (error) {
    showNotification('Error creating class: ' + error.message, 'error');
  }
}

/**
 * Setup classes event filter - populate and auto-select assigned event for EventAdmin
 */
async function setupClassesEventFilter() {
  const select = document.getElementById('classEventFilter');
  if (!select) return;
  
  // For EventAdmin, populate with assigned event and auto-select it
  if (assignedEventId && assignedEvent) {
    // Clear existing options
    select.innerHTML = '';
    // Add assigned event as option
    const option = document.createElement('option');
    option.value = assignedEvent.ID;
    option.textContent = assignedEvent.Name;
    option.selected = true;
    select.appendChild(option);
  } else if (assignedEventId) {
    // If we have assignedEventId but not assignedEvent, load it
    await loadAssignedEvent();
    if (assignedEvent) {
      select.innerHTML = '';
      const option = document.createElement('option');
      option.value = assignedEvent.ID;
      option.textContent = assignedEvent.Name;
      option.selected = true;
      select.appendChild(option);
    }
  }
}

async function renderClasses() {
  const container = document.getElementById('classesList');
  if (!container) return;
  
  const select = document.getElementById('classEventFilter');
  // For EventAdmin, use assignedEventId if no event is selected in dropdown
  let eventId = select?.value;
  if (!eventId && assignedEventId) {
    eventId = assignedEventId;
    // Auto-select the assigned event in the dropdown if it exists
    if (select && assignedEvent) {
      select.value = assignedEventId;
    }
  }
  const createBtn = document.getElementById('createClassBtn');
  
  if (!eventId) {
    container.innerHTML = '<p class="text-center">Select an event to view classes</p>';
    if (createBtn) createBtn.disabled = true;
    return;
  }
  
  if (createBtn) createBtn.disabled = false;
  
  try {
    const response = await fetchWithAuth(`/api/classes/${eventId}`);
    allClasses = await response.json();
    
    if (allClasses.length === 0) {
      container.innerHTML = '<p class="text-center">No classes found for this event</p>';
      return;
    }
    
    // Separate active and inactive classes
    let activeClasses = allClasses.filter(c => c.Active);
    let inactiveClasses = allClasses.filter(c => !c.Active);
    
    // Apply filters
    if (Object.keys(classFilters).length > 0) {
      const filterFunction = (cls) => {
        return Object.entries(classFilters).every(([column, filterValue]) => {
          if (!filterValue) return true;
          const lowerFilter = filterValue.toLowerCase();
          
          switch(column) {
            case 'honor':
              return (cls.HonorName || 'N/A').toLowerCase().includes(lowerFilter);
            case 'club':
              return (cls.ClubName || 'N/A').toLowerCase().includes(lowerFilter);
            case 'teacher':
              const teacherName = cls.TeacherFirstName && cls.TeacherLastName 
                ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` 
                : 'Unassigned';
              return teacherName.toLowerCase().includes(lowerFilter);
            case 'location':
              return (cls.LocationName || 'N/A').toLowerCase().includes(lowerFilter);
            case 'datetime':
              const dateStr = (cls.TimeslotDate || 'N/A').toLowerCase();
              const timeStr = cls.TimeslotStartTime 
                ? convertTo12Hour(cls.TimeslotStartTime).toLowerCase() 
                : '';
              const endTimeStr = cls.TimeslotEndTime 
                ? convertTo12Hour(cls.TimeslotEndTime).toLowerCase() 
                : '';
              return dateStr.includes(lowerFilter) || timeStr.includes(lowerFilter) || endTimeStr.includes(lowerFilter);
            case 'capacity':
              const capacityStr = `${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}`;
              return capacityStr.includes(lowerFilter);
            case 'status':
              const statusText = cls.Active ? 'Active' : 'Inactive';
              return statusText.toLowerCase().includes(lowerFilter);
            default:
              return true;
          }
        });
      };
      
      activeClasses = activeClasses.filter(filterFunction);
      inactiveClasses = inactiveClasses.filter(filterFunction);
    }
    
    // Combine for sorting
    let allFilteredClasses = [...activeClasses, ...inactiveClasses];
    
    // Apply sorting
    if (classSortColumn) {
      allFilteredClasses.sort((a, b) => {
        let aVal, bVal;
        
        switch(classSortColumn) {
          case 'honor':
            aVal = (a.HonorName || 'N/A').toLowerCase();
            bVal = (b.HonorName || 'N/A').toLowerCase();
            break;
          case 'club':
            aVal = (a.ClubName || 'N/A').toLowerCase();
            bVal = (b.ClubName || 'N/A').toLowerCase();
            break;
          case 'teacher':
            aVal = (a.TeacherFirstName && a.TeacherLastName 
              ? `${a.TeacherFirstName} ${a.TeacherLastName}` 
              : 'Unassigned').toLowerCase();
            bVal = (b.TeacherFirstName && b.TeacherLastName 
              ? `${b.TeacherFirstName} ${b.TeacherLastName}` 
              : 'Unassigned').toLowerCase();
            break;
          case 'location':
            aVal = (a.LocationName || 'N/A').toLowerCase();
            bVal = (b.LocationName || 'N/A').toLowerCase();
            break;
          case 'datetime':
            // Sort by date first, then time
            const aDate = a.TimeslotDate ? new Date(a.TimeslotDate) : new Date(0);
            const bDate = b.TimeslotDate ? new Date(b.TimeslotDate) : new Date(0);
            if (aDate.getTime() !== bDate.getTime()) {
              return classSortDirection === 'asc' 
                ? aDate.getTime() - bDate.getTime()
                : bDate.getTime() - aDate.getTime();
            }
            // If same date, sort by start time
            aVal = a.TimeslotStartTime || '00:00';
            bVal = b.TimeslotStartTime || '00:00';
            break;
          case 'capacity':
            // Sort by enrolled count
            aVal = a.EnrolledCount || 0;
            bVal = b.EnrolledCount || 0;
            break;
          case 'status':
            aVal = a.Active ? 1 : 0;
            bVal = b.Active ? 1 : 0;
            break;
          default:
            return 0;
        }
        
        if (classSortColumn === 'datetime' && a.TimeslotDate && b.TimeslotDate) {
          // Already handled above
          return 0;
        }
        
        if (typeof aVal === 'string') {
          return classSortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          return classSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });
      
      // Re-separate after sorting (maintain active/inactive grouping but sorted)
      activeClasses = allFilteredClasses.filter(c => c.Active);
      inactiveClasses = allFilteredClasses.filter(c => !c.Active);
    }

    // Helper function to format level restriction badge
    const getLevelBadge = (cls) => {
      if (cls.MinimumLevel) {
        return `<span class="badge bg-warning" style="font-size: 0.7em; margin-left: 5px;" title="Minimum level required: ${cls.MinimumLevel}">Min: ${cls.MinimumLevel}+</span>`;
      }
      return '';
    };

    const tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th class="filterable ${classFilters.honor ? 'filter-active' : ''} ${classSortColumn === 'honor' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('honor')" style="width: 18%; padding: 12px 8px; text-align: left;">Honor</th>
            <th class="filterable ${classFilters.club ? 'filter-active' : ''} ${classSortColumn === 'club' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('club')" style="width: 12%; padding: 12px 8px; text-align: left;">Club</th>
            <th class="filterable ${classFilters.teacher ? 'filter-active' : ''} ${classSortColumn === 'teacher' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('teacher')" style="width: 13%; padding: 12px 8px; text-align: left;">Teacher</th>
            <th class="filterable ${classFilters.location ? 'filter-active' : ''} ${classSortColumn === 'location' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('location')" style="width: 13%; padding: 12px 8px; text-align: left;">Location</th>
            <th class="filterable ${classFilters.datetime ? 'filter-active' : ''} ${classSortColumn === 'datetime' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('datetime')" style="width: 16%; padding: 12px 8px; text-align: left;">Date/Time</th>
            <th class="filterable ${classFilters.capacity ? 'filter-active' : ''} ${classSortColumn === 'capacity' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('capacity')" style="width: 13%; padding: 12px 8px; text-align: left;">Capacity</th>
            <th class="filterable ${classFilters.status ? 'filter-active' : ''} ${classSortColumn === 'status' ? 'sort-active' : ''}" onclick="toggleEventAdminClassColumnFilter('status')" style="width: 8%; padding: 12px 8px; text-align: left;">Status</th>
            <th style="width: 10%; padding: 12px 8px; text-align: left;">Actions</th>
          </tr>
          <tr class="filter-row" id="eventAdminClassFilterRow" style="display: ${Object.keys(classFilters).length > 0 ? 'table-row' : 'none'}; background-color: #f8fafc;">
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-honor" value="${classFilters.honor || ''}" oninput="debouncedUpdateEventAdminClassFilter('honor', this.value)" placeholder="Filter by honor...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-club" value="${classFilters.club || ''}" oninput="debouncedUpdateEventAdminClassFilter('club', this.value)" placeholder="Filter by club...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-teacher" value="${classFilters.teacher || ''}" oninput="debouncedUpdateEventAdminClassFilter('teacher', this.value)" placeholder="Filter by teacher...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-location" value="${classFilters.location || ''}" oninput="debouncedUpdateEventAdminClassFilter('location', this.value)" placeholder="Filter by location...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-datetime" value="${classFilters.datetime || ''}" oninput="debouncedUpdateEventAdminClassFilter('datetime', this.value)" placeholder="Filter by date/time...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-capacity" value="${classFilters.capacity || ''}" oninput="debouncedUpdateEventAdminClassFilter('capacity', this.value)" placeholder="Filter by capacity...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="eventAdmin-filter-status" value="${classFilters.status || ''}" oninput="debouncedUpdateEventAdminClassFilter('status', this.value)" placeholder="Filter by status...">
            </td>
            <td class="filter-cell"></td>
          </tr>
        </thead>
        <tbody>
          ${activeClasses.length === 0 && inactiveClasses.length === 0 ? '<tr><td colspan="8" class="text-center">No classes match the current filters</td></tr>' : ''}
          ${activeClasses.map(cls => `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 12px 8px; text-align: left;"><strong>${cls.HonorName || 'N/A'}</strong>${getLevelBadge(cls)}</td>
            <td style="padding: 12px 8px; text-align: left;">${cls.ClubName || '<span style="color: #999;">N/A</span>'}</td>
            <td style="padding: 12px 8px; text-align: left;">${cls.TeacherFirstName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : '<span style="color: #999;">Unassigned</span>'}</td>
            <td style="padding: 12px 8px; text-align: left;">${cls.LocationName || 'N/A'}</td>
            <td style="padding: 12px 8px; text-align: left;">
              ${cls.TimeslotDate || 'N/A'}<br>
              <small style="color: var(--text-light);">${cls.TimeslotStartTime ? convertTo12Hour(cls.TimeslotStartTime) : ''} - ${cls.TimeslotEndTime ? convertTo12Hour(cls.TimeslotEndTime) : ''}</small>
            </td>
            <td style="padding: 12px 8px; text-align: left;">${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}</td>
            <td style="padding: 12px 8px; text-align: left;"><span class="badge bg-success">Active</span></td>
            <td style="padding: 12px 8px; text-align: left;">
              <button onclick="viewClassStudents(${cls.ID})" class="btn btn-sm btn-info">Manage Students</button>
              <button onclick="editClass(${cls.ID})" class="btn btn-sm btn-secondary">Edit</button> 
              <button onclick="deactivateClass(${cls.ID})" class="btn btn-sm btn-danger">Deactivate</button>
            </td>
          </tr>
        `).join('')}
        ${inactiveClasses.length > 0 ? `
          <tr style="background: #f9f9f9; border-top: 2px solid #ccc;">
            <td colspan="8" style="padding: 10px; font-weight: bold; color: #666;">Deactivated Classes</td>
          </tr>
          ${inactiveClasses.map(cls => `
          <tr style="border-bottom: 1px solid #e0e0e0; opacity: 0.7; background: #f9f9f9;">
            <td style="padding: 12px 8px; text-align: left;"><strong>${cls.HonorName || 'N/A'}</strong>${getLevelBadge(cls)}</td>
            <td style="padding: 12px 8px; text-align: left;">${cls.ClubName || '<span style="color: #999;">N/A</span>'}</td>
            <td style="padding: 12px 8px; text-align: left;">${cls.TeacherFirstName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : '<span style="color: #999;">Unassigned</span>'}</td>
            <td style="padding: 12px 8px; text-align: left;">${cls.LocationName || 'N/A'}</td>
            <td style="padding: 12px 8px; text-align: left;">
              ${cls.TimeslotDate || 'N/A'}<br>
              <small style="color: var(--text-light);">${cls.TimeslotStartTime ? convertTo12Hour(cls.TimeslotStartTime) : ''} - ${cls.TimeslotEndTime ? convertTo12Hour(cls.TimeslotEndTime) : ''}</small>
            </td>
            <td style="padding: 12px 8px; text-align: left;">${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}</td>
            <td style="padding: 12px 8px; text-align: left;"><span class="badge bg-danger">Inactive</span></td>
            <td style="padding: 12px 8px; text-align: left;">
              <button onclick="activateClass(${cls.ID})" class="btn btn-sm btn-success">Activate</button>
              <button onclick="removeClass(${cls.ID})" class="btn btn-sm btn-danger" style="margin-left: 5px;">Remove</button>
            </td>
          </tr>
        `).join('')}
        ` : ''}
        </tbody>
      </table>
    `;
    
    const allClassesForMobile = allFilteredClasses.length > 0 ? allFilteredClasses : [...activeClasses, ...inactiveClasses];
    const mobileCards = allClassesForMobile.map(cls => {
      const dateTime = cls.TimeslotDate 
        ? `${cls.TimeslotDate}<br><small style="color: var(--text-light);">${cls.TimeslotStartTime ? convertTo12Hour(cls.TimeslotStartTime) : ''} - ${cls.TimeslotEndTime ? convertTo12Hour(cls.TimeslotEndTime) : ''}</small>`
        : 'N/A';
      
      const actionsHtml = cls.Active
        ? `
          <button onclick="viewClassStudents(${cls.ID})" class="btn btn-sm btn-info">Manage Students</button>
          <button onclick="editClass(${cls.ID})" class="btn btn-sm btn-secondary">Edit</button>
          <button onclick="deactivateClass(${cls.ID})" class="btn btn-sm btn-danger">Deactivate</button>
        `
        : `
          <button onclick="activateClass(${cls.ID})" class="btn btn-sm btn-success">Activate</button>
          <button onclick="removeClass(${cls.ID})" class="btn btn-sm btn-danger" style="margin-left: 5px;">Remove</button>
        `;
      
      return createMobileCard({
        'Honor': cls.HonorName || 'N/A',
        'Club': cls.ClubName || 'N/A',
        'Teacher': cls.TeacherFirstName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : 'Unassigned',
        'Location': cls.LocationName || 'N/A',
        'Date/Time': dateTime,
        'Capacity': `${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}`,
        'Status': cls.Active ? 'Active' : 'Inactive'
      }, cls.HonorName || 'N/A', actionsHtml);
    }).join('');
    
    container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
    
    // Update filter button state after rendering
    updateEventAdminClassFilterButtonState();
  } catch (error) {
    console.error('Error loading classes:', error);
    showNotification('Error loading classes', 'error');
  }
}

function toggleEventAdminClassColumnFilter(column) {
  // Show filter row if hidden and add filter for this column
  const filterRow = document.getElementById('eventAdminClassFilterRow');
  if (filterRow && filterRow.style.display === 'none') {
    filterRow.style.display = 'table-row';
  }
  
  // Focus on the filter input for this column
  const filterInput = document.getElementById(`eventAdmin-filter-${column}`);
  if (filterInput) {
    filterInput.focus();
  }
  
  // Update filter button state
  const filterBtn = document.getElementById('toggleEventAdminClassFiltersBtn');
  if (filterBtn && filterRow && filterRow.style.display !== 'none') {
    filterBtn.classList.add('btn-primary');
    filterBtn.textContent = '🔍 Filters Active';
  }
  
  // Toggle sorting
  if (classSortColumn === column) {
    classSortDirection = classSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    classSortColumn = column;
    classSortDirection = 'asc';
  }
  
  renderClasses();
}

function updateEventAdminClassFilter(column, value) {
  if (value.trim()) {
    classFilters[column] = value.trim();
  } else {
    delete classFilters[column];
    // Hide filter row if no filters active
    if (Object.keys(classFilters).length === 0) {
      const filterRow = document.getElementById('eventAdminClassFilterRow');
      if (filterRow) filterRow.style.display = 'none';
      // Update filter button state
      const filterBtn = document.getElementById('toggleEventAdminClassFiltersBtn');
      if (filterBtn) {
        filterBtn.classList.remove('btn-primary');
        filterBtn.textContent = '🔍 Filter';
      }
      // Remove clear filters button
      const clearBtn = filterBtn?.nextElementSibling;
      if (clearBtn && clearBtn.onclick?.toString().includes('clearEventAdminClassFilters')) {
        clearBtn.remove();
      }
    }
  }
  renderClasses();
  // Update filter button state
  updateEventAdminClassFilterButtonState();
}

// Debounced version of updateEventAdminClassFilter (400ms delay)
const debouncedUpdateEventAdminClassFilter = debounce(updateEventAdminClassFilter, 400);

function toggleEventAdminClassFilters() {
  const filterRow = document.getElementById('eventAdminClassFilterRow');
  if (!filterRow) return;
  
  const isVisible = filterRow.style.display !== 'none';
  filterRow.style.display = isVisible ? 'none' : 'table-row';
  
  // Update button text
  const filterBtn = document.getElementById('toggleEventAdminClassFiltersBtn');
  if (filterBtn) {
    if (isVisible) {
      filterBtn.classList.remove('btn-primary');
      filterBtn.textContent = '🔍 Filter';
    } else {
      filterBtn.classList.add('btn-primary');
      filterBtn.textContent = '🔍 Filters Active';
    }
  }
}

function clearEventAdminClassFilters() {
  classFilters = {};
  classSortColumn = null;
  classSortDirection = 'asc';
  
  // Clear all filter inputs
  const filterInputs = document.querySelectorAll('#eventAdminClassFilterRow .filter-input');
  filterInputs.forEach(input => input.value = '');
  
  // Hide filter row
  const filterRow = document.getElementById('eventAdminClassFilterRow');
  if (filterRow) filterRow.style.display = 'none';
  
  // Update filter button
  const filterBtn = document.getElementById('toggleEventAdminClassFiltersBtn');
  if (filterBtn) {
    filterBtn.classList.remove('btn-primary');
    filterBtn.textContent = '🔍 Filter';
  }
  
  // Remove clear filters button
  const clearBtn = filterBtn?.nextElementSibling;
  if (clearBtn && clearBtn.onclick?.toString().includes('clearEventAdminClassFilters')) {
    clearBtn.remove();
  }
  
  renderClasses();
}

function updateEventAdminClassFilterButtonState() {
  const filterBtn = document.getElementById('toggleEventAdminClassFiltersBtn');
  if (!filterBtn) return;
  
  const hasActiveFilters = Object.keys(classFilters).length > 0;
  if (hasActiveFilters) {
    filterBtn.classList.add('btn-primary');
    filterBtn.textContent = '🔍 Filters Active';
    
    // Add clear filters button if it doesn't exist
    if (!filterBtn.nextElementSibling || !filterBtn.nextElementSibling.onclick?.toString().includes('clearEventAdminClassFilters')) {
      const clearBtn = document.createElement('button');
      clearBtn.onclick = clearEventAdminClassFilters;
      clearBtn.className = 'btn btn-outline';
      clearBtn.textContent = 'Clear Filters';
      clearBtn.title = 'Clear all filters';
      filterBtn.insertAdjacentElement('afterend', clearBtn);
    }
  } else {
    filterBtn.classList.remove('btn-primary');
    filterBtn.textContent = '🔍 Filter';
    
    // Remove clear filters button
    const clearBtn = filterBtn.nextElementSibling;
    if (clearBtn && clearBtn.onclick?.toString().includes('clearEventAdminClassFilters')) {
      clearBtn.remove();
    }
  }
}

window.renderClasses = renderClasses;
window.renderTimeslots = renderTimeslots;
window.toggleEventAdminClassColumnFilter = toggleEventAdminClassColumnFilter;
window.updateEventAdminClassFilter = updateEventAdminClassFilter;
window.debouncedUpdateEventAdminClassFilter = debouncedUpdateEventAdminClassFilter;
window.toggleEventAdminClassFilters = toggleEventAdminClassFilters;
window.clearEventAdminClassFilters = clearEventAdminClassFilters;

// Club management functions
async function renderClubs() {
  const container = document.getElementById('clubsList');
  if (!container) return;
  
  try {
    // Ensure the Create Club button exists and is visible
    const cardHeader = document.querySelector('#content .card-header');
    if (cardHeader) {
      let createClubBtn = cardHeader.querySelector('button[onclick*="showCreateClubForm"]');
      if (!createClubBtn) {
        // Button is missing, add it
        createClubBtn = document.createElement('button');
        createClubBtn.setAttribute('onclick', 'showCreateClubForm()');
        createClubBtn.className = 'btn btn-primary';
        createClubBtn.textContent = 'Create Club';
        cardHeader.appendChild(createClubBtn);
      } else {
        // Button exists, ensure it's visible
        createClubBtn.style.display = 'block';
        createClubBtn.style.visibility = 'visible';
      }
    }
    
    // Load clubs for assigned event
    const response = await fetchWithAuth(`/api/clubs/event/${assignedEventId}`);
    allClubs = await response.json();
    
    if (allClubs.length === 0) {
      container.innerHTML = '<p class="text-center">No clubs found</p>';
      return;
    }
    
    // For each club, load its events
    const clubsWithEvents = await Promise.all(
      allClubs.map(async (club) => {
        const eventsResponse = await fetchWithAuth(`/api/clubs/${club.ID}/events`);
        const events = await eventsResponse.json();
        return {
          ...club,
          events: events
        };
      })
    );
    
    const tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 25%; padding: 12px 8px; text-align: left;">Club Name</th>
            <th style="width: 20%; padding: 12px 8px; text-align: left;">Church</th>
            <th style="width: 20%; padding: 12px 8px; text-align: left;">Director</th>
            <th style="width: 30%; padding: 12px 8px; text-align: left;">Events</th>
            <th style="width: 5%; padding: 12px 8px; text-align: left;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${clubsWithEvents.map(club => `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 12px 8px; text-align: left;"><strong>${club.Name}</strong></td>
            <td style="padding: 12px 8px; text-align: left;">${club.Church || '-'}</td>
            <td style="padding: 12px 8px; text-align: left;">${club.DirectorFirstName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : '<span style="color: #999;">Unassigned</span>'}</td>
            <td style="padding: 12px 8px; text-align: left;">${club.events.length > 0 ? club.events.map(e => e.Name).join(', ') : '<span style="color: #999;">No events</span>'}</td>
            <td style="padding: 12px 8px; text-align: left;">
              <button onclick="editClub(${club.ID})" class="btn btn-sm btn-secondary">Edit</button>
            </td>
          </tr>
        `).join('')}
        </tbody>
      </table>
    `;
    
    const mobileCards = clubsWithEvents.map(club => {
      const actionsHtml = `
        <button onclick="editClub(${club.ID})" class="btn btn-sm btn-secondary">Edit</button>
      `;
      
      return createMobileCard({
        'Club Name': club.Name,
        'Church': club.Church || '-',
        'Director': club.DirectorFirstName ? `${club.DirectorFirstName} ${club.DirectorLastName}` : 'Unassigned',
        'Events': club.events.length > 0 ? club.events.map(e => e.Name).join(', ') : 'No events'
      }, club.Name, actionsHtml);
    }).join('');
    
    container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
  } catch (error) {
    console.error('Error loading clubs:', error);
    showNotification('Error loading clubs', 'error');
  }
}

async function showCreateClubForm() {
  // EventAdmin creates clubs for their assigned event
  const eventId = assignedEventId;
  
  if (!eventId) {
    showNotification('No event assigned. Please contact an administrator.', 'error');
    return;
  }
  
  // Load directors (Club Directors)
  const directorsRes = await fetchWithAuth('/api/users?role=ClubDirector');
  const directors = await directorsRes.json();
  
  const modal = document.createElement('div');
  modal.id = 'createClubModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create New Club</h2>
        <button onclick="closeModal('createClubModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createClubForm" onsubmit="handleCreateClub(event)">
        <div class="form-group">
          <label for="clubName">Club Name *</label>
          <input type="text" id="clubName" name="clubName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="clubChurch">Church</label>
          <input type="text" id="clubChurch" name="clubChurch" class="form-control">
        </div>
        <div class="form-group">
          <label for="clubDirector">Director</label>
          <select id="clubDirector" name="clubDirector" class="form-control">
            <option value="">No Director</option>
            ${directors.map(d => `<option value="${d.ID}">${d.FirstName} ${d.LastName}</option>`).join('')}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create Club</button>
          <button type="button" onclick="closeModal('createClubModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleCreateClub(e) {
  e.preventDefault();
  const form = e.target;
  
  // EventAdmin creates clubs for their assigned event
  const eventId = assignedEventId;
  
  const clubData = {
    Name: form.clubName?.value?.trim() || '',
    Church: form.clubChurch?.value?.trim() || null,
    DirectorID: form.clubDirector?.value || null
  };
  
  if (!clubData.Name) {
    showNotification('Please enter a club name', 'error');
    return;
  }
  
  if (!eventId) {
    showNotification('No event assigned. Please contact an administrator.', 'error');
    return;
  }
  
  try {
    // Create club without EventID, then link to assigned event
    const response = await fetchWithAuth('/api/clubs', {
      method: 'POST',
      body: JSON.stringify(clubData)
    });
    
    const result = await response.json();
    
    if (response.ok && eventId) {
      // Link the newly created club to the assigned event
      const linkResponse = await fetchWithAuth(`/api/clubs/${result.ID}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ EventID: eventId })
      });
      
      if (linkResponse.ok) {
        showNotification('Club created and linked to event successfully', 'success');
        closeModal('createClubModal');
        await renderClubs();
      } else {
        const linkError = await linkResponse.json();
        showNotification('Club created but failed to link to event: ' + (linkError.error || 'Unknown error'), 'error');
      }
    } else if (response.ok) {
      showNotification('Club created but no event assigned. Please contact an administrator.', 'error');
    } else {
      showNotification(result.error || 'Error creating club', 'error');
    }
  } catch (error) {
    showNotification('Error creating club: ' + error.message, 'error');
  }
}

async function editClub(clubId) {
  const club = allClubs.find(c => c.ID === clubId);
  if (!club) return;
  
  // Load directors
  const directorsRes = await fetchWithAuth('/api/users?role=ClubDirector');
  const directors = await directorsRes.json();
  
  const modal = document.createElement('div');
  modal.id = 'editClubModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Club</h2>
        <button onclick="closeModal('editClubModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editClubForm" onsubmit="handleEditClub(event, ${clubId})">
        <div class="form-group">
          <label for="editClubName">Club Name *</label>
          <input type="text" id="editClubName" name="editClubName" class="form-control" value="${club.Name}" required>
        </div>
        <div class="form-group">
          <label for="editClubChurch">Church</label>
          <input type="text" id="editClubChurch" name="editClubChurch" class="form-control" value="${club.Church || ''}">
        </div>
        <div class="form-group">
          <label for="editClubDirector">Director</label>
          <select id="editClubDirector" name="editClubDirector" class="form-control">
            <option value="">No Director</option>
            ${directors.map(d => `<option value="${d.ID}" ${club.DirectorID === d.ID ? 'selected' : ''}>${d.FirstName} ${d.LastName}</option>`).join('')}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Club</button>
          <button type="button" onclick="closeModal('editClubModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleEditClub(e, clubId) {
  e.preventDefault();
  const form = e.target;
  
  const clubData = {
    Name: form.editClubName?.value?.trim() || '',
    Church: form.editClubChurch?.value?.trim() || null,
    DirectorID: form.editClubDirector?.value || null
  };
  
  if (!clubData.Name) {
    showNotification('Please enter a club name', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs/${clubId}`, {
      method: 'PUT',
      body: JSON.stringify(clubData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Club updated successfully', 'success');
      closeModal('editClubModal');
      await loadClubs();
      // Also refresh users if we're on the users tab (data will refresh when tab is clicked)
      if (currentTab === 'users') {
        await loadUsers();
      }
    } else {
      showNotification(result.error || 'Error updating club', 'error');
    }
  } catch (error) {
    showNotification('Error updating club: ' + error.message, 'error');
  }
}

async function showMoveClubModal(clubId) {
  const club = allClubs.find(c => c.ID === clubId);
  if (!club) return;
  
  const modal = document.createElement('div');
  modal.id = 'moveClubModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Move Club to Different Event</h2>
        <button onclick="closeModal('moveClubModal')" class="btn btn-outline">×</button>
      </div>
      <p>Select the event to move "${club.Name}" to:</p>
      <form id="moveClubForm" onsubmit="handleMoveClub(event, ${clubId})">
        <div class="form-group">
          <label for="moveToEvent">Event *</label>
          <select id="moveToEvent" name="moveToEvent" class="form-control" required>
            <option value="">Select Event</option>
            ${allEvents.map(event => `<option value="${event.ID}">${event.Name}</option>`).join('')}
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Move Club</button>
          <button type="button" onclick="closeModal('moveClubModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function handleMoveClub(e, clubId) {
  e.preventDefault();
  const form = e.target;
  const eventId = form.moveToEvent?.value;
  
  if (!eventId) {
    showNotification('Please select an event', 'error');
    return;
  }
  
  try {
    // Link club to event (clubs can now participate in multiple events)
    const response = await fetchWithAuth(`/api/clubs/${clubId}/events`, {
      method: 'POST',
      body: JSON.stringify({ EventID: parseInt(eventId) })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Club linked to event successfully', 'success');
      closeModal('moveClubModal');
      await renderClubs();
    } else {
      showNotification(result.error || 'Error linking club to event', 'error');
    }
  } catch (error) {
    showNotification('Error linking club to event: ' + error.message, 'error');
  }
}

window.renderClasses = renderClasses;
window.renderTimeslots = renderTimeslots;
window.renderClubs = renderClubs;
window.showCreateClassForm = showCreateClassForm;
window.handleCreateClass = handleCreateClass;
window.showCreateEventForm = showCreateEventForm;
window.generateEventReport = generateEventReport;
window.generateTimeslotRosterReport = generateTimeslotRosterReport;
window.showCreateClubForm = showCreateClubForm;
window.handleCreateClub = handleCreateClub;
window.editClub = editClub;
window.handleEditClub = handleEditClub;
window.showMoveClubModal = showMoveClubModal;
window.handleMoveClub = handleMoveClub;
window.showCreateUserForm = showCreateUserForm;
window.showCreateLocationForm = showCreateLocationForm;
window.showCreateTimeslotForm = showCreateTimeslotForm;
window.editLocation = editLocation;
window.deleteLocation = deleteLocation;
window.handleCreateLocation = handleCreateLocation;
window.handleEditLocation = handleEditLocation;
window.handleCreateTimeslot = handleCreateTimeslot;
window.editTimeslot = editTimeslot;
window.deleteTimeslot = deleteTimeslot;
window.handleEditTimeslot = handleEditTimeslot;
window.editUser = editUser;
window.handleCreateUser = handleCreateUser;
window.showInviteModal = showInviteModal;
window.resendInvite = async function(email) {
  try {
    // First, fetch the existing invite
    const response = await fetchWithAuth(`/api/invites/user/${encodeURIComponent(email)}`);
    const invite = await response.json();
    
    if (!response.ok) {
      showNotification(invite.error || 'Error fetching invite', 'error');
      return;
    }
    
    // Reset the invite time
    const resetResponse = await fetchWithAuth(`/api/invites/${invite.Code}/reset`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresInDays: 30 })
    });
    
    const updatedInvite = await resetResponse.json();
    
    if (!resetResponse.ok) {
      showNotification(updatedInvite.error || 'Error resetting invite time', 'error');
      return;
    }
    
    // Get user details for email template
    const user = allUsers.find(u => u.Email === email);
    if (!user) {
      showNotification('User not found', 'error');
      return;
    }
    
    // Get event and club names
    const eventName = assignedEvent ? assignedEvent.Name : '';
    const clubName = user.ClubID ? (allClubs.find(c => c.ID === user.ClubID)?.Name || 'Club') : '';
    
    // Show invite modal with updated invite (same code, but reset time)
    const inviteData = {
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      role: user.Role,
      clubId: user.ClubID || null,
      eventId: assignedEventId
    };
    
    showInviteModal(updatedInvite, inviteData);
  } catch (error) {
    showNotification('Error resending invite: ' + error.message, 'error');
  }
};
window.handleEditUser = handleEditUser;
window.closeModal = closeModal;
window.handleCreateEvent = handleCreateEvent;
window.toggleUserColumnFilter = toggleUserColumnFilter;
window.updateUserFilter = updateUserFilter;
window.debouncedUpdateUserFilter = debouncedUpdateUserFilter;
window.toggleUserFilters = toggleUserFilters;
window.clearUserFilters = clearUserFilters;
window.renderUsers = renderUsers;
window.toggleDeactivatedUsers = toggleDeactivatedUsers;
window.searchByCheckInNumber = searchByCheckInNumber;
window.searchByFirstName = searchByFirstName;
window.selectUserFromDropdown = selectUserFromDropdown;
window.displayCheckInUser = displayCheckInUser;
window.handleCheckInUser = handleCheckInUser;
window.clearCheckInForm = clearCheckInForm;

