// Admin Dashboard - Full Implementation

let currentTab = 'events';
let allEvents = [];
let allUsers = [];
let allLocations = [];
let allTimeslots = [];
let allClubs = [];
let allClasses = [];
let currentUser = null;

// Filter state for user table
let userFilters = {};
let userSortColumn = null;
let userSortDirection = 'asc';
let showDeactivatedUsers = false;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) {
    window.location.href = '/login.html';
    return;
  }

  const user = getCurrentUser();
  
  // Skip admin dashboard initialization for Club Directors
  // They have their own dashboard logic
  if (user.role === 'ClubDirector') {
    return;
  }
  
  currentUser = user;
  document.getElementById('userDisplayName').textContent = `${user.firstName} ${user.lastName}`;

  // Make switchTab available globally
  window.switchTab = switchTab;
  window.toggleEventDropdown = toggleEventDropdown;
  window.toggleEditEventDropdown = toggleEditEventDropdown;
  
  await loadEvents();
  await loadUsers();
  const savedTab = localStorage.getItem('adminCurrentTab') || 'events';
  switchTab(savedTab);
});

// Helper function to get role label from event
function getRoleLabel(role, eventId) {
  if (!eventId || !allEvents) return role;
  const event = allEvents.find(e => e.ID === eventId);
  if (!event) return role;
  
  const labelMap = {
    'Student': event.RoleLabelStudent || 'Student',
    'Teacher': event.RoleLabelTeacher || 'Teacher',
    'Staff': event.RoleLabelStaff || 'Staff',
    'ClubDirector': event.RoleLabelClubDirector || 'Club Director',
    'EventAdmin': event.RoleLabelEventAdmin || 'Event Admin',
    'Admin': 'Admin' // Admin is not customizable
  };
  
  return labelMap[role] || role;
}

// Toggle event dropdown based on role selection
async function toggleEventDropdown(role) {
  const eventContainer = document.getElementById('eventContainer');
  const clubContainer = document.getElementById('clubContainer');
  const eventSelect = document.getElementById('eventId');
  
  if (role === 'EventAdmin') {
    eventContainer.style.display = 'block';
    if (eventSelect && eventSelect.options.length === 1) { // Only has "Select Event" option
      // Populate events
      const response = await fetchWithAuth('/api/events');
      const events = await response.json();
      events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.ID;
        option.textContent = event.Name;
        eventSelect.appendChild(option);
      });
    }
  } else if (role === 'Student' || role === 'Teacher' || role === 'ClubDirector') {
    // Show event container for students, teachers, and club directors (they need to be in a club)
    eventContainer.style.display = 'block';
    if (eventSelect && eventSelect.options.length === 1) {
      const response = await fetchWithAuth('/api/events');
      const events = await response.json();
      events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.ID;
        option.textContent = event.Name;
        eventSelect.appendChild(option);
      });
    }
    // Show club container for students and teachers
    if (role === 'Student' || role === 'Teacher') {
      if (clubContainer) clubContainer.style.display = 'block';
    }
  } else {
    if (eventContainer) eventContainer.style.display = 'none';
    if (clubContainer) clubContainer.style.display = 'none';
  }
}

// Toggle event dropdown in edit modal
async function toggleEditEventDropdown(role) {
  const eventContainer = document.getElementById('editEventContainer');
  const clubContainer = document.getElementById('editClubContainer');
  const eventSelect = document.getElementById('editEventId');
  
  if (role === 'EventAdmin') {
    if (eventContainer) eventContainer.style.display = 'block';
    if (eventSelect && eventSelect.options.length === 1) { // Only has "Select Event" option
      // Populate events
      const response = await fetchWithAuth('/api/events');
      const events = await response.json();
      events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.ID;
        option.textContent = event.Name;
        eventSelect.appendChild(option);
      });
      
      // Set current event if user already has one
      const currentUser = allUsers.find(u => u.ID === parseInt(eventSelect.closest('form').getAttribute('data-user-id')));
      if (currentUser && currentUser.EventID) {
        eventSelect.value = currentUser.EventID;
      }
    }
  } else if (['Student', 'Teacher', 'ClubDirector'].includes(role)) {
    if (eventContainer) eventContainer.style.display = 'block';
    if (clubContainer) clubContainer.style.display = 'block'; // Show club container for these roles
    if (eventSelect && eventSelect.options.length === 1) {
      // Populate events
      const response = await fetchWithAuth('/api/events');
      const events = await response.json();
      events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.ID;
        option.textContent = event.Name;
        eventSelect.appendChild(option);
      });
    }
  } else {
    if (eventContainer) eventContainer.style.display = 'none';
    if (clubContainer) clubContainer.style.display = 'none';
  }
}

