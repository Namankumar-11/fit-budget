from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== PYDANTIC MODELS =====
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class GoogleSessionInput(BaseModel):
    session_id: str

class OnboardingInput(BaseModel):
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    fitness_goal: str
    training_experience: str
    workout_location: str
    food_preference: str
    allergies: str = ""
    daily_budget: int

class FoodLogInput(BaseModel):
    food_name: str
    quantity_g: float
    calories: float
    protein: float
    carbs: float
    fats: float
    meal_type: str
    date: str

class WeightLogInput(BaseModel):
    weight_kg: float
    date: str

class UnlockPlanInput(BaseModel):
    plan_id: str
    plan_type: str

# ===== SUBSCRIPTION CONSTANTS =====
FREE_GENERATIONS_PER_MONTH = 5
PREMIUM_GENERATIONS_PER_MONTH = 60
PLAN_CACHE_DAYS = 7
PRICING = {
    "india": {"premium_monthly": 79, "premium_yearly": 599, "unlock_single": 19, "currency": "INR"},
    "global": {"premium_monthly": 1.99, "premium_yearly": 14.99, "unlock_single": 0.49, "currency": "USD"},
}

# ===== AUTH HELPERS =====
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_session_token() -> str:
    return f"sess_{uuid.uuid4().hex}"

async def get_current_user(authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ===== INDIAN FOOD DATABASE =====
from food_database import GLOBAL_FOOD_DATABASE

# ===== STARTUP EVENT =====
@app.on_event("startup")
async def startup_event():
    count = await db.food_items.count_documents({})
    if count < len(GLOBAL_FOOD_DATABASE):
        await db.food_items.drop()
        foods_to_insert = []
        for food in GLOBAL_FOOD_DATABASE:
            foods_to_insert.append({
                "food_id": f"food_{uuid.uuid4().hex[:8]}",
                **food
            })
        await db.food_items.insert_many(foods_to_insert)
        await db.food_items.create_index([("name", 1)])
        await db.food_items.create_index([("cuisine", 1)])
        await db.food_items.create_index([("category", 1)])
        logger.info(f"Seeded {len(foods_to_insert)} global foods")
    logger.info("FitBudget API started")

# ===== CALORIE/MACRO CALCULATOR =====
def calculate_targets(user_data: dict) -> dict:
    weight = user_data['weight_kg']
    height = user_data['height_cm']
    age = user_data['age']
    gender = user_data['gender']
    goal = user_data['fitness_goal']
    if gender == 'male':
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    tdee = bmr * 1.55
    if goal == 'fat_loss':
        target_cal = tdee - 500
        protein = weight * 2.0
        fats = weight * 0.8
    elif goal == 'muscle_gain':
        target_cal = tdee + 300
        protein = weight * 1.8
        fats = weight * 0.9
    else:
        target_cal = tdee
        protein = weight * 1.6
        fats = weight * 0.8
    carbs = max((target_cal - protein * 4 - fats * 9) / 4, 50)
    return {
        "target_calories": round(target_cal),
        "protein_g": round(protein),
        "carbs_g": round(carbs),
        "fats_g": round(fats)
    }

# ===== SUBSCRIPTION HELPERS =====
def get_default_subscription_fields():
    return {
        "subscription_tier": "free",
        "generations_used": 0,
        "generations_reset_date": datetime.now(timezone.utc).replace(day=1).isoformat(),
        "unlocked_plans": [],
        "region": "india",
    }

async def check_and_update_generation_limit(user: dict) -> dict:
    tier = user.get("subscription_tier", "free")
    limit = PREMIUM_GENERATIONS_PER_MONTH if tier == "premium" else FREE_GENERATIONS_PER_MONTH
    used = user.get("generations_used", 0)
    reset_date_str = user.get("generations_reset_date", "")
    now = datetime.now(timezone.utc)
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    if reset_date_str < current_month_start:
        used = 0
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"generations_used": 0, "generations_reset_date": current_month_start}}
        )
    if used >= limit:
        return {"allowed": False, "used": used, "limit": limit, "remaining": 0}
    return {"allowed": True, "used": used, "limit": limit, "remaining": limit - used}

