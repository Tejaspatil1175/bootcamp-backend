# 🚀 Nokia API Integration - Quick Start Guide

## ✅ What's Been Implemented

### 1. **New Service: `nokiaService.js`**
- ✅ Number Verification API
- ✅ SIM Swap Detection API  
- ✅ Device Swap Detection API
- ✅ Location Verification API
- ✅ Comprehensive Fraud Check (all APIs in parallel)
- ✅ Risk scoring algorithm (0-100 scale)
- ✅ Automatic retry logic
- ✅ Mock mode for testing without API key

### 2. **Updated Files**
- ✅ `backend/services/nokiaService.js` - Complete rewrite with RapidAPI integration
- ✅ `backend/config/config.env` - Added Nokia API credentials
- ✅ `backend/models/Application.js` - Added `nokiaVerification` field
- ✅ `backend/controllers/applicationController.js` - Integrated Nokia verification
- ✅ `backend/routes/applicationRoutes.js` - Added Nokia verification endpoints
- ✅ `backend/package.json` - Added test script

### 3. **New Files**
- ✅ `backend/test-nokia.js` - Comprehensive test suite
- ✅ `backend/NOKIA_API_DOCUMENTATION.md` - Full API documentation
- ✅ `backend/NOKIA_INTEGRATION_GUIDE.md` - This file

---

## 🎯 How It Works

### Automatic Verification (Default Behavior)
```
User submits loan application
    ↓
Application saved to database ✅
    ↓
Nokia verification starts in background (non-blocking) 🔄
    ↓
All 4 Nokia APIs called in parallel:
  - Number Verification
  - SIM Swap Detection  
  - Device Swap Detection
  - Location Verification
    ↓
Risk score calculated (0-100)
    ↓
Results saved to application.nokiaVerification
    ↓
Admin can view results in dashboard 📊
```

**Time:** ~3-5 seconds for all APIs  
**User Experience:** Application submits instantly, verification happens in background

---

## 🏃 Quick Start

### Step 1: Test the APIs
```bash
cd backend
npm run test:nokia
```

**Expected Output:**
```
🧪 ========== NOKIA API TEST SUITE ==========

📋 Test Configuration:
   API Key Available: ✅ YES
   Base Hostname: network-as-code.p-eu.rapidapi.com
   RapidAPI Host: network-as-code.nokia.rapidapi.com

🧪 TEST 1: Number Verification
─────────────────────────────────────────────
✅ Result: {
  "success": true,
  "verified": true,
  "confidence": 0.95,
  ...
}
```

### Step 2: Start the Server
```bash
npm run dev
```

### Step 3: Submit a Test Application

**Using Postman/Thunder Client:**

**POST** `http://localhost:5000/api/applications/submit`

**Headers:**
```
Authorization: Bearer <your_user_token>
Content-Type: application/json
```

**Body:**
```json
{
  "loanAmount": 500000,
  "loanType": "personal",
  "purpose": "Business expansion",
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
    "country": "India",
    "latitude": 19.9975,
    "longitude": 73.7898
  }
}
```

### Step 4: Check Verification Status

**Wait 5 seconds, then:**

**GET** `http://localhost:5000/api/applications/nokia-status/APP_20251004_1234`

---

## 📊 Risk Score Interpretation

| Risk Score | Risk Level | Auto Action | Manual Action Required |
|-----------|--------------|-------------|----------------------|
| **0-14**  | VERY_LOW ✅  | Auto-approve | None - proceed |
| **15-29** | LOW ⚠️ | Approve with monitoring | None - proceed |
| **30-49** | MEDIUM ⚠️ | Request additional docs | Review documents |
| **50-69** | HIGH 🔴 | Hold for manual review | **Required** - Verify identity |
| **70-100** | CRITICAL 🚨 | Auto-reject | **Required** - Contact applicant |

---

## 🧪 Testing Scenarios

### Scenario 1: Low Risk (Should Pass)
```json
{
  "phoneNumber": "+919876543210",
  "loanAmount": 200000
}
```
**Expected:** Risk Score < 30

### Scenario 2: High Risk - SIM Swap (Should Fail)
```json
{
  "phoneNumber": "+919876543666",  // Ends with 666 = Mock SIM swap
  "loanAmount": 500000
}
```
**Expected:** Risk Score > 70

---

## 🛠️ Troubleshooting

### "Nokia API not configured"
**Solution:** Check `config.env` has `NOKIA_RAPIDAPI_KEY`  
**Workaround:** System uses mock mode automatically

### "Request timeout"
**Solution:** Check internet connection  
**Debug:** Run `npm run test:nokia`

---

## ✅ Checklist

- [x] Nokia service rewritten
- [x] Environment variables configured
- [x] Database schema updated
- [x] Routes added
- [x] Test suite created
- [ ] Frontend updated (TODO)

---

**🎉 Integration Complete! Run `npm run test:nokia` to verify.**
