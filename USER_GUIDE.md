# Honors Festival Management System - User Guide

## Table of Contents
1. [Overview](#overview)
2. [Logging In](#logging-in)
3. [Admin Dashboard](#admin-dashboard)
4. [Event Admin Dashboard](#event-admin-dashboard)
5. [Club Director Dashboard](#club-director-dashboard)
6. [Teacher Dashboard](#teacher-dashboard)
7. [Student Dashboard](#student-dashboard)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Honors Festival Management System is a comprehensive platform for managing honors festivals, including events, classes, registrations, users, and more. Each user role has access to specific features and data based on their permissions.

### User Roles

- **Admin**: Full system access with all permissions
- **EventAdmin**: Manages a specific assigned event
- **ClubDirector**: Manages their club's students and classes
- **Teacher**: Views and manages their assigned classes
- **Student**: Views and registers for classes
- **Staff**: Similar to Student, views and registers for classes

---

## Logging In

### First-Time Login

1. Navigate to the login page
2. Enter your **Username** (provided by your administrator)
3. Enter your **Password** (provided by your administrator or set during registration)
4. Click **Login**

### Password Reset

If you've forgotten your password:

1. Click **"Forgot Password?"** on the login page
2. Enter your email address
3. Check your email for a password reset link
4. Click the link and follow the instructions to set a new password

### Email Magic Link Login (Stytch Users)

1. On the login page, click the **"Email Magic Link"** tab
2. Enter your email address
3. Click **Send Magic Link**
4. Check your email and click the link to log in automatically

---

## Admin Dashboard

**Access Level**: Full system access

**Who Should Use This**: System administrators who need to manage all events, users, clubs, classes, and system settings.

### Dashboard Overview

The Admin Dashboard provides complete control over the Honors Festival system, including:

- **Events Management**: Create and manage all events
- **User Management**: Create, edit, and manage all users
- **Class Locations**: Manage event locations
- **Timeslots**: Create and manage class timeslots
- **Clubs Management**: Create and manage all clubs and their event associations
- **Classes Management**: View and manage all classes across all events
- **Reports**: Generate comprehensive CSV reports
- **Check-In**: Check in any participant for any event
- **System Administration**: Database reset and reseed (use with caution!)

### Features by Tab

#### Events Tab

**View Events**
- See all events in the system
- View event status (Active/Inactive, Live/Closed)
- See associated clubs, classes, and registrations

**Create New Event**
1. Click **"Create New Event"** button
2. Fill in required fields:
   - Event Name
   - Start Date
   - End Date
   - Coordinator Name
   - Description (optional)
   - Address (optional)
3. Set event status:
   - **Event Active**: Must be checked for the event to be visible to clubs/participants
   - **Status**: Choose "Live" (registration open) or "Closed" (registration closed)
4. Click **Create Event**

**Manage Event Status**
- **Event Open/Closed Button**: Toggles whether the event is active and visible
  - When closed, registration automatically closes
  - When opened, registration remains closed until explicitly opened
- **Class Registration Open/Closed Button**: Toggles whether class registration is open
- **Edit Button**: Modify event details

**Manage Clubs for Event**
1. Click **"Manage Clubs"** button on any event
2. View all clubs associated with this event
3. Add existing clubs or create new clubs
4. Remove clubs from the event

#### Users Tab

**View All Users**
- See all users across all events and clubs
- Filter by role, name, email, club, age, active status, and background check
- Sort by any column
- Toggle to show/hide deactivated users

**Create User**
1. Click **"Add User"** button
2. Fill in required fields:
   - First Name, Last Name
   - Date of Birth
   - Role
   - Email (optional)
   - Phone (optional)
   - Password
3. For specific roles:
   - **Admin, EventAdmin, ClubDirector**: Use **"Invite User"** button instead
     - System generates an invite code
     - User must accept invite to complete registration
     - Invited users appear in the list with blue text and "(Invited)" label
4. Click **Create User** or **Invite User**

**Edit User**
1. Find the user in the list
2. Click **"Edit"** button
3. Modify any fields
4. Click **Save**

**Deactivate/Activate User**
1. Find the user in the list
2. Click **"Deactivate"** or **"Activate"** button
3. Confirm the action

**Resend Invite** (for Admin, EventAdmin, ClubDirector roles)
1. Find the invited user (blue text with "(Invited)" label)
2. Click **"Resend Invite"** button
3. Copy the invite code or email template to send to the user

#### Class Locations Tab

**View Locations**
- See all locations across all events
- Filter by event using dropdown

**Create Location**
1. Select an event from the dropdown
2. Click **"Create Location"** button
3. Fill in:
   - Location Name
   - Description
   - Maximum Capacity
4. Click **Create**

**Edit Location**
1. Find the location in the list
2. Click **"Edit"** button
3. Modify details
4. Click **Save**

#### Timeslots Tab

**View Timeslots**
- See all timeslots across all events
- Filter by event using dropdown

**Create Timeslot**
1. Select an event from the dropdown
2. Click **"Create Timeslot"** button
3. Fill in:
   - Date
   - Start Time
   - End Time
4. Click **Create**

**Edit Timeslot**
1. Find the timeslot in the list
2. Click **"Edit"** button
3. Modify details
4. Click **Save**

#### Clubs Tab

**View All Clubs**
- See all clubs in the system
- View associated events for each club
- See club director and church information

**Manage Clubs for Event**
1. Go to **Events** tab
2. Click **"Manage Clubs"** button on an event
3. Add existing clubs or create new clubs
4. Remove clubs from the event

#### Classes Tab

**View All Classes**
- See all classes across all events
- Filter by event using dropdown
- View class capacity (Enrolled/Waitlist/Max)
- See active and inactive classes

**Create Class**
1. Select an event from the dropdown
2. Click **"Create Class"** button
3. Fill in:
   - Honor (subject)
   - Teacher
   - Location
   - Timeslot
   - Maximum Capacity
   - Teacher Max Students
4. Click **Create**

**Edit Class**
1. Find the class in the list
2. Click **"Edit"** button
3. Modify details
4. Click **Save**

**Manage Students in Class**
1. Find the class in the list
2. Click **"Manage Students"** button
3. View enrolled and waitlisted students
4. Add students to the class
5. Remove students from the class
6. Move students from waitlist to enrolled (if space available)

**Activate/Deactivate Class**
1. Find the class in the list
2. Click **"Activate"** or **"Deactivate"** button
3. Confirm the action

#### Reports Tab

**Generate Event Report**
1. Select an event from the dropdown
2. Click **"Generate CSV Report"** button
3. Report downloads automatically
4. Contains all registrations, classes, and student information for the event

#### Check-In Tab

**Check In Participants**
1. Select an event from the dropdown
2. View all participants for that event
3. Filter by check-in number using the search box
4. For each participant:
   - Check **"Checked In"** checkbox to mark as checked in
   - For users 18+, check **"Background Check"** checkbox if completed
5. Click **"View Details"** for full participant information

**Features**:
- Real-time filtering by check-in number
- Mobile-responsive view
- View participant details in modal

#### System Tab

**Reset & Reseed Database**
⚠️ **WARNING**: This will delete ALL data!

1. Read the warning message carefully
2. Click **"Reset & Reseed Database"** button
3. Confirm the action
4. All data will be deleted and replaced with fresh test data
5. You will need to log in again after reset

---

## Event Admin Dashboard

**Access Level**: Limited to assigned event

**Who Should Use This**: Event coordinators who manage a specific event

### Dashboard Overview

The Event Admin Dashboard provides complete control over a single assigned event, including:

- **Event Management**: View and manage the assigned event
- **User Management**: Create and manage users for the assigned event
- **Class Locations**: Manage locations for the assigned event
- **Timeslots**: Create and manage timeslots for the assigned event
- **Clubs Management**: View clubs associated with the assigned event
- **Classes Management**: View and manage classes for the assigned event
- **Reports**: Generate reports for the assigned event
- **Check-In**: Check in participants for the assigned event

### Features by Tab

#### Events Tab

**View Assigned Event**
- See details of your assigned event
- View event status
- Event selection is disabled (you can only manage your assigned event)

**Edit Event** (Limited)
- Basic event details editing (coordinate with Admin for major changes)

#### Users Tab

**View Users**
- See all users associated with your assigned event
- Filter by role, name, email, club, age, active status
- Toggle to show/hide deactivated users

**Create User**
1. Click **"Add User"** button
2. Fill in required fields (same as Admin)
3. For Admin, EventAdmin, or ClubDirector roles: Use **"Invite User"** button
4. User is automatically associated with your assigned event

**Manage Users**
- Edit user details
- Activate/deactivate users
- Resend invites for privileged roles

#### Class Locations Tab

**View Locations**
- See all locations for your assigned event

**Create Location**
- Same process as Admin, but automatically uses your assigned event

#### Timeslots Tab

**View Timeslots**
- See all timeslots for your assigned event

**Create Timeslot**
- Same process as Admin, but automatically uses your assigned event

#### Clubs Tab

**View Clubs**
- See all clubs associated with your assigned event
- View club details and directors

**Note**: You cannot add/remove clubs (coordinate with Admin)

#### Classes Tab

**View Classes**
- See all classes for your assigned event
- View class capacity and enrollment

**Create Class**
- Same process as Admin, but automatically uses your assigned event

**Manage Students**
- Add/remove students from classes
- Manage waitlists

#### Reports Tab

**Generate Event Report**
- Automatically generates report for your assigned event
- Click **"Generate CSV Report"** button

#### Check-In Tab

**Check In Participants**
1. View all participants for your assigned event
2. Filter by check-in number
3. Mark participants as checked in
4. Mark background checks for users 18+

---

## Club Director Dashboard

**Access Level**: Limited to own club

**Who Should Use This**: Club directors who manage their club's students, classes, and registrations

### Dashboard Overview

The Club Director Dashboard provides management tools for your club, including:

- **User Management**: Create and manage users in your club
- **Classes Management**: Create and manage classes for your club (for assigned events)
- **Registration Codes**: Generate registration codes for new students
- **Check-In**: Check in students from your club
- **Reports**: Generate reports for your club

### Event Selection

If your club is associated with multiple events:
- An event selector dropdown appears at the top
- Select the event you want to work with
- All tabs will show data for the selected event

If your club has no events:
- A warning banner appears
- Contact an administrator to be assigned to an event

### Features by Tab

#### Users Tab

**View Club Users**
- See all users (students, teachers, staff) in your club
- Filter and sort by various criteria
- View user details and edit

**Create User**
1. Click **"Add User"** button
2. Fill in required fields:
   - First Name, Last Name
   - Date of Birth
   - Role (Student, Teacher, or Staff only)
   - Email, Phone (optional)
   - Password
   - Investiture Level
3. User is automatically associated with your club and the selected event
4. Click **Create User**

**Edit User**
- Edit users in your club
- Cannot change user's club association

#### Classes Tab

**View Classes**
- See all active classes for the selected event
- View classes you created
- See class capacity and enrollment

**Create Class**
1. Ensure an event is selected
2. Click **"Create Class"** button
3. Fill in:
   - Honor (subject)
   - Teacher (must be from your club)
   - Location
   - Timeslot
   - Maximum Capacity
4. Click **Create**

**Manage Students in Your Classes**
1. Find a class you created
2. Click **"Manage Students"** button
3. Add students from your club to the class
4. Remove students if needed
5. Manage waitlists

**Edit Class**
- Edit classes you created
- Cannot edit classes created by others

#### Registration Codes Tab

**View Registration Codes**
- See all registration codes generated for your club
- View code status (used/unused) and expiration dates

**Generate Registration Code**
1. Ensure an event is selected
2. Click **"Generate New Code"** button
3. Code is generated with:
   - Unique code
   - Expiration date (30 days default)
   - Associated with your club and selected event
4. Share the code with new students
5. Use the email template to send invitation email

**Features**:
- Copy code to clipboard
- Copy registration URL
- Copy email template
- View code details

#### Check-In Tab

**Check In Your Students**
1. Ensure an event is selected
2. View all students from your club for the selected event
3. Filter by check-in number
4. Check the **"Checked In"** checkbox for each student
5. For students 18+, mark background check if completed

**Note**: You can only see and check in students from your own club

#### Reports Tab

**Generate Club Report**
1. Ensure an event is selected
2. Click **"Generate CSV Report"** button
3. Report contains:
   - All students from your club
   - Their class registrations
   - Check-in status
   - For the selected event only

---

## Teacher Dashboard

**Access Level**: Limited to own classes

**Who Should Use This**: Teachers who need to view and manage their class rosters

### Dashboard Overview

The Teacher Dashboard provides tools to manage your assigned classes:

- **View Classes**: See all classes you are teaching
- **View Rosters**: See students enrolled in your classes
- **Class Information**: View class details including location, timeslot, and capacity

### Features

#### View Your Classes

1. Upon login, you'll see a list of all classes assigned to you
2. Each class shows:
   - Honor name (subject)
   - Location
   - Date and time
   - Enrollment status (enrolled/waitlist counts)
   - Capacity

#### View Class Roster

1. Select a class from the dropdown
2. View the roster showing:
   - Student name
   - Club name
   - Investiture level
   - Registration status (Enrolled/Waitlisted)
3. Export roster if needed

#### Class Details

- View full class information
- See all enrolled students
- See waitlisted students (if applicable)
- View capacity and enrollment numbers

---

## Student Dashboard

**Access Level**: Personal data only

**Who Should Use This**: Students who want to register for classes and view their schedule

### Dashboard Overview

The Student Dashboard allows you to:

- **View Available Classes**: Browse classes available for registration
- **Register for Classes**: Register for classes you want to attend
- **View Your Schedule**: See all classes you're registered for
- **Remove Registrations**: Drop classes if needed (if registration is open)

### Features

#### View Available Classes

1. Select an event (if multiple events available)
2. Browse classes organized by honor/subject
3. View class details:
   - Teacher name
   - Location
   - Date and time
   - Available spots
   - Waitlist status

4. Filter classes:
   - By honor/subject category
   - By available capacity
   - By timeslot

#### Register for Classes

1. Find a class you want to register for
2. Click **"Register"** button
3. If class is full, you'll be added to the waitlist
4. If space is available, you'll be enrolled immediately
5. Your registration appears in "My Registrations"

#### View Your Schedule

1. Scroll to "My Registrations" section
2. View all classes you're enrolled in
3. See:
   - Class name and honor
   - Date and time
   - Location
   - Teacher
   - Status (Enrolled or Waitlisted)

#### Remove Registration

1. Find the class in "My Registrations"
2. Click **"Remove"** button
3. Confirm removal
4. **Note**: Cannot remove if event registration is closed

#### Important Notes

- Registration is only open when the event status is "Live"
- You cannot register for classes with conflicting timeslots
- You may be on a waitlist if a class is full
- Contact your club director if you need help with registration

---

## Common Tasks

### Changing Your Password

**For Stytch Users**:
1. Click "Forgot Password?" on login page
2. Enter your email
3. Follow the link in your email

**For Local Users**:
- Contact your administrator to reset your password

### Registering a New Student

**Club Directors**:
1. Generate a registration code (Registration Codes tab)
2. Share the code with the new student
3. Student uses the code on the registration page
4. Student completes registration with password
5. Student can then log in and register for classes

### Checking In Participants

**Admin/EventAdmin**:
1. Go to Check-In tab
2. Select event (Admin only)
3. Filter by check-in number if needed
4. Check boxes for checked-in status and background checks

**Club Directors**:
1. Go to Check-In tab
2. View only your club's students
3. Check in students as they arrive

### Managing Waitlists

**Club Directors/Admins**:
1. Go to Classes tab
2. Click "Manage Students" on a class
3. View waitlist
4. When space becomes available, manually move students from waitlist to enrolled
5. Or remove students from enrolled to create space

---

## Troubleshooting

### Cannot Log In

- **Check username and password**: Make sure you're using the correct credentials
- **Forgot password**: Use the "Forgot Password?" link
- **Account deactivated**: Contact your administrator
- **Browser cache**: Try clearing your browser cache and cookies

### Cannot See Expected Data

- **Event status**: Check if the event is "Active"
- **Registration status**: Check if registration is "Live"
- **Role permissions**: Make sure you're logged in with the correct role
- **Event selection**: Ensure you've selected the correct event (Club Directors)

### Registration Not Working

- **Event closed**: Registration may be closed for the event
- **Class full**: Class may be at capacity (you'll be added to waitlist)
- **Conflicting timeslot**: You may already be registered for a class at that time
- **Not in assigned event**: Make sure you're trying to register for the correct event

### Check-In Issues

- **Event not selected**: Make sure an event is selected (Admin only)
- **Club filter**: Club Directors only see students from their own club
- **Check-in number not found**: Verify the number is correct

### Dashboard Access Issues

- **Wrong dashboard**: Each role has their own dashboard - you'll be automatically redirected
- **No permissions**: Contact your administrator if you think you should have access
- **Browser issues**: Try a different browser or clear cache

### Need Help?

- **Technical issues**: Contact your system administrator
- **Registration questions**: Contact your club director
- **Account issues**: Contact your event administrator or system administrator

---

## Best Practices

### For Administrators

- Regularly review and update user accounts
- Monitor event status and registration periods
- Generate reports before and after events
- Keep backup of important data
- Use the system logs to track changes

### For Event Admins

- Coordinate with administrators for major changes
- Monitor class enrollment and capacity
- Generate reports regularly during events
- Communicate with club directors about event status

### For Club Directors

- Keep user information up-to-date
- Generate registration codes in advance
- Monitor student registrations
- Check in students promptly on event day
- Review reports to ensure accuracy

### For Teachers

- Review class rosters before the event
- Contact administrators about capacity issues
- Report any discrepancies in enrollment

### For Students

- Register for classes early to secure spots
- Review your schedule regularly
- Contact your club director if you need to drop a class
- Arrive on time for check-in on event day

---

## Security Notes

- Never share your login credentials
- Log out when finished using the system
- Use strong passwords
- Report any suspicious activity to your administrator
- The system automatically logs you out after periods of inactivity

---

**Version**: 1.0  
**Last Updated**: 2025  
**For questions or support, contact your system administrator.**

