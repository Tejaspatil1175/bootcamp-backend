import dotenv from 'dotenv';
import path from 'path';
import NokiaNetworkService from './services/nokiaService.js';

// Load environment variables
const envPath = path.resolve(process.cwd(), 'config', 'config.env');
dotenv.config({ path: envPath });

console.log('\n🧪 ========== NOKIA API TEST SUITE ==========\n');

const nokiaService = new NokiaNetworkService();

// Test data
const testData = {
  validPhone: '+99999991000',
  invalidPhone: '+919876543000', // Contains '000' - will fail in mock
  latitude: 19.9975,  // Nashik coordinates
  longitude: 73.7898,
  loanAmount: 500000
};

async function runTests() {
  console.log('📋 Test Configuration:');
  console.log(`   API Key Available: ${nokiaService.isAvailable() ? '✅ YES' : '❌ NO (Will use MOCK)'}`);
  console.log(`   Base Hostname: ${nokiaService.baseHostname}`);
  console.log(`   RapidAPI Host: ${nokiaService.rapidApiHost}\n`);

  // Test 1: Individual API - Number Verification
  console.log('🧪 TEST 1: Number Verification');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.verifyPhoneNumber(testData.validPhone);
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  // Test 2: Individual API - SIM Swap Check
  console.log('🧪 TEST 2: SIM Swap Detection');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.checkSimSwap(testData.validPhone, 168); // 7 days
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  // Test 3: Individual API - Device Swap Check
  console.log('🧪 TEST 3: Device Swap Detection');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.checkDeviceSwap(testData.validPhone, 168); // 7 days
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  // Test 4: Individual API - Location Verification
  console.log('🧪 TEST 4: Location Verification');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.verifyLocation(
      testData.validPhone,
      testData.latitude,
      testData.longitude,
      10000 // 10km radius
    );
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  // Test 5: Comprehensive Fraud Check - Valid Phone
  console.log('🧪 TEST 5: Comprehensive Fraud Check (Valid Phone)');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.comprehensiveFraudCheck({
      phoneNumber: testData.validPhone,
      latitude: testData.latitude,
      longitude: testData.longitude,
      loanAmount: testData.loanAmount
    });
    console.log('✅ Comprehensive Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  // Test 6: Comprehensive Fraud Check - Invalid Phone (should trigger high risk)
  console.log('🧪 TEST 6: Comprehensive Fraud Check (High Risk Phone)');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.comprehensiveFraudCheck({
      phoneNumber: testData.invalidPhone,
      latitude: testData.latitude,
      longitude: testData.longitude,
      loanAmount: testData.loanAmount
    });
    console.log('✅ Comprehensive Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  // Test 7: Mock Mode Test
  console.log('🧪 TEST 7: Mock Mode (Fallback Test)');
  console.log('─────────────────────────────────────────────');
  try {
    const result = await nokiaService.mockComprehensiveFraudCheck({
      phoneNumber: testData.validPhone,
      loanAmount: testData.loanAmount
    });
    console.log('✅ Mock Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log('\n');

  console.log('🎉 ========== ALL TESTS COMPLETED ==========\n');
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 FATAL ERROR:', error);
  process.exit(1);
});
