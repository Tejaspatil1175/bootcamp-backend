# Loan Application API Documentation

## Base URL
```
http://localhost:4000/api
```

## Authentication
Use Bearer token in Authorization header:
```
Authorization: Bearer <token>
```

---

## User Authentication

### 1. Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "tejas patil",
  "email": "tejaspatil@gmail.com",
  "password": "12345678"
}
```

### 2. Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### 3. Get User Profile
```http
GET /auth/profile
Authorization: Bearer <user_token>
```

---

## Loan Applications (User)

### 1. Submit Loan Application
```http
POST /applications/submit
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "loanAmount": 100000,
  "loanType": "personal",
  "purpose": "Home renovation",
  "fullName": "John Doe",
  "phoneNumber": "9876543210",
  "email": "john@example.com",
  "dateOfBirth": "1990-01-15",
  "monthlyIncome": 50000,
  "address": {
    "street": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India"
  }
}
```

### 2. Get My Applications
```http
GET /applications/my-applications
Authorization: Bearer <user_token>
```

### 3. Get Single Application
```http
GET /applications/my-application/{applicationId}
Authorization: Bearer <user_token>
```

---

## Admin Authentication

### 1. Register Super Admin (Initial Setup)
```http
POST /admin/register-super-admin
Content-Type: application/json

{
  "username": "superadmin",
  "email": "tejaspatil@gmail",
  "password": "Tp8788244416"",
  "fullName": "Super Administrator", 
  "employeeId": "SA001"
}
```

### 2. Admin Login
```http
POST /admin/login
Content-Type: application/json

{
  "email": "tejaspatil@gmail",
  "password": "Tp8788244416"
}
```

### 3. Get Admin Profile
```http
GET /admin/profile
Authorization: Bearer <admin_token>
```

---

## Admin - Application Management

### 1. Get All Applications
```http
GET /admin/applications/admin/all?status=pending&page=1&limit=10
Authorization: Bearer <admin_token>
```

### 2. Get Application Details
```http
GET /applications/admin/details/{applicationId}
Authorization: Bearer <admin_token>
```

### 3. Approve/Reject Application
```http
PUT /applications/admin/update-status/{applicationId}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "decision": "approved",
  "reason": "All documents verified",
  "approvedAmount": 80000,
  "comments": "Approved with reduced amount"
}
```

### 4. Get Application Statistics
```http
GET /applications/admin/stats
Authorization: Bearer <admin_token>
```

---

## Admin - User Management

### 1. Get All Users
```http
GET /admin/users?page=1&limit=10&search=john
Authorization: Bearer <admin_token>
```

### 2. Get User Details (with Applications)
```http
GET /admin/users/{userId}
Authorization: Bearer <admin_token>
```

**Response includes:**
- User profile information
- All applications submitted by the user
- Application summary statistics

### 3. Dashboard Statistics
```http
GET /admin/dashboard/stats
Authorization: Bearer <admin_token>
```

### 4. Create New Admin (Super Admin Only)
```http
POST /admin/create-admin
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "username": "newadmin",
  "email": "newadmin@loan.com",
  "password": "password123",
  "fullName": "New Admin",
  "role": "loan_officer",
  "department": "loans",
  "employeeId": "EMP002",
  "permissions": ["view_applications", "approve_loans"]
}
```

---

## Application Status Flow
1. **pending** - Application submitted by user
2. **approved** - Approved by admin
3. **rejected** - Rejected by admin

## Admin Roles
- **super_admin** - Full access to everything
- **admin** - Can manage applications and users
- **senior_admin** - Senior level permissions
- **loan_officer** - Can view and process loans
- **risk_analyst** - Can analyze risk and approve/reject

## Default Admin Credentials
**Note**: With the new super admin registration endpoint, there are no default credentials. You need to register the first super admin using the `/admin/register-super-admin` endpoint.

---

## Error Response Format
```json
{
  "success": false,
  "message": "Error message here"
}
```

## Success Response Format
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```
