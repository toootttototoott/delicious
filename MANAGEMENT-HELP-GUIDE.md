# Platform Management Help Guide

This guide is intended for management, operational, and rollout users who need to understand how to access and use the platform day to day.

## 1. What the Platform Does

The platform manages venue-based bookings across companies, establishments, and seat-count calendars.

It supports:

- Internal management logins with role-based access
- Booking calendar and day-by-day availability management
- Manual booking creation, editing, and cancellation
- Booking search and reporting
- Company, venue, and seat-count configuration
- Public booking widget and standalone booking page setup
- Admin-only AI-assisted theme editing for the widget and booking page

## 2. Access and User Roles

Users sign in with an email address and password.

The platform currently supports these permission levels:

- `admin`
  - Full access to users, settings, venues, booking tools, widget setup, widget/page styling, and system configuration
- `manager`
  - Venue-scoped access
  - Can manage bookings for their assigned establishment
  - Can run reports
  - Can create and manage staff users for their assigned establishment
  - Can close and reopen booking days
- `staff`
  - Venue-scoped access
  - Can work through day-to-day bookings and booking search for their assigned establishment
  - Cannot run reports
  - Cannot manage booking-day closures

## 3. Signing In

To access the platform:

1. Open the platform login page.
2. Enter your assigned email address and password.
3. After sign-in, the system will take you to the appropriate management view based on your role.

If a user forgets their password:

1. Select `Forgot password`.
2. Enter the email address linked to the account.
3. Open the password reset email.
4. Follow the reset link and choose a new password.

## 4. Main Navigation

Depending on role, users may see some or all of the following areas:

- `Settings`
  - Admin-only full management area
- `Widget`
  - Public booking widget preview
- `Widget Setup`
  - Admin area for selecting the live company, establishment, and seat-count source
- `Theme Editor`
  - Admin area for editing or generating booking widget CSS
- `Page View Editor`
  - Admin area for editing or generating the standalone booking page layout and CSS

Managers and staff are automatically directed to their scoped management workspace rather than the full admin area.

## 5. Daily Booking Workflow

This is the core process most operational users will follow.

### Start of Day

Recommended daily routine:

1. Sign in at the start of service.
2. Review today’s bookings and remaining availability.
3. Confirm any important notes or large bookings.
4. Update the calendar as calls, emails, or manual requests come through.

### Review the Calendar

The booking calendar is used to:

- View open dates and time slots
- See remaining seats by time
- Inspect booking load for the day
- Open the daily booking list

Users select:

- Company
- Establishment
- Seat-count calendar

The calendar then shows:

- Open and closed dates
- Bookable dates
- Availability by time slot
- Existing bookings on the selected day

### Create a Booking

To create a booking:

1. Open the required date in the booking calendar.
2. Select the time slot.
3. Enter:
   - Party size
   - First name
   - Last name
   - Email
   - Phone
   - Notes, if needed
4. Save the booking.

If email delivery is configured, a confirmation email can be sent automatically after the booking is created.

### Edit a Booking

To edit a booking:

1. Open the booking from the selected day or booking search.
2. Update the guest details, date, time, party size, or notes.
3. Save the changes.

### Cancel a Booking

To cancel a booking:

1. Open the booking record.
2. Delete the booking.
3. Confirm the action if prompted.

## 6. Searching for Existing Bookings

The booking workspace includes a search function to help staff and managers locate bookings quickly.

Search can be used to find bookings by guest details such as:

- Name
- Email
- Phone

This is useful when:

- A guest calls to make changes
- Staff need to confirm whether a booking already exists
- A team member needs to find a booking without manually browsing the calendar

## 7. Booking Reports

Booking reports are available to admins and managers.

Reports can be filtered by:

- Date range
- Time range
- Seat-count calendar

Preset ranges are available, including:

- Today
- This week
- This month

Reports are useful for:

- Reviewing booking volumes
- Estimating guest counts
- Comparing service periods
- Preparing operational staffing or venue planning

The report area also supports CSV export for sharing or offline review.

## 8. Closing or Reopening Booking Days

Admins and managers can stop bookings for a specific day where required.

This is useful for:

- Private events
- Public holidays
- Venue maintenance
- Operational capacity limits

To close a day:

1. Open the booking calendar.
2. Select the required date.
3. Use the close-day action.

To reopen a day:

1. Return to the selected date.
2. Use the reopen-day action.

