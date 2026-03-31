# Postman API Guide

This file lists all backend API endpoints you can test in Postman (or Thunder Client / curl). Use `http://localhost:5000` as the base URL when running locally.

> Tip: Start the server from `backend` with `npm run dev` and make sure your `config/config.env` is loaded.

---

## Quick auth (get a token)

1. Register (create a user)

POST /api/auth/register
Headers: Content-Type: application/json
Body (JSON):
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123"
}

Response (201): contains `token` in JSON. Save it as `{{USER_TOKEN}}` in Postman environment.

2. Login (get token)

POST /api/auth/login
Headers: Content-Type: application/json
Body:
{
  "email": "test@example.com",
  "password": "password123"
}

Response: JSON with `token` field. Use `Authorization: Bearer {{USER_TOKEN}}` on protected endpoints.

---

## Authentication / Profile

GET /api/auth/me
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Response: current user (excludes password)

PUT /api/auth/profile
- Headers: Authorization: Bearer {{USER_TOKEN}}, Content-Type: application/json
- Body:
{
  "upiId": "testuser@paytm",
  "phoneNumber": "+919876543210"
}
- Response: updated user object

PUT /api/auth/notification-preferences
- Headers: Authorization: Bearer {{USER_TOKEN}}, Content-Type: application/json
- Body (example):
{
  "notificationPreferences": {
    "email": { "transactions": true, "security": true },
    "sms": { "transactions": true, "security": true },
    "inApp": { "transactions": true }
  }
}

GET /api/auth/security-alerts
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Query params: `?limit=10&status=OPEN`
- Response: list of security alerts for the user

---

## Applications (loan + Nokia verification)

POST /api/applications/submit
- Headers: Authorization: Bearer {{USER_TOKEN}}, Content-Type: application/json
- Body (example):
{
  "loanAmount": 100000,
  "loanType": "personal",
  "purpose": "Home renovation",
  "fullName": "Test User",
  "phoneNumber": "+919876543210",
  "email": "test@example.com",
  "dateOfBirth": "1990-01-01",
  "monthlyIncome": 50000,
  "address": {
    "street": "123 Main Street",
    "city": "Nashik",
    "state": "Maharashtra",
    "pincode": "422001",
    "latitude": 19.9975,
    "longitude": 73.7898
  }
}
- Response (201): applicationId + verification will run in background

GET /api/applications/nokia-status/:applicationId
- Headers: Authorization: Bearer {{USER_TOKEN}} (user token) or admin token for admin route
- Example: GET /api/applications/nokia-status/APP_20251006_8828
- Response: { verified: true|false, verification: { riskScore, riskLevel, details, verifiedAt } }

GET /api/applications/my-applications
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Response: list of user's applications

GET /api/applications/my-application/:applicationId
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Response: single application details

---

## Transactions (UPI payments)

POST /api/transactions/initiate
- Headers: Authorization: Bearer {{USER_TOKEN}}, Content-Type: application/json
- Body (example):
{
  "amount": 500,
  "receiverUPI": "merchant@paytm",
  "receiverName": "Merchant",
  "description": "Test payment"
}
- Response: transaction result. If fraud-check passes, transaction created. If flagged, response indicates status and risk details.

GET /api/transactions/history
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Query params: `?page=1&limit=20`
- Response: list of transactions for user

GET /api/transactions/:transactionId
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Response: single transaction detail with fraud info

POST /api/transactions/:transactionId/cancel
- Headers: Authorization: Bearer {{USER_TOKEN}}
- Response: cancellation result (if allowed)

---

## Admin endpoints (require admin token)

Note: Use an admin token (login as an admin user). Some admin endpoints require permission checks.

GET /api/transactions/admin/flagged
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}
- Query params: ?page=1&limit=20&severity=HIGH
- Response: flagged transactions list with transactionIds like "TXN_20251008_1234"

PUT /api/transactions/admin/:transactionId/review
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}, Content-Type: application/json
- **IMPORTANT**: Use TRANSACTION ID (like TXN_20251008_1234), NOT Application ID (APP_20251008_5160)
- Body (example):
{
  "decision": "approved" | "rejected",
  "comments": "Reviewed and approved after verification"
}
- Response: updated transaction

**WORKFLOW**: First call GET flagged to get transactionIds, then use those IDs in the review endpoint.

GET /api/admin/security/frozen-accounts
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}
- Response: list of frozen user accounts

POST /api/admin/security/unfreeze-account/:userId
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}, Content-Type: application/json
- Body: { "notes": "Identity verified, unfreezing" }
- Response: success

GET /api/admin/security/security-alerts
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}
- Response: all security alerts across users

---

## 📋 **ADMIN ENDPOINTS EXPLAINED**

### **Transaction Management:**
1. **GET /api/transactions/admin/flagged** 
   - **Purpose**: Lists transactions flagged by Nokia fraud detection
   - **Returns**: Transactions with status "blocked" or "pending" that need admin review
   - **Use Case**: See which payments were automatically blocked due to high fraud risk

