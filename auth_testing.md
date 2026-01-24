# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session
Run this in your environment shell:

```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,  // Custom UUID field (MongoDB's _id is separate/internal)
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,  // Must match user.user_id exactly
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
# Test auth endpoint
curl -X GET "https://your-app.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test protected endpoints (example)
curl -X GET "https://your-app.com/api/tasks" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing (Playwright)

```js
// Set cookie and navigate
await page.context.add_cookies([
  {
    name: 'session_token',
    value: 'YOUR_SESSION_TOKEN',
    domain: 'your-app.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  }
]);
await page.goto('https://your-app.com');
```

## Quick Debug

```bash
mongosh --eval "
use('test_database');
db.users.find().limit(2).pretty();
db.user_sessions.find().limit(2).pretty();
"
```

## Clean Test Data

```bash
mongosh --eval "
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
"
```

## Checklist
- User document has `user_id` field (custom UUID, MongoDB `_id` is separate)
- Session `user_id` matches user's `user_id` exactly
- All backend queries use `{ "_id": 0 }` projection to exclude MongoDB `_id`
- `/api/auth/me` returns user data (not 401/404)
- Dashboard loads without redirect
- CRUD operations work
