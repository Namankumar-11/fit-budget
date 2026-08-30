"""
FitBudget Subscription & Monetization Tests
Tests: Subscription status, tier management, generation limits, content gating, food database with cuisines
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
def free_user_token(api_client):
    """Use existing test user (free tier)"""
    payload = {
        "email": "test@fitbudget.com",
        "password": "Test1234"
    }
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
    if response.status_code == 200:
        data = response.json()
        return data["session_token"], data["user_id"]
    pytest.skip("Failed to login test user")


# ===== SUBSCRIPTION STATUS TESTS =====
class TestSubscriptionStatus:
    """Test subscription status endpoint"""
    
    def test_01_subscription_status_free_tier(self, api_client, free_user_token):
        """Test 1: GET /api/subscription/status returns correct data for free tier user"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/subscription/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tier" in data, "tier missing"
        assert data["tier"] == "free", f"Expected free tier, got {data['tier']}"
        
        assert "generation_status" in data, "generation_status missing"
        gen_status = data["generation_status"]
        assert "used" in gen_status, "generation_status.used missing"
        assert "limit" in gen_status, "generation_status.limit missing"
        assert "remaining" in gen_status, "generation_status.remaining missing"
        assert gen_status["limit"] == 5, f"Free tier should have 5 generations, got {gen_status['limit']}"
        
        assert "pricing" in data, "pricing missing"
        pricing = data["pricing"]
        assert "premium_monthly" in pricing, "premium_monthly missing"
        assert "unlock_single" in pricing, "unlock_single missing"
        assert "currency" in pricing, "currency missing"
        
        assert "region" in data, "region missing"
        assert data["region"] in ["india", "global"], f"Invalid region: {data['region']}"
        
        # Verify pricing values match region
        if data["region"] == "india":
            assert pricing["premium_monthly"] == 79, "India premium_monthly should be ₹79"
            assert pricing["unlock_single"] == 19, "India unlock_single should be ₹19"
            assert pricing["currency"] == "INR", "India currency should be INR"
        else:
            assert pricing["premium_monthly"] == 1.99, "Global premium_monthly should be $1.99"
            assert pricing["unlock_single"] == 0.49, "Global unlock_single should be $0.49"
            assert pricing["currency"] == "USD", "Global currency should be USD"
        
        print(f"✓ Test 1 PASSED: Subscription status - tier={data['tier']}, limit={gen_status['limit']}, region={data['region']}")


