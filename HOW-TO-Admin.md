# How to Use the System - Admin Guide

## Overview
As an **Admin**, you have full access to manage all aspects of the Honors Festival system. You can create and manage events, users, clubs, timeslots, locations, classes, check-ins, reports, and system settings.

## Getting Started

### Logging In
1. Navigate to the login page
2. Enter your username and password
3. Click "Login"
4. You'll be automatically redirected to the Admin Dashboard

### Dashboard Overview
The Admin Dashboard has the following tabs (in order):
- **Events** - Manage events
- **Users** - Manage all users
- **Clubs** - Manage clubs and club directors
- **Timeslots** - Manage timeslots for events
- **Locations** - Manage locations (venues) for events
- **Classes** - Manage classes
- **Check-In** - Check in participants at events
- **Reports** - Generate reports and export data
- **System** - System settings and database management (Super Admin only)

## Tab-by-Tab Guide

### Events Tab

#### Creating a New Event
1. Click the **"Create Event"** button
2. Fill in the required fields:
   - **Name**: Event name (e.g., "Spring 2024 Honors Festival")
   - **Start Date**: First day of the event
   - **End Date**: Last day of the event
   - **Coordinator Name**: Name of the event coordinator
   - **Description**: Optional event description
   - **Location Details**: Street, City, State, ZIP, Location Description
   - **Event Status**: 
     - **Closed**: Clubs can view classes but cannot register
     - **Live**: Clubs can view and register for classes
   - **Active**: Check to make the event visible, uncheck to hide it
   - **Custom Role Names**: Customize how role names appear for this event (optional)
3. Click **"Create Event"**

#### Editing an Event
1. Find the event in the events list
2. Click **"Edit"** button
3. Update any fields
4. Click **"Update Event"**

#### Event Status
- **Active**: Visible to clubs and participants
- **Inactive**: Hidden from clubs and participants (useful for archived events)
- **Status: Live**: Registration is open
- **Status: Closed**: Registration is closed, view-only mode

### Users Tab

#### Creating a New User
1. Click the **"Add User"** button
2. Fill in required fields:
   - **First Name** and **Last Name**: Required
   - **Date of Birth**: Required
   - **Email**: Required for Admin, EventAdmin, and ClubDirector roles; optional for Teacher, Student, and Staff
   - **Phone**: Optional
   - **Role**: Select from Admin, EventAdmin, ClubDirector, Teacher, Student, or Staff
   - **Event** (if applicable): Required for EventAdmin; optional for Student and Teacher
   - **Club** (if applicable): Required for ClubDirector; optional for Student, Teacher, and Staff
   - **Investiture Level**: Select from None, Friend, Companion, Explorer, Ranger, Voyager, Guide, MasterGuide
   - **Password**: Leave blank to use default "password123" (local users only)
3. Click **"Create User"**

**Note**: For Stytch users (external authentication), password cannot be set here - users must use Stytch's password reset feature.

#### Editing a User
1. Find the user in the users list
2. Click **"Edit"** button
3. Make changes:
   - For **Local users**: You'll see "(Local)" next to "Edit User" and can change password directly
   - For **Stytch users**: Password changes must be done through Stytch's password reset feature
   - Changing email for Stytch users will send a verification email to the new address
4. Click **"Update User"**

#### User Filters
- Click any column header to filter by that column
- Type in the filter boxes to search
- Filters work together (AND logic)

#### Deactivating a User
1. Find the user in the list
2. Click **"Deactivate"** button
3. Deactivated users are removed from all classes and cannot log in

### Clubs Tab

#### Creating a Club
1. Click the **"Create Club"** button
2. Fill in:
   - **Name**: Club name (required)
   - **Church**: Associated church name (optional)
   - **Director**: Select a Club Director from existing users (optional)
3. Click **"Create Club"**

#### Editing a Club
1. Find the club in the list
2. Click **"Edit"** button
3. Update club details or assign/change the director
4. Click **"Update Club"**

#### Linking Clubs to Events
1. Click **"Edit"** on a club
2. You'll see a summary of linked events
3. When assigning a director, the club can be linked to events through the Users tab

### Timeslots Tab

#### Creating Timeslots
1. Select an **Event** from the dropdown
2. Click **"Create Timeslot"**
3. Fill in:
   - **Date**: Date for this timeslot
   - **Start Time**: When the session begins (24-hour format, e.g., "09:00")
   - **End Time**: When the session ends (24-hour format, e.g., "11:30")
4. Click **"Create Timeslot"**

#### Managing Timeslots
- Timeslots are displayed in a table showing Date, Start Time, End Time
- You can edit or delete timeslots
- Multiple timeslots can be created for the same event

### Locations Tab

