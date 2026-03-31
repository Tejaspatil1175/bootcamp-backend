import dotenv from 'dotenv';
import path from 'path';
import NokiaNetworkService from './services/nokiaService.js';

// Load environment variables
const envPath = path.resolve(process.cwd(), 'config', 'config.env');
dotenv.config({ path: envPath });

console.log('🚀 Nokia Network Service Test Suite\n');

const nokiaService = new NokiaNetworkService();

// Test data
const testData = {
  // Use a test phone number format (E.164)
  phoneNumber: '+99999991000', // Test number
  latitude: 19.9975,  // Mumbai coordinates
  longitude: 73.7898,
  loanAmount: 250000
};

// Main test function

async function runTests() {
  console.log('   Test Configuration:');
  console.log(`   Phone: ${testData.phoneNumber}`);
  console.log(`   Location: (${testData.latitude}, ${testData.longitude})`);
  console.log(`   Loan Amount: ₹${testData.loanAmount.toLocaleString()}`);
  console.log(`   API Key: ${nokiaService.rapidApiKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   API Host: ${nokiaService.rapidApiHost}\n`);

  try {
    // Test 1: SIM Swap Check
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: SIM Swap Detection');
    console.log('='.repeat(60));
    const simSwapResult = await nokiaService.checkSimSwap(testData.phoneNumber, 168);
    console.log('Result:', JSON.stringify(simSwapResult, null, 2));

    // Test 2: Device Swap Check
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Device Swap Detection');
    console.log('='.repeat(60));
    const deviceSwapResult = await nokiaService.checkDeviceSwap(testData.phoneNumber, 168);
    console.log('Result:', JSON.stringify(deviceSwapResult, null, 2));

    // Test 3: Location Verification
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Location Verification');
    console.log('='.repeat(60));
    const locationResult = await nokiaService.verifyLocation(
      testData.phoneNumber,
      testData.latitude,
      testData.longitude,
      10000
    );
    console.log('Result:', JSON.stringify(locationResult, null, 2));

    // Test 4: Number Verification
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Number Verification');
    console.log('='.repeat(60));
    const numberResult = await nokiaService.verifyPhoneNumber(testData.phoneNumber);
    console.log('Result:', JSON.stringify(numberResult, null, 2));

    // Test 5: Comprehensive Fraud Check
    console.log('\n' + '='.repeat(60));
    console.log('TEST 5: Comprehensive Fraud Check');
    console.log('='.repeat(60));
    const fraudCheckResult = await nokiaService.comprehensiveFraudCheck(testData);
    
    console.log('\n📊 FINAL FRAUD CHECK RESULT:');
    console.log(JSON.stringify(fraudCheckResult, null, 2));

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST SUITE COMPLETED');
    console.log('='.repeat(60));
    console.log(`Risk Score: ${fraudCheckResult.riskScore}/100`);
    console.log(`Risk Level: ${fraudCheckResult.riskLevel}`);
    console.log(`Recommendation: ${fraudCheckResult.recommendation}`);
    console.log(`Confidence: ${(fraudCheckResult.confidence * 100).toFixed(0)}%`);
    console.log('\nRisk Factors:');
    fraudCheckResult.riskFactors.forEach(factor => console.log(`  ${factor}`));

  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests
runTests().then(() => {
  console.log('\n✅ All tests completed!');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test suite error:', err);
  process.exit(1);
});