// Load clubs for create user form when event is selected
async function loadClubsForCreateUser(eventId) {
  const clubContainer = document.getElementById('clubContainer');
  const clubSelect = document.getElementById('clubId');
  
  if (!eventId) {
    if (clubContainer) clubContainer.style.display = 'none';
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs/event/${eventId}`);
    const clubs = await response.json();
    
    if (clubSelect) {
      clubSelect.innerHTML = '<option value="">No Club</option>';
      clubs.forEach(club => {
        const option = document.createElement('option');
        option.value = club.ID;
        option.textContent = club.Name;
        clubSelect.appendChild(option);
      });
    }
    
    if (clubContainer) clubContainer.style.display = 'block';
  } catch (error) {
    console.error('Error loading clubs:', error);
  }
}

// Load clubs for edit user form when event is selected
async function loadClubsForEditUser(eventId) {
  const clubContainer = document.getElementById('editClubContainer');
  const clubSelect = document.getElementById('editClubId');
  const user = allUsers.find(u => u.ID === parseInt(document.getElementById('editUserForm')?.dataset.userId || 0));
  
  if (!eventId) {
    if (clubContainer) clubContainer.style.display = 'none';
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/clubs/event/${eventId}`);
    const clubs = await response.json();
    
    if (clubSelect) {
      clubSelect.innerHTML = '<option value="">No Club</option>';
      clubs.forEach(club => {
        const option = document.createElement('option');
        option.value = club.ID;
        option.textContent = club.Name;
        if (user && user.ClubID === club.ID) {
          option.selected = true;
        }
        clubSelect.appendChild(option);
      });
    }
    
    if (clubContainer) clubContainer.style.display = 'block';
  } catch (error) {
    console.error('Error loading clubs:', error);
  }
}

// Make function globally available
window.loadClubsForCreateUser = loadClubsForCreateUser;
window.loadClubsForEditUser = loadClubsForEditUser;

async function switchTab(tabName, clickedElement = null) {
  currentTab = tabName;
  try { localStorage.setItem('adminCurrentTab', tabName); } catch (e) {}
  
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
      await renderEvents();
      break;
    case 'users':
      content.innerHTML = await getUsersTab();
      await renderUsers();
      break;
    case 'locations':
      content.innerHTML = await getLocationsTab();
      updateEventDropdowns(); // Populate event dropdown
      await renderLocations();
      break;
    case 'timeslots':
      content.innerHTML = await getTimeslotsTab();
      updateEventDropdowns(); // Populate event dropdown
      await renderTimeslots();
      break;
    case 'clubs':
      content.innerHTML = await getClubsTab();
      await renderClubs();
      break;
    case 'classes':
      content.innerHTML = await getClassesTab();
      updateEventDropdowns(); // Populate event dropdown
      await renderClasses();
      break;
    case 'reports':
      content.innerHTML = await getReportsTab();
      updateEventDropdowns(); // Populate event dropdown
      break;
    case 'checkin':
      content.innerHTML = getCheckInTab({ eventId: null, userRole: currentUser.role, userClubId: null });
      await checkInPopulateEventSelector();
      break;
    case 'system':
      content.innerHTML = getSystemTab();
      break;
  }
}

function getEventsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Events</h2>
        <button onclick="showCreateEventForm()" class="btn btn-primary">Create New Event</button>
      </div>
      <div id="eventsList"></div>
    </div>
  `;
}

function getUsersTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Users</h2>
        <div style="display: flex; gap: 0.5rem;">
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
        <button onclick="showCreateLocationForm()" class="btn btn-primary" id="createLocationBtn" disabled>Create Location</button>
      </div>
      <select id="locationEventFilter" class="form-control mb-2" onchange="renderLocations()">
        <option value="">Select Event</option>
      </select>
      <div id="locationsList"></div>
    </div>
  `;
}

function getTimeslotsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Timeslots</h2>
        <button onclick="showCreateTimeslotForm()" class="btn btn-primary" id="createTimeslotBtn" disabled>Create Timeslot</button>
      </div>
      <select id="timeslotEventFilter" class="form-control mb-2" onchange="renderTimeslots()">
        <option value="">Select Event</option>
      </select>
      <div id="timeslotsList"></div>
    </div>
  `;
}

function getClubsTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Clubs</h2>
      </div>
      <div id="clubsList"></div>
    </div>
  `;
}

function getClassesTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Classes</h2>
        <button onclick="showCreateClassForm()" class="btn btn-primary" id="createClassBtn" disabled>Create Class</button>
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
        <h2 class="card-title">Reports</h2>
      </div>
      <select id="reportEventFilter" class="form-control mb-2" onchange="updateReportButton()">
        <option value="">Select Event</option>
      </select>
      <button id="generateReportBtn" onclick="generateReport()" class="btn btn-primary" disabled>Generate CSV Report</button>
    </div>
  `;
}

// Check-in functionality now uses the reusable module in checkin.js
// Old check-in functions removed

function getSystemTab() {
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">System Administration</h2>
      </div>
      <div style="padding: 20px;">
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ffc107;">
          <strong>⚠️ Warning:</strong> Resetting the database will delete ALL data including admin users, honors, events, clubs, classes, and registrations. Everything will be recreated fresh. This action cannot be undone.
        </div>
        <div class="form-group">
          <label><strong>Database Reset & Reseed</strong></label>
          <p style="color: #666; margin: 10px 0;">This will:</p>
          <ul style="color: #666; margin: 10px 0 20px 20px;">
            <li>Delete ALL data: honors, events, clubs, all users, classes, locations, timeslots, and registrations</li>
            <li>Reseed the database with fresh test data</li>
            <li>Create honors list, 3 admin users, 2 events, 8 clubs, test users, locations, timeslots, and classes</li>
          </ul>
          <button onclick="reseedDatabase()" class="btn btn-danger" id="reseedBtn">
            Reset & Reseed Database
          </button>
        </div>
      </div>
    </div>
  `;
}

async function reseedDatabase() {
  if (!confirm('Are you absolutely sure you want to reset and reseed the database?\n\nThis will delete ALL data including admin users and honors, then recreate everything fresh.\n\nYou will need to log in again after the reset.\n\nThis action CANNOT be undone!')) {
    return;
  }
  
  const btn = document.getElementById('reseedBtn');
  btn.disabled = true;
  btn.textContent = 'Resetting...';
  
  try {
    const response = await fetchWithAuth('/api/admin/reseed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // If not JSON, read as text to see what we got
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned non-JSON response. Check server logs.');
    }
    
    if (response.ok) {
      showNotification('Database reset and reseeded successfully! Redirecting to login...', 'success');
      
      // Redirect to login after 2 seconds since the session will be invalid
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } else {
      showNotification(result.error || 'Error resetting database', 'error');
      btn.disabled = false;
      btn.textContent = 'Reset & Reseed Database';
    }
  } catch (error) {
    console.error('Reseed error:', error);
    showNotification('Error resetting database: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Reset & Reseed Database';
  }
}

// Load data
async function loadEvents() {
  try {
    const response = await fetchWithAuth('/api/events');
    allEvents = await response.json();
    
    // Normalize Active field from SQLite (1/0) to boolean for consistent rendering
    allEvents = allEvents.map(event => {
      // SQLite returns Active as 1 or 0 (integer), convert to boolean for template rendering
      const isActive = event.Active === 1 || event.Active === true || event.Active === '1';
      return {
        ...event,
        Active: isActive  // Store as boolean (true/false) for easier template rendering
      };
    });
    
    
    // Populate event filters every time
    updateEventDropdowns();
    
    renderEvents();
  } catch (error) {
    console.error('Error loading events:', error);
    showNotification('Error loading events', 'error');
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
    const response = await fetchWithAuth('/api/users');
    allUsers = await response.json();
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showNotification('Error loading users', 'error');
  }
}

async function loadLocations(eventId) {
  if (!eventId) {
    document.getElementById('locationsList').innerHTML = '<p class="text-center">Select an event to view locations</p>';
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/events/${eventId}/locations`);
    allLocations = await response.json();
    renderLocationsList();
  } catch (error) {
    console.error('Error loading locations:', error);
    showNotification('Error loading locations', 'error');
  }
}

async function loadClasses(eventId) {
  if (!eventId) {
    document.getElementById('classesList').innerHTML = '<p class="text-center">Select an event to view classes</p>';
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/classes/${eventId}`);
    allClasses = await response.json();
    // renderClassesList is no longer used - new data-table version handles rendering
  } catch (error) {
    console.error('Error loading classes:', error);
    showNotification('Error loading classes', 'error');
  }
}