#### Creating Locations
1. Select an **Event** from the dropdown
2. Click **"Create Location"**
3. Fill in:
   - **Name**: Location name (e.g., "Room 101", "Main Hall")
   - **Max Capacity**: Maximum number of students this location can hold
   - **Description**: Optional description
4. Click **"Create Location"**

**Note**: Locations must be assigned to classes for them to have a physical location.

### Classes Tab

#### Creating a Class
1. Select an **Event** from the dropdown
2. Click **"Create Class"**
3. Fill in required fields:
   - **Honor**: Select from the list of available honors
   - **Teacher**: Optional - can be assigned later
   - **Location**: Select a location for this class
   - **Timeslot**: Select when this class will be held (can select multiple timeslots for multi-session classes)
   - **Max Capacity**: Maximum number of students (will be limited by location capacity)
4. Click **"Create Class"**

#### Managing Classes
- Classes show: Honor Name, Teacher, Location, Timeslot, Capacity, Active Status
- **Deactivate**: Removes all registrations and hides the class from students
- **Edit**: Update class details, teacher, location, or capacity
- You can filter classes by event

### Check-In Tab

#### Checking In Participants
1. Select an **Event** from the dropdown
2. The list shows all participants (students) for that event
3. Click **"Check In"** next to a participant's name
4. The check-in number (if assigned) and check-in status are displayed

**Note**: Check-in numbers are automatically assigned to users and displayed on their dashboards.

### Reports Tab

#### Generating Reports
1. Select an **Event** from the dropdown
2. Click **"Generate Report"** or **"Export CSV"**
3. Reports include:
   - Student Name
   - Club
   - Honor Name (Class)
   - Timeslot
   - Attended Status
   - Completed Status
   - Investiture Level

Reports can be exported as CSV files for further analysis in Excel or Google Sheets.

### System Tab (Super Admin Only)

**Note**: Only users with username "admin" or "jason.hansen" can access this tab.

#### Branding
1. **Site Name**: Customize the name displayed in the header (default: "Honors Festival")
2. **Logo**: Upload a logo image that appears in the upper left corner
   - Logo appears in front of the site name
   - Recommended: Square logo, transparent background

#### Database Management
1. **Reseed Database**: 
   - Resets the database and populates it with demo/test data
   - Creates admin user (username: "admin", password: "@dudlybob3X")
   - WARNING: This will delete all current data!
   
2. **Clear Live Data**:
   - Removes all operational data (users, events, registrations, etc.)
   - Keeps system settings and honors
   - Useful for preparing for a fresh "go live"
   - WARNING: This action cannot be undone!

## Profile Management

### Editing Your Own Profile
1. Click on your name in the top banner (it's underlined and clickable)
2. You can update:
   - First Name and Last Name
   - Email (for Stytch users, this sends a verification email)
   - Phone
   - Investiture Level
   - Password (local users only)
3. Click **"Update Profile"**

**Note**: For Stytch users, password changes must be done through Stytch's password reset feature on the login page.

## Tips and Best Practices

1. **Event Setup Order**: 
   - Create Event
   - Create Timeslots
   - Create Locations
   - Link Clubs to Events (through Users or Clubs tab)
   - Create Classes
   - Set Event Status to "Live" when ready

2. **User Management**:
   - Use filters to find users quickly
   - Email is required for Admin, EventAdmin, and ClubDirector roles
   - Teachers, Staff, and Students can be created without email addresses

3. **Class Capacity**:
   - Class capacity is limited by both the location's max capacity and the teacher's max students setting
   - The system automatically uses the lower of the two values

4. **Deactivation vs Deletion**:
   - Use "Deactivate" to temporarily disable users or classes
   - Deactivated users cannot log in and are removed from classes
   - Deactivated classes are hidden from students

5. **Multi-Event Clubs**:
   - Clubs can be linked to multiple events
   - Club Directors see all events their club is linked to
   - Students can switch between events they have access to

6. **Password Management**:
   - Local users (marked with "(Local)") can have passwords set directly
   - Stytch users must use Stytch's password reset feature
   - Check the user's authentication method in the edit screen

## Troubleshooting

**Users can't log in:**
- Check if user is Active (not deactivated)
- Verify user has correct role assigned
- For Stytch users, ensure they've completed email verification

**Classes not showing for students:**
- Verify event status is "Live" for registration
- Check if class is Active
- Ensure student's club is linked to the event

**Registration codes not working:**
- Registration codes are created by Club Directors
- Codes expire after the set number of days
- Each code can only be used once

## Support

For technical issues or questions:
1. Check this guide first
2. Review the system notifications for error messages
3. Contact system administrator if issues persist

---

**Last Updated**: Based on current system implementation


