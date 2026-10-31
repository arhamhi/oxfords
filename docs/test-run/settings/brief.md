# Brief: workspace settings (light and dark)

Product: Shiftboard, staff scheduling for restaurant groups.

Screen: Workspace settings for "Marlow Kitchen Group" (4 restaurants, 38 staff). It must show:
- a form for the workspace name and timezone. Save stays disabled until something changes. In the default view one field shows a validation error.
- a members table: name, email, role, location, last active. One invite is pending. Owners can change roles.
- plan and billing: current plan, seats used, next invoice, the payment card's last four digits
- a danger zone for deleting the workspace

Opening the page with `?dialog=delete` must show the delete-workspace confirmation dialog open.

The page follows the system light/dark setting, and both themes must be designed. It must work on desktop and at 390px wide.