2. **PUT /api/transactions/admin/:transactionId/review**
   - **Purpose**: Manually approve or reject flagged transactions
   - **Input**: Transaction ID from flagged list + decision (approved/rejected)
   - **Result**: Changes transaction status and allows/blocks the payment
   - **Use Case**: Override fraud detection when false positive occurs

### **Account Security:**
3. **GET /api/admin/security/frozen-accounts**
   - **Purpose**: Lists user accounts that are frozen due to suspicious activity
   - **Returns**: Users with accountStatus: "frozen"
   - **Use Case**: Monitor accounts locked due to repeated fraud attempts

4. **POST /api/admin/security/unfreeze-account/:userId**
   - **Purpose**: Unfreeze a user's account after manual verification
   - **Input**: User ID + reason for unfreezing
   - **Result**: Restores user's ability to make transactions
   - **Use Case**: Restore access after identity verification

5. **GET /api/admin/security/security-alerts**
   - **Purpose**: View all security alerts across the system
   - **Returns**: Nokia fraud detection alerts, suspicious login attempts, etc.
   - **Use Case**: Monitor overall system security threats

---

## Admin - Applications

GET /api/applications/admin/all
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}
- Query params: `?status=pending&page=1&limit=10&search=John`
- Response: paginated applications

GET /api/applications/admin/details/:applicationId
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}
- Response: full application + nokia verification details

PUT /api/applications/admin/update-status/:applicationId
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}, Content-Type: application/json
- Body (example):
{
  "decision": "approved",
  "reason": "Verified documents",
  "approvedAmount": 90000
}
- Response: updated application status

POST /api/applications/admin/verify-nokia/:applicationId
- Headers: Authorization: Bearer {{ADMIN_TOKEN}}
- Response: triggers manual Nokia verification synchronously and returns verification result

---

## 🔥 **ADMIN TRANSACTION REVIEW - CORRECT WORKFLOW**

**❌ WRONG** (what you're doing):
```
PUT /api/transactions/admin/APP_20251008_5160/review  
❌ This fails because APP_20251008_5160 is an Application ID, not Transaction ID
```

**✅ CORRECT** (what you should do):

**Step 1:** Get flagged transactions first
```
GET /api/transactions/admin/flagged
Headers: Authorization: Bearer {{ADMIN_TOKEN}}

Response:
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "TXN_20251008_4592",  ← Use THIS ID
        "amount": 500,
        "status": "blocked",
        "fraudCheck": { "riskLevel": "HIGH" },
        "userId": { "name": "John Doe" }
      }
    ]
  }
}
```

**Step 2:** Review using the TRANSACTION ID
```
PUT /api/transactions/admin/TXN_20251008_4592/review
Headers: Authorization: Bearer {{ADMIN_TOKEN}}, Content-Type: application/json
Body:
{
  "decision": "approved",
  "comments": "Manual review passed"
}
```

**Key Points:**
- **Applications** have IDs like `APP_20251008_XXXX` (for loan applications)
- **Transactions** have IDs like `TXN_20251008_XXXX` (for UPI payments)
- Transaction review endpoint only works with Transaction IDs, not Application IDs
- Always call `/flagged` first to get the correct transaction IDs

---

## How to set tokens in Postman

1. After logging in, copy the `token` value from the JSON response.
2. In Postman, create an environment variable named `USER_TOKEN` or `ADMIN_TOKEN` and paste the token.
3. For requests, add header:
   Authorization: Bearer {{USER_TOKEN}}

---

## Troubleshooting & Notes

- If you get `401 Token is not valid`:
  - Ensure the Authorization header is `Bearer <token>` with full token.
  - Token must be a user token for user routes (contains `userId`) and an admin token for admin routes (contains `adminId`).
  - Ensure server was started in the same environment where `config/config.env` was loaded (contains `JWT_SECRET`).

- If Nokia results show `API failed` or minimal fields:
  - Check `backend/config/config.env` for `NOKIA_RAPIDAPI_KEY` and `NOKIA_RAPIDAPI_HOST`.
  - Run `node test-nokia.js` from `backend` to see detailed Nokia test logs.

- For email/SMS simulation: If Twilio/Gmail credentials are missing the system will only simulate sending messages (console logs). Add credentials to `config.env` if you want real notifications.

---

## Example Postman Workflow (step-by-step)

1. Register user (POST /api/auth/register)
2. Login (POST /api/auth/login) -> copy token
3. PUT /api/auth/profile with token
4. POST /api/transactions/initiate with token
5. Check GET /api/transactions/history
6. Submit application (POST /api/applications/submit)
7. Wait ~5s and GET /api/applications/nokia-status/:applicationId to view Nokia verification

---

If you'd like, I can also generate a Postman collection JSON file for import (with all endpoints prefilled). Say "generate collection" and I'll add it to the repo.