#!/bin/bash

echo "🚀 Testing Fraud Protection System"
echo "=================================="
echo ""

# Base URL
BASE_URL="http://localhost:5000/api"

echo "📝 Step 1: Register User"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ Registration failed"
  echo "$REGISTER_RESPONSE"
  exit 1
fi

echo "✅ User registered successfully"
echo "Token: $TOKEN"
echo ""

echo "📝 Step 2: Setup Profile (UPI ID & Phone)"
curl -s -X PUT "$BASE_URL/auth/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "upiId": "testuser@paytm",
    "phoneNumber": "+919876543210"
  }' | json_pp

echo ""
echo "✅ Profile setup complete"
echo ""

echo "📝 Step 3: Make Low-Risk Payment"
curl -s -X POST "$BASE_URL/transactions/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "receiverUPI": "merchant@paytm",
    "receiverName": "Test Merchant",
    "description": "Test payment"
  }' | json_pp

echo ""
echo "✅ Low-risk transaction completed"
echo ""

echo "📝 Step 4: Make High-Risk Payment (Large Amount)"
curl -s -X POST "$BASE_URL/transactions/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 18000,
    "receiverUPI": "unknown@paytm",
    "receiverName": "Unknown Merchant",
    "description": "Large payment"
  }' | json_pp

echo ""
echo "⚠️ High-risk transaction attempted"
echo ""

echo "📝 Step 5: Check Transaction History"
curl -s -X GET "$BASE_URL/transactions/history" \
  -H "Authorization: Bearer $TOKEN" | json_pp

echo ""
echo "✅ Transaction history retrieved"
echo ""

echo "📝 Step 6: Check Security Alerts"
curl -s -X GET "$BASE_URL/auth/security-alerts" \
  -H "Authorization: Bearer $TOKEN" | json_pp

echo ""
echo "✅ Security alerts retrieved"
echo ""

echo "🎉 Testing Complete!"
echo "===================="
echo ""
echo "Check your server console for detailed fraud check logs"