async def increment_generation_count(user_id: str):
    await db.users.update_one({"user_id": user_id}, {"$inc": {"generations_used": 1}})

def gate_plan_content(plan_data: dict, user: dict, plan_id: str) -> dict:
    tier = user.get("subscription_tier", "free")
    unlocked = user.get("unlocked_plans", [])
    is_unlocked = tier == "premium" or plan_id in unlocked
    gated = {**plan_data}
    if not is_unlocked:
        if "tips" in gated and isinstance(gated["tips"], list) and len(gated["tips"]) > 1:
            gated["tips"] = [gated["tips"][0]]
            gated["tips_locked"] = True
        if "alternatives" in gated and isinstance(gated["alternatives"], list):
            gated["alternatives"] = []
            gated["alternatives_locked"] = True
    else:
        gated["tips_locked"] = False
        gated["alternatives_locked"] = False
    return gated

# ===== AUTH ENDPOINTS =====
@api_router.post("/auth/register")
async def register(input_data: RegisterInput):
    existing = await db.users.find_one({"email": input_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(input_data.password)
    user_doc = {
        "user_id": user_id,
        "email": input_data.email,
        "name": input_data.name,
        "password": hashed_pw,
        "picture": "",
        "onboarding_complete": False,
        "created_at": datetime.now(timezone.utc),
        **get_default_subscription_fields()
    }
    await db.users.insert_one(user_doc)
    session_token = generate_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    return {"session_token": session_token, "user_id": user_id, "name": input_data.name, "onboarding_complete": False}

@api_router.post("/auth/login")
async def login(input_data: LoginInput):
    user = await db.users.find_one({"email": input_data.email}, {"_id": 0})
    if not user or not verify_password(input_data.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_token = generate_session_token()
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    return {
        "session_token": session_token,
        "user_id": user["user_id"],
        "name": user.get("name", ""),
        "onboarding_complete": user.get("onboarding_complete", False)
    }

@api_router.post("/auth/google-session")
async def google_session(input_data: GoogleSessionInput):
    try:
        resp = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": input_data.session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        google_data = resp.json()
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Google auth failed")
    existing = await db.users.find_one({"email": google_data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": google_data.get("name", existing.get("name", "")),
            "picture": google_data.get("picture", "")
        }})
        onboarding_complete = existing.get("onboarding_complete", False)
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": google_data["email"],
            "name": google_data.get("name", ""),
            "picture": google_data.get("picture", ""),
            "password": "",
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc),
            **get_default_subscription_fields()
        })
        onboarding_complete = False
    session_token = generate_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    return {
        "session_token": session_token,
        "user_id": user_id,
        "name": google_data.get("name", ""),
        "onboarding_complete": onboarding_complete
    }

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    safe = {k: v for k, v in user.items() if k != "password"}
    return safe

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}

