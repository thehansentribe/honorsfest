// Club Director Dashboard - Uses Admin Dashboard Code with Filters
// Wrapped in IIFE to avoid variable conflicts with admin-dashboard.js
(function() {
'use strict';

let clubDirectorTab = 'users';
let clubDirectorClubId = null;
let clubDirectorEventId = null;
let clubDirectorUser = null;
let clubDirectorUsers = [];
let clubDirectorEvents = [];
let clubDirectorClasses = [];
let clubDirectorSelectedEventId = null; // Currently selected event for multi-event support

// Filter state for user table
let clubDirectorFilters = {};
let clubDirectorSortColumn = null;
let clubDirectorSortDirection = 'asc';

// Define functions BEFORE they're called in DOMContentLoaded

// Override switchTab
async function clubdirectorSwitchTab(tabName, clickedElement = null) {
  clubDirectorTab = tabName;
  try { localStorage.setItem('directorCurrentTab', tabName); } catch (e) {}
  
  // Update tab UI
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  if (clickedElement) {
    clickedElement.classList.add('active');
  } else {
    // Find the tab by data-tab attribute or text content
    document.querySelectorAll('.tab').forEach(t => {
      const dataTab = t.getAttribute('data-tab');
      if (dataTab === tabName) {
        t.classList.add('active');
      } else if (!dataTab) {
        // Fallback to text matching
        if (t.textContent.trim().toLowerCase() === tabName.toLowerCase()) {
          t.classList.add('active');
        }
      }
    });
  }
  
  // Load tab content
  const content = document.getElementById('content');
  
  switch(tabName) {
    case 'users':
      content.innerHTML = getUsersTab();
      renderUsers();
      break;
    case 'classes':
      content.innerHTML = getClassesTabClubDirector();
      renderClasses();
      break;
    case 'codes':
      content.innerHTML = getCodesTab();
      await renderCodes();
      break;
    case 'reports':
      content.innerHTML = getReportsTab();
      break;
    case 'checkin':
      content.innerHTML = getCheckInTab({ 
        eventId: clubDirectorSelectedEventId, 
        userRole: 'ClubDirector', 
        userClubId: clubDirectorClubId 
      });
      if (clubDirectorSelectedEventId) {
        await checkInLoadParticipants();
      }
      break;
  }
}

// Get Users Tab HTML for Club Director
function getUsersTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Users in Your Club</h2>
        <button onclick="showCreateUserForm()" class="btn btn-primary">Add User</button>
      </div>
      <div id="usersList">
        <p class="text-center">Loading users...</p>
      </div>
    </div>
  `;
}

// Get Classes Tab HTML for Club Director
function getClassesTabClubDirector() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Classes</h2>
        <button onclick="showCreateClassForm()" class="btn btn-primary" id="createClassBtn">Create Class</button>
      </div>
      <div id="classesList">
        <p class="text-center">Loading classes...</p>
      </div>
    </div>
  `;
}

// Get Registration Codes Tab HTML for Club Director
function getCodesTab() {
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Registration Codes</h2>
        <button onclick="generateRegistrationCode()" class="btn btn-primary">Generate New Code</button>
      </div>
      <div id="codesList">
        <p class="text-center">Loading codes...</p>
      </div>
    </div>
  `;
}

// Get Reports Tab HTML for Club Director
function getReportsTab() {
  if (clubDirectorEvents.length === 0) {
    return `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Reports</h2>
        </div>
        <p class="text-center" style="color: #d32f2f;">No events assigned to your club. Please contact an administrator to be assigned to an event.</p>
      </div>
    `;
  }
  
  if (!clubDirectorSelectedEventId) {
    return `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Reports</h2>
        </div>
        <p class="text-center" style="color: #d32f2f;">Please select an event first using the dropdown above</p>
      </div>
    `;
  }
  
  const selectedEvent = clubDirectorEvents.find(e => e.ID === parseInt(clubDirectorSelectedEventId));
  const eventName = selectedEvent ? selectedEvent.Name : 'Selected Event';
  
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Reports for ${eventName}</h2>
      </div>
      <p class="mb-2"><strong>Event:</strong> ${eventName}</p>
      <button id="generateReportBtn" onclick="generateClubDirectorReport()" class="btn btn-primary">Generate CSV Report</button>
    </div>
  `;
}

// Override renderUsers
function renderUsers() {
  const container = document.getElementById('usersList');
  if (!container) return;
  
  if (clubDirectorUsers.length === 0) {
    container.innerHTML = '<p class="text-center">No users in your club yet. Create your first user!</p>';
    return;
  }
  
  // Apply filters
  let filteredUsers = [...clubDirectorUsers];
  
  if (Object.keys(clubDirectorFilters).length > 0) {
    filteredUsers = filteredUsers.filter(user => {
      return Object.entries(clubDirectorFilters).every(([column, filterValue]) => {
        if (!filterValue) return true;
        const lowerFilter = filterValue.toLowerCase();
        
        switch(column) {
          case 'name':
            return `${user.FirstName} ${user.LastName}`.toLowerCase().includes(lowerFilter);
          case 'username':
            return user.Username.toLowerCase().includes(lowerFilter);
          case 'role':
            return user.Role.toLowerCase().includes(lowerFilter);
          case 'club':
            return (user.ClubName || 'None').toLowerCase().includes(lowerFilter);
          case 'age':
            return (user.Age !== null ? user.Age.toString() : 'N/A').toLowerCase().includes(lowerFilter);
          case 'active':
            return (user.Active ? 'yes' : 'no').includes(lowerFilter);
          case 'bgcheck':
            return (user.BackgroundCheck ? 'yes' : 'no').includes(lowerFilter);
          default:
            return true;
        }
      });
    });
  }
  
  // Apply sorting
  if (clubDirectorSortColumn) {
    filteredUsers.sort((a, b) => {
      let aVal, bVal;
      
      switch(clubDirectorSortColumn) {
        case 'name':
          aVal = `${a.FirstName} ${a.LastName}`;
          bVal = `${b.FirstName} ${b.LastName}`;
          break;
        case 'username':
          aVal = a.Username;
          bVal = b.Username;
          break;
        case 'role':
          aVal = a.Role;
          bVal = b.Role;
          break;
        case 'club':
          aVal = a.ClubName || '';
          bVal = b.ClubName || '';
          break;
        case 'age':
          aVal = a.Age !== null ? a.Age : 0;
          bVal = b.Age !== null ? b.Age : 0;
          break;
        case 'active':
          aVal = a.Active ? 1 : 0;
          bVal = b.Active ? 1 : 0;
          break;
        case 'bgcheck':
          aVal = a.BackgroundCheck ? 1 : 0;
          bVal = b.BackgroundCheck ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        return clubDirectorSortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return clubDirectorSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th class="filterable ${clubDirectorFilters.name ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('name')">Name ${clubDirectorSortColumn === 'name' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${clubDirectorFilters.username ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('username')">Username ${clubDirectorSortColumn === 'username' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${clubDirectorFilters.role ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('role')">Role ${clubDirectorSortColumn === 'role' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${clubDirectorFilters.club ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('club')">Club ${clubDirectorSortColumn === 'club' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${clubDirectorFilters.age ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('age')">Age (DOB) ${clubDirectorSortColumn === 'age' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${clubDirectorFilters.active ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('active')">Active ${clubDirectorSortColumn === 'active' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th class="filterable ${clubDirectorFilters.bgcheck ? 'filter-active' : ''}" onclick="toggleClubDirectorColumnFilter('bgcheck')">BG Check ${clubDirectorSortColumn === 'bgcheck' ? (clubDirectorSortDirection === 'asc' ? '↑' : '↓') : ''}</th>
          <th>Actions</th>
        </tr>
        <tr class="filter-row" id="clubDirectorFilterRow" style="display: ${Object.keys(clubDirectorFilters).length > 0 ? 'table-row' : 'none'};">
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-name" value="${clubDirectorFilters.name || ''}" oninput="updateClubDirectorFilter('name', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-username" value="${clubDirectorFilters.username || ''}" oninput="updateClubDirectorFilter('username', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-role" value="${clubDirectorFilters.role || ''}" oninput="updateClubDirectorFilter('role', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-club" value="${clubDirectorFilters.club || ''}" oninput="updateClubDirectorFilter('club', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-age" value="${clubDirectorFilters.age || ''}" oninput="updateClubDirectorFilter('age', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-active" value="${clubDirectorFilters.active || ''}" oninput="updateClubDirectorFilter('active', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-bgcheck" value="${clubDirectorFilters.bgcheck || ''}" oninput="updateClubDirectorFilter('bgcheck', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell"></td>
        </tr>
      </thead>
      <tbody>
        ${filteredUsers.length === 0 ? '<tr><td colspan="8" class="text-center">No users match the current filters</td></tr>' : filteredUsers.map(user => `
          <tr>
            <td>${user.FirstName} ${user.LastName}</td>
            <td>${user.Username}</td>
            <td>${user.Role}</td>
            <td>${user.ClubName ? `<strong>${user.ClubName}</strong>` : '<span style="color: #d32f2f;">None</span>'}</td>
            <td>${user.Age !== null ? user.Age : 'N/A'}</td>
            <td>${user.Active ? 'Yes' : 'No'}</td>
            <td>${user.BackgroundCheck ? '✓' : '-'}</td>
            <td>
              <button onclick="editUser(${user.ID})" class="btn btn-sm btn-secondary">Edit</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  const mobileCards = filteredUsers.length === 0
    ? '<div class="card-row"><div class="card-row-value text-center">No users match the current filters</div></div>'
    : filteredUsers.map(user => {
        const actionsHtml = `
          <button onclick="editUser(${user.ID})" class="btn btn-sm btn-secondary">Edit</button>
        `;
        
        return createMobileCard({
          'Name': `${user.FirstName} ${user.LastName}`,
          'Username': user.Username,
          'Role': user.Role,
          'Club': user.ClubName || 'None',
          'Age (DOB)': user.Age !== null ? user.Age : 'N/A',
          'Active': user.Active ? 'Yes' : 'No',
          'BG Check': user.BackgroundCheck ? '✓' : '-'
        }, `${user.FirstName} ${user.LastName}`, actionsHtml);
      }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
}

function toggleClubDirectorColumnFilter(column) {
  // Show filter row if hidden and add filter for this column
  const filterRow = document.getElementById('clubDirectorFilterRow');
  if (filterRow && filterRow.style.display === 'none') {
    filterRow.style.display = 'table-row';
  }
  
  // Focus on the filter input for this column
  const filterInput = document.getElementById(`filter-cd-${column}`);
  if (filterInput) {
    filterInput.focus();
  }
  
  // Toggle sorting
  if (clubDirectorSortColumn === column) {
    clubDirectorSortDirection = clubDirectorSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    clubDirectorSortColumn = column;
    clubDirectorSortDirection = 'asc';
  }
  
  renderUsers();
}

function updateClubDirectorFilter(column, value) {
  if (value.trim()) {
    clubDirectorFilters[column] = value.trim();
  } else {
    delete clubDirectorFilters[column];
    // Hide filter row if no filters active
    if (Object.keys(clubDirectorFilters).length === 0) {
      const filterRow = document.getElementById('clubDirectorFilterRow');
      if (filterRow) filterRow.style.display = 'none';
    }
  }
  renderUsers();
}

// Helper function for time conversion
function convertTo12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes} ${period}`;
}

// Override renderClasses to filter by their club's event
async function renderClasses() {
  const container = document.getElementById('classesList');
  if (!container) {
    console.error('Classes list container not found');
    return;
  }
  
  if (!clubDirectorSelectedEventId) {
    if (clubDirectorEvents.length === 0) {
      container.innerHTML = '<p class="text-center" style="color: #d32f2f;">No events assigned to your club. Please contact an administrator.</p>';
    } else {
      container.innerHTML = '<p class="text-center" style="color: #d32f2f;">Please select an event first</p>';
    }
    return;
  }
  
  try {
    const response = await fetchWithAuth(`/api/classes/${clubDirectorSelectedEventId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to load classes: ${response.status}`);
    }
    
    clubDirectorClasses = await response.json();
    
    const normalizeActive = (value) => value === 1 || value === true || value === '1';
    const activeClasses = clubDirectorClasses.filter(c => normalizeActive(c.Active));
    const inactiveClasses = clubDirectorClasses.filter(c => !normalizeActive(c.Active));
    
    if (activeClasses.length === 0 && inactiveClasses.length === 0) {
      container.innerHTML = '<p class="text-center">No classes found for this event</p>';
      return;
    }
    
    const hasActive = activeClasses.length > 0;
    const hasInactive = inactiveClasses.length > 0;

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
          ${hasActive ? activeClasses.map(cls => {
              const isActive = normalizeActive(cls.Active);
              const canEdit = isActive && cls.CreatedBy === clubDirectorUser?.id;
              return `
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
              ${canEdit ? `<button onclick="editClass(${cls.ID})" class="btn btn-sm btn-secondary">Edit</button>` : ''}
            </td>
          </tr>
        `;
            }).join('') : ''}
        ${hasInactive ? `
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
            <td style="padding: 12px 8px; text-align: left;"><span style="color: #999;">Inactive class</span></td>
          </tr>
        `).join('')}
        ` : ''}
        </tbody>
      </table>
    `;
    
    const mobileCards = [...activeClasses, ...inactiveClasses].map(cls => {
      const isActive = normalizeActive(cls.Active);
      const canEdit = isActive && cls.CreatedBy === clubDirectorUser?.id;
      const dateTime = cls.TimeslotDate
        ? `${cls.TimeslotDate}<br><small style="color: var(--text-light);">${cls.TimeslotStartTime ? convertTo12Hour(cls.TimeslotStartTime) : ''} - ${cls.TimeslotEndTime ? convertTo12Hour(cls.TimeslotEndTime) : ''}</small>`
        : 'N/A';

      const actionsHtml = cls.Active
        ? `
          <button onclick="viewClassStudents(${cls.ID})" class="btn btn-sm btn-info">Manage Students</button>
          ${canEdit ? `<button onclick="editClass(${cls.ID})" class="btn btn-sm btn-secondary">Edit</button>` : ''}
        `
        : `<span style="color: #999;">Inactive class</span>`;

      return createMobileCard({
        'Honor': cls.HonorName || 'N/A',
        'Teacher': cls.TeacherFirstName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : 'Unassigned',
        'Location': cls.LocationName || 'N/A',
        'Date/Time': dateTime,
        'Capacity': `${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}`,
        'Status': isActive ? 'Active' : 'Inactive'
      }, cls.HonorName || 'N/A', actionsHtml);
    }).join('');
    
    container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
  } catch (error) {
    console.error('Error loading classes:', error);
    container.innerHTML = `<p class="text-center" style="color: red;">Error loading classes: ${error.message}</p>`;
    showNotification('Error loading classes', 'error');
  }
}

// Override loadEvents to load events for this club
async function loadEvents() {
  try {
    // Use /api/events/my to get events for this club
    const response = await fetchWithAuth('/api/events/my');
    clubDirectorEvents = await response.json();
    
  } catch (error) {
    console.error('Error loading events:', error);
    clubDirectorEvents = [];
  }
}

// Override loadUsers to load ONLY users from the director's club
async function loadUsers() {
  try {
    // Club Directors ONLY see users from their own club
    const queryParams = new URLSearchParams();
    if (clubDirectorClubId) {
      queryParams.append('clubId', clubDirectorClubId);
    }
    
    const response = await fetchWithAuth(`/api/users?${queryParams.toString()}`);
    clubDirectorUsers = await response.json();
    
    
    // Now trigger renderUsers if tab is active
    if (clubDirectorTab === 'users') {
      renderUsers();
    }
  } catch (error) {
    console.error('Error loading users:', error);
    showNotification('Error loading users', 'error');
  }
}

// Override showCreateUserForm to prefill club and event
function showCreateUserFormClubDirector() {
  const modal = document.createElement('div');
  modal.id = 'createUserModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Add User to Your Club</h2>
        <button onclick="closeModal('createUserModal')" class="btn btn-outline">×</button>
      </div>
      <form id="createUserForm" onsubmit="handleCreateUser(event)">
        <input type="hidden" id="clubId" name="clubId" value="${clubDirectorClubId}">
        <input type="hidden" id="eventId" name="eventId" value="${clubDirectorSelectedEventId}">
        <div class="form-group">
          <label for="firstName">First Name *</label>
          <input type="text" id="firstName" name="firstName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="lastName">Last Name *</label>
          <input type="text" id="lastName" name="lastName" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="dateOfBirth">Date of Birth *</label>
          <input type="date" id="dateOfBirth" name="dateOfBirth" class="form-control" required>
          <small style="color: var(--text-light);">Age will be calculated automatically</small>
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" class="form-control">
        </div>
        <div class="form-group">
          <label for="phone">Phone</label>
          <input type="text" id="phone" name="phone" class="form-control">
        </div>
        <div class="form-group">
          <label for="role">Role *</label>
          <select id="role" name="role" class="form-control" required>
            <option value="">Select Role</option>
            <option value="Student">Student</option>
            <option value="Teacher">Teacher</option>
            <option value="Staff">Staff</option>
          </select>
          <small style="color: var(--text-light);">Club Directors can only add Students, Teachers, and Staff</small>
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
        <div class="form-group">
          <label for="password">Password *</label>
          <input type="password" id="password" name="password" class="form-control" required>
          <small style="color: var(--text-light);">Default: password123</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create User</button>
          <button type="button" onclick="closeModal('createUserModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

// Override edit user to prevent club/event changes
function editUserClubDirector(userId) {
  const user = clubDirectorUsers.find(u => u.ID === userId);
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
        <input type="hidden" id="editClubId" name="editClubId" value="${clubDirectorClubId}">
        <input type="hidden" id="editEventId" name="editEventId" value="${clubDirectorSelectedEventId}">
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
          <select id="editRole" name="editRole" class="form-control" required>
            <option value="Student" ${user.Role === 'Student' ? 'selected' : ''}>Student</option>
            <option value="Teacher" ${user.Role === 'Teacher' ? 'selected' : ''}>Teacher</option>
            <option value="Staff" ${user.Role === 'Staff' ? 'selected' : ''}>Staff</option>
          </select>
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
          <small style="color: var(--text-light);">Leave blank to keep current password</small>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update User</button>
          <button type="button" onclick="closeModal('editUserModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

// Override showCreateClassForm for Club Directors - filter teachers by club
async function showCreateClassFormClubDirector() {
  const eventId = clubDirectorSelectedEventId;
  
  if (!eventId) {
    showNotification('No event assigned to your club', 'error');
    return;
  }
  
  // Load honors, timeslots for Club Directors (no locations - admins set those)
  const [honorsRes, timeslotsRes] = await Promise.all([
    fetchWithAuth('/api/classes/honors'),
    fetchWithAuth(`/api/events/${eventId}/timeslots`)
  ]);
  
  const honors = await honorsRes.json();
  const timeslots = await timeslotsRes.json();
  
  // Load teachers from the same club
  const teachersResponse = await fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=Teacher`);
  const teachers = await teachersResponse.json();
  
  
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
          <label for="classTeacher">Teacher * (Only teachers from your club)</label>
          <select id="classTeacher" name="classTeacher" class="form-control" required>
            <option value="">Select Teacher</option>
            ${teachers.map(t => `<option value="${t.ID}">${t.FirstName} ${t.LastName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="classMaxCapacity">Max Capacity *</label>
          <input type="number" id="classMaxCapacity" name="classMaxCapacity" class="form-control" min="1" required>
          <small style="color: var(--text-light);">Admin will assign location later</small>
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

// Now the DOMContentLoaded handler
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
  
  await window.applyBranding('Club Director Dashboard');

  // Only ClubDirector should access this dashboard
  if (user.role !== 'ClubDirector') {
    // Redirect to appropriate dashboard
    if (user.role === 'Admin') {
      window.location.href = '/admin-dashboard.html';
      return;
    } else if (user.role === 'EventAdmin') {
      window.location.href = '/eventadmin-dashboard.html';
      return;
    } else if (user.role === 'Teacher') {
      window.location.href = '/teacher-dashboard.html';
      return;
    } else {
      window.location.href = '/student-dashboard.html';
      return;
    }
  }
  
  clubDirectorUser = user;
  document.getElementById('userDisplayName').textContent = `${user.firstName} ${user.lastName}`;

  const userDetails = await window.fetchUserDetails(user.id);
  window.setClubName(userDetails?.ClubName || null);

  // Get the director's club from JWT or fetched details
  clubDirectorClubId = userDetails?.ClubID ?? user.clubId ?? null;
  

  // Load events for this club
  await loadEvents();
  
  // Handle no events case
  const noEventsBanner = document.getElementById('noEventsBanner');
  if (clubDirectorEvents.length === 0) {
    if (noEventsBanner) noEventsBanner.style.display = 'block';
    clubDirectorSelectedEventId = null;
    clubDirectorEventId = null;
  } else {
    if (noEventsBanner) noEventsBanner.style.display = 'none';
    // Select first event (prefer active events, then first available)
    const activeEvent = clubDirectorEvents.find(e => e.Active);
    clubDirectorEventId = activeEvent ? activeEvent.ID : clubDirectorEvents[0].ID;
    clubDirectorSelectedEventId = clubDirectorEventId;
  }
  
  // Setup event selector UI (even if no events, to show message)
  setupEventSelector();

  // Check event status and show banner if closed
  await checkEventStatus();
  
  // Load data
  await loadUsers();
  
  // Override functions - expose to window so they can be called from HTML
  window.switchTab = clubdirectorSwitchTab;
  window.showCreateUserForm = showCreateUserFormClubDirector;
  window.editUser = editUserClubDirector;
  window.showCreateClassForm = showCreateClassFormClubDirector;
  window.switchClubDirectorEvent = switchClubDirectorEvent;
  
  // Restore last active tab or default to users
  const savedTab = localStorage.getItem('directorCurrentTab') || 'users';
  await window.switchTab(savedTab);

  // Override editClass to use clubDirectorClasses array
  window.editClass = async function editClassClubDirector(classId) {
    const cls = clubDirectorClasses.find(c => c.ID === classId);
    if (!cls) return;
    
    const eventId = clubDirectorSelectedEventId;
    
    // Load honors, teachers, locations for dropdowns
    const [honorsRes, locationsRes, teachersRes] = await Promise.all([
      fetchWithAuth('/api/classes/honors'),
      fetchWithAuth(`/api/events/${eventId}/locations`),
      fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=Teacher`)
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
        <form id="editClassForm" onsubmit="handleEditClass(${classId})">
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
            <select id="editClassLocation" name="editClassLocation" class="form-control" disabled>
              <option value="">No Location</option>
              ${locations.map(l => `<option value="${l.ID}" ${cls.LocationID === l.ID ? 'selected' : ''}>${l.Name} (Capacity: ${l.MaxCapacity})</option>`).join('')}
            </select>
            <small style="color: var(--text-light);">Location can only be changed by Admins</small>
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
    
    // Handle form submission
    document.getElementById('editClassForm').onsubmit = async function(e) {
      e.preventDefault();
      const form = e.target;
      
      // Club Directors can only edit TeacherID and TeacherMaxStudents
      const classData = {
        TeacherID: form.editClassTeacher?.value || null,
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
          await renderClasses(); // Reload classes list
        } else {
          showNotification(result.error || 'Error updating class', 'error');
        }
      } catch (error) {
        showNotification('Error updating class: ' + error.message, 'error');
      }
    };
  };
  
  // Override handleCreateClass for Club Directors - NO location field
  window.handleCreateClass = async function handleCreateClassClubDirector(e) {
    e.preventDefault();
    const form = e.target;
    
    const selectedTimeslots = Array.from(form.querySelectorAll('input[name="classTimeslots"]:checked')).map(cb => cb.value);
    
    if (selectedTimeslots.length === 0) {
      showNotification('Please select at least one timeslot (session) for this class', 'error');
      return;
    }
    
    const classData = {
      EventID: clubDirectorSelectedEventId, // Use the director's event
      HonorID: form.classHonor?.value,
      TeacherID: form.classTeacher?.value,
      LocationID: null, // Club Directors don't set location - admins do this
      TeacherMaxStudents: parseInt(form.classMaxCapacity?.value) || 0
    };
    
    if (!classData.HonorID || !classData.TeacherID || !classData.TeacherMaxStudents) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    try {
      // Create a separate class for each selected timeslot
      const results = [];
      for (const timeslotId of selectedTimeslots) {
        const classDataForTimeslot = {
          ...classData,
          TimeslotID: timeslotId
        };
        
        const response = await fetchWithAuth(`/api/classes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(classDataForTimeslot)
        });
        
        const result = await response.json();
        results.push(result);
      }
      
      if (results.length > 0 && results[0].ID) {
        showNotification(`Created ${results.length} class session(s) successfully. Admin will assign location later.`, 'success');
        closeModal('createClassModal');
        await renderClasses(); // Reload classes list
      } else {
        showNotification('Error creating classes', 'error');
      }
    } catch (error) {
      showNotification('Error creating class: ' + error.message, 'error');
    }
  };
  
  // Expose handleCreateUser and handleEditUser
  window.handleCreateUser = async function handleCreateUserClubDirector(e) {
    e.preventDefault();
    const form = e.target;
    
    const userData = {
      FirstName: form.firstName?.value?.trim() || '',
      LastName: form.lastName?.value?.trim() || '',
      DateOfBirth: form.dateOfBirth?.value || '',
      Email: form.email?.value?.trim() || null,
      Phone: form.phone?.value?.trim() || null,
      Role: form.role?.value || '',
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('User created successfully', 'success');
        closeModal('createUserModal');
        await loadUsers(); // Load ONLY club users
      } else {
        showNotification(result.error || 'Error creating user', 'error');
      }
    } catch (error) {
      showNotification('Error creating user: ' + error.message, 'error');
    }
  };
  
  window.handleEditUser = async function handleEditUserClubDirector(e, userId) {
    e.preventDefault();
    const form = e.target;
    
    const userData = {
      FirstName: form.editFirstName?.value?.trim() || '',
      LastName: form.editLastName?.value?.trim() || '',
      DateOfBirth: form.editDateOfBirth?.value || '',
      Email: form.editEmail?.value?.trim() || null,
      Phone: form.editPhone?.value?.trim() || null,
      Role: form.editRole?.value || '',
      InvestitureLevel: form.editInvestitureLevel?.value || 'None',
      ClubID: form.editClubId?.value || null,
      EventID: form.editEventId?.value || null,
      Password: form.editPassword?.value || null
    };

    // Validate
    if (!userData.FirstName || !userData.LastName || !userData.DateOfBirth || !userData.Role) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    // If password provided, add it to update
    if (userData.Password) {
      userData.Password = userData.Password;
    } else {
      delete userData.Password;
    }

    try {
      const response = await fetchWithAuth(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('User updated successfully', 'success');
        closeModal('editUserModal');
        await loadUsers(); // Load ONLY club users
      } else {
        showNotification(result.error || 'Error updating user', 'error');
      }
    } catch (error) {
      showNotification('Error updating user: ' + error.message, 'error');
    }
  };
  
  // Registration code functions
  async function renderCodes() {
    const container = document.getElementById('codesList');
    if (!container) {
      console.error('Codes list container not found');
      return;
    }
    
    container.innerHTML = '<p class="text-center">Loading codes...</p>';
    
    // Check if events are available
    if (clubDirectorEvents.length === 0) {
      container.innerHTML = '<p class="text-center" style="color: #d32f2f;">No events assigned to your club. Please contact an administrator to be assigned to an event.</p>';
      return;
    }
    
    // Check if event is selected
    if (!clubDirectorSelectedEventId) {
      container.innerHTML = '<p class="text-center" style="color: #d32f2f;">Please select an event first using the dropdown above</p>';
      return;
    }
    
    // Check if club ID is available
    if (!clubDirectorClubId) {
      container.innerHTML = '<p class="text-center" style="color: #d32f2f;">Club information not available. Please refresh the page.</p>';
      console.error('clubDirectorClubId is null');
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/codes/club/${clubDirectorClubId}?eventId=${clubDirectorSelectedEventId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to load codes' };
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const codes = await response.json();
      
      if (!Array.isArray(codes)) {
        console.error('Invalid response format:', codes);
        throw new Error('Invalid response format from server');
      }
      
      if (codes.length === 0) {
        container.innerHTML = '<p class="text-center">No registration codes yet. Click "Generate New Code" to create one!</p>';
        return;
      }
      
      const tableHtml = `
        <table class="data-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="padding: 12px 8px; text-align: left;">Code</th>
              <th style="padding: 12px 8px; text-align: left;">Created</th>
              <th style="padding: 12px 8px; text-align: left;">Expires</th>
              <th style="padding: 12px 8px; text-align: left;">Status</th>
              <th style="padding: 12px 8px; text-align: left;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${codes.map(code => `
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 8px;"><strong>${code.Code}</strong></td>
                <td style="padding: 12px 8px;">${new Date(code.CreatedAt).toLocaleDateString()}</td>
                <td style="padding: 12px 8px;">${new Date(code.ExpiresAt).toLocaleDateString()}</td>
                <td style="padding: 12px 8px;">
                  ${new Date(code.ExpiresAt) > new Date()
                    ? '<span class="badge bg-success">Active</span>' 
                    : '<span class="badge bg-danger">Expired</span>'
                  }
                </td>
                <td style="padding: 12px 8px; text-align: left;">
                  <button onclick="shareRegistrationCode('${code.Code}')" class="btn btn-sm btn-info" style="margin-right: 8px;">Share</button>
                  <button onclick="deleteRegistrationCode('${code.Code}')" class="btn btn-sm btn-danger">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      const mobileCards = codes.map(code => {
        const isActive = new Date(code.ExpiresAt) > new Date();
        const actionsHtml = `
          <button onclick="shareRegistrationCode('${code.Code}')" class="btn btn-sm btn-info">Share</button>
          <button onclick="deleteRegistrationCode('${code.Code}')" class="btn btn-sm btn-danger">Delete</button>
        `;
        
        return createMobileCard({
          'Code': code.Code,
          'Created': new Date(code.CreatedAt).toLocaleDateString(),
          'Expires': new Date(code.ExpiresAt).toLocaleDateString(),
          'Status': isActive ? 'Active' : 'Expired'
        }, `Code: ${code.Code}`, actionsHtml);
      }).join('');
      
      container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
    } catch (error) {
      console.error('Error loading codes:', error);
      container.innerHTML = `<p class="text-center" style="color: red;">Error loading codes: ${error.message}</p>`;
      showNotification('Error loading codes: ' + error.message, 'error');
    }
  }

  async function generateRegistrationCode() {
    // Check if events are available
    if (clubDirectorEvents.length === 0) {
      showNotification('No events assigned to your club. Please contact an administrator.', 'error');
      return;
    }
    
    // Check if event is selected
    if (!clubDirectorSelectedEventId) {
      showNotification('Please select an event first using the dropdown above', 'error');
      return;
    }
    
    if (!clubDirectorClubId) {
      showNotification('Club information not available. Please refresh the page.', 'error');
      console.error('clubDirectorClubId is null');
      return;
    }
    
    const days = prompt('How many days should this code be valid? (Default: 30)', '30');
    if (days === null) return;
    
    const expiresInDays = parseInt(days) || 30;
    
    try {
      const response = await fetchWithAuth('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: clubDirectorClubId,
          eventId: clubDirectorSelectedEventId,
          expiresInDays
        })
      });
      
      const code = await response.json();
      
      if (response.ok) {
        showNotification(`Code generated: ${code.Code}`, 'success');
        await renderCodes();
        // Show email template modal with expiration days
        showCodeEmailModal(code.Code, expiresInDays);
      } else {
        showNotification(code.error || 'Error generating code', 'error');
      }
    } catch (error) {
      showNotification('Error generating code: ' + error.message, 'error');
    }
  }
  
  function showCodeEmailModal(code, expiresInDays = 30) {
    // Get current site URL
    const registrationUrl = window.location.origin + '/register.html';
    
    // Get event info for the email
    const currentEvent = clubDirectorEvents.find(e => e.ID === parseInt(clubDirectorSelectedEventId));
    const eventName = currentEvent ? currentEvent.Name : 'Event';
    
    const emailSubject = `Registration Code for ${eventName}`;
    
    const emailBody = `Hello,

You have been invited to register for ${eventName}.

REGISTRATION CODE: ${code}

TO REGISTER:
1. Click this link: ${registrationUrl}
2. Enter your registration code: ${code}
3. Fill out the registration form
4. Submit your registration

This code will expire in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''}. Please register as soon as possible.

If you have any questions, please contact your club director.

Thank you!`;

    const modal = document.createElement('div');
    modal.id = 'codeEmailModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header">
          <h2>Send Registration Code via Email</h2>
          <button onclick="closeClubDirectorModal('codeEmailModal')" class="btn btn-outline">×</button>
        </div>
        <div style="padding: 20px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--border);">
            <p><strong>Ready to send!</strong> Copy the email below and send it to your registrants.</p>
          </div>
          
          <div class="form-group">
            <label><strong>Email Subject:</strong></label>
            <input type="text" id="emailSubject" class="form-control" value="${emailSubject}" readonly style="background: #f5f5f5; cursor: pointer;" onclick="this.select(); document.execCommand('copy'); showNotification('Subject copied to clipboard!', 'success');">
          </div>
          
          <div class="form-group">
            <label><strong>Email Body:</strong></label>
            <textarea id="emailBody" class="form-control" rows="15" readonly style="background: #f5f5f5; cursor: pointer; font-family: monospace; font-size: 13px;" onclick="this.select(); document.execCommand('copy'); showNotification('Email copied to clipboard!', 'success');">${emailBody}</textarea>
          </div>
          
          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="copyCodeEmail('${code}', '${registrationUrl}')" class="btn btn-primary" style="flex: 1;">
              📋 Copy Full Email to Clipboard
            </button>
            <button onclick="closeClubDirectorModal('codeEmailModal')" class="btn btn-outline" style="flex: 1;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  function copyCodeEmail(code, registrationUrl) {
    const emailSubject = document.getElementById('emailSubject').value;
    const emailBody = document.getElementById('emailBody').value;
    
    const fullEmail = `Subject: ${emailSubject}\n\n${emailBody}`;
    
    navigator.clipboard.writeText(fullEmail).then(() => {
      showNotification('Full email copied to clipboard!', 'success');
    }).catch(() => {
      showNotification('Failed to copy email', 'error');
    });
  }
  
  function closeClubDirectorModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
    }
  }
  
  // Close modal function that also refreshes classes when exiting viewStudentsModal
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
      
      // If closing the viewStudentsModal, refresh the classes list to update counts
      if (modalId === 'viewStudentsModal') {
        const currentTab = localStorage.getItem('directorCurrentTab') || 'users';
        if (currentTab === 'classes') {
          renderClasses();
        }
      }
    }
  }

  // Expose functions globally
  window.renderCodes = renderCodes;
  window.generateRegistrationCode = generateRegistrationCode;
  
  // Create copyCode wrapper that can be called from HTML onclick
  window.copyRegistrationCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
      showNotification(`Code "${code}" copied to clipboard!`, 'success');
    }).catch(() => {
      showNotification('Failed to copy code', 'error');
    });
  };
  
  // Share registration code (opens email modal)
  function shareRegistrationCode(code) {
    showCodeEmailModal(code);
  }
  
  // Delete registration code
  async function deleteRegistrationCode(code) {
    if (!confirm('Are you sure you want to delete this registration code? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/codes/${code}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showNotification('Registration code deleted successfully', 'success');
        await renderCodes();
      } else {
        showNotification(result.error || 'Error deleting code', 'error');
      }
    } catch (error) {
      showNotification('Error deleting code: ' + error.message, 'error');
    }
  }
  
  // Manage students functions (copied from admin-dashboard.js with conflict handling)
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
      
      // Load available students - filter by club for Club Directors
      const user = getCurrentUser();
      let availableUrl = `/api/registrations/available/${classId}`;
      if (user.role === 'ClubDirector' && user.clubId) {
        availableUrl += `?clubId=${user.clubId}`;
      }
      
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
        await viewClassStudents(classId);
      } else if (response.status === 409 && result.conflict) {
        showConflictModalClubDirector(classId, studentId, result.conflictClassName, result.conflictRegistrationId);
      } else {
        showNotification(result.error || 'Error adding student', 'error');
      }
    } catch (error) {
      showNotification('Error adding student: ' + error.message, 'error');
    }
  }
  
  function showConflictModalClubDirector(newClassId, userId, conflictClassName, conflictRegistrationId) {
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
            <button onclick="resolveConflictClubDirector('${newClassId}', '${userId}', '${conflictRegistrationId}')" class="btn btn-primary" style="flex: 1;">
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
  
  async function resolveConflictClubDirector(newClassId, userId, conflictRegistrationId) {
    try {
      const removeResponse = await fetchWithAuth(`/api/registrations/admin/${conflictRegistrationId}`, {
        method: 'DELETE'
      });
      
      if (!removeResponse.ok) {
        throw new Error('Failed to remove student from conflict class');
      }
      
      const addResponse = await fetchWithAuth('/api/registrations/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ UserID: userId, ClassID: newClassId })
      });
      
      if (!addResponse.ok) {
        throw new Error('Failed to add student to new class');
      }
      
      closeModal('conflictModal');
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
        await viewClassStudents(classId);
      } else {
        const result = await response.json();
        showNotification(result.error || 'Error removing student', 'error');
      }
    } catch (error) {
      showNotification('Error removing student: ' + error.message, 'error');
    }
  }
  
  // Export filter functions
  window.toggleClubDirectorColumnFilter = toggleClubDirectorColumnFilter;
  window.updateClubDirectorFilter = updateClubDirectorFilter;
  window.renderUsers = renderUsers;
  window.copyCodeEmail = copyCodeEmail;
  window.closeClubDirectorModal = closeClubDirectorModal;
  window.closeModal = closeModal;
  window.shareRegistrationCode = shareRegistrationCode;
  window.deleteRegistrationCode = deleteRegistrationCode;
  window.generateClubDirectorReport = generateClubDirectorReport;
  
  // Manage students functions
  window.viewClassStudents = viewClassStudents;
  window.handleAddStudentToClass = handleAddStudentToClass;
  window.removeStudentFromClass = removeStudentFromClass;
  window.showConflictModalClubDirector = showConflictModalClubDirector;
  window.resolveConflictClubDirector = resolveConflictClubDirector;
  
  async function checkEventStatus() {
    try {
      const response = await fetch('/api/events/current/status');
      const data = await response.json();
      
      const banner = document.getElementById('eventStatusBanner');
      if (data.status === 'Closed') {
        if (banner) banner.style.display = 'block';
      } else {
        if (banner) banner.style.display = 'none';
      }
    } catch (error) {
      console.error('Error checking event status:', error);
    }
  }
  
  // Setup event selector for multi-event support
  function setupEventSelector() {
    const selectorContainer = document.getElementById('eventSelectorContainer');
    const selector = document.getElementById('eventSelector');
    const eventNameEl = document.getElementById('eventName');
    
    if (!selector || !eventNameEl) {
      console.error('Event selector elements not found in DOM');
      return;
    }
    
    // Show selector if there are multiple events
    if (clubDirectorEvents.length > 1) {
      if (selectorContainer) selectorContainer.style.display = 'inline-block';
      
      // Populate selector
      selector.innerHTML = clubDirectorEvents.map(event => 
        `<option value="${event.ID}" ${event.ID === clubDirectorSelectedEventId ? 'selected' : ''}>
          ${event.Name} ${event.Active ? '' : '(Inactive)'}
        </option>`
      ).join('');
      
      // Hide event name when selector is shown
      eventNameEl.textContent = '';
    } else if (clubDirectorEvents.length === 1) {
      // Single event - hide selector and show event name
      if (selectorContainer) selectorContainer.style.display = 'none';
      const selectedEvent = clubDirectorEvents[0];
      eventNameEl.textContent = selectedEvent.Name || 'No Event Selected';
    } else {
      // No events - hide selector and show message
      if (selectorContainer) selectorContainer.style.display = 'none';
      eventNameEl.textContent = '';
    }
  }
  
  // Switch between events for multi-event clubs
  async function switchClubDirectorEvent(eventId) {
    if (!eventId) {
      showNotification('Please select a valid event', 'error');
      return;
    }
    
    const eventIdInt = parseInt(eventId);
    const selectedEvent = clubDirectorEvents.find(e => e.ID === eventIdInt);
    
    if (!selectedEvent) {
      showNotification('Selected event not found', 'error');
      return;
    }
    
    clubDirectorSelectedEventId = eventIdInt;
    clubDirectorEventId = clubDirectorSelectedEventId;
    
    // Update UI
    setupEventSelector();
    
    // Reload data for the selected event based on current tab
    switch (clubDirectorTab) {
      case 'classes':
        await renderClasses();
        break;
      case 'codes':
        await renderCodes();
        break;
      case 'reports':
        // Reload reports tab with new event context
        const content = document.getElementById('content');
        if (content) {
          content.innerHTML = getReportsTab();
        }
        break;
      // 'users' tab doesn't need to reload on event switch
    }
    
    showNotification(`Switched to event: ${selectedEvent.Name}`, 'success');
  }
  
  // Generate report for club director
  async function generateClubDirectorReport() {
    if (!clubDirectorSelectedEventId) {
      showNotification('Please select an event first', 'error');
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/reports/event/${clubDirectorSelectedEventId}`);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate report' }));
        throw new Error(error.error || 'Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const selectedEvent = clubDirectorEvents.find(e => e.ID === clubDirectorSelectedEventId);
      const eventName = selectedEvent ? selectedEvent.Name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'event';
      a.download = `report_${eventName}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showNotification('Report generated successfully', 'success');
    } catch (error) {
      showNotification('Error generating report: ' + error.message, 'error');
    }
  }
});

})(); // End IIFE - closes the wrapper around all Club Director code