// Render functions
function renderEvents() {
  const container = document.getElementById('eventsList');
  if (!container) return;
  
  if (allEvents.length === 0) {
    container.innerHTML = '<p class="text-center">No events yet. Create your first event!</p>';
    return;
  }
  
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
        ${allEvents.map(event => `
          <tr>
            <td>
              <strong>${event.Name}</strong>
            </td>
            <td>${event.StartDate}</td>
            <td>${event.EndDate}</td>
            <td>${event.ClassCount || 0}</td>
            <td>
              <button onclick="toggleEventActive(${event.ID}, ${event.Active ? 'true' : 'false'})" class="btn btn-sm ${event.Active ? 'btn-success' : 'btn-secondary'}" style="margin-right: 5px;">
                ${event.Active ? 'Event Open' : 'Event Closed'}
              </button>
              <button onclick="toggleEventStatus(${event.ID}, '${event.Status}')" class="btn btn-sm ${event.Status === 'Live' ? 'btn-success' : 'btn-secondary'}" style="margin-right: 5px;">
                ${event.Status === 'Live' ? 'Registration Open' : 'Registration Closed'}
              </button>
              <button onclick="manageEventClubs(${event.ID})" class="btn btn-sm btn-info" style="margin-right: 5px;">Manage Clubs</button>
              <button onclick="editEvent(${event.ID})" class="btn btn-sm btn-primary">Edit</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  const mobileCards = allEvents.map(event => {
    const actionsHtml = `
      <button onclick="toggleEventActive(${event.ID}, ${event.Active ? 'true' : 'false'})" class="btn btn-sm ${event.Active ? 'btn-success' : 'btn-secondary'}">
        ${event.Active ? 'Event Open' : 'Event Closed'}
      </button>
      <button onclick="toggleEventStatus(${event.ID}, '${event.Status}')" class="btn btn-sm ${event.Status === 'Live' ? 'btn-success' : 'btn-secondary'}">
        ${event.Status === 'Live' ? 'Registration Open' : 'Registration Closed'}
      </button>
      <button onclick="manageEventClubs(${event.ID})" class="btn btn-sm btn-info">Manage Clubs</button>
      <button onclick="editEvent(${event.ID})" class="btn btn-sm btn-primary">Edit</button>
    `;
    
    return createMobileCard({
      'Name': event.Name,
      'Start Date': event.StartDate,
      'End Date': event.EndDate,
      'Classes': event.ClassCount || 0
    }, event.Name, actionsHtml);
  }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
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
        <tr class="filter-row" id="userFilterRow" style="display: ${Object.keys(userFilters).length > 0 ? 'table-row' : 'none'};">
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-name" value="${userFilters.name || ''}" oninput="updateUserFilter('name', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-username" value="${userFilters.username || ''}" oninput="updateUserFilter('username', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-role" value="${userFilters.role || ''}" oninput="updateUserFilter('role', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-event" value="${userFilters.event || ''}" oninput="updateUserFilter('event', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-club" value="${userFilters.club || ''}" oninput="updateUserFilter('club', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-age" value="${userFilters.age || ''}" oninput="updateUserFilter('age', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-bgcheck" value="${userFilters.bgcheck || ''}" oninput="updateUserFilter('bgcheck', this.value)" placeholder="Filter...">
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
}

function toggleUserColumnFilter(column) {
  // Show filter row if hidden and add filter for this column
  const filterRow = document.getElementById('userFilterRow');
  if (filterRow.style.display === 'none') {
    filterRow.style.display = 'table-row';
  }
  
  // Focus on the filter input for this column
  const filterInput = document.getElementById(`filter-${column}`);
  if (filterInput) {
    filterInput.focus();
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
      document.getElementById('userFilterRow').style.display = 'none';
    }
  }
  renderUsers();
}

async function renderLocations() {
  const select = document.getElementById('locationEventFilter');
  const eventId = select?.value;
  const createBtn = document.getElementById('createLocationBtn');
  
  if (!eventId) {
    document.getElementById('locationsList').innerHTML = '<p class="text-center">Select an event to view locations</p>';
    if (createBtn) createBtn.disabled = true;
    return;
  }
  
  if (createBtn) createBtn.disabled = false;
  await loadLocations(eventId);
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
  
  // Load honors, teachers, locations for dropdowns
  const [honorsRes, locationsRes, teachersRes] = await Promise.all([
    fetchWithAuth('/api/classes/honors'),
    fetchWithAuth(`/api/events/${eventId}/locations`),
    fetchWithAuth(`/api/users?role=Teacher`)
  ]);
  
  const honors = await honorsRes.json();
  const locations = await locationsRes.json();
  const teachers = await teachersRes.json();
  
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
          <label for="editClassTeacher">Teacher</label>
          <select id="editClassTeacher" name="editClassTeacher" class="form-control">
            <option value="">Unassigned</option>
            ${teachers.map(t => `<option value="${t.ID}" ${cls.TeacherID === t.ID ? 'selected' : ''}>${t.FirstName} ${t.LastName}</option>`).join('')}
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
    TeacherID: form.editClassTeacher?.value || null,
    LocationID: form.editClassLocation?.value || null,
    TeacherMaxStudents: parseInt(form.editClassMaxCapacity?.value) || 0
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
    
    // Format timeslot for display
    function convertTo12Hour(time24) {
      if (!time24) return '';
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    }
    
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

async function generateReport() {
  const select = document.getElementById('reportEventFilter');
  const eventId = select.value;
  
  if (!eventId) return;
  
  try {
    const response = await fetchWithAuth(`/api/reports/event/${eventId}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-${eventId}-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showNotification('Report generated successfully', 'success');
  } catch (error) {
    showNotification('Error generating report', 'error');
  }
}

// Modal functions
function showCreateEventForm() {
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

async function handleCreateEvent(e) {
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
          <label for="email">Email *</label>
          <input type="email" id="email" name="email" class="form-control" required>
          <small style="color: var(--text-light);">Required for Admin, Event Admin, and Club Director invitations</small>
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
        <div class="form-group" id="passwordContainer">
          <label for="password">Password *</label>
          <input type="password" id="password" name="password" class="form-control" required>
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
    
    if (!roleSelect) return;
    
    const role = roleSelect.value;
    
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
  
  const modal = document.createElement('div');
  modal.id = 'editUserModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit User</h2>
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
          <label for="editEmail">Email</label>
          <input type="email" id="editEmail" name="editEmail" class="form-control" value="${user.Email || ''}">
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
        <div class="form-group" id="editEventContainer" style="display: ${['EventAdmin', 'Student', 'Teacher', 'ClubDirector'].includes(user.Role) ? 'block' : 'none'};">
          <label for="editEventId">Event${user.Role === 'EventAdmin' ? ' *' : ''}</label>
          <select id="editEventId" name="editEventId" class="form-control" onchange="loadClubsForEditUser(this.value)">
            <option value="">Select Event</option>
          </select>
        </div>
        <div class="form-group" id="editClubContainer" style="display: ${['Student', 'Teacher'].includes(user.Role) ? 'block' : 'none'};">
          <label for="editClubId">Club <span style="color: #999;">(None = cannot register)</span></label>
          <select id="editClubId" name="editClubId" class="form-control">
            <option value="">No Club</option>
          </select>
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
          <label for="editPassword">New Password</label>
          <input type="password" id="editPassword" name="editPassword" class="form-control">
          <small style="color: var(--text-light); display: block; margin-top: 5px;">Leave blank to keep current password</small>
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
  if (['EventAdmin', 'Student', 'Teacher', 'ClubDirector'].includes(user.Role)) {
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
  
  // Add change listener for role dropdown
  const editRoleSelect = document.getElementById('editRole');
  if (editRoleSelect) {
    editRoleSelect.addEventListener('change', function() {
      toggleEditEventDropdown(this.value);
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
    if (role === 'EventAdmin' && !form.eventId?.value) {
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
        eventId: form.eventId?.value || null,
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
    } catch (error) {
      showNotification('Error generating invite: ' + error.message, 'error');
    }
    return;
  }
  
  // For other roles (Student, Teacher, Staff) - create user directly
  const userData = {
    FirstName: firstName,
    LastName: lastName,
    DateOfBirth: form.dateOfBirth?.value || '',
    Email: email,
    Phone: form.phone?.value?.trim() || null,
    Role: role,
    InvestitureLevel: form.investitureLevel?.value || 'None',
    EventID: form.eventId?.value || null,
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
  const eventName = inviteData.eventId ? (allEvents.find(e => e.ID === parseInt(inviteData.eventId))?.Name || 'Event') : '';
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
    userData.EventID = form.editEventId?.value || null;
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
  
  // Add password if provided
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

  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('User updated successfully', 'success');
      closeModal('editUserModal');
      await loadUsers();
    } else {
      showNotification(result.error || 'Error updating user', 'error');
    }
  } catch (error) {
    showNotification('Error updating user: ' + error.message, 'error');
  }
}

// Location management functions
function showCreateLocationForm() {
  const select = document.getElementById('locationEventFilter');
  const eventId = select?.value;
  
  if (!eventId) {
    showNotification('Please select an event first', 'error');
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
    const response = await fetchWithAuth(`/api/events/${eventId}/locations`, {
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
window.editClass = editClass;
window.editEvent = editEvent;
window.handleEditEvent = handleEditEvent;
window.handleEditClass = handleEditClass;
window.viewClassStudents = viewClassStudents;
window.handleAddStudentToClass = handleAddStudentToClass;
window.removeStudentFromClass = removeStudentFromClass;
window.showConflictModal = showConflictModal;
window.resolveConflict = resolveConflict;
window.generateReport = generateReport;
window.reseedDatabase = reseedDatabase;
window.updateReportButton = updateReportButton;
window.renderLocations = renderLocations;
// Timeslot management functions
async function renderTimeslots() {
  const select = document.getElementById('timeslotEventFilter');
  const eventId = select?.value;
  const createBtn = document.getElementById('createTimeslotBtn');
  
  if (!eventId) {
    document.getElementById('timeslotsList').innerHTML = '<p class="text-center">Select an event to view timeslots</p>';
    if (createBtn) createBtn.disabled = true;
    return;
  }
  
  if (createBtn) createBtn.disabled = false;
  
  try {
    const response = await fetchWithAuth(`/api/events/${eventId}/timeslots`);
    allTimeslots = await response.json();
    
    if (allTimeslots.length === 0) {
      document.getElementById('timeslotsList').innerHTML = '<p class="text-center">No timeslots found for this event</p>';
      return;
    }
    
    document.getElementById('timeslotsList').innerHTML = `
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
  } catch (error) {
    console.error('Error loading timeslots:', error);
    showNotification('Error loading timeslots', 'error');
  }
}

function calculateDuration(startTime, endTime) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function convertTo12Hour(time24) {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes} ${period}`;
}

function showCreateTimeslotForm() {
  const select = document.getElementById('timeslotEventFilter');
  const eventId = select?.value;
  
  if (!eventId) {
    showNotification('Please select an event first', 'error');
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
  const select = document.getElementById('timeslotEventFilter');
  const eventId = select?.value;
  
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
  const select = document.getElementById('classEventFilter');
  const eventId = select?.value;
  
  if (!eventId) {
    showNotification('Please select an event first', 'error');
    return;
  }
  
  // Load honors, teachers, locations, and timeslots for the event
  const [honorsRes, teachersRes, locationsRes, timeslotsRes] = await Promise.all([
    fetchWithAuth('/api/classes/honors'),
    fetchWithAuth(`/api/users?role=Teacher`),
    fetchWithAuth(`/api/events/${eventId}/locations`),
    fetchWithAuth(`/api/events/${eventId}/timeslots`)
  ]);
  
  const honors = await honorsRes.json();
  const teachers = await teachersRes.json();
  const locations = await locationsRes.json();
  const timeslots = await timeslotsRes.json();
  
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
            ${honors.map(h => `<option value="${h.ID}">${h.Name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="classTeacher">Teacher *</label>
          <select id="classTeacher" name="classTeacher" class="form-control" required>
            <option value="">Select Teacher</option>
            ${teachers.map(t => `<option value="${t.ID}">${t.FirstName} ${t.LastName}</option>`).join('')}
          </select>
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
  const select = document.getElementById('classEventFilter');
  const eventId = select?.value;
  
  const selectedTimeslots = Array.from(form.querySelectorAll('input[name="classTimeslots"]:checked')).map(cb => cb.value);
  
  if (selectedTimeslots.length === 0) {
    showNotification('Please select at least one timeslot (session) for this class', 'error');
    return;
  }
  
  const classData = {
    HonorID: form.classHonor?.value,
    TeacherID: form.classTeacher?.value,
    LocationID: form.classLocation?.value,
    TeacherMaxStudents: parseInt(form.classMaxCapacity?.value) || 0
  };
  
  if (!classData.HonorID || !classData.TeacherID || !classData.LocationID || !classData.TeacherMaxStudents) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    // Create a separate class for each selected timeslot
    const results = [];
    for (const timeslotId of selectedTimeslots) {
      const response = await fetchWithAuth(`/api/classes`, {
        method: 'POST',
        body: JSON.stringify({ ...classData, EventID: eventId, TimeslotID: timeslotId })
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

async function renderClasses() {
  const select = document.getElementById('classEventFilter');
  const eventId = select?.value;
  const createBtn = document.getElementById('createClassBtn');
  
  if (!eventId) {
    document.getElementById('classesList').innerHTML = '<p class="text-center">Select an event to view classes</p>';
    if (createBtn) createBtn.disabled = true;
    return;
  }
  
  if (createBtn) createBtn.disabled = false;
  
  try {
    const response = await fetchWithAuth(`/api/classes/${eventId}`);
    allClasses = await response.json();
    
    if (allClasses.length === 0) {
      document.getElementById('classesList').innerHTML = '<p class="text-center">No classes found for this event</p>';
      return;
    }
    
    // Separate active and inactive classes
    const activeClasses = allClasses.filter(c => c.Active);
    const inactiveClasses = allClasses.filter(c => !c.Active);
    
    const tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 20%; padding: 12px 8px; text-align: left;">Honor</th>
            <th style="width: 15%; padding: 12px 8px; text-align: left;">Teacher</th>
            <th style="width: 15%; padding: 12px 8px; text-align: left;">Location</th>
            <th style="width: 18%; padding: 12px 8px; text-align: left;">Date/Time</th>
            <th style="width: 15%; padding: 12px 8px; text-align: left;">Capacity</th>
            <th style="width: 10%; padding: 12px 8px; text-align: left;">Status</th>
            <th style="width: 10%; padding: 12px 8px; text-align: left;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${activeClasses.map(cls => `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 12px 8px; text-align: left;"><strong>${cls.HonorName || 'N/A'}</strong></td>
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
            <td colspan="7" style="padding: 10px; font-weight: bold; color: #666;">Deactivated Classes</td>
          </tr>
          ${inactiveClasses.map(cls => `
          <tr style="border-bottom: 1px solid #e0e0e0; opacity: 0.7; background: #f9f9f9;">
            <td style="padding: 12px 8px; text-align: left;"><strong>${cls.HonorName || 'N/A'}</strong></td>
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
            </td>
          </tr>
        `).join('')}
        ` : ''}
        </tbody>
      </table>
    `;
    
    const allClassesForMobile = [...activeClasses, ...inactiveClasses];
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
        `;
      
      return createMobileCard({
        'Honor': cls.HonorName || 'N/A',
        'Teacher': cls.TeacherFirstName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : 'Unassigned',
        'Location': cls.LocationName || 'N/A',
        'Date/Time': dateTime,
        'Capacity': `${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}`,
        'Status': cls.Active ? 'Active' : 'Inactive'
      }, cls.HonorName || 'N/A', actionsHtml);
    }).join('');
    
    document.getElementById('classesList').innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
  } catch (error) {
    console.error('Error loading classes:', error);
    showNotification('Error loading classes', 'error');
  }
}

window.renderClasses = renderClasses;
window.renderTimeslots = renderTimeslots;

// Club management functions
async function renderClubs() {
  try {
    // Load all clubs
    const response = await fetchWithAuth('/api/clubs');
    allClubs = await response.json();
    
    if (allClubs.length === 0) {
      document.getElementById('clubsList').innerHTML = '<p class="text-center">No clubs found</p>';
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
    
    document.getElementById('clubsList').innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
  } catch (error) {
    console.error('Error loading clubs:', error);
    showNotification('Error loading clubs', 'error');
  }
}

async function showCreateClubForm() {
  const select = document.getElementById('clubEventFilter');
  const eventId = select?.value;
  
  if (!eventId) {
    showNotification('Please select an event first', 'error');
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
  const select = document.getElementById('clubEventFilter');
  const eventId = select?.value;
  
  const clubData = {
    Name: form.clubName?.value?.trim() || '',
    Church: form.clubChurch?.value?.trim() || null,
    DirectorID: form.clubDirector?.value || null
  };
  
  if (!clubData.Name) {
    showNotification('Please enter a club name', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth('/api/clubs', {
      method: 'POST',
      body: JSON.stringify({ ...clubData, EventID: eventId })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('Club created successfully', 'success');
      closeModal('createClubModal');
      await renderClubs();
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
      await renderClubs();
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
window.copyInviteCode = function() {
  const code = document.getElementById('inviteCodeDisplay');
  code.select();
  document.execCommand('copy');
  showNotification('Invitation code copied to clipboard', 'success');
};
window.copyInviteUrl = function() {
  const url = document.getElementById('inviteUrlDisplay');
  url.select();
  document.execCommand('copy');
  showNotification('Invitation URL copied to clipboard', 'success');
};
window.copyEmailTemplate = function() {
  const template = document.getElementById('emailTemplate');
  template.select();
  document.execCommand('copy');
  showNotification('Email template copied to clipboard', 'success');
};
window.resendInvite = async function(email) {
  try {
    const response = await fetchWithAuth(`/api/invites/user/${encodeURIComponent(email)}`);
    const invite = await response.json();
    
    if (!response.ok) {
      showNotification(invite.error || 'Error fetching invite', 'error');
      return;
    }
    
    // Get user details for email template
    const user = allUsers.find(u => u.Email === email);
    if (!user) {
      showNotification('User not found', 'error');
      return;
    }
    
    // Get event and club names
    const eventName = user.EventID ? (allEvents.find(e => e.ID === user.EventID)?.Name || 'Event') : '';
    const clubName = user.ClubID ? (allClubs.find(c => c.ID === user.ClubID)?.Name || 'Club') : '';
    
    // Show invite modal with existing code
    const inviteData = {
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      role: user.Role,
      clubId: user.ClubID || null,
      eventId: user.EventID || null
    };
    
    showInviteModal(invite, inviteData);
  } catch (error) {
    showNotification('Error resending invite: ' + error.message, 'error');
  }
};
window.handleEditUser = handleEditUser;
window.closeModal = closeModal;
window.handleCreateEvent = handleCreateEvent;
window.toggleUserColumnFilter = toggleUserColumnFilter;
window.updateUserFilter = updateUserFilter;
window.renderUsers = renderUsers;
window.toggleDeactivatedUsers = toggleDeactivatedUsers;
window.searchByCheckInNumber = searchByCheckInNumber;
window.searchByFirstName = searchByFirstName;
window.selectUserFromDropdown = selectUserFromDropdown;
window.displayCheckInUser = displayCheckInUser;
window.handleCheckInUser = handleCheckInUser;
window.clearCheckInForm = clearCheckInForm;

