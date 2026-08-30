# FitBudget – Smart Fitness & Diet Planner

## Product Requirements Document

### Overview
FitBudget is a production-level Android+iOS fitness application targeting Indian middle-class users. Its USP is **budget-based personalized Indian diet planning** powered by AI (GPT-5.2).

### Target Users
Indian middle-class beginners and intermediate gym users (18-35 age) with limited diet knowledge and limited budget.

### Tech Stack
- **Frontend**: Expo React Native (SDK 54) with file-based routing
- **Backend**: FastAPI (Python) with async MongoDB (Motor)
- **Database**: MongoDB (7 collections)
- **AI**: OpenAI GPT-5.2 via Emergent LLM key
- **Auth**: JWT email/password + Emergent Google OAuth

### Features Implemented

#### 1. Authentication (Email + Google OAuth)
- Email/password registration & login with bcrypt hashing
- Emergent Google OAuth social login
- Session-based auth with 7-day expiry
- Auto-redirect based on auth & onboarding state

#### 2. Smart Onboarding (4-step wizard)
- Step 1: Personal Info (age, gender, height, weight)
- Step 2: Fitness Goals (goal, experience, workout location)
- Step 3: Diet Preferences (veg/non-veg/eggitarian, allergies)
- Step 4: Budget (daily food budget in ₹)
- Auto-calculates TDEE & macro targets (Mifflin-St Jeor equation)

#### 3. AI Diet Plan Generation
- GPT-5.2 generates personalized Indian meal plans
- Optimized for maximum protein per ₹
- Includes breakfast, lunch, dinner, snacks
- Food quantities, calories, protein, cost per item
- Budget alternatives & pro tips
- Pan-Indian food database (35 items seeded)

#### 4. Calorie Tracker
- Indian food database with search
- Food logging by meal type (breakfast/lunch/snacks/dinner)
- Daily calorie & macro tracking
- Visual progress bars on dashboard

#### 5. Workout Plan Generator
- GPT-5.2 generates personalized weekly splits
- Supports gym & home workouts
- Exercises with sets, reps, rest time, notes
- Expandable day-by-day view
- Training tips included

#### 6. Progress Tracking
- Weight logging with date tracking
- Visual bar chart for weight trend
- Current/start/change weight stats
- 30-day history view

#### 7. Dashboard
- Daily calorie consumption ring
- Macro breakdown bars (protein/carbs/fats)
- Quick action buttons
- CTA for missing diet/workout plans
- Today's food log summary

### Database Collections
- `users` - User profiles + onboarding data + calculated targets
- `user_sessions` - Auth sessions with expiry
- `food_items` - 35 seeded Indian foods (name, calories, protein, carbs, fats, serving, price)
- `food_logs` - Daily food entries per user
- `diet_plans` - AI-generated diet plans
- `workout_plans` - AI-generated workout plans
- `weight_logs` - Weight tracking entries

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Email registration |
| POST | /api/auth/login | Email login |
| POST | /api/auth/google-session | Google OAuth callback |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| POST | /api/onboarding | Save onboarding data |
| GET | /api/foods/search | Search Indian foods |
| GET | /api/foods/popular | Popular high-protein foods |
| POST | /api/food-log | Log food entry |
| GET | /api/food-log | Get food logs by date |
| DELETE | /api/food-log/{id} | Delete food log |
| POST | /api/diet/generate | AI diet plan generation |
| GET | /api/diet/current | Get current diet plan |
| POST | /api/workout/generate | AI workout plan generation |
| GET | /api/workout/current | Get current workout plan |
| POST | /api/progress/weight | Log weight |
| GET | /api/progress/weight | Get weight history |
| GET | /api/dashboard | Get dashboard data |

### Design System
- **Theme**: Dark Mode (background #0A0A0A, surface #121212)
- **Accent**: Volt Green (#CCFF00) - high energy, premium feel
- **Secondary**: Blue (#007AFF)
- **Typography**: System fonts with bold weights for headings
- **Icons**: @expo/vector-icons (MaterialCommunityIcons)
- **Navigation**: 5-tab bottom navigation (Dashboard, Diet, Workout, Progress, Profile)

### Monetization Model (Freemium)

| Feature | Free | Premium (₹79/mo India, $1.99/mo Global) |
|---------|------|----------------------------------------|
| AI Generations/month | 5 | 60 |
| Pro Tips visible | 1 per plan | All |
| Budget Alternatives | Locked | All |
| Food Logging & Tracking | Full | Full |
| Progress Tracking | Full | Full |
| Plan Caching | 7-day cache | Instant regen |
| Per-plan unlock | ₹19 India / $0.49 Global | N/A (all unlocked) |

### Cost Optimization Implemented
1. **7-day plan caching** for free users — saves ~80% AI API cost
2. **5 free gens/month cap** — hard limit prevents abuse
3. **Content gating** — tips & alternatives locked until premium/unlock
4. **Generation counter** — tracked per user per month with auto-reset

### Future Enhancements
- Push notifications for meal reminders
- Social features (community, challenges)
- Premium subscription tier with advanced AI features
- Water intake tracking
- Recipe integration with step-by-step cooking instructions
- Integration with fitness wearables
