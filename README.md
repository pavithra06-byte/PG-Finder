**PG Finder**

A web-based platform that helps students and working professionals find suitable Paying Guest (PG) accommodations based on location, budget, room type, amenities, and availability. PG owners can manage their properties, rooms, bookings, and tenant enquiries, while administrators manage users and monitor the overall platform.

**Project Overview**

PG Finder provides three separate dashboards for Tenants, PG Owners, and Admins.

Tenants can search and filter PGs, view properties on an interactive map, check room details and amenities, save favorites, send enquiries, request visits, and book rooms.

PG Owners can add and manage PG properties, rooms, rent, availability, bookings, enquiries, and reviews.

Admins can manage users and owners, verify owners, approve PG listings, monitor bookings, handle reports, and view platform activities.

**Key Features:**
User authentication with role-based access
PG search by city and location
Search and filter by budget, room type, amenities, and availability
Interactive map using Leaflet and OpenStreetMap
PG and room details with images
Room availability management
Favorite PGs
Booking and visit requests
Tenant and owner enquiries
Real-time messaging and notifications
Reviews and ratings
Owner verification and PG approval
Reports and complaints management
Dashboard analytics

User Roles:
**Tenant:**
Search and filter PG accommodations
View PG locations on a map
Check rooms, rent, amenities, and availability
Save favorite PGs
Send enquiries
Request visits
Book rooms
Communicate with owners
Give reviews and ratings

**PG Owner:**
Add and manage PG properties
Add rooms and set rent
Manage room availability
Add amenities and PG details
Manage bookings and visit requests
Respond to tenant enquiries
Communicate with tenants
View reviews and property performance

**Admin:**
Manage users and owners
Verify PG owners
Approve or reject PG listings
Monitor bookings
Manage reports and reviews
Monitor system activities
View overall platform analytics

Technology Stack:
**Frontend:**
React.js
Vite 
Tailwind CSS 
React Router
Axios
Leaflet & OpenStreetMap 
Recharts 
Socket.IO Client 

**Backend:**
Python
Flask 
Flask-SocketIO 
PyMongo 
PyJWT 
bcrypt 
Pillow 
Requests 
python-dotenv 

**Database:**
MongoDB – Stores users, PGs, rooms, bookings, enquiries, reviews, and other application data.

**Authentication:**
JWT Authentication
Google OAuth
bcrypt Password Hashing

**System Workflow:**
User registers or logs into the application.
The system identifies the user's role.
The user is redirected to the relevant dashboard.
Tenants search for PGs using location and filters.
Available PGs are displayed as a list and on an interactive map.
Tenants view PG details, rooms, amenities, rent, and availability.
Tenants can favorite, enquire, request a visit, or book a room.
Owners manage PGs, rooms, availability, bookings, and enquiries.
Admins verify owners and approve PG listings.
The system provides notifications and real-time communication between users.
Admins monitor overall users, PGs, bookings, reviews, reports, and activities.
