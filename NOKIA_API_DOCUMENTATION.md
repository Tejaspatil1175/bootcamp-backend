# Nokia Network API Integration Documentation

## Overview
This document describes the Nokia Network as Code (NaC) API integration using RapidAPI for fraud detection and phone verification in the loan application system.

---

## 🔑 Configuration

### Environment Variables (config.env)
```env
# Nokia Network as Code API (RapidAPI)
NOKIA_RAPIDAPI_KEY=36c0fe18f4mshd62d5628dd0da9bp1f2821jsn7141754479d7
NOKIA_RAPIDAPI_HOST=network-as-code.nokia.rapidapi.com
```

---

## 📡 Available Nokia APIs

### 1. **Number Verification**
Verifies that a phone number belongs to the device making the request.

**Endpoint:** `/passthrough/camara/v1/number-verification/number-verification/v0/verify`

**Input:**
```json
{
  "phoneNumber": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "confidence": 0.95,
  "result": "VERIFIED",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

### 2. **SIM Swap Detection**
Detects if a SIM card has been swapped recently (fraud indicator).

**Endpoint:** `/passthrough/camara/v1/sim-swap/sim-swap/v0/check`

**Input:**
```json
{
  "phoneNumber": "+919876543210",
  "maxAge": 168
}
```
- `maxAge`: Hours to check (168 = 7 days, 240 = 10 days)

**Response:**
```json
{
  "success": true,
  "swapDetected": false,
  "lastSwapDate": null,
  "riskLevel": "LOW",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

**Risk Levels:**
- `swapDetected: true` → **HIGH RISK** (40 points added to fraud score)
- `swapDetected: false` → **LOW RISK**

---

### 3. **Device Swap Detection**
Detects if the device has been changed recently.

**Endpoint:** `/passthrough/camara/v1/device-swap/device-swap/v1/check`

**Input:**
```json
{
  "phoneNumber": "+919876543210",
  "maxAge": 168
}
```

**Response:**
```json
{
  "success": true,
  "swapDetected": false,
  "lastSwapDate": null,
  "riskLevel": "LOW",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

**Risk Levels:**
- `swapDetected: true` → **MEDIUM RISK** (20 points added)
- `swapDetected: false` → **LOW RISK**

---

### 4. **Location Verification**
Verifies if the device is within a specified geographic area.

**Endpoint:** `/location-verification/v0/verify`

**Input:**
```json
{
  "device": {
    "phoneNumber": "+919876543210"
  },
  "area": {
    "areaType": "CIRCLE",
    "center": {
      "latitude": 19.9975,
      "longitude": 73.7898
    },
    "radius": 10000
  },
  "maxAge": 120
}
```
- `radius`: In meters (10000 = 10km)
- `maxAge`: Seconds (120 = 2 minutes)

**Response:**
```json
{
  "success": true,
  "locationMatch": true,
  "verificationResult": "TRUE",
  "distance": null,
  "accuracy": "N/A",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

## 🎯 Comprehensive Fraud Check

### Function: `comprehensiveFraudCheck()`

**Description:** Runs all 4 Nokia APIs in parallel and calculates an overall fraud risk score.

**Input:**
```javascript
{
  phoneNumber: '+919876543210',
  latitude: 19.9975,
  longitude: 73.7898,
  loanAmount: 500000
}
```

**Output:**
```json
{
  "success": true,
  "riskScore": 15,
  "riskLevel": "VERY_LOW",
  "riskFactors": [
    "✅ Phone number verified by carrier",
    "✅ No recent SIM swap detected",
    "✅ No recent device swap detected",
    "✅ Location verified"
  ],
  "recommendation": "APPROVE",
  "confidence": 1.0,
  "nokiaResults": {
    "numberVerification": {...},
    "simSwapDetection": {...},
    "deviceSwapDetection": {...},
    "locationVerification": {...}
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

## 📊 Risk Scoring Algorithm

### Score Calculation

| Check | Success | Fail | Points Added |
|-------|---------|------|--------------|
| **Number Verification** | ✅ Verified | ❌ Not Verified | 30 |
| **SIM Swap Detection** | ✅ No Swap | ❌ Swap Detected | **40** (Critical) |
| **Device Swap Detection** | ✅ No Swap | ❌ Swap Detected | 20 |
| **Location Verification** | ✅ Match | ❌ Mismatch | 10 |
| **API Failure Penalty** | - | API Call Failed | 5-20 |
| **High Loan Amount** | - | >₹5 lakh + risk | Up to 20% |

### Risk Levels

| Score Range | Risk Level | Recommendation | Action |
|-------------|-----------|----------------|--------|
| 0-14 | **VERY_LOW** | `APPROVE` | ✅ Auto-approve |
| 15-29 | **LOW** | `PROCEED_WITH_CAUTION` | ⚠️ Approve with monitoring |
| 30-49 | **MEDIUM** | `ADDITIONAL_VERIFICATION` | 🔍 Request documents |
| 50-69 | **HIGH** | `MANUAL_REVIEW` | 👤 Admin review required |
| 70-100 | **CRITICAL** | `REJECT` | ❌ Auto-reject |

---

## 🔗 Backend API Endpoints

### 1. Submit Application (Auto Nokia Verification)
**POST** `/api/applications/submit`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
```

**Body:**
```json
{
  "loanAmount": 500000,
  "loanType": "personal",
  "purpose": "Business expansion",
  "fullName": "John Doe",
  "phoneNumber": "+919876543210",
  "email": "john@example.com",
  "dateOfBirth": "1990-01-01",
  "monthlyIncome": 50000,
  "address": {
    "street": "123 Main St",
    "city": "Nashik",
    "state": "Maharashtra",
    "pincode": "422001",
    "country": "India",
    "latitude": 19.9975,
    "longitude": 73.7898
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully. Verification in progress.",
  "application": {
    "applicationId": "APP_20251004_1234",
    "loanAmount": 500000,
    "status": "pending",
    "submittedAt": "2025-10-04T12:00:00.000Z"
  }
}
```

**Note:** Nokia verification runs in the background and doesn't block the submission.

---

### 2. Manually Trigger Nokia Verification (Admin)
**POST** `/api/applications/admin/verify-nokia/:applicationId`

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Nokia verification completed successfully",
  "verification": {
    "riskScore": 15,
    "riskLevel": "VERY_LOW",
    "recommendation": "APPROVE",
    "confidence": 1.0,
    "riskFactors": [...],
    "details": {...},
    "verifiedAt": "2025-10-04T12:05:00.000Z"
  }
}
```

---

### 3. Get Nokia Verification Status
**GET** `/api/applications/nokia-status/:applicationId` (User)  
**GET** `/api/applications/admin/nokia-status/:applicationId` (Admin)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "verification": {
    "applicationId": "APP_20251004_1234",
    "phoneNumber": "+919876543210",
    "loanAmount": 500000,
    "riskScore": 15,
    "riskLevel": "VERY_LOW",
    "recommendation": "APPROVE",
    "confidence": 1.0,
    "riskFactors": [...],
    "details": {
      "numberVerification": {...},
      "simSwapDetection": {...},
      "deviceSwapDetection": {...},
      "locationVerification": {...}
    },
    "verifiedAt": "2025-10-04T12:05:00.000Z",
    "error": null
  }
}
```

---

## 🧪 Testing

### Run Test Suite
```bash
cd backend
node test-nokia.js
```

### Test Cases
1. ✅ Number Verification - Valid Phone
2. ✅ SIM Swap Detection - 7-day check
3. ✅ Device Swap Detection - 7-day check
4. ✅ Location Verification - 10km radius
5. ✅ Comprehensive Check - Low Risk
6. ✅ Comprehensive Check - High Risk
7. ✅ Mock Mode Fallback

### Mock Mode
If `NOKIA_RAPIDAPI_KEY` is not set, the system automatically uses mock responses:
- Phone numbers with `000`: **Fail verification**
- Phone numbers ending in `666`: **SIM swap detected**
- All other numbers: **Pass all checks**

---

## 🛡️ Security Features

### 1. Retry Logic
- Automatic retry on network errors (max 3 attempts)
- 1-second delay between retries
- No retry on 4xx client errors

### 2. Timeout Protection
- 15-second timeout per API call
- Prevents hanging requests

### 3. Error Handling
- Graceful degradation if APIs fail
- Verification continues even if individual APIs fail
- Errors logged to application record

### 4. Rate Limiting
- 1-hour cooldown between manual re-verifications
- Prevents API abuse

---

## 📈 Database Schema Updates

### Application Model - Nokia Verification Field
```javascript
nokiaVerification: {
  verified: Boolean,
  verifiedAt: Date,
  riskScore: Number (0-100),
  riskLevel: String (VERY_LOW|LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN),
  riskFactors: [String],
  recommendation: String (APPROVE|PROCEED_WITH_CAUTION|ADDITIONAL_VERIFICATION|MANUAL_REVIEW|REJECT),
  confidence: Number (0-1),
  details: {
    numberVerification: { verified: Boolean, confidence: Number },
    simSwapDetection: { swapDetected: Boolean, lastSwapDate: String, riskLevel: String },
    deviceSwapDetection: { swapDetected: Boolean, lastSwapDate: String, riskLevel: String },
    locationVerification: { locationMatch: Boolean, distance: String }
  },
  rawResults: Mixed,
  error: String
}
```

---

## 🎬 Integration Flow

### Automatic Verification (on Application Submit)
```
User submits application
    ↓
Application saved to database
    ↓
Background task triggered (non-blocking)
    ↓
Nokia APIs called in parallel
    ↓
Results stored in application.nokiaVerification
    ↓
Admin can view results in dashboard
```

### Manual Verification (Admin Trigger)
```
Admin clicks "Verify Nokia" button
    ↓
Synchronous API call
    ↓
Results returned immediately
    ↓
Application updated with new results
```

---

## 🚨 Error Scenarios

### 1. API Key Not Configured
**Behavior:** System uses mock mode automatically  
**Log:** `⚠️ NOKIA_RAPIDAPI_KEY not configured - Nokia services will be disabled`

### 2. Network Timeout
**Behavior:** Retry up to 3 times, then mark as failed  
**Result:** `nokiaVerification.error = "Request timeout"`

### 3. API Rate Limit Exceeded
**Behavior:** API returns 429 error  
**Result:** Verification fails, admin notified

### 4. Invalid Phone Number Format
**Behavior:** API returns 400 error  
**Result:** `nokiaVerification.error = "Invalid phone number format"`

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** "Nokia API verification failed"  
**Solution:** Check if `NOKIA_RAPIDAPI_KEY` is set correctly in `config.env`

**Issue:** "Request timeout"  
**Solution:** Check network connectivity, verify RapidAPI endpoint is accessible

**Issue:** "Phone number not verified"  
**Solution:** Ensure phone number is in E.164 format (e.g., +919876543210)

---

## 📚 References

- Nokia Network as Code Documentation: https://www.networkascode.nokia.com
- RapidAPI Platform: https://rapidapi.com/
- CAMARA APIs: https://camaraproject.org/

---

**Last Updated:** October 4, 2025  
**Version:** 1.0.0
