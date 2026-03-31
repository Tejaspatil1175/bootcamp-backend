# Super Admin Registration API Documentation

## Super Admin Registration Endpoint

### POST `/api/admin/register-super-admin`

This endpoint allows you to register the first super admin for your system.

#### Request Body:
```json
{
  "username": "superadmin",
  "email": "tejas@gmail.com",
  "password": "Tp8788244416",
  "fullName": "Super Administrator",
  "employeeId": "SA001"
}
```

#### Optional Security (Currently Commented Out):
If you want to add an extra security layer, uncomment the registration key validation in the controller and add:
```json
{
  "username": "superadmin",
  "email": "tejas@gmail.com",
  "password": "Tp8788244416",
  "fullName": "Super Administrator",
  "employeeId": "SA001",
  "registrationKey": "YOUR_SECRET_KEY"
}
```

#### Required Fields:
- `username` (string, 3-20 characters)
- `email` (string, valid email format)
- `password` (string, minimum 8 characters)
- `fullName` (string)
- `employeeId` (string, unique identifier)

#### Success Response (201 Created):
```json
{
  "success": true,
  "message": "Super admin registered successfully",
  "token": "jwt_token_here",
  "admin": {
    "id": "admin_id",
    "username": "superadmin",
    "email": "tejas@gmail.com",
    "fullName": "Super Administrator",
    "role": "super_admin",
    "department": "it",
    "employeeId": "SA001",
    "permissions": [
      "view_applications",
      "approve_loans",
      "reject_loans",
      "manage_users",
      "view_reports",
      "export_data",
      "system_settings",
      "user_management"
    ]
  }
}
```

#### Error Responses:

**400 Bad Request** - Missing required fields:
```json
{
  "success": false,
  "message": "All fields are required"
}
```

**400 Bad Request** - Super admin already exists:
```json
{
  "success": false,
  "message": "Super admin already exists. Only one super admin is allowed."
}
```

**400 Bad Request** - Admin already exists:
```json
{
  "success": false,
  "message": "Admin with this email, username, or employee ID already exists"
}
```

**400 Bad Request** - Password too short:
```json
{
  "success": false,
  "message": "Password must be at least 8 characters long"
}
```

#### Usage Example with cURL:
```bash
curl -X POST http://localhost:4000/api/admin/register-super-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "superadmin",
    "email": "admin@company.com", 
    "password": "securepassword123",
    "fullName": "Super Administrator",
    "employeeId": "SA001"
  }'
```

#### Usage Example with JavaScript/Fetch:
```javascript
const registerSuperAdmin = async () => {
  try {
    const response = await fetch('/api/admin/register-super-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'superadmin',
        email: 'admin@company.com',
        password: 'securepassword123',
        fullName: 'Super Administrator',
        employeeId: 'SA001'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Super admin registered:', data.admin);
      // Store the token for future requests
      localStorage.setItem('adminToken', data.token);
    } else {
      console.error('Registration failed:', data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## Login After Registration

After successful registration, you can use the regular admin login endpoint with your credentials:

### POST `/api/admin/login`
```json
{
  "email": "tejas@gmail.com",
  "password": "Tp87882444165"
}
```

## Security Notes:

1. **Single Super Admin**: The system only allows one super admin to exist at a time for security.

2. **Registration Key** (Optional): You can uncomment the registration key validation in the controller for extra security.

3. **Environment Variable**: If using registration key, set it in your `.env` file:
   ```
   SUPER_ADMIN_REGISTRATION_KEY=your_secret_key_here
   ```

4. **After Registration**: Once super admin is created, this endpoint will reject further super admin registration attempts.

5. **Creating Other Admins**: After super admin is registered, use the existing `/api/admin/create-admin` endpoint (requires super admin authentication) to create other admin roles.
