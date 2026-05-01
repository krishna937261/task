# ⚡ TaskFlow — Team Task Manager

> Full-stack web app for team project and task management with role-based access control.

## 🔗 Links
- **Live URL:** https://taskflow-frontend.up.railway.app
- **API URL:** https://taskflow-backend.up.railway.app
- **GitHub:** https://github.com/YOUR_USERNAME/taskflow

---

## 🚀 Tech Stack

| Layer      | Technology                         |
|------------|------------------------------------|
| Frontend   | React 18, Vite                     |
| Backend    | Node.js, Express.js                |
| Database   | PostgreSQL (hosted on Railway)     |
| Auth       | JWT (jsonwebtoken) + bcryptjs      |
| Deployment | Railway (backend + DB + frontend)  |

---

## ✨ Features

### Authentication
- Signup / Login with JWT tokens (7-day expiry)
- Passwords hashed with bcrypt (10 salt rounds)
- Protected routes via middleware

### Role-Based Access Control
| Feature              | Admin | Member |
|----------------------|-------|--------|
| View all projects    | ✅    | ❌ (own only) |
| Create projects      | ✅    | ❌     |
| Manage team members  | ✅    | ❌     |
| Create tasks         | ✅    | ✅     |
| Edit assigned tasks  | ✅    | ✅ (own) |
| Delete any task      | ✅    | ❌     |
| View team page       | ✅    | ❌     |

### Project Management
- Create projects with name, description, color, and team members
- Progress tracking per project
- Member avatars and task count display

### Task Management
- Full CRUD: create, read, update, delete tasks
- Status: `todo` → `in-progress` → `done`
- Priority levels: High / Medium / Low
- Due dates with automatic overdue detection
- Filter by status, priority, project, assignee

### Dashboard
- Personal task stats (assigned, in progress, done, overdue)
- Project progress bars
- Recent activity feed

---

## 📁 Project Structure

```
taskflow/
├── taskflow-backend/
│   ├── src/
│   │   ├── index.js          # Express app entry point
│   │   ├── db/index.js       # PostgreSQL connection + schema
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT middleware + adminOnly guard
│   │   └── routes/
│   │       ├── auth.js       # POST /signup, /login, GET /me
│   │       ├── projects.js   # CRUD /projects
│   │       ├── tasks.js      # CRUD /tasks
│   │       └── users.js      # GET/PUT /users
│   ├── .env.example
│   ├── package.json
│   └── railway.toml
│
└── taskflow-frontend/
    ├── src/
    │   ├── main.jsx          # React entry
    │   ├── App.jsx           # Main app shell
    │   └── api.js            # All API calls (fetch wrapper)
    ├── .env.example
    ├── vite.config.js
    └── package.json
```

---

## 🗄️ Database Schema

```sql
users (id, name, email, password, role, avatar, color, created_at)
projects (id, name, description, color, created_by → users, created_at)
project_members (project_id → projects, user_id → users)  -- many-to-many
tasks (id, title, description, status, priority, due_date,
       project_id → projects, assigned_to → users, created_by → users,
       created_at, updated_at)
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint          | Auth | Description       |
|--------|-------------------|------|-------------------|
| POST   | /api/auth/signup  | ❌   | Register new user |
| POST   | /api/auth/login   | ❌   | Login, get token  |
| GET    | /api/auth/me      | ✅   | Current user info |

### Projects
| Method | Endpoint           | Auth  | Description           |
|--------|--------------------|-------|-----------------------|
| GET    | /api/projects      | ✅    | List accessible projects |
| GET    | /api/projects/:id  | ✅    | Get project details   |
| POST   | /api/projects      | Admin | Create project        |
| PUT    | /api/projects/:id  | Admin | Update project        |
| DELETE | /api/projects/:id  | Admin | Delete project        |

### Tasks
| Method | Endpoint                  | Auth  | Description        |
|--------|---------------------------|-------|--------------------|
| GET    | /api/tasks                | ✅    | List tasks (filterable) |
| GET    | /api/tasks/stats          | ✅    | Dashboard stats    |
| GET    | /api/tasks/:id            | ✅    | Get task           |
| POST   | /api/tasks                | ✅    | Create task        |
| PUT    | /api/tasks/:id            | ✅    | Update task        |
| PATCH  | /api/tasks/:id/status     | ✅    | Quick status change|
| DELETE | /api/tasks/:id            | ✅    | Delete task        |

### Users
| Method | Endpoint               | Auth  | Description        |
|--------|------------------------|-------|--------------------|
| GET    | /api/users             | ✅    | List team members  |
| GET    | /api/users/:id         | ✅    | Get user by ID     |
| PUT    | /api/users/:id/role    | Admin | Change user role   |
| DELETE | /api/users/:id         | Admin | Remove user        |

---

## ⚙️ Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL (or use Railway's free DB)

### Backend
```bash
cd taskflow-backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
npm run dev
```

### Frontend
```bash
cd taskflow-frontend
npm install
cp .env.example .env
# For local dev, leave VITE_API_URL blank (Vite proxies /api to localhost:3000)
npm run dev
```

---

## 🚂 Deploy on Railway

### Step 1 — Create Railway Project
1. Go to [railway.app](https://railway.app) → New Project
2. Click **"Deploy from GitHub repo"** → select your repo

### Step 2 — Add PostgreSQL
1. In your Railway project → **New Service** → **Database** → **PostgreSQL**
2. Railway auto-generates `DATABASE_URL` — copy it

### Step 3 — Deploy Backend
1. Add a new service → select your repo → set **Root Directory** to `taskflow-backend`
2. Set environment variables:
   ```
   DATABASE_URL=<from Railway PostgreSQL>
   JWT_SECRET=some_long_random_secret_string_here
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.up.railway.app
   PORT=3000
   ```
3. Deploy — Railway runs `npm start` automatically

### Step 4 — Deploy Frontend
1. Add another service → same repo → Root Directory: `taskflow-frontend`
2. Set environment variables:
   ```
   VITE_API_URL=https://your-backend.up.railway.app/api
   ```
3. Build command: `npm run build`
4. Start command: `npx serve dist`

### Step 5 — Done!
- Visit your frontend Railway URL
- The backend auto-creates all database tables on first boot

---

## 🧪 Test Credentials (after seeding)
You can register directly via the signup form. For the first user, sign up and manually update their role to `admin` in PostgreSQL if needed:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 📹 Demo Video
[Link to 2–5 min Loom/YouTube walkthrough]

---

## 👤 Author
Built by [Your Name] as a full-stack assignment submission.
