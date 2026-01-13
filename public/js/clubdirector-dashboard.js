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

// Filter state for classes table
let clubDirectorClassFilters = {};
let clubDirectorClassSortColumn = null;
let clubDirectorClassSortDirection = 'asc';

// Summary section state (classes table expanded by default)
let summaryExpanded = true;

// Define functions BEFORE they're called in DOMContentLoaded

// Render summary section
async function renderSummarySection() {
  const container = document.getElementById('summarySection');
  if (!container) return;

  if (!clubDirectorClubId || !clubDirectorSelectedEventId) {
    container.innerHTML = '';
    return;
  }

  try {
    const response = await fetchWithAuth(`/api/clubs/${clubDirectorClubId}/summary?eventId=${clubDirectorSelectedEventId}`);
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(`Failed to load summary: ${response.status}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
    }

    const data = await response.json();
    const { userCounts, classes, totalClasses, totalSeats } = data;

    const toggleIcon = summaryExpanded ? '▼' : '▶';
    const toggleText = summaryExpanded ? 'Hide Classes' : 'Show Classes';

    // Statistics cards - always visible
    const statsCards = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #666; font-size: 0.875rem; margin-bottom: 5px;">Club Directors</div>
          <div style="font-size: 2rem; font-weight: bold; color: #333;">${userCounts.ClubDirector || 0}</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #666; font-size: 0.875rem; margin-bottom: 5px;">Teachers</div>
          <div style="font-size: 2rem; font-weight: bold; color: #333;">${userCounts.Teacher || 0}</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #666; font-size: 0.875rem; margin-bottom: 5px;">Staff</div>
          <div style="font-size: 2rem; font-weight: bold; color: #333;">${userCounts.Staff || 0}</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #666; font-size: 0.875rem; margin-bottom: 5px;">Students</div>
          <div style="font-size: 2rem; font-weight: bold; color: #333;">${userCounts.Student || 0}</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #666; font-size: 0.875rem; margin-bottom: 5px;">Classes Being Offered</div>
          <div style="font-size: 2rem; font-weight: bold; color: #333;">${totalClasses || 0}</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #666; font-size: 0.875rem; margin-bottom: 5px;">Total Seats Teaching</div>
          <div style="font-size: 2rem; font-weight: bold; color: #333;">${totalSeats || 0}</div>
        </div>
      </div>
    `;

    // Classes table - expandable section
    const classesSection = summaryExpanded ? `
      ${classes.length > 0 ? `
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th style="padding: 12px 8px; text-align: left;">Class</th>
                <th style="padding: 12px 8px; text-align: left;">Teacher</th>
                <th style="padding: 12px 8px; text-align: center;">Enrolled</th>
                <th style="padding: 12px 8px; text-align: center;">Waitlisted</th>
                <th style="padding: 12px 8px; text-align: center;">Capacity</th>
              </tr>
            </thead>
            <tbody>
              ${classes.map(cls => `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                  <td style="padding: 12px 8px; text-align: left;"><strong>${cls.HonorName || 'N/A'}</strong></td>
                  <td style="padding: 12px 8px; text-align: left;">${cls.TeacherFirstName && cls.TeacherLastName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : 'Unassigned'}</td>
                  <td style="padding: 12px 8px; text-align: center;">${cls.EnrolledCount || 0}</td>
                  <td style="padding: 12px 8px; text-align: center;">${cls.WaitlistCount || 0}</td>
                  <td style="padding: 12px 8px; text-align: center;">${cls.ActualMaxCapacity || cls.MaxCapacity || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p style="text-align: center; color: #666; padding: 20px;">No classes are being taught by club members for this event.</p>'}
    ` : '';

    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <h2 class="card-title" style="margin: 0;">Club Summary</h2>
        </div>
        <div style="padding: 20px;">
          ${statsCards}
          
          ${classes.length > 0 ? `
            <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; cursor: pointer;" onclick="toggleSummarySection()">
                <h3 style="margin: 0; color: #333;">Classes Being Taught by Club Members</h3>
                <button class="btn btn-outline summary-toggle" style="display: flex; align-items: center; gap: 8px; border: none; background: transparent; padding: 5px 10px;">
                  <span style="display: inline-block; transition: transform 0.3s; ${summaryExpanded ? 'transform: rotate(0deg);' : 'transform: rotate(-90deg);'}">${toggleIcon}</span>
                  ${toggleText}
                </button>
              </div>
              ${classesSection}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading summary:', error);
    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <h2 class="card-title" style="margin: 0;">Club Summary</h2>
        </div>
        <div style="padding: 20px; color: red;">
          Error loading summary: ${error.message}
        </div>
      </div>
    `;
  }
}

// Toggle summary section
function toggleSummarySection() {
  summaryExpanded = !summaryExpanded;
  renderSummarySection();
}

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
    case 'import':
      content.innerHTML = getImportTab();
      // Setup file upload handler after tab is loaded
      setTimeout(() => {
        setupCSVFileInput();
      }, 0);
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
        if (typeof checkInLoadParticipants === 'function') {
          await checkInLoadParticipants();
        }
      }
      break;
    case 'myclasses':
      content.innerHTML = getMyClassesTab();
      await renderMyClasses();
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
  const hasActiveFilters = Object.keys(clubDirectorClassFilters).length > 0;
  return `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-title" style="margin: 0;">Classes</h2>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="toggleClubDirectorClassFilters()" class="btn btn-outline ${hasActiveFilters ? 'btn-primary' : ''}" id="toggleClubDirectorClassFiltersBtn" title="Toggle filter row">
            ${hasActiveFilters ? '🔍 Filters Active' : '🔍 Filter'}
          </button>
          ${hasActiveFilters ? `<button onclick="clearClubDirectorClassFilters()" class="btn btn-outline" title="Clear all filters">Clear Filters</button>` : ''}
          <button onclick="showCreateClassForm()" class="btn btn-primary" id="createClassBtn">Create Class</button>
        </div>
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

// Get Import Tab HTML for Club Director
function getImportTab() {
  if (clubDirectorEvents.length === 0) {
    return `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Import Users</h2>
        </div>
        <p class="text-center" style="color: #d32f2f;">No events assigned to your club. Please contact an administrator to be assigned to an event.</p>
      </div>
    `;
  }
  
  if (!clubDirectorSelectedEventId) {
    return `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Import Users</h2>
        </div>
        <p class="text-center" style="color: #d32f2f;">Please select an event first using the dropdown above</p>
      </div>
    `;
  }
  
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Import Users from CSV</h2>
      </div>
      <div style="padding: 20px;">
        <div style="margin-bottom: 20px;">
          <button onclick="generateSampleCSV()" class="btn btn-secondary" style="margin-right: 10px;">Download Sample CSV</button>
          <small style="color: var(--text-light);">Download a sample CSV file with examples of Student, Teacher, and Staff users</small>
        </div>
        <div style="margin-bottom: 20px;">
          <label for="csvFileInput" style="display: block; margin-bottom: 8px; font-weight: bold;">Upload CSV File:</label>
          <input type="file" id="csvFileInput" accept=".csv" style="margin-bottom: 10px;">
          <small style="color: var(--text-light); display: block;">Select a CSV file to import users. The file should have columns: FirstName, LastName, DateOfBirth, Email, Phone, Role, InvestitureLevel</small>
        </div>
        <div id="importPreview" style="display: none;">
          <h3 style="margin-bottom: 15px;">Import Preview</h3>
          <div id="importSummary" style="margin-bottom: 15px; padding: 10px; background: #f8fafc; border-radius: 5px;"></div>
          <div id="importPreviewTable" style="overflow-x: auto; margin-bottom: 20px;"></div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button id="importValidUsersBtn" onclick="importValidUsers()" class="btn btn-primary" disabled>Import Valid Users</button>
          </div>
        </div>
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

// Get My Classes Tab HTML for Club Director
function getMyClassesTab() {
  if (clubDirectorEvents.length === 0) {
    return `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">My Classes</h2>
        </div>
        <p class="text-center" style="color: #d32f2f;">No events assigned to your club. Please contact an administrator to be assigned to an event.</p>
      </div>
    `;
  }
  
  if (!clubDirectorSelectedEventId) {
    return `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">My Classes</h2>
        </div>
        <p class="text-center" style="color: #d32f2f;">Please select an event first using the dropdown above</p>
      </div>
    `;
  }
  
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">My Classes</h2>
      </div>
      <div id="myClassesContent">
        <p class="text-center">Loading classes...</p>
      </div>
    </div>
    <div class="card" id="rosterCard" style="display: none; margin-top: 20px;">
      <div class="card-header">
        <h2 class="card-title">Class Roster</h2>
      </div>
      <div id="rosterContent">
        <p class="text-center">Select a class to view roster</p>
      </div>
    </div>
  `;
}

// Render My Classes tab - shows classes where current user is the teacher
async function renderMyClasses() {
  const container = document.getElementById('myClassesContent');
  if (!container) return;
  
  if (!clubDirectorSelectedEventId || !clubDirectorUser) {
    container.innerHTML = '<p class="text-center">Please select an event first.</p>';
    return;
  }
  
  try {
    const classesResponse = await fetchWithAuth(`/api/classes/${clubDirectorSelectedEventId}?teacherId=${clubDirectorUser.id}`);
    const myClasses = await classesResponse.json();
    
    if (myClasses.length === 0) {
      container.innerHTML = '<p class="text-center">No classes assigned to you as a teacher.</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="form-group">
        <label for="classSelect">Select Class:</label>
        <select id="classSelect" class="form-control" onchange="loadMyClassRoster(this.value)">
          <option value="">-- Select a class --</option>
          ${myClasses.map(c => `<option value="${c.ID}">${c.HonorName} - ${c.TimeslotDate} ${c.TimeslotStartTime}</option>`).join('')}
        </select>
      </div>
    `;
  } catch (error) {
    console.error('Error loading my classes:', error);
    container.innerHTML = '<p class="text-center" style="color: #d32f2f;">Error loading classes</p>';
  }
}

// Load roster for selected class
async function loadMyClassRoster(classId) {
  if (!classId) {
    const rosterCard = document.getElementById('rosterCard');
    if (rosterCard) rosterCard.style.display = 'none';
    return;
  }
  
  const rosterContainer = document.getElementById('rosterContent');
  const rosterCard = document.getElementById('rosterCard');
  if (!rosterContainer || !rosterCard) return;
  
  try {
    const response = await fetchWithAuth(`/api/registrations/class/${classId}/roster`);
    const roster = await response.json();
    
    rosterCard.style.display = 'block';
    
    // Check event status to determine if attendance can be edited
    const currentEvent = clubDirectorEvents.find(e => e.ID === clubDirectorSelectedEventId);
    const isEventClosed = currentEvent && currentEvent.Status === 'Closed';
    const disabledAttr = isEventClosed ? 'disabled' : '';
    
    const tableHtml = `
      <table class="table">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Club</th>
            <th>Investiture Level</th>
            <th>Attended</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody>
          ${roster.map(student => `
            <tr>
              <td>${student.FirstName} ${student.LastName}</td>
              <td>${student.ClubName || 'No Club'}</td>
              <td>${student.InvestitureLevel || 'None'}</td>
              <td>
                <input type="checkbox" ${student.Attended ? 'checked' : ''} ${disabledAttr}
                  onchange="updateMyClassAttendance(${classId}, ${student.UserID}, 'Attended', this.checked)">
              </td>
              <td>
                <input type="checkbox" ${student.Completed ? 'checked' : ''} ${disabledAttr}
                  onchange="updateMyClassAttendance(${classId}, ${student.UserID}, 'Completed', this.checked)">
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    const mobileCards = roster.map(student => {
      const attendedChecked = student.Attended ? 'checked' : '';
      const completedChecked = student.Completed ? 'checked' : '';
      
      const actionsHtml = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" ${attendedChecked} ${disabledAttr}
              onchange="updateMyClassAttendance(${classId}, ${student.UserID}, 'Attended', this.checked)">
            <span>Attended</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" ${completedChecked} ${disabledAttr}
              onchange="updateMyClassAttendance(${classId}, ${student.UserID}, 'Completed', this.checked)">
            <span>Completed</span>
          </label>
        </div>
      `;
      
      return createMobileCard({
        'Student Name': `${student.FirstName} ${student.LastName}`,
        'Club': student.ClubName || 'No Club',
        'Investiture Level': student.InvestitureLevel || 'None'
      }, `${student.FirstName} ${student.LastName}`, actionsHtml);
    }).join('');
    
    rosterContainer.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
    
    if (isEventClosed) {
      const banner = document.createElement('div');
      banner.className = 'status-banner status-banner-closed';
      banner.style.marginBottom = '15px';
      banner.innerHTML = '<strong>⚠ Event Closed:</strong> Attendance cannot be edited for closed events.';
      rosterContainer.insertBefore(banner, rosterContainer.firstChild);
    }
  } catch (error) {
    console.error('Error loading roster:', error);
    rosterContainer.innerHTML = '<p class="text-center" style="color: #d32f2f;">Error loading roster</p>';
  }
}

// Update attendance for a student in a class
async function updateMyClassAttendance(classId, userId, field, value) {
  try {
    const updateData = {};
    updateData[field] = value;

    const response = await fetchWithAuth(`/api/attendance/${classId}/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      showNotification('Attendance updated', 'success');
    } else {
      const error = await response.json().catch(() => ({ error: 'Failed to update attendance' }));
      showNotification(error.error || 'Error updating attendance', 'error');
    }
  } catch (error) {
    console.error('Error updating attendance:', error);
    showNotification('Error updating attendance', 'error');
  }
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
            <input type="text" class="filter-input" id="filter-cd-name" value="${clubDirectorFilters.name || ''}" oninput="debouncedUpdateClubDirectorFilter('name', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-username" value="${clubDirectorFilters.username || ''}" oninput="debouncedUpdateClubDirectorFilter('username', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-role" value="${clubDirectorFilters.role || ''}" oninput="debouncedUpdateClubDirectorFilter('role', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-club" value="${clubDirectorFilters.club || ''}" oninput="debouncedUpdateClubDirectorFilter('club', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-age" value="${clubDirectorFilters.age || ''}" oninput="debouncedUpdateClubDirectorFilter('age', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-active" value="${clubDirectorFilters.active || ''}" oninput="debouncedUpdateClubDirectorFilter('active', this.value)" placeholder="Filter...">
          </td>
          <td class="filter-cell">
            <input type="text" class="filter-input" id="filter-cd-bgcheck" value="${clubDirectorFilters.bgcheck || ''}" oninput="debouncedUpdateClubDirectorFilter('bgcheck', this.value)" placeholder="Filter...">
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

// Debounced version of updateClubDirectorFilter (400ms delay)
const debouncedUpdateClubDirectorFilter = debounce(updateClubDirectorFilter, 400);

// convertTo12Hour is now in utils.js and available globally

// Helper function to normalize active status to boolean
function normalizeActive(active) {
  // Handle various possible formats: boolean, 0/1, null/undefined
  if (active === null || active === undefined) return false;
  if (typeof active === 'boolean') return active;
  if (typeof active === 'number') return active !== 0;
  if (typeof active === 'string') return active.toLowerCase() === 'true' || active === '1';
  return Boolean(active);
}

// Override renderClasses to filter by their club's event (shows all classes for the event)
async function renderClasses() {
  const container = document.getElementById('classesList');
  if (!container) {
    console.error('Classes list container not found');
    return;
  }
  
  console.log('[ClubDirector] renderClasses for event', clubDirectorSelectedEventId);
  
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
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(`Failed to load classes: ${response.status}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
    }
    
    clubDirectorClasses = await response.json();
    console.log('[ClubDirector] Classes response:', clubDirectorClasses);
    
    // API already filters to only active classes with active honors for Club Directors
    // Show all classes for the selected event
    if (clubDirectorClasses.length === 0) {
      container.innerHTML = '<p class="text-center">No active classes found for this event</p>';
      return;
    }
    
    let activeClasses = clubDirectorClasses;
    const hasInactive = false; // Club Directors never see inactive classes
    
    // Apply filters
    if (Object.keys(clubDirectorClassFilters).length > 0) {
      const filterFunction = (cls) => {
        return Object.entries(clubDirectorClassFilters).every(([column, filterValue]) => {
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
    }
    
    // Apply sorting
    if (clubDirectorClassSortColumn) {
      activeClasses.sort((a, b) => {
        let aVal, bVal;
        
        switch(clubDirectorClassSortColumn) {
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
              return clubDirectorClassSortDirection === 'asc' 
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
        
        if (clubDirectorClassSortColumn === 'datetime' && a.TimeslotDate && b.TimeslotDate) {
          // Already handled above
          return 0;
        }
        
        if (typeof aVal === 'string') {
          return clubDirectorClassSortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          return clubDirectorClassSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });
    }
    
    const hasActive = activeClasses.length > 0;

    // Helper function to format multi-session badge
    const getMultiSessionBadge = (cls) => {
      if (cls.IsMultiSession && cls.TotalSessions > 1) {
        return `<span class="badge bg-info" style="font-size: 0.7em; margin-left: 5px;" title="Session ${cls.SessionNumber} of ${cls.TotalSessions}">Session ${cls.SessionNumber}/${cls.TotalSessions}</span>`;
      }
      return '';
    };
    
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
            <th class="filterable ${clubDirectorClassFilters.honor ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'honor' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('honor')" style="width: 18%; padding: 12px 8px; text-align: left;">Honor</th>
            <th class="filterable ${clubDirectorClassFilters.club ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'club' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('club')" style="width: 12%; padding: 12px 8px; text-align: left;">Club</th>
            <th class="filterable ${clubDirectorClassFilters.teacher ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'teacher' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('teacher')" style="width: 13%; padding: 12px 8px; text-align: left;">Teacher</th>
            <th class="filterable ${clubDirectorClassFilters.location ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'location' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('location')" style="width: 13%; padding: 12px 8px; text-align: left;">Location</th>
            <th class="filterable ${clubDirectorClassFilters.datetime ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'datetime' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('datetime')" style="width: 16%; padding: 12px 8px; text-align: left;">Date/Time</th>
            <th class="filterable ${clubDirectorClassFilters.capacity ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'capacity' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('capacity')" style="width: 13%; padding: 12px 8px; text-align: left;">Capacity</th>
            <th class="filterable ${clubDirectorClassFilters.status ? 'filter-active' : ''} ${clubDirectorClassSortColumn === 'status' ? 'sort-active' : ''}" onclick="toggleClubDirectorClassColumnFilter('status')" style="width: 8%; padding: 12px 8px; text-align: left;">Status</th>
            <th style="width: 10%; padding: 12px 8px; text-align: left;">Actions</th>
          </tr>
          <tr class="filter-row" id="clubDirectorClassFilterRow" style="display: ${Object.keys(clubDirectorClassFilters).length > 0 ? 'table-row' : 'none'}; background-color: #f8fafc;">
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-honor" value="${clubDirectorClassFilters.honor || ''}" oninput="debouncedUpdateClubDirectorClassFilter('honor', this.value)" placeholder="Filter by honor...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-club" value="${clubDirectorClassFilters.club || ''}" oninput="debouncedUpdateClubDirectorClassFilter('club', this.value)" placeholder="Filter by club...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-teacher" value="${clubDirectorClassFilters.teacher || ''}" oninput="debouncedUpdateClubDirectorClassFilter('teacher', this.value)" placeholder="Filter by teacher...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-location" value="${clubDirectorClassFilters.location || ''}" oninput="debouncedUpdateClubDirectorClassFilter('location', this.value)" placeholder="Filter by location...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-datetime" value="${clubDirectorClassFilters.datetime || ''}" oninput="debouncedUpdateClubDirectorClassFilter('datetime', this.value)" placeholder="Filter by date/time...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-capacity" value="${clubDirectorClassFilters.capacity || ''}" oninput="debouncedUpdateClubDirectorClassFilter('capacity', this.value)" placeholder="Filter by capacity...">
            </td>
            <td class="filter-cell">
              <input type="text" class="filter-input" id="clubDirector-filter-status" value="${clubDirectorClassFilters.status || ''}" oninput="debouncedUpdateClubDirectorClassFilter('status', this.value)" placeholder="Filter by status...">
            </td>
            <td class="filter-cell"></td>
          </tr>
        </thead>
        <tbody>
          ${!hasActive ? '<tr><td colspan="8" class="text-center">No classes match the current filters</td></tr>' : ''}
          ${hasActive ? activeClasses.map(cls => {
              const isActive = normalizeActive(cls.Active);
              const canEdit = isActive && cls.CreatedBy === clubDirectorUser?.id;
              return `
          <tr style="border-bottom: 1px solid #e0e0e0;${cls.IsMultiSession ? ' background: linear-gradient(to right, #e3f2fd 0%, transparent 100%);' : ''}">
            <td style="padding: 12px 8px; text-align: left;">
              <strong>${cls.HonorName || 'N/A'}</strong>
              ${getMultiSessionBadge(cls)}
              ${getLevelBadge(cls)}
            </td>
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
              ${canEdit ? `<button onclick="editClass(${cls.ID})" class="btn btn-sm btn-secondary">Edit</button>` : ''}
            </td>
          </tr>
        `;
            }).join('') : ''}
        ${hasInactive ? `
          <tr style="background: #f9f9f9; border-top: 2px solid #ccc;">
            <td colspan="8" style="padding: 10px; font-weight: bold; color: #666;">Deactivated Classes</td>
          </tr>
          ${inactiveClasses.map(cls => `
          <tr style="border-bottom: 1px solid #e0e0e0; opacity: 0.7; background: #f9f9f9;">
            <td style="padding: 12px 8px; text-align: left;"><strong>${cls.HonorName || 'N/A'}</strong></td>
            <td style="padding: 12px 8px; text-align: left;">${cls.ClubName || '<span style="color: #999;">N/A</span>'}</td>
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
    
    const mobileCards = activeClasses.map(cls => {
      const isActive = normalizeActive(cls.Active);
      const canEdit = isActive && cls.CreatedBy === clubDirectorUser?.id;
      const dateTime = cls.TimeslotDate
        ? `${cls.TimeslotDate}<br><small style="color: var(--text-light);">${cls.TimeslotStartTime ? convertTo12Hour(cls.TimeslotStartTime) : ''} - ${cls.TimeslotEndTime ? convertTo12Hour(cls.TimeslotEndTime) : ''}</small>`
        : 'N/A';

      const sessionInfo = cls.IsMultiSession && cls.TotalSessions > 1 
        ? `Session ${cls.SessionNumber}/${cls.TotalSessions}`
        : '';

      const actionsHtml = cls.Active
        ? `
          <button onclick="viewClassStudents(${cls.ID})" class="btn btn-sm btn-info">Manage Students</button>
          ${canEdit ? `<button onclick="editClass(${cls.ID})" class="btn btn-sm btn-secondary">Edit</button>` : ''}
        `
        : `<span style="color: #999;">Inactive class</span>`;

      const cardData = {
        'Honor': cls.HonorName || 'N/A',
        'Club': cls.ClubName || 'N/A',
        'Teacher': cls.TeacherFirstName ? `${cls.TeacherFirstName} ${cls.TeacherLastName}` : 'Unassigned',
        'Location': cls.LocationName || 'N/A',
        'Date/Time': dateTime,
        'Capacity': `${cls.EnrolledCount || 0}/${cls.WaitlistCount || 0}/${cls.ActualMaxCapacity || cls.MaxCapacity}`,
        'Status': isActive ? 'Active' : 'Inactive'
      };
      
      if (sessionInfo) {
        cardData['Session'] = sessionInfo;
      }

      return createMobileCard(cardData, cls.HonorName || 'N/A', actionsHtml);
    }).join('');
    
    container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
    
    // Update filter button state after rendering
    updateClubDirectorClassFilterButtonState();
  } catch (error) {
    console.error('Error loading classes:', error);
    container.innerHTML = `<p class="text-center" style="color: red;">Error loading classes: ${error.message}</p>`;
    showNotification('Error loading classes', 'error');
  }
}

function toggleClubDirectorClassColumnFilter(column) {
  // Show filter row if hidden and add filter for this column
  const filterRow = document.getElementById('clubDirectorClassFilterRow');
  if (filterRow && filterRow.style.display === 'none') {
    filterRow.style.display = 'table-row';
  }
  
  // Focus on the filter input for this column
  const filterInput = document.getElementById(`clubDirector-filter-${column}`);
  if (filterInput) {
    filterInput.focus();
  }
  
  // Update filter button state
  const filterBtn = document.getElementById('toggleClubDirectorClassFiltersBtn');
  if (filterBtn && filterRow && filterRow.style.display !== 'none') {
    filterBtn.classList.add('btn-primary');
    filterBtn.textContent = '🔍 Filters Active';
  }
  
  // Toggle sorting
  if (clubDirectorClassSortColumn === column) {
    clubDirectorClassSortDirection = clubDirectorClassSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    clubDirectorClassSortColumn = column;
    clubDirectorClassSortDirection = 'asc';
  }
  
  renderClasses();
}

function updateClubDirectorClassFilter(column, value) {
  if (value.trim()) {
    clubDirectorClassFilters[column] = value.trim();
  } else {
    delete clubDirectorClassFilters[column];
    // Hide filter row if no filters active
    if (Object.keys(clubDirectorClassFilters).length === 0) {
      const filterRow = document.getElementById('clubDirectorClassFilterRow');
      if (filterRow) filterRow.style.display = 'none';
      // Update filter button state
      const filterBtn = document.getElementById('toggleClubDirectorClassFiltersBtn');
      if (filterBtn) {
        filterBtn.classList.remove('btn-primary');
        filterBtn.textContent = '🔍 Filter';
      }
      // Remove clear filters button
      const clearBtn = filterBtn?.nextElementSibling;
      if (clearBtn && clearBtn.onclick?.toString().includes('clearClubDirectorClassFilters')) {
        clearBtn.remove();
      }
    }
  }
  renderClasses();
  // Update filter button state
  updateClubDirectorClassFilterButtonState();
}

// Debounced version of updateClubDirectorClassFilter (400ms delay)
const debouncedUpdateClubDirectorClassFilter = debounce(updateClubDirectorClassFilter, 400);

function toggleClubDirectorClassFilters() {
  const filterRow = document.getElementById('clubDirectorClassFilterRow');
  if (!filterRow) return;
  
  const isVisible = filterRow.style.display !== 'none';
  filterRow.style.display = isVisible ? 'none' : 'table-row';
  
  // Update button text
  const filterBtn = document.getElementById('toggleClubDirectorClassFiltersBtn');
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

function clearClubDirectorClassFilters() {
  clubDirectorClassFilters = {};
  clubDirectorClassSortColumn = null;
  clubDirectorClassSortDirection = 'asc';
  
  // Clear all filter inputs
  const filterInputs = document.querySelectorAll('#clubDirectorClassFilterRow .filter-input');
  filterInputs.forEach(input => input.value = '');
  
  // Hide filter row
  const filterRow = document.getElementById('clubDirectorClassFilterRow');
  if (filterRow) filterRow.style.display = 'none';
  
  // Update filter button
  const filterBtn = document.getElementById('toggleClubDirectorClassFiltersBtn');
  if (filterBtn) {
    filterBtn.classList.remove('btn-primary');
    filterBtn.textContent = '🔍 Filter';
  }
  
  // Remove clear filters button
  const clearBtn = filterBtn?.nextElementSibling;
  if (clearBtn && clearBtn.onclick?.toString().includes('clearClubDirectorClassFilters')) {
    clearBtn.remove();
  }
  
  renderClasses();
}

function updateClubDirectorClassFilterButtonState() {
  const filterBtn = document.getElementById('toggleClubDirectorClassFiltersBtn');
  if (!filterBtn) return;
  
  const hasActiveFilters = Object.keys(clubDirectorClassFilters).length > 0;
  if (hasActiveFilters) {
    filterBtn.classList.add('btn-primary');
    filterBtn.textContent = '🔍 Filters Active';
    
    // Add clear filters button if it doesn't exist
    if (!filterBtn.nextElementSibling || !filterBtn.nextElementSibling.onclick?.toString().includes('clearClubDirectorClassFilters')) {
      const clearBtn = document.createElement('button');
      clearBtn.onclick = clearClubDirectorClassFilters;
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
    if (clearBtn && clearBtn.onclick?.toString().includes('clearClubDirectorClassFilters')) {
      clearBtn.remove();
    }
  }
}

// Export functions to window for onclick handlers
window.toggleClubDirectorClassColumnFilter = toggleClubDirectorClassColumnFilter;
window.updateClubDirectorClassFilter = updateClubDirectorClassFilter;
window.debouncedUpdateClubDirectorClassFilter = debouncedUpdateClubDirectorClassFilter;
window.toggleClubDirectorClassFilters = toggleClubDirectorClassFilters;
window.clearClubDirectorClassFilters = clearClubDirectorClassFilters;

// Override loadEvents to load events for this club
async function loadEvents() {
  try {
    // Use /api/events/my to get events for this club
    const response = await fetchWithAuth('/api/events/my');
    clubDirectorEvents = await response.json();
    console.log('[ClubDirector] Events loaded:', clubDirectorEvents);
    
  } catch (error) {
    console.error('Error loading events:', error);
    clubDirectorEvents = [];
  }
}

// Override loadUsers to load ONLY users from the director's club
async function loadUsers() {
  try {
    // Club Directors ONLY see users from their own club
    // Only show active users (deactivated users should not appear in club dashboard)
    const queryParams = new URLSearchParams();
    if (clubDirectorClubId) {
      queryParams.append('clubId', clubDirectorClubId);
    }
    queryParams.append('active', '1'); // Only fetch active users
    
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
  
  // Sort honors by category, then by name
  const sortedHonors = [...honors].sort((a, b) => {
    if (a.Category !== b.Category) {
      return a.Category.localeCompare(b.Category);
    }
    return a.Name.localeCompare(b.Name);
  });
  
  // Load teachers, staff, and club directors from the same club for this event
  // Only show active users (deactivated users should not appear in dropdowns)
  const [teachersResponse, staffResponse, directorsResponse] = await Promise.all([
    fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=Teacher&eventId=${eventId}&active=1`),
    fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=Staff&eventId=${eventId}&active=1`),
    fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=ClubDirector&eventId=${eventId}&active=1`)
  ]);
  const teachers = await teachersResponse.json();
  const staff = await staffResponse.json();
  const directors = await directorsResponse.json();
  // Merge teachers, staff, and club directors for teacher selection
  const allTeachers = [...teachers, ...staff, ...directors].sort((a, b) => {
    if (a.LastName !== b.LastName) return a.LastName.localeCompare(b.LastName);
    return a.FirstName.localeCompare(b.FirstName);
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
          <label for="classTeacher">Teacher</label>
          <select id="classTeacher" name="classTeacher" class="form-control">
            <option value="">No Teacher (Unassigned)</option>
            ${allTeachers.map(t => `<option value="${t.ID}">${t.FirstName} ${t.LastName}</option>`).join('')}
          </select>
          <small style="color: var(--text-light);">Optional - Teacher can be assigned later (Only teachers from your club)</small>
        </div>
        <div class="form-group">
          <label for="classMaxCapacity">Max Capacity *</label>
          <input type="number" id="classMaxCapacity" name="classMaxCapacity" class="form-control" min="1" required>
          <small style="color: var(--text-light);">Admin will assign location later</small>
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
          <label>Select Timeslots for this Class *</label>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto;">
            ${timeslots.map(slot => `
              <label style="display: block; padding: 8px; margin-bottom: 4px; border: 1px solid #eee; border-radius: 3px; cursor: pointer; transition: background 0.2s;" 
                     onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                <input type="checkbox" name="classTimeslots" value="${slot.ID}" style="margin-right: 8px;">
                <strong>${convertTo12Hour(slot.StartTime)} - ${convertTo12Hour(slot.EndTime)}</strong> on ${slot.Date}
              </label>
            `).join('')}
          </div>
          <small style="color: var(--text-light); display: block; margin-top: 5px;">Select timeslots when this class will be offered</small>
        </div>
        <div class="form-group" style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;">
          <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; margin: 0;">
            <input type="checkbox" id="isMultiSession" name="isMultiSession" style="margin-top: 3px; width: auto;">
            <div>
              <strong style="display: block; margin-bottom: 4px;">Link as multi-session class</strong>
              <small style="color: var(--text-light); display: block;">
                When checked: Creates ONE class spanning all selected timeslots. Students must attend ALL sessions.<br>
                When unchecked: Creates SEPARATE independent classes for each timeslot (default).
              </small>
            </div>
          </label>
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

// Import functionality - CSV parsing and validation
let parsedUsers = [];
let userValidations = [];
let importedUsersData = []; // Store successfully imported users with usernames and passwords

// Setup file upload handler (called when import tab is loaded)
function setupCSVFileInput() {
  const csvFileInput = document.getElementById('csvFileInput');
  if (csvFileInput) {
    // Remove existing listeners by cloning
    const newInput = csvFileInput.cloneNode(true);
    csvFileInput.parentNode.replaceChild(newInput, csvFileInput);
    
    newInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (!file.name.toLowerCase().endsWith('.csv')) {
        showNotification('Please select a CSV file', 'error');
        return;
      }
      
            try {
              parsedUsers = await parseCSVFile(file);
              
              // Clear previous import data when new file is uploaded
              importedUsersData = [];
              const existingDownloadBtn = document.getElementById('downloadImportedUsersBtn');
              if (existingDownloadBtn) {
                existingDownloadBtn.remove();
              }
              
              // Fetch existing users to check for duplicates
              const existingUsersResponse = await fetchWithAuth('/api/users');
              const existingUsers = existingUsersResponse.ok ? await existingUsersResponse.json() : [];
              
              // Validate all rows with duplicate checking
              userValidations = parsedUsers.map((row, index) => validateUserRow(row, index, existingUsers));
              
              renderImportPreview(parsedUsers, userValidations);
              showNotification(`CSV parsed: ${parsedUsers.length} user${parsedUsers.length !== 1 ? 's' : ''} found`, 'success');
            } catch (error) {
              showNotification('Error parsing CSV: ' + error.message, 'error');
              parsedUsers = [];
              userValidations = [];
              const previewDiv = document.getElementById('importPreview');
              if (previewDiv) {
                previewDiv.style.display = 'none';
              }
            }
    });
  }
}

// Generate sample CSV file
function generateSampleCSV() {
  const headers = ['FirstName', 'LastName', 'DateOfBirth', 'Email', 'Phone', 'Role', 'InvestitureLevel'];
  
  // Sample data with examples for Student, Teacher, and Staff
  const sampleData = [
    ['John', 'Doe', '2010-05-15', 'john.doe@example.com', '555-0101', 'Student', 'Explorer'],
    ['Jane', 'Smith', '1985-03-20', 'jane.smith@example.com', '555-0102', 'Teacher', 'Guide'],
    ['Bob', 'Johnson', '1990-07-10', 'bob.johnson@example.com', '555-0103', 'Staff', 'Ranger']
  ];
  
  // CSV escaping function
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Build CSV content
  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...sampleData.map(row => row.map(escapeCSV).join(','))
  ];
  
  const csvContent = csvLines.join('\n');
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'user-import-sample.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  showNotification('Sample CSV downloaded', 'success');
}

// Parse CSV file
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }
        
        // Parse header row
        const headers = parseCSVLine(lines[0]);
        const normalizedHeaders = headers.map(h => h.trim());
        
        // Validate required headers
        const requiredHeaders = ['FirstName', 'LastName', 'DateOfBirth', 'Role'];
        const missingHeaders = requiredHeaders.filter(h => !normalizedHeaders.includes(h));
        if (missingHeaders.length > 0) {
          reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
          return;
        }
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length === 0 || values.every(v => !v.trim())) continue; // Skip empty rows
          
          const row = {};
          normalizedHeaders.forEach((header, index) => {
            row[header] = values[index] ? values[index].trim() : '';
          });
          data.push(row);
        }
        
        resolve(data);
      } catch (error) {
        reject(new Error('Error parsing CSV: ' + error.message));
      }
    };
    
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current);
  
  return values;
}

// Check if username would be duplicate
async function checkUsernameDuplicate(firstName, lastName) {
  try {
    // Generate potential base username
    const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    
    // Fetch all users to check for existing usernames
    const response = await fetchWithAuth('/api/users');
    if (!response.ok) {
      return false; // If we can't check, allow it (server will handle duplicates)
    }
    
    const allUsers = await response.json();
    
    // Check if base username exists
    if (allUsers.some(u => u.Username === baseUsername)) {
      return true;
    }
    
    // Check for numbered variations (firstname.lastname1, firstname.lastname2, etc.)
    const usernamePattern = new RegExp(`^${baseUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d*$`);
    if (allUsers.some(u => usernamePattern.test(u.Username))) {
      return true; // A variation exists, which is fine - server will generate unique one
    }
    
    return false;
  } catch (error) {
    console.error('Error checking username:', error);
    return false; // If check fails, allow it (server will handle duplicates)
  }
}

// Validate a user row
function validateUserRow(row, rowIndex, existingUsers = []) {
  const errors = [];
  const rowNum = rowIndex + 2; // +2 because row 1 is header, and we're 0-indexed
  
  // Required fields
  if (!row.FirstName || !row.FirstName.trim()) {
    errors.push('FirstName is required');
  }
  
  if (!row.LastName || !row.LastName.trim()) {
    errors.push('LastName is required');
  }
  
  if (!row.DateOfBirth || !row.DateOfBirth.trim()) {
    errors.push('DateOfBirth is required');
  } else {
    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.DateOfBirth.trim())) {
      errors.push('DateOfBirth must be in YYYY-MM-DD format');
    } else {
      // Validate it's a valid date
      const date = new Date(row.DateOfBirth.trim());
      if (isNaN(date.getTime())) {
        errors.push('DateOfBirth is not a valid date');
      }
    }
  }
  
  if (!row.Role || !row.Role.trim()) {
    errors.push('Role is required');
  } else {
    const validRoles = ['Student', 'Teacher', 'Staff'];
    if (!validRoles.includes(row.Role.trim())) {
      errors.push(`Role must be one of: ${validRoles.join(', ')}`);
    }
  }
  
  // Optional fields validation
  if (row.Email && row.Email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.Email.trim())) {
      errors.push('Email format is invalid');
    }
  }
  
  // Phone is optional, no validation needed (any format accepted)
  
  // InvestitureLevel validation
  if (row.InvestitureLevel && row.InvestitureLevel.trim()) {
    const validLevels = ['None', 'Friend', 'Companion', 'Explorer', 'Ranger', 'Voyager', 'Guide', 'MasterGuide'];
    if (!validLevels.includes(row.InvestitureLevel.trim())) {
      errors.push(`InvestitureLevel must be one of: ${validLevels.join(', ')}`);
    }
  }
  
  // Check for duplicate username (only if other validations pass)
  if (errors.length === 0 && row.FirstName && row.LastName) {
    const baseUsername = `${row.FirstName.trim().toLowerCase()}.${row.LastName.trim().toLowerCase()}`;
    const exactMatch = existingUsers.some(u => u.Username === baseUsername);
    
    if (exactMatch) {
      errors.push('Username already exists (duplicate first/last name combination)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// Render import preview table
function renderImportPreview(parsedUsers, validations) {
  const previewDiv = document.getElementById('importPreview');
  const summaryDiv = document.getElementById('importSummary');
  const tableDiv = document.getElementById('importPreviewTable');
  const importBtn = document.getElementById('importValidUsersBtn');
  
  if (!previewDiv || !summaryDiv || !tableDiv) return;
  
  previewDiv.style.display = 'block';
  
  // Calculate summary
  const validCount = validations.filter(v => v.valid).length;
  const invalidCount = validations.filter(v => !v.valid).length;
  const totalCount = parsedUsers.length;
  
  summaryDiv.innerHTML = `
    <strong>Summary:</strong> ${validCount} valid, ${invalidCount} invalid out of ${totalCount} total user${totalCount !== 1 ? 's' : ''}
  `;
  
  // Build table
  const tableHtml = `
    <table class="table" style="width: 100%;">
      <thead>
        <tr>
          <th>Row #</th>
          <th>FirstName</th>
          <th>LastName</th>
          <th>DateOfBirth</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Role</th>
          <th>InvestitureLevel</th>
          <th>Status</th>
          <th>Errors</th>
        </tr>
      </thead>
      <tbody>
        ${parsedUsers.map((user, index) => {
          const validation = validations[index];
          const rowNum = index + 2; // +2 because row 1 is header, and we're 0-indexed
          const isValid = validation.valid;
          
          // Determine which cells have errors
          const firstNameError = !user.FirstName || !user.FirstName.trim();
          const lastNameError = !user.LastName || !user.LastName.trim();
          const dobError = !user.DateOfBirth || !user.DateOfBirth.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(user.DateOfBirth.trim());
          const emailError = user.Email && user.Email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.Email.trim());
          const roleError = !user.Role || !['Student', 'Teacher', 'Staff'].includes(user.Role.trim());
          const investitureError = user.InvestitureLevel && user.InvestitureLevel.trim() && !['None', 'Friend', 'Companion', 'Explorer', 'Ranger', 'Voyager', 'Guide', 'MasterGuide'].includes(user.InvestitureLevel.trim());
          
          return `
            <tr style="${isValid ? '' : 'background-color: #fff5f5;'}">
              <td>${rowNum}</td>
              <td style="${firstNameError ? 'border: 2px solid red;' : ''}">${user.FirstName || ''}</td>
              <td style="${lastNameError ? 'border: 2px solid red;' : ''}">${user.LastName || ''}</td>
              <td style="${dobError ? 'border: 2px solid red;' : ''}">${user.DateOfBirth || ''}</td>
              <td style="${emailError ? 'border: 2px solid red;' : ''}">${user.Email || ''}</td>
              <td>${user.Phone || ''}</td>
              <td style="${roleError ? 'border: 2px solid red;' : ''}">${user.Role || ''}</td>
              <td style="${investitureError ? 'border: 2px solid red;' : ''}">${user.InvestitureLevel || ''}</td>
              <td>${isValid ? '<span style="color: green;">✓</span>' : '<span style="color: red;">✗</span>'}</td>
              <td style="color: red; font-size: 0.875rem;">${validation.errors.length > 0 ? validation.errors.join(', ') : ''}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  tableDiv.innerHTML = tableHtml;
  
  // Enable/disable import button
  if (importBtn) {
    importBtn.disabled = validCount === 0;
  }
}

// Download imported users CSV with usernames and passwords
function downloadImportedUsersCSV() {
  if (importedUsersData.length === 0) {
    showNotification('No imported users data available', 'error');
    return;
  }
  
  const headers = ['FirstName', 'LastName', 'DateOfBirth', 'Email', 'Phone', 'Role', 'InvestitureLevel', 'Username', 'Password'];
  
  // CSV escaping function
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Build CSV content
  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...importedUsersData.map(user => [
      user.FirstName,
      user.LastName,
      user.DateOfBirth,
      user.Email || '',
      user.Phone || '',
      user.Role,
      user.InvestitureLevel || 'None',
      user.Username,
      user.Password
    ].map(escapeCSV).join(','))
  ];
  
  const csvContent = csvLines.join('\n');
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().split('T')[0];
  a.download = `imported-users-${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  showNotification('Imported users CSV downloaded', 'success');
}

// Import valid users
async function importValidUsers() {
  if (!clubDirectorClubId || !clubDirectorSelectedEventId) {
    showNotification('Club or event information is missing', 'error');
    return;
  }
  
  const validUsers = parsedUsers.filter((_, index) => userValidations[index].valid);
  
  if (validUsers.length === 0) {
    showNotification('No valid users to import', 'error');
    return;
  }
  
  const importBtn = document.getElementById('importValidUsersBtn');
  if (importBtn) {
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
  }
  
  // Clear previous import data
  importedUsersData = [];
  
  let successCount = 0;
  let failureCount = 0;
  const failures = [];
  
  // Fetch existing users again before import to check for duplicates
  const existingUsersResponse = await fetchWithAuth('/api/users');
  const existingUsers = existingUsersResponse.ok ? await existingUsersResponse.json() : [];
  const existingUsernames = new Set(existingUsers.map(u => u.Username));
  
  for (let i = 0; i < validUsers.length; i++) {
    const user = validUsers[i];
    
    // Check for duplicate username before importing
    const baseUsername = `${user.FirstName.trim().toLowerCase()}.${user.LastName.trim().toLowerCase()}`;
    if (existingUsernames.has(baseUsername)) {
      failureCount++;
      failures.push({
        name: `${user.FirstName} ${user.LastName}`,
        error: 'Username already exists (duplicate first/last name combination)'
      });
      continue;
    }
    
    const userData = {
      FirstName: user.FirstName.trim(),
      LastName: user.LastName.trim(),
      DateOfBirth: user.DateOfBirth.trim(),
      Email: user.Email ? user.Email.trim() : null,
      Phone: user.Phone ? user.Phone.trim() : null,
      Role: user.Role.trim(),
      InvestitureLevel: (user.InvestitureLevel && user.InvestitureLevel.trim()) || 'None',
      ClubID: clubDirectorClubId,
      EventID: clubDirectorSelectedEventId,
      Password: 'password123',
      Active: true,
      BackgroundCheck: false
    };
    
    try {
      const response = await fetchWithAuth('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        successCount++;
        // Store imported user data with username and password
        importedUsersData.push({
          FirstName: user.FirstName.trim(),
          LastName: user.LastName.trim(),
          DateOfBirth: user.DateOfBirth.trim(),
          Email: user.Email ? user.Email.trim() : '',
          Phone: user.Phone ? user.Phone.trim() : '',
          Role: user.Role.trim(),
          InvestitureLevel: (user.InvestitureLevel && user.InvestitureLevel.trim()) || 'None',
          Username: result.Username || baseUsername,
          Password: 'password123'
        });
        // Add to existing usernames set to prevent duplicates in same batch
        existingUsernames.add(result.Username || baseUsername);
      } else {
        failureCount++;
        failures.push({
          name: `${user.FirstName} ${user.LastName}`,
          error: result.error || 'Unknown error'
        });
      }
    } catch (error) {
      failureCount++;
      failures.push({
        name: `${user.FirstName} ${user.LastName}`,
        error: error.message || 'Network error'
      });
    }
  }
  
  // Reset button
  if (importBtn) {
    importBtn.disabled = false;
    importBtn.textContent = 'Import Valid Users';
  }
  
  // Show results
  let message = `Import complete: ${successCount} user${successCount !== 1 ? 's' : ''} imported successfully`;
  if (failureCount > 0) {
    message += `, ${failureCount} failed`;
    if (failures.length > 0) {
      const failureDetails = failures.map(f => `${f.name}: ${f.error}`).join('; ');
      message += `. Failures: ${failureDetails}`;
    }
  }
  
  showNotification(message, failureCount > 0 ? 'error' : 'success');
  
  // Refresh users list
  await loadUsers();
  
  // Show download button if users were imported
  if (successCount > 0) {
    const previewDiv = document.getElementById('importPreview');
    if (previewDiv) {
      const downloadBtn = document.getElementById('downloadImportedUsersBtn');
      if (!downloadBtn) {
        const downloadButton = document.createElement('button');
        downloadButton.id = 'downloadImportedUsersBtn';
        downloadButton.className = 'btn btn-success';
        downloadButton.style.marginLeft = '10px';
        downloadButton.textContent = 'Download Imported Users CSV';
        downloadButton.onclick = downloadImportedUsersCSV;
        const importBtnContainer = importBtn.parentElement;
        if (importBtnContainer) {
          importBtnContainer.appendChild(downloadButton);
        }
      }
    }
  }
  
  // Clear preview after a delay to allow download
  // Don't clear immediately so user can download CSV
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
    const storedEventId = parseInt(localStorage.getItem('clubDirectorSelectedEventId') || '', 10);
    const activeEvent = clubDirectorEvents.find(e => e.Active);
    const storedEvent = clubDirectorEvents.find(e => e.ID === storedEventId);
    const fallbackEvent = activeEvent || clubDirectorEvents[0];
    
    clubDirectorEventId = fallbackEvent.ID;
    clubDirectorSelectedEventId = storedEvent ? storedEvent.ID : fallbackEvent.ID;
  }
  
  // Setup event selector UI (even if no events, to show message)
  setupEventSelector();

  // Check event status and show banner if closed
  await checkEventStatus();
  
  // Load data
  await loadUsers();
  
  // Render summary section
  await renderSummarySection();
  
  // Override functions - expose to window so they can be called from HTML
  window.switchTab = clubdirectorSwitchTab;
  window.toggleSummarySection = toggleSummarySection;
  window.showCreateUserForm = showCreateUserFormClubDirector;
  window.editUser = editUserClubDirector;
  window.showCreateClassForm = showCreateClassFormClubDirector;
  window.switchClubDirectorEvent = switchClubDirectorEvent;
  window.generateSampleCSV = generateSampleCSV;
  window.importValidUsers = importValidUsers;
  window.downloadImportedUsersCSV = downloadImportedUsersCSV;
  window.loadMyClassRoster = loadMyClassRoster;
  window.updateMyClassAttendance = updateMyClassAttendance;
  
  // Restore last active tab or default to users
  const savedTab = localStorage.getItem('directorCurrentTab') || 'users';
  await window.switchTab(savedTab);

  // Override editClass to use clubDirectorClasses array
  window.editClass = async function editClassClubDirector(classId) {
    const cls = clubDirectorClasses.find(c => c.ID === classId);
    if (!cls) return;
    
    const eventId = clubDirectorSelectedEventId;
    
    // Load honors, teachers, locations for dropdowns
    const [honorsRes, locationsRes, teachersRes, staffRes, directorsRes] = await Promise.all([
      fetchWithAuth('/api/classes/honors'),
      fetchWithAuth(`/api/events/${eventId}/locations`),
      fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=Teacher&eventId=${eventId}&active=1`),
      fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=Staff&eventId=${eventId}&active=1`),
      fetchWithAuth(`/api/users?clubId=${clubDirectorClubId}&role=ClubDirector&eventId=${eventId}&active=1`)
    ]);
    
    const honors = await honorsRes.json();
    const locations = await locationsRes.json();
    const teachers = await teachersRes.json();
    const staff = await staffRes.json();
    const directors = await directorsRes.json();
    // Merge teachers, staff, and club directors for teacher selection
    const allTeachers = [...teachers, ...staff, ...directors].sort((a, b) => {
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
              ${allTeachers.map(t => `<option value="${t.ID}" ${cls.TeacherID === t.ID ? 'selected' : ''}>${t.FirstName} ${t.LastName}</option>`).join('')}
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
    
    // Handle form submission
    document.getElementById('editClassForm').onsubmit = async function(e) {
      e.preventDefault();
      const form = e.target;
      
      // Club Directors can only edit TeacherID, TeacherMaxStudents, and MinimumLevel
      const classData = {
        TeacherID: form.editClassTeacher?.value || null,
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
    
    const selectedTimeslots = Array.from(form.querySelectorAll('input[name="classTimeslots"]:checked')).map(cb => parseInt(cb.value));
    const isMultiSession = form.isMultiSession?.checked || false;
    
    if (selectedTimeslots.length === 0) {
      showNotification('Please select at least one timeslot for this class', 'error');
      return;
    }
    
    // Validate multi-session selection
    if (isMultiSession && selectedTimeslots.length < 2) {
      showNotification('Multi-session classes require at least 2 timeslots', 'error');
      return;
    }
    
    const classData = {
      EventID: clubDirectorSelectedEventId, // Use the director's event
      HonorID: form.classHonor?.value,
      ClubID: clubDirectorClubId, // Use the director's club
      TeacherID: form.classTeacher?.value || null, // Teacher is optional
      LocationID: null, // Club Directors don't set location - admins do this
      TeacherMaxStudents: parseInt(form.classMaxCapacity?.value) || 0,
      MinimumLevel: form.classMinimumLevel?.value || null,
      TimeslotIDs: selectedTimeslots,
      isMultiSession: isMultiSession
    };
    
    if (!classData.HonorID || !classData.TeacherMaxStudents) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create class');
      }
      
      if (isMultiSession) {
        showNotification(`Created multi-session class with ${result.classes?.length || selectedTimeslots.length} sessions. Admin will assign location later.`, 'success');
      } else {
        showNotification(`Created ${result.classes?.length || 1} class(es) successfully. Admin will assign location later.`, 'success');
      }
      
      closeModal('createClassModal');
      await renderClasses(); // Reload classes list
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
    // Expose immediately so it's available
    window.renderCodes = renderCodes;
    
    const container = document.getElementById('codesList');
    if (!container) {
      console.error('Codes list container not found');
      return;
    }
    
    console.log('[ClubDirector] renderCodes for event', clubDirectorSelectedEventId, 'clubId:', clubDirectorClubId);
    
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
      console.log('[ClubDirector] Fetching codes from:', `/api/codes/club/${clubDirectorClubId}?eventId=${clubDirectorSelectedEventId}`);
      const response = await fetchWithAuth(`/api/codes/club/${clubDirectorClubId}?eventId=${clubDirectorSelectedEventId}`);
      
      console.log('[ClubDirector] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ClubDirector] Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to load codes' };
        }
        const errorMsg = errorData.error || `Server error: ${response.status}`;
        container.innerHTML = `<p class="text-center" style="color: red;">Error loading codes: ${errorMsg}</p>`;
        showNotification('Error loading codes: ' + errorMsg, 'error');
        return;
      }
      
      const codes = await response.json();
      console.log('[ClubDirector] Codes response:', codes);
      
      if (!Array.isArray(codes)) {
        console.error('[ClubDirector] Invalid response format:', codes);
        container.innerHTML = '<p class="text-center" style="color: red;">Invalid response format from server</p>';
        showNotification('Invalid response format from server', 'error');
        return;
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
      console.error('[ClubDirector] Error loading codes:', error);
      const errorMsg = error.message || 'Unknown error occurred';
      container.innerHTML = `<p class="text-center" style="color: red;">Error loading codes: ${errorMsg}</p><p class="text-center" style="margin-top: 10px;"><button onclick="window.generateRegistrationCode && window.generateRegistrationCode()" class="btn btn-primary">Generate New Code</button></p>`;
      showNotification('Error loading codes: ' + errorMsg, 'error');
    }
  }

  async function generateRegistrationCode() {
    // Expose immediately so it's available
    window.generateRegistrationCode = generateRegistrationCode;
    
    console.log('[ClubDirector] generateRegistrationCode called');
    console.log('[ClubDirector] clubDirectorEvents:', clubDirectorEvents.length);
    console.log('[ClubDirector] clubDirectorSelectedEventId:', clubDirectorSelectedEventId);
    console.log('[ClubDirector] clubDirectorClubId:', clubDirectorClubId);
    
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
    // Get current site URL with code parameter
    const registrationUrl = window.location.origin + '/register.html?code=' + encodeURIComponent(code);
    
    // Get event info for the email
    const currentEvent = clubDirectorEvents.find(e => e.ID === parseInt(clubDirectorSelectedEventId));
    const eventName = currentEvent ? currentEvent.Name : 'Event';
    
    const emailSubject = `Registration Code for ${eventName}`;
    
    const emailBody = `Hello,

You have been invited to register for ${eventName}.

REGISTRATION CODE: ${code}

TO REGISTER:
1. Click this link: ${registrationUrl}
   (The registration code will be automatically filled in)
2. Fill out the registration form
3. Submit your registration

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
          
          <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
            <button onclick="copyCodeEmail('${code}', '${registrationUrl}')" class="btn btn-primary" style="flex: 1; min-width: 200px;">
              📋 Copy Full Email to Clipboard
            </button>
            <button onclick="copyRegistrationLink('${registrationUrl}')" class="btn btn-secondary" style="flex: 1; min-width: 200px;">
              🔗 Copy Registration Link (with code)
            </button>
            <button onclick="closeClubDirectorModal('codeEmailModal')" class="btn btn-outline" style="flex: 1; min-width: 200px;">
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
  
  function copyRegistrationLink(registrationUrl) {
    navigator.clipboard.writeText(registrationUrl).then(() => {
      showNotification('Registration link copied to clipboard!', 'success');
    }).catch(() => {
      showNotification('Failed to copy link', 'error');
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
    window.shareRegistrationCode = shareRegistrationCode;
    showCodeEmailModal(code);
  }
  
  // Delete registration code
  async function deleteRegistrationCode(code) {
    window.deleteRegistrationCode = deleteRegistrationCode;
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
  
  // Expose registration code functions globally - must be after function definitions
  window.renderCodes = renderCodes;
  window.generateRegistrationCode = generateRegistrationCode;
  window.shareRegistrationCode = shareRegistrationCode;
  window.deleteRegistrationCode = deleteRegistrationCode;
  
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
  window.debouncedUpdateClubDirectorFilter = debouncedUpdateClubDirectorFilter;
  window.renderUsers = renderUsers;
  window.copyCodeEmail = copyCodeEmail;
  window.copyRegistrationLink = copyRegistrationLink;
  window.closeClubDirectorModal = closeClubDirectorModal;
  window.closeModal = closeModal;
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
      selector.innerHTML = '';
      clubDirectorEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event.ID;
        option.textContent = `${event.Name} ${event.Active ? '' : '(Inactive)'}`;
        if (event.ID === clubDirectorSelectedEventId) {
          option.selected = true;
        }
        selector.appendChild(option);
      });
      const selectedEvent = clubDirectorEvents.find(e => e.ID === clubDirectorSelectedEventId);
      eventNameEl.textContent = selectedEvent ? selectedEvent.Name : '';
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
    
    console.log('[ClubDirector] Switching to event', selectedEvent);
    
    clubDirectorSelectedEventId = eventIdInt;
    clubDirectorEventId = clubDirectorSelectedEventId;
    
    // Update UI
    setupEventSelector();
    
    // Reload summary section for new event
    await renderSummarySection();
    
    // Reload data for the selected event based on current tab
    switch (clubDirectorTab) {
      case 'classes':
        await renderClasses();
        break;
      case 'codes':
        await renderCodes();
        break;
      case 'import':
        // Reload import tab with new event context
        const importContent = document.getElementById('content');
        if (importContent) {
          importContent.innerHTML = getImportTab();
          // Re-setup file upload handler
          setTimeout(() => {
            setupCSVFileInput();
          }, 0);
        }
        setupEventSelector();
        break;
      case 'reports':
        // Reload reports tab with new event context
        const content = document.getElementById('content');
        if (content) {
          content.innerHTML = getReportsTab();
        }
        setupEventSelector();
        break;
      case 'checkin':
        if (typeof checkInLoadParticipants === 'function') {
          await checkInLoadParticipants();
        }
        break;
      // 'users' tab doesn't need to reload on event switch
    }
    
    try {
      localStorage.setItem('clubDirectorSelectedEventId', clubDirectorSelectedEventId);
    } catch (error) {
      console.warn('Unable to persist selected event:', error);
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