Staff users do not have access to this control.

## 9. User and Access Management

### Admin Users

Admins can:

- Create users
- Edit users
- Delete users
- Assign roles
- Assign company and establishment access

### Manager Users

Managers can:

- Create staff users for their assigned establishment
- Edit staff users for that establishment
- Delete staff users for that establishment

Managers cannot create other managers or admins.

### Good Practice

For rollout and ongoing operations:

- Give each user their own login
- Use manager access only where needed
- Limit staff accounts to the relevant venue
- Remove old user accounts when team members leave

## 10. Company, Establishment, and Capacity Setup

Admins can maintain the platform structure through the company management area.

### Companies

Each company record includes:

- Company name
- Enquiry email address

The enquiry email is used when public website users submit booking enquiries instead of direct bookings.

### Establishments

Each establishment belongs to a company.

Admins can:

- Create establishments
- Rename establishments
- Delete establishments

### Seat Counts

Each establishment can contain one or more seat-count calendars.

Each seat-count setup includes:

- Maximum seat capacity
- Guest visit duration
- Maximum online booking party size

This allows separate calendars for:

- Different rooms
- Indoor and outdoor seating
- Function areas
- Smaller operational sections within one venue

## 11. Opening Hours

Admins can define opening hours for each establishment by weekday.

These settings control when bookings can be accepted.

Each weekday can be:

- Open
- Closed

For open days, set:

- Opening time
- Closing time

Bookings are only offered within configured hours.

## 12. Booking Confirmation Email Testing

Admins can test the booking confirmation email setup directly from the settings area.

This helps verify:

- SMTP connection
- From address
- Email layout
- Guest-facing content

This is recommended before rollout so the team can confirm guest emails are sending as expected.

## 13. Widget Setup

The widget setup area is used to choose which live booking source is exposed on the public-facing website.

Admins can select:

- Company
- Establishment
- Seat-count calendar

Once selected, the platform provides:

- Widget URL
- Standalone booking page URL
- Website embed code

This allows the public website to point to the correct booking calendar.

## 14. Public Booking Experience

The public-facing booking experience is available in two formats:

- Embedded widget
- Standalone page view

Guests can:

- Select a date
- Select a time
- Enter booking details
- Submit a booking

If the requested party size is larger than the configured maximum online booking size, the guest is directed to submit an enquiry instead.

## 15. Theme Editor

The Theme Editor is an admin-only tool for managing the look and feel of the embedded booking widget.

It supports:

- Manual CSS editing
- AI-assisted CSS generation
- Attachment uploads for visual references
- Saved prompt templates
- Previewing the widget before publishing

Typical workflow:

1. Choose the company and establishment.
2. Add a design request.
3. Attach references if needed.
4. Generate or edit the CSS.
5. Review the result in preview.
6. Save the final CSS when ready.

## 16. Page View Editor

The Page View Editor is similar to the Theme Editor but applies to the standalone booking page.

It can manage:

- Page structure/content JSON
- Page-specific CSS
- AI-assisted generation of both content layout and styles

This is useful when the business wants a fuller branded booking page rather than only an embedded widget.

## 17. Prompt Library for Admin Styling Work

Admins can save prompt templates in the editor areas.

This is useful for:

- Reusing a preferred design prompt
- Storing brand direction
- Testing multiple visual approaches
- Keeping styling requests consistent across venues

Prompts can be:

- Saved
- Loaded
- Updated
- Deleted

## 18. Suggested Rollout Process

For a clean operational rollout, this order is recommended:

1. Create admin access.
2. Set up companies and establishments.
3. Create seat-count calendars and opening hours.
4. Add manager and staff users.
5. Confirm booking confirmation email settings.
6. Test manual booking creation and editing.
7. Test reporting and booking-day closure workflows.
8. Confirm widget or page-view setup for the live site.
9. Provide team training and issue test logins.

## 19. Suggested Team Training Topics

When introducing the platform to the operational team, the most important areas to cover are:

- Signing in and password reset
- Using the booking calendar
- Creating, editing, and cancelling bookings
- Searching for guest bookings
- Understanding availability and remaining capacity
- When to use close-day controls
- How manager and staff permissions differ

## 20. Support and Walkthrough

Test users can be created for review and training purposes.

If helpful, a one-on-one Microsoft Teams walkthrough can also be arranged to run through the platform with the team live, answer operational questions, and confirm the rollout workflow.