# ===== ONBOARDING =====
@api_router.post("/onboarding")
async def save_onboarding(input_data: OnboardingInput, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    targets = calculate_targets({
        "weight_kg": input_data.weight_kg,
        "height_cm": input_data.height_cm,
        "age": input_data.age,
        "gender": input_data.gender,
        "fitness_goal": input_data.fitness_goal
    })
    update_data = {
        "age": input_data.age,
        "gender": input_data.gender,
        "height_cm": input_data.height_cm,
        "weight_kg": input_data.weight_kg,
        "fitness_goal": input_data.fitness_goal,
        "training_experience": input_data.training_experience,
        "workout_location": input_data.workout_location,
        "food_preference": input_data.food_preference,
        "allergies": input_data.allergies,
        "daily_budget": input_data.daily_budget,
        "onboarding_complete": True,
        **targets
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    return {"message": "Onboarding complete", **targets}

# ===== FOOD SEARCH =====
@api_router.get("/foods/search")
async def search_foods(q: str = "", preference: str = "all", cuisine: str = "all"):
    query = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if preference == "veg":
        query["is_veg"] = True
    elif preference == "eggitarian":
        query["$or"] = [{"is_veg": True}, {"name": {"$regex": "egg", "$options": "i"}}]
    if cuisine and cuisine != "all":
        query["cuisine"] = cuisine
    foods = await db.food_items.find(query, {"_id": 0}).to_list(50)
    return foods

@api_router.get("/foods/popular")
async def get_popular_foods():
    foods = await db.food_items.find({}, {"_id": 0}).sort("protein", -1).to_list(20)
    return foods

# ===== FOOD LOGGING =====
@api_router.post("/food-log")
async def create_food_log(input_data: FoodLogInput, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    log_entry = {
        "log_id": f"log_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "food_name": input_data.food_name,
        "quantity_g": input_data.quantity_g,
        "calories": input_data.calories,
        "protein": input_data.protein,
        "carbs": input_data.carbs,
        "fats": input_data.fats,
        "meal_type": input_data.meal_type,
        "date": input_data.date,
        "created_at": datetime.now(timezone.utc)
    }
    await db.food_logs.insert_one(log_entry)
    return {k: v for k, v in log_entry.items() if k != "_id"}

@api_router.get("/food-log")
async def get_food_logs(date: str = "", authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    query = {"user_id": user["user_id"]}
    if date:
        query["date"] = date
    logs = await db.food_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return logs

@api_router.delete("/food-log/{log_id}")
async def delete_food_log(log_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    result = await db.food_logs.delete_one({"log_id": log_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"message": "Deleted"}

# ===== AI DIET PLAN GENERATION =====
@api_router.post("/diet/generate")
async def generate_diet_plan(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("onboarding_complete"):
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    gen_status = await check_and_update_generation_limit(user)
    if not gen_status["allowed"]:
        raise HTTPException(status_code=429, detail=f"Monthly limit reached ({gen_status['limit']} generations). Upgrade to Premium for {PREMIUM_GENERATIONS_PER_MONTH}/month.")
    existing = await db.diet_plans.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if existing and existing.get("created_at"):
        created = existing["created_at"]
        if isinstance(created, str):
            created_dt = datetime.fromisoformat(created)
        else:
            created_dt = created
        if created_dt.tzinfo is None:
            created_dt = created_dt.replace(tzinfo=timezone.utc)
        days_old = (datetime.now(timezone.utc) - created_dt).days
        if days_old < PLAN_CACHE_DAYS and user.get("subscription_tier", "free") == "free":
            return {"plan_id": existing.get("plan_id"), "plan_data": existing.get("plan_data"), "created_at": existing.get("created_at"), "cached": True, "generation_status": gen_status}
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"diet-{user['user_id']}-{datetime.now(timezone.utc).isoformat()}",
        system_message="You are an expert Indian nutritionist. Return ONLY valid JSON, no markdown."
    ).with_model("openai", "gpt-5.2")
    prompt = f"""Generate a daily Indian meal plan:
User: Age {user.get('age')}, {user.get('gender')}, {user.get('weight_kg')}kg, {user.get('height_cm')}cm
Goal: {user.get('fitness_goal')}, Budget: ₹{user.get('daily_budget')}/day
Preference: {user.get('food_preference')}, Allergies: {user.get('allergies', 'none')}
Targets: {user.get('target_calories')} cal, {user.get('protein_g')}g protein, {user.get('carbs_g')}g carbs, {user.get('fats_g')}g fats

Focus on: max protein per rupee, easily available Indian foods, simple cooking.
Return JSON: {{"meals":[{{"meal_type":"breakfast","items":[{{"name":"str","quantity":"str","calories":0,"protein":0,"carbs":0,"fats":0,"cost":0}}],"total_calories":0,"total_protein":0,"total_cost":0}},{{"meal_type":"lunch","items":[...],...}},{{"meal_type":"snacks","items":[...],...}},{{"meal_type":"dinner","items":[...],...}}],"daily_totals":{{"calories":0,"protein":0,"carbs":0,"fats":0,"cost":0}},"alternatives":[{{"original":"str","alternative":"str","reason":"str"}}],"tips":["str"]}}"""
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        clean = response.strip()
        if clean.startswith("```"):
            clean = re.sub(r'^```\w*\n?', '', clean)
            clean = re.sub(r'\n?```$', '', clean)
        plan_data = json.loads(clean)
    except Exception as e:
        logger.error(f"AI diet error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate diet plan")
    await increment_generation_count(user["user_id"])
    plan_doc = {
        "plan_id": f"diet_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "plan_data": plan_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.diet_plans.delete_many({"user_id": user["user_id"]})
    await db.diet_plans.insert_one(plan_doc)
    gen_status["used"] += 1
    gen_status["remaining"] -= 1
    return {"plan_id": plan_doc["plan_id"], "plan_data": plan_data, "created_at": plan_doc["created_at"], "generation_status": gen_status}

@api_router.get("/diet/current")
async def get_current_diet(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    gen_status = await check_and_update_generation_limit(user)
    plan = await db.diet_plans.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        return {
            "plan": None,
            "generation_status": gen_status,
            "subscription_tier": user.get("subscription_tier", "free"),
        }
    plan_id = plan.get("plan_id", "")
    gated = gate_plan_content(plan.get("plan_data", {}), user, plan_id)
    return {
        "plan_id": plan_id,
        "plan_data": gated,
        "created_at": plan.get("created_at"),
        "generation_status": gen_status,
        "subscription_tier": user.get("subscription_tier", "free"),
    }

# ===== AI WORKOUT PLAN GENERATION =====
@api_router.post("/workout/generate")
async def generate_workout_plan(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("onboarding_complete"):
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    gen_status = await check_and_update_generation_limit(user)
    if not gen_status["allowed"]:
        raise HTTPException(status_code=429, detail=f"Monthly limit reached ({gen_status['limit']} generations). Upgrade to Premium for {PREMIUM_GENERATIONS_PER_MONTH}/month.")
    existing = await db.workout_plans.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if existing and existing.get("created_at"):
        created = existing["created_at"]
        if isinstance(created, str):
            created_dt = datetime.fromisoformat(created)
        else:
            created_dt = created
        if created_dt.tzinfo is None:
            created_dt = created_dt.replace(tzinfo=timezone.utc)
        days_old = (datetime.now(timezone.utc) - created_dt).days
        if days_old < PLAN_CACHE_DAYS and user.get("subscription_tier", "free") == "free":
            return {"plan_id": existing.get("plan_id"), "plan_data": existing.get("plan_data"), "created_at": existing.get("created_at"), "cached": True, "generation_status": gen_status}
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"workout-{user['user_id']}-{datetime.now(timezone.utc).isoformat()}",
        system_message="You are an expert fitness trainer. Return ONLY valid JSON, no markdown."
    ).with_model("openai", "gpt-5.2")
    prompt = f"""Generate a weekly workout plan:
User: Age {user.get('age')}, {user.get('gender')}, {user.get('weight_kg')}kg
Goal: {user.get('fitness_goal')}, Experience: {user.get('training_experience')}
Location: {user.get('workout_location')}

Return JSON: {{"plan_name":"str","days_per_week":5,"days":[{{"day":"Monday","focus":"str","exercises":[{{"name":"str","sets":4,"reps":"8-12","rest_seconds":90,"notes":"str"}}],"duration_minutes":60}}],"tips":["str"]}}"""
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        clean = response.strip()
        if clean.startswith("```"):
            clean = re.sub(r'^```\w*\n?', '', clean)
            clean = re.sub(r'\n?```$', '', clean)
        plan_data = json.loads(clean)
    except Exception as e:
        logger.error(f"AI workout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate workout plan")
    await increment_generation_count(user["user_id"])
    plan_doc = {
        "plan_id": f"wk_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "plan_data": plan_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.workout_plans.delete_many({"user_id": user["user_id"]})
    await db.workout_plans.insert_one(plan_doc)
    gen_status["used"] += 1
    gen_status["remaining"] -= 1
    return {"plan_id": plan_doc["plan_id"], "plan_data": plan_data, "created_at": plan_doc["created_at"], "generation_status": gen_status}

@api_router.get("/workout/current")
async def get_current_workout(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    gen_status = await check_and_update_generation_limit(user)
    plan = await db.workout_plans.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        return {
            "plan": None,
            "generation_status": gen_status,
            "subscription_tier": user.get("subscription_tier", "free"),
        }
    plan_id = plan.get("plan_id", "")
    gated = gate_plan_content(plan.get("plan_data", {}), user, plan_id)
    return {
        "plan_id": plan_id,
        "plan_data": gated,
        "created_at": plan.get("created_at"),
        "generation_status": gen_status,
        "subscription_tier": user.get("subscription_tier", "free"),
    }

# ===== SUBSCRIPTION ENDPOINTS =====
@api_router.get("/subscription/status")
async def get_subscription_status(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    gen_status = await check_and_update_generation_limit(user)
    region = user.get("region", "india")
    pricing = PRICING.get(region, PRICING["india"])
    return {
        "tier": user.get("subscription_tier", "free"),
        "generation_status": gen_status,
        "unlocked_plans": user.get("unlocked_plans", []),
        "pricing": pricing,
        "region": region,
    }

@api_router.post("/subscription/unlock-plan")
async def unlock_plan(input_data: UnlockPlanInput, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    unlocked = user.get("unlocked_plans", [])
    plan_key = f"{input_data.plan_type}_{input_data.plan_id}"
    if plan_key in unlocked:
        return {"message": "Already unlocked", "unlocked": True}
    unlocked.append(plan_key)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"unlocked_plans": unlocked}})
    return {"message": "Plan unlocked!", "unlocked": True}

@api_router.post("/subscription/upgrade")
async def upgrade_subscription(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"subscription_tier": "premium"}})
    return {"message": "Upgraded to Premium!", "tier": "premium"}

# ===== PROGRESS TRACKING =====
@api_router.post("/progress/weight")
async def log_weight(input_data: WeightLogInput, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    entry = {
        "entry_id": f"wt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "weight_kg": input_data.weight_kg,
        "date": input_data.date,
        "created_at": datetime.now(timezone.utc)
    }
    await db.weight_logs.delete_many({"user_id": user["user_id"], "date": input_data.date})
    await db.weight_logs.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}

@api_router.get("/progress/weight")
async def get_weight_history(days: int = 30, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    logs = await db.weight_logs.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("date", -1).to_list(days)
    return logs

# ===== DASHBOARD =====
@api_router.get("/dashboard")
async def get_dashboard(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_logs = await db.food_logs.find(
        {"user_id": user["user_id"], "date": today}, {"_id": 0}
    ).to_list(100)
    total_cal = sum(entry.get("calories", 0) for entry in today_logs)
    total_protein = sum(entry.get("protein", 0) for entry in today_logs)
    total_carbs = sum(entry.get("carbs", 0) for entry in today_logs)
    total_fats = sum(entry.get("fats", 0) for entry in today_logs)
    diet_plan = await db.diet_plans.find_one({"user_id": user["user_id"]}, {"_id": 0})
    workout_plan = await db.workout_plans.find_one({"user_id": user["user_id"]}, {"_id": 0})
    latest_weight = await db.weight_logs.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}, sort=[("date", -1)]
    )
    return {
        "user": {k: v for k, v in user.items() if k != "password"},
        "today": {
            "date": today,
            "calories_consumed": round(total_cal),
            "protein_consumed": round(total_protein),
            "carbs_consumed": round(total_carbs),
            "fats_consumed": round(total_fats),
            "food_logs": today_logs
        },
        "targets": {
            "calories": user.get("target_calories", 2000),
            "protein": user.get("protein_g", 100),
            "carbs": user.get("carbs_g", 250),
            "fats": user.get("fats_g", 65)
        },
        "has_diet_plan": diet_plan is not None,
        "has_workout_plan": workout_plan is not None,
        "latest_weight": latest_weight
    }

# ===== INCLUDE ROUTER & MIDDLEWARE =====
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