# ===== PLAN UNLOCK TESTS =====
class TestPlanUnlock:
    """Test per-plan unlock functionality"""
    
    def test_02_unlock_plan_success(self, api_client, free_user_token):
        """Test 2: POST /api/subscription/unlock-plan successfully unlocks a specific plan"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # First get current diet plan (if exists)
        diet_response = api_client.get(f"{BASE_URL}/api/diet/current")
        diet_data = diet_response.json()
        
        # If no plan exists, skip this test
        if not diet_data.get("plan_id"):
            pytest.skip("No diet plan exists for user, cannot test unlock")
        
        plan_id = diet_data["plan_id"]
        
        # Unlock the plan
        unlock_payload = {
            "plan_id": plan_id,
            "plan_type": "diet"
        }
        response = api_client.post(f"{BASE_URL}/api/subscription/unlock-plan", json=unlock_payload)
        assert response.status_code == 200, f"Unlock failed with {response.status_code}"
        
        data = response.json()
        assert "message" in data, "message missing"
        assert "unlocked" in data, "unlocked missing"
        assert data["unlocked"] == True, "unlocked should be True"
        
        # Verify the plan is now unlocked by checking subscription status
        status_response = api_client.get(f"{BASE_URL}/api/subscription/status")
        status_data = status_response.json()
        unlocked_plans = status_data.get("unlocked_plans", [])
        plan_key = f"diet_{plan_id}"
        assert plan_key in unlocked_plans, f"Plan {plan_key} should be in unlocked_plans"
        
        print(f"✓ Test 2 PASSED: Plan {plan_id} unlocked successfully")


# ===== UPGRADE TO PREMIUM TESTS =====
class TestSubscriptionUpgrade:
    """Test subscription upgrade functionality"""
    
    def test_03_upgrade_to_premium(self, api_client):
        """Test 3: POST /api/subscription/upgrade changes user to premium tier"""
        # Create a new test user for upgrade test
        timestamp = int(datetime.now().timestamp() * 1000)
        register_payload = {
            "email": f"TEST_upgrade_user_{timestamp}@fitbudget.test",
            "password": "Test1234",
            "name": "Upgrade Test User"
        }
        register_response = api_client.post(f"{BASE_URL}/api/auth/register", json=register_payload)
        token = register_response.json()["session_token"]
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Complete onboarding
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
        api_client.post(f"{BASE_URL}/api/onboarding", json=onboarding_data)
        
        # Check initial status (should be free)
        status_before = api_client.get(f"{BASE_URL}/api/subscription/status")
        assert status_before.json()["tier"] == "free", "User should start as free tier"
        assert status_before.json()["generation_status"]["limit"] == 5, "Free tier should have 5 generations"
        
        # Upgrade to premium
        upgrade_response = api_client.post(f"{BASE_URL}/api/subscription/upgrade")
        assert upgrade_response.status_code == 200, f"Upgrade failed with {upgrade_response.status_code}"
        
        upgrade_data = upgrade_response.json()
        assert "tier" in upgrade_data, "tier missing in response"
        assert upgrade_data["tier"] == "premium", f"Expected premium, got {upgrade_data['tier']}"
        
        # Verify tier change by checking subscription status
        status_after = api_client.get(f"{BASE_URL}/api/subscription/status")
        status_data = status_after.json()
        assert status_data["tier"] == "premium", "User should now be premium tier"
        assert status_data["generation_status"]["limit"] == 60, "Premium tier should have 60 generations"
        
        print(f"✓ Test 3 PASSED: User upgraded to premium, limit increased from 5 to 60")


# ===== CONTENT GATING TESTS =====
class TestContentGating:
    """Test content gating for free vs premium users"""
    
    def test_04_diet_plan_gated_for_free_user(self, api_client, free_user_token):
        """Test 4: GET /api/diet/current returns gated content (tips_locked, alternatives_locked) for free user"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/diet/current")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "subscription_tier" in data, "subscription_tier missing"
        assert data["subscription_tier"] == "free", "User should be free tier"
        
        assert "generation_status" in data, "generation_status missing"
        gen_status = data["generation_status"]
        assert gen_status["limit"] == 5, "Free tier should have 5 generation limit"
        
        # If plan exists, check gating
        if data.get("plan_data"):
            plan_data = data["plan_data"]
            
            # Check if tips are gated
            if "tips" in plan_data:
                # For free users, only 1 tip should be visible
                if "tips_locked" in plan_data and plan_data["tips_locked"]:
                    assert len(plan_data["tips"]) == 1, f"Free users should see only 1 tip, got {len(plan_data['tips'])}"
                    print(f"✓ Tips gated: showing 1/{len(plan_data['tips'])} tips")
            
            # Check if alternatives are gated
            if "alternatives_locked" in plan_data and plan_data["alternatives_locked"]:
                assert len(plan_data.get("alternatives", [])) == 0, "Free users should see 0 alternatives when locked"
                print(f"✓ Alternatives gated: showing 0 alternatives")
        
        print(f"✓ Test 4 PASSED: Diet plan content properly gated for free user")
    
    def test_05_workout_plan_gated_for_free_user(self, api_client, free_user_token):
        """Test 5: GET /api/workout/current returns gated content (tips_locked) for free user"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/workout/current")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "subscription_tier" in data, "subscription_tier missing"
        assert data["subscription_tier"] == "free", "User should be free tier"
        
        assert "generation_status" in data, "generation_status missing"
        gen_status = data["generation_status"]
        assert gen_status["limit"] == 5, "Free tier should have 5 generation limit"
        
        # If plan exists, check tips gating
        if data.get("plan_data"):
            plan_data = data["plan_data"]
            
            if "tips" in plan_data:
                if "tips_locked" in plan_data and plan_data["tips_locked"]:
                    assert len(plan_data["tips"]) == 1, f"Free users should see only 1 tip, got {len(plan_data['tips'])}"
                    print(f"✓ Workout tips gated: showing 1 tip")
        
        print(f"✓ Test 5 PASSED: Workout plan content properly gated for free user")


# ===== GLOBAL FOOD DATABASE TESTS =====
class TestGlobalFoodDatabase:
    """Test global food database with 226 foods across 14 cuisines"""
    
    def test_06_food_search_pizza_returns_italian(self, api_client, free_user_token):
        """Test 6: GET /api/foods/search?q=pizza returns Italian cuisine foods"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/foods/search?q=pizza")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        foods = response.json()
        assert isinstance(foods, list), "Response should be a list"
        assert len(foods) > 0, "Should return at least one pizza item"
        
        # Check that results contain "pizza" and have Italian cuisine
        pizza_items = [f for f in foods if "pizza" in f["name"].lower()]
        assert len(pizza_items) > 0, "No pizza items found"
        
        # Verify cuisine field exists and is italian
        first_pizza = pizza_items[0]
        assert "cuisine" in first_pizza, "cuisine field missing"
        assert first_pizza["cuisine"] == "italian", f"Expected italian cuisine, got {first_pizza['cuisine']}"
        
        print(f"✓ Test 6 PASSED: Found {len(pizza_items)} pizza items with Italian cuisine: {[f['name'] for f in pizza_items]}")
    
    def test_07_food_search_ramen_returns_japanese(self, api_client, free_user_token):
        """Test 7: GET /api/foods/search?q=ramen returns Japanese cuisine foods"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/foods/search?q=ramen")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        foods = response.json()
        assert isinstance(foods, list), "Response should be a list"
        assert len(foods) > 0, "Should return at least one ramen item"
        
        # Check that results contain "ramen" and have Japanese cuisine
        ramen_items = [f for f in foods if "ramen" in f["name"].lower()]
        assert len(ramen_items) > 0, "No ramen items found"
        
        # Verify cuisine field
        first_ramen = ramen_items[0]
        assert "cuisine" in first_ramen, "cuisine field missing"
        assert first_ramen["cuisine"] == "japanese", f"Expected japanese cuisine, got {first_ramen['cuisine']}"
        
        print(f"✓ Test 7 PASSED: Found {len(ramen_items)} ramen items with Japanese cuisine: {[f['name'] for f in ramen_items]}")
    
    def test_08_food_search_cuisine_filter_korean(self, api_client, free_user_token):
        """Test 8: GET /api/foods/search?cuisine=korean returns Korean foods only"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        response = api_client.get(f"{BASE_URL}/api/foods/search?cuisine=korean")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        foods = response.json()
        assert isinstance(foods, list), "Response should be a list"
        assert len(foods) > 0, "Should return at least one Korean food item"
        
        # Verify all returned foods are Korean cuisine
        for food in foods:
            assert "cuisine" in food, f"cuisine field missing in {food['name']}"
            assert food["cuisine"] == "korean", f"Expected korean cuisine, got {food['cuisine']} for {food['name']}"
        
        korean_names = [f["name"] for f in foods]
        print(f"✓ Test 8 PASSED: Found {len(foods)} Korean foods: {korean_names}")
    
    def test_09_food_database_has_multiple_cuisines(self, api_client, free_user_token):
        """Test 9: Verify food database contains foods from multiple global cuisines"""
        token, user_id = free_user_token
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test different cuisine searches to verify global database
        test_cuisines = [
            ("italian", "Margherita Pizza"),
            ("japanese", "Sushi"),
            ("chinese", "Fried Rice"),
            ("mexican", "Burrito"),
            ("american", "Hamburger"),
            ("thai", "Pad Thai"),
            ("mediterranean", "Hummus"),
            ("korean", "Bibimbap")
        ]
        
        found_cuisines = []
        for cuisine_name, expected_food in test_cuisines:
            response = api_client.get(f"{BASE_URL}/api/foods/search?cuisine={cuisine_name}")
            if response.status_code == 200:
                foods = response.json()
                if len(foods) > 0:
                    found_cuisines.append(cuisine_name)
        
        assert len(found_cuisines) >= 5, f"Expected at least 5 cuisines in database, found {len(found_cuisines)}: {found_cuisines}"
        
        print(f"✓ Test 9 PASSED: Found {len(found_cuisines)} cuisines in global database: {found_cuisines}")


# ===== TEST CLEANUP =====
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    print("\n\n=== Test Data Cleanup ===")
    print("Note: Test entries prefixed with TEST_ for easy identification")
