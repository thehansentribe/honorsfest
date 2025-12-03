# How to Use the System - Event Admin Guide

## Overview
As an **Event Admin**, you have access to manage all aspects of a specific event you're assigned to. Your dashboard is automatically scoped to your assigned event, and you can manage users, clubs, timeslots, classes, check-ins, and reports for that event.

## Getting Started

### Logging In
1. Navigate to the login page
2. Enter your username and password
3. Click "Login"
4. You'll be automatically redirected to the Event Admin Dashboard
5. Your assigned event is automatically selected and displayed

### Dashboard Overview
The Event Admin Dashboard has the following tabs:
- **Events** - View event details (read-only for your assigned event)
- **Users** - Manage users for your event
- **Clubs** - Manage clubs participating in your event
- **Timeslots** - Manage timeslots for your event
- **Classes** - Manage classes for your event
- **Check-In** - Check in participants at your event
- **Reports** - Generate reports for your event
- **System** - View branding settings (read-only)

**Note**: Your assigned event is automatically selected and used throughout the dashboard.

## Tab-by-Tab Guide

### Events Tab

#### Viewing Event Details
- You can view your assigned event's details
- Event information includes: Name, Dates, Status, Coordinator, Location details
- You cannot edit the event itself (only full Admins can do this)

### Users Tab

#### Creating a New User
1. Click the **"Add User"** button
2. Fill in required fields:
   - **First Name** and **Last Name**: Required
   - **Date of Birth**: Required
   - **Email**: Required for Admin, EventAdmin, and ClubDirector roles; optional for Teacher, Student, and Staff
   - **Phone**: Optional
   - **Role**: Select from EventAdmin, ClubDirector, Teacher, Student, or Staff
   - **Event**: Automatically set to your assigned event (for EventAdmin, Student, Teacher roles)
   - **Club**: Optional for Student, Teacher, Staff; required for ClubDirector
   - **Investiture Level**: Select from available options
   - **Password**: Leave blank to use default "password123" (local users only)
3. Click **"Create User"**

**Note**: Users created here are automatically associated with your event.

#### Editing a User
1. Find the user in the users list
2. Click **"Edit"** button
3. Make changes:
   - For **Local users**: You'll see "(Local)" and can change password directly
   - For **Stytch users**: Password changes must be done through Stytch's password reset
   - Changing email for Stytch users sends a verification email
4. Click **"Update User"**

#### User Management Tips
- Use filters to find users quickly
- Users must be associated with your event
- EventAdmin role cannot create other EventAdmins or full Admins

### Clubs Tab

#### Managing Clubs
- View all clubs participating in your event
- See club directors assigned to each club
- Link or unlink clubs to/from your event (done through Users tab when assigning Club Directors)

#### Club Director Assignment
1. Create or edit a user with ClubDirector role
2. Select a club from the dropdown
3. The club is automatically linked to your event

### Timeslots Tab

#### Creating Timeslots
1. Click **"Create Timeslot"** (your event is automatically selected)
2. Fill in:
   - **Date**: Date for this timeslot
   - **Start Time**: When the session begins (24-hour format, e.g., "09:00")
   - **End Time**: When the session ends (24-hour format, e.g., "11:30")
3. Click **"Create Timeslot"**

#### Managing Timeslots
- All timeslots you create are automatically for your assigned event
- Edit or delete timeslots as needed
- Multiple timeslots can be created for different sessions

### Classes Tab

#### Creating a Class
1. Click **"Create Class"** (your event is automatically selected)
2. Fill in required fields:
   - **Honor**: Select from the list of available honors
   - **Teacher**: Optional - can be assigned later
   - **Location**: Select a location for this class
   - **Timeslot**: Select when this class will be held (can select multiple for multi-session classes)
   - **Max Capacity**: Maximum number of students
3. Click **"Create Class"**

#### Managing Classes
- All classes are automatically for your assigned event
- Deactivate classes to remove all registrations
- Edit classes to update details, teacher, location, or capacity
- Classes show active/inactive status

### Check-In Tab

#### Checking In Participants
1. Your assigned event is automatically selected
2. The list shows all participants (students) for your event
3. Click **"Check In"** next to a participant's name
4. Check-in status is updated in real-time

**Features**:
- See check-in numbers for participants
- Filter and search participants
- Mark participants as checked in/out

### Reports Tab

#### Generating Reports
1. Your assigned event is automatically selected
2. Click **"Generate Report"** or **"Export CSV"**
3. Reports include:
   - Student Name
   - Club
   - Honor Name (Class)
   - Timeslot
   - Attended Status
   - Completed Status
   - Investiture Level

Reports can be exported as CSV files for further analysis.

### System Tab

#### Viewing Branding
- You can view the current site branding (logo and site name)
- You cannot modify branding settings (only Super Admins can)

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

**Note**: You cannot change your role or assigned event through your profile.

## Tips and Best Practices

1. **Event Scope**: Remember that everything you do is automatically scoped to your assigned event. You cannot manage other events.

2. **User Creation Order**:
   - Create Club Directors first (they manage their clubs)
   - Then create Teachers and Students
   - Teachers and Students should be assigned to clubs

3. **Class Setup**:
   - Create timeslots before creating classes
   - Assign locations to classes
   - Teachers can be assigned later if needed

4. **Capacity Management**:
   - Monitor class capacities
   - Deactivate classes that are no longer needed
   - Update capacities if location or teacher changes

5. **Check-In Process**:
   - Check in participants as they arrive
   - Check-in status is used for attendance reports
   - Club Directors can also check in their club members

## Differences from Admin Role

**What Event Admins CAN do:**
- Manage all aspects of their assigned event
- Create users for their event
- Create classes, timeslots
- Check in participants
- Generate reports for their event

**What Event Admins CANNOT do:**
- Create or edit events
- Access the System tab database controls
- Change branding settings
- Manage events they're not assigned to
- Create other EventAdmins or full Admins

## Troubleshooting

**Can't see my event:**
- Verify you're assigned to an event (contact Admin)
- Refresh the page
- Check your login credentials

**Users not showing:**
- Ensure users are associated with your event
- Check if users are active
- Verify users have appropriate roles

**Classes not appearing for students:**
- Verify event status is "Live" (contact Admin to change)
- Check if classes are Active
- Ensure students' clubs are linked to your event

## Support

For issues or questions:
1. Review this guide
2. Check system notifications for error messages
3. Contact the system Administrator if you need event status changes or access to additional features

---

**Last Updated**: Based on current system implementation


