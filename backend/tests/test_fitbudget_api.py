"""
FitBudget API Backend Tests
Tests: Auth flow, Onboarding, Dashboard, Food Search, Food Logging, Weight Tracking
"""

import pytest
import requests
import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get backend URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.exit("EXPO_PUBLIC_BACKEND_URL not found in environment")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def test_user_token(api_client):
    """Create a new test user and return token"""
    timestamp = int(datetime.now().timestamp() * 1000)
    test_email = f"TEST_pytest_user_{timestamp}@fitbudget.test"
    payload = {
        "email": test_email,
        "password": "Test1234",
        "name": "Pytest Test User"
    }
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
    if response.status_code == 200:
        data = response.json()
        return data["session_token"], data["user_id"]
    pytest.skip("Failed to create test user")

@pytest.fixture
def onboarded_user_token(api_client, test_user_token):
    """Create test user and complete onboarding"""
    token, user_id = test_user_token
    api_client.headers.update({"Authorization": f"Bearer {token}"})
    
    onboarding_data = {
        "age": 25,
        "gender": "male",
        "height_cm": 175.0,
        "weight_kg": 70.0,
        "fitness_goal": "muscle_gain",
        "training_experience": "beginner",
        "workout_location": "gym",
        "food_preference": "non-veg",
        "allergies": "",
        "daily_budget": 200
    }
    response = api_client.post(f"{BASE_URL}/api/onboarding", json=onboarding_data)
    if response.status_code == 200:
        return token, user_id
    pytest.skip("Failed to complete onboarding")


