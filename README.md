🏠 PG Finder

A full-stack web application that helps students and working professionals find suitable Paying Guest (PG) accommodations based on location, budget, room type, amenities, and availability. PG owners can add and manage their properties, rooms, and tenant requests, while administrators can manage the overall platform.

✨ Features
👤 Tenant
User registration and login
Search PGs by location
View PG details, rooms, pricing, and amenities
Filter PGs based on budget, room type, and facilities
View PG locations on an interactive map
Check room availability
Send booking/request inquiries
Manage profile and requests
🏠 PG Owner
Owner registration and login
Add and manage PG properties
Add rooms and room details
Manage room availability
Update PG information and pricing
View tenant requests
Manage property details
🛡️ Admin
Admin dashboard
Manage tenants and PG owners
Manage PG properties
Monitor rooms and availability
Manage users and platform activities
View overall system statistics
🗺️ Location & Map

The application provides map-based PG discovery so users can search for accommodations based on location.

Leaflet – Interactive map functionality
OpenStreetMap – Map data and location visualization

Users can view PG locations directly on the map and explore accommodations around their selected location.

🔄 Application Workflow
User
  ↓
Register / Login
  ↓
Select Role
  ↓
Tenant / PG Owner / Admin
  ↓
--------------------------------
Tenant → Search → Filter → View PG → Request/Book
Owner  → Add PG → Add Rooms → Manage Availability → Manage Requests
Admin  → Manage Users → Manage PGs → Monitor System
--------------------------------
  ↓
Database
  ↓
MongoDB
🛠️ Technologies Used
Frontend
React.js
Vite
Tailwind CSS
React Router
Axios
Leaflet
Backend
Python
Flask
REST APIs
JWT Authentication
Database
MongoDB
PyMongo
Maps
Leaflet
OpenStreetMap
Development Tools
Git
GitHub
Visual Studio Code
📁 Project Structure
PG-Finder/
│
├── backend/
│   ├── app.py
│   ├── routes/
│   ├── models/
│   ├── utils/
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── .gitignore
├── README.md
└── ...
