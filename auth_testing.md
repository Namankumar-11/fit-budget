# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  onboarding_complete: true,
  age: 25,
  gender: 'male',
  height_cm: 175,
  weight_kg: 70,
  fitness_goal: 'muscle_gain',
  training_experience: 'beginner',
  workout_location: 'gym',
  food_preference: 'non-veg',
  allergies: '',
  daily_budget: 200,
  target_calories: 2500,
  protein_g: 140,
  carbs_g: 300,
  fats_g: 70,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
curl -X GET "https://budget-fitness-diet.preview.emergentagent.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "budget-fitness-diet.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://budget-fitness-diet.preview.emergentagent.com");
```
