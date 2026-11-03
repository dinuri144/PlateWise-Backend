# PlateWise – Backend

**Smart nutrition, made simple.**

PlateWise is a smart nutrition and meal-planning web application that helps users manage their food habits, track nutrition, and work towards personalized health goals.

This repository contains the backend API of PlateWise, developed using Node.js, Express, TypeScript, and PostgreSQL.

## ✨ Backend Features

- **Authentication & Authorization** – Secure user authentication using JSON Web Tokens (JWT).
- **Password Security** – Password hashing using bcrypt.
- **User Profiles** – Manage personal information and nutrition goals.
- **Nutrition Calculations** – Support BMI, calorie, and protein target calculations.
- **Pantry Management** – Manage and retrieve pantry information.
- **Recipe Management** – Handle recipe-related data.
- **Food Logging** – Store and manage daily food records.
- **Dietary Preferences** – Manage users' dietary preferences.
- **Shopping Lists** – Create and manage shopping list data.
- **AI Integration** – Integrate Google Gemini AI for nutrition assistance.
- **Input Validation** – Validate request data using Zod.
- **Database Management** – Manage relational data using Prisma ORM and PostgreSQL.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express 5 | Backend web framework |
| TypeScript | Type-safe development |
| PostgreSQL | Relational database |
| Prisma ORM 7 | Database access and migrations |
| JWT | Authentication |
| bcrypt / bcryptjs | Password hashing |
| Zod | Data validation |
| Google Gemini AI | AI-powered nutrition assistance |
| pg | PostgreSQL driver |

## 📁 Project Structure

```text
server/
├── prisma/
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── ...
│   └── index.ts
├── prisma.config.ts
├── package.json
└── tsconfig.json
```

*The structure may evolve as the application develops.*

## ⚙️ Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/dinuri144/PlateWise-Backend.git
```

### 2. Navigate to the project folder

```bash
cd PlateWise-Backend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create your local `.env` file using the provided `.env.example`, if available.

Configure the required values for:

- PostgreSQL database connection
- JWT authentication
- Google Gemini API

**Important:** Never upload your `.env` file or expose secret keys on GitHub.

### 5. Set up the database

Ensure PostgreSQL is running and your database is configured.

Apply the database migrations using the migration workflow configured for this project.

### 6. Start the development server

```bash
npm run dev
```

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with automatic reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start the compiled application |
| `npm run seed` | Run the database seed script |

## 🗄️ Database

PlateWise uses PostgreSQL as its relational database and Prisma ORM for database access and schema management.

Database migration history is maintained in the `prisma/migrations` directory.

## 🔗 Related Repository

**Frontend:** [PlateWise-Frontend](https://github.com/dinuri144/PlateWise-Frontend)

## 👩‍💻 Author

Developed as a personal software development project.

**GitHub:** [@dinuri144](https://github.com/dinuri144)

---

*PlateWise – Making healthier food choices simpler.*