# ===== AUTH TESTS =====
class TestAuth:
    """Test authentication endpoints"""
    
    def test_01_register_new_user(self, api_client):
        """Test 1: Register new user with email/password, verify session token returned"""
        timestamp = int(datetime.now().timestamp() * 1000)
        payload = {
            "email": f"TEST_new_user_{timestamp}@fitbudget.test",
            "password": "Test1234",
            "name": "New Test User"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "session_token" in data, "session_token missing in response"
        assert data["session_token"].startswith("sess_"), "Invalid session token format"
        assert "user_id" in data, "user_id missing"
        assert data["name"] == "New Test User", "Name mismatch"
        assert data["onboarding_complete"] == False, "New user should not be onboarded"
        print(f"✓ Test 1 PASSED: User registered with token {data['session_token'][:20]}...")
    
    def test_02_login_existing_user(self, api_client):
        """Test 2: Login with existing user, verify session token and onboarding_complete status"""
        # Use the pre-seeded test user
        payload = {
            "email": "test@fitbudget.com",
            "password": "Test1234"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Login failed with {response.status_code}"
        
        data = response.json()
        assert "session_token" in data, "session_token missing"
        assert data["session_token"].startswith("sess_"), "Invalid token format"
        assert "user_id" in data, "user_id missing"
        assert "onboarding_complete" in data, "onboarding_complete missing"
        assert data["onboarding_complete"] == True, "Test user should be onboarded"
        print(f"✓ Test 2 PASSED: Login successful, onboarding_complete={data['onboarding_complete']}")
    
    def test_03_get_auth_me_with_token(self, api_client):
        """Test 3: GET /api/auth/me with valid token returns user data"""
        # Login first
        login_payload = {"email": "test@fitbudget.com", "password": "Test1234"}
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        token = login_response.json()["session_token"]
        
        # Call /auth/me
        headers = {"Authorization": f"Bearer {token}"}
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        user_data = response.json()
        assert "user_id" in user_data, "user_id missing"
        assert "email" in user_data, "email missing"
        assert user_data["email"] == "test@fitbudget.com", "Email mismatch"
        assert "password" not in user_data, "Password should not be in response"
        print(f"✓ Test 3 PASSED: /auth/me returned user data for {user_data['email']}")


# ===== ONBOARDING TESTS =====
class TestOnboarding:
    """Test onboarding endpoint"""
    
    def test_04_onboarding_saves_data_and_calculates_targets(self, api_client, test_user_token):
        """Test 4: POST /api/onboarding saves all user data and calculates calorie/macro targets"""
        token, user_id = test_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        onboarding_data = {
            "age": 28,
            "gender": "female",
            "height_cm": 165.0,
            "weight_kg": 60.0,
            "fitness_goal": "fat_loss",
            "training_experience": "intermediate",
            "workout_location": "home",
            "food_preference": "veg",
            "allergies": "peanuts",
            "daily_budget": 150
        }
        
        response = api_client.post(f"{BASE_URL}/api/onboarding", json=onboarding_data)
        assert response.status_code == 200, f"Onboarding failed with {response.status_code}"
        
        data = response.json()
        assert "target_calories" in data, "target_calories missing"
        assert "protein_g" in data, "protein_g missing"
        assert "carbs_g" in data, "carbs_g missing"
        assert "fats_g" in data, "fats_g missing"
        assert data["target_calories"] > 0, "target_calories should be positive"
        assert data["protein_g"] > 0, "protein_g should be positive"
        
        # Verify data was saved by calling /auth/me
        me_response = api_client.get(f"{BASE_URL}/api/auth/me")
        user = me_response.json()
        assert user["onboarding_complete"] == True, "onboarding_complete should be True"
        assert user["age"] == 28, "Age not saved"
        assert user["fitness_goal"] == "fat_loss", "Fitness goal not saved"
        assert user["daily_budget"] == 150, "Budget not saved"
        print(f"✓ Test 4 PASSED: Onboarding saved, targets: {data['target_calories']}cal, {data['protein_g']}g protein")


# ===== DASHBOARD TESTS =====
class TestDashboard:
    """Test dashboard endpoint"""
    
    def test_05_dashboard_returns_complete_data(self, api_client, onboarded_user_token):
        """Test 5: GET /api/dashboard returns user data, today's food logs, targets, plan status"""
        token, user_id = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200, f"Dashboard failed with {response.status_code}"
        
        data = response.json()
        assert "user" in data, "user missing"
        assert "today" in data, "today missing"
        assert "targets" in data, "targets missing"
        assert "has_diet_plan" in data, "has_diet_plan missing"
        assert "has_workout_plan" in data, "has_workout_plan missing"
        
        # Validate today's data structure
        assert "date" in data["today"], "today.date missing"
        assert "calories_consumed" in data["today"], "calories_consumed missing"
        assert "protein_consumed" in data["today"], "protein_consumed missing"
        assert "food_logs" in data["today"], "food_logs missing"
        
        # Validate targets
        assert data["targets"]["calories"] > 0, "calories target should be positive"
        assert data["targets"]["protein"] > 0, "protein target should be positive"
        
        print(f"✓ Test 5 PASSED: Dashboard returned complete data, consumed={data['today']['calories_consumed']}cal")


# ===== FOOD SEARCH TESTS =====
class TestFoodSearch:
    """Test food search endpoints"""
    
    def test_06_food_search_with_query(self, api_client, onboarded_user_token):
        """Test 6: GET /api/foods/search?q=chicken returns matching Indian foods"""
        token, _ = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/foods/search?q=chicken")
        assert response.status_code == 200, f"Food search failed with {response.status_code}"
        
        foods = response.json()
        assert isinstance(foods, list), "Response should be a list"
        assert len(foods) > 0, "Should return at least one chicken item"
        
        # Check that results contain "chicken"
        chicken_items = [f for f in foods if "chicken" in f["name"].lower()]
        assert len(chicken_items) > 0, "No chicken items found"
        
        # Validate food structure
        first_food = foods[0]
        assert "name" in first_food, "name missing"
        assert "calories" in first_food, "calories missing"
        assert "protein" in first_food, "protein missing"
        assert "carbs" in first_food, "carbs missing"
        assert "fats" in first_food, "fats missing"
        assert "serving" in first_food, "serving missing"
        
        print(f"✓ Test 6 PASSED: Found {len(chicken_items)} chicken items: {[f['name'] for f in chicken_items]}")
    
    def test_07_food_popular_returns_high_protein(self, api_client, onboarded_user_token):
        """Test 7: GET /api/foods/popular returns high-protein foods sorted"""
        token, _ = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/foods/popular")
        assert response.status_code == 200, f"Popular foods failed with {response.status_code}"
        
        foods = response.json()
        assert isinstance(foods, list), "Response should be a list"
        assert len(foods) > 0, "Should return foods"
        
        # Verify foods are sorted by protein (descending)
        if len(foods) >= 2:
            assert foods[0]["protein"] >= foods[1]["protein"], "Foods should be sorted by protein descending"
        
        # Check high protein content
        top_food = foods[0]
        assert top_food["protein"] >= 10, f"Top food should have high protein, got {top_food['protein']}g"
        
        print(f"✓ Test 7 PASSED: Popular foods returned, top={top_food['name']} with {top_food['protein']}g protein")


# ===== FOOD LOGGING TESTS =====
class TestFoodLogging:
    """Test food logging endpoints"""
    
    def test_08_create_food_log_entry(self, api_client, onboarded_user_token):
        """Test 8: POST /api/food-log creates a food entry"""
        token, user_id = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        today = datetime.now().strftime("%Y-%m-%d")
        log_data = {
            "food_name": "TEST_Chicken Breast",
            "quantity_g": 100.0,
            "calories": 165.0,
            "protein": 31.0,
            "carbs": 0.0,
            "fats": 3.6,
            "meal_type": "lunch",
            "date": today
        }
        
        response = api_client.post(f"{BASE_URL}/api/food-log", json=log_data)
        assert response.status_code == 200, f"Food log creation failed with {response.status_code}"
        
        data = response.json()
        assert "log_id" in data, "log_id missing"
        assert data["log_id"].startswith("log_"), "Invalid log_id format"
        assert data["food_name"] == "TEST_Chicken Breast", "food_name mismatch"
        assert data["calories"] == 165.0, "calories mismatch"
        assert data["meal_type"] == "lunch", "meal_type mismatch"
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/food-log?date={today}")
        logs = get_response.json()
        created_log = next((log for log in logs if log["log_id"] == data["log_id"]), None)
        assert created_log is not None, "Created log not found in GET"
        assert created_log["protein"] == 31.0, "Protein value not persisted"
        
        print(f"✓ Test 8 PASSED: Food log created {data['log_id']}, verified in GET")
    
    def test_09_get_food_logs_for_date(self, api_client, onboarded_user_token):
        """Test 9: GET /api/food-log?date=2026-02-15 returns logs for that date"""
        token, user_id = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create a log entry first
        test_date = "2026-02-15"
        log_data = {
            "food_name": "TEST_Dal Moong",
            "quantity_g": 150.0,
            "calories": 160.0,
            "protein": 12.0,
            "carbs": 26.0,
            "fats": 0.8,
            "meal_type": "dinner",
            "date": test_date
        }
        create_response = api_client.post(f"{BASE_URL}/api/food-log", json=log_data)
        created_log_id = create_response.json()["log_id"]
        
        # Get logs for that date
        response = api_client.get(f"{BASE_URL}/api/food-log?date={test_date}")
        assert response.status_code == 200, f"Get food logs failed with {response.status_code}"
        
        logs = response.json()
        assert isinstance(logs, list), "Response should be a list"
        
        # Verify our log is in the results
        our_log = next((log for log in logs if log["log_id"] == created_log_id), None)
        assert our_log is not None, "Created log not found"
        assert our_log["date"] == test_date, "Date mismatch"
        
        print(f"✓ Test 9 PASSED: Retrieved {len(logs)} logs for {test_date}")
    
    def test_10_delete_food_log_entry(self, api_client, onboarded_user_token):
        """Test 10: DELETE /api/food-log/{log_id} removes entry"""
        token, user_id = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create a log to delete
        today = datetime.now().strftime("%Y-%m-%d")
        log_data = {
            "food_name": "TEST_DELETE_ME",
            "quantity_g": 50.0,
            "calories": 100.0,
            "protein": 5.0,
            "carbs": 10.0,
            "fats": 2.0,
            "meal_type": "snacks",
            "date": today
        }
        create_response = api_client.post(f"{BASE_URL}/api/food-log", json=log_data)
        log_id = create_response.json()["log_id"]
        
        # Delete the log
        delete_response = api_client.delete(f"{BASE_URL}/api/food-log/{log_id}")
        assert delete_response.status_code == 200, f"Delete failed with {delete_response.status_code}"
        
        # Verify it's deleted
        get_response = api_client.get(f"{BASE_URL}/api/food-log?date={today}")
        logs = get_response.json()
        deleted_log = next((log for log in logs if log["log_id"] == log_id), None)
        assert deleted_log is None, "Log should be deleted"
        
        print(f"✓ Test 10 PASSED: Deleted log {log_id}, verified removal")


# ===== WEIGHT TRACKING TESTS =====
class TestWeightTracking:
    """Test weight tracking endpoints"""
    
    def test_11_log_weight_entry(self, api_client, onboarded_user_token):
        """Test 11: POST /api/progress/weight logs weight"""
        token, user_id = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        today = datetime.now().strftime("%Y-%m-%d")
        weight_data = {
            "weight_kg": 72.5,
            "date": today
        }
        
        response = api_client.post(f"{BASE_URL}/api/progress/weight", json=weight_data)
        assert response.status_code == 200, f"Weight log failed with {response.status_code}"
        
        data = response.json()
        assert "entry_id" in data, "entry_id missing"
        assert data["entry_id"].startswith("wt_"), "Invalid entry_id format"
        assert data["weight_kg"] == 72.5, "weight_kg mismatch"
        assert data["date"] == today, "date mismatch"
        
        # Verify persistence
        get_response = api_client.get(f"{BASE_URL}/api/progress/weight?days=30")
        weights = get_response.json()
        our_entry = next((w for w in weights if w["entry_id"] == data["entry_id"]), None)
        assert our_entry is not None, "Weight entry not found in GET"
        assert our_entry["weight_kg"] == 72.5, "Weight value not persisted"
        
        print(f"✓ Test 11 PASSED: Weight logged {data['entry_id']}, verified in GET")
    
    def test_12_get_weight_history(self, api_client, onboarded_user_token):
        """Test 12: GET /api/progress/weight returns weight history"""
        token, user_id = onboarded_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create a weight entry first
        today = datetime.now().strftime("%Y-%m-%d")
        weight_data = {"weight_kg": 71.0, "date": today}
        create_response = api_client.post(f"{BASE_URL}/api/progress/weight", json=weight_data)
        created_entry_id = create_response.json()["entry_id"]
        
        # Get weight history
        response = api_client.get(f"{BASE_URL}/api/progress/weight?days=30")
        assert response.status_code == 200, f"Get weight history failed with {response.status_code}"
        
        weights = response.json()
        assert isinstance(weights, list), "Response should be a list"
        assert len(weights) > 0, "Should have at least one weight entry"
        
        # Verify structure
        first_entry = weights[0]
        assert "entry_id" in first_entry, "entry_id missing"
        assert "weight_kg" in first_entry, "weight_kg missing"
        assert "date" in first_entry, "date missing"
        
        # Verify our entry exists
        our_entry = next((w for w in weights if w["entry_id"] == created_entry_id), None)
        assert our_entry is not None, "Created entry not in history"
        
        print(f"✓ Test 12 PASSED: Weight history returned {len(weights)} entries")


# ===== TEST CLEANUP =====
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Cleanup happens here after all tests
    print("\n\n=== Test Data Cleanup ===")
    print("Note: Test entries prefixed with TEST_ for easy identification")
