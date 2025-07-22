// Banking IAM System - Read Operations Test Tool
// JPMorgan Chase IAM PoC - Cerbos Policy Validation
// Focus: Comprehensive READ operations testing
// Author: Tech Lead Team
// Usage: node tool-test.js

import axios from 'axios';
import jwt from 'jsonwebtoken';
import chalk from 'chalk';

const API_URL = 'http://localhost:3000';
const JWT_SECRET = 'd1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1';

// ============ ENHANCED USER PROFILES FOR READ TESTING ============
const testUsers = [
  {
    id: 'USR001',
    role: 'client',
    desc: 'Standard client - owns ACC001, KYC verified, MFA enabled',
    payload: {
      sub: 'USR001',
      role: 'client',
      attr: {
        id: 'USR001',
        suspended: false,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: true,
        mfa_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        last_password_change: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        account_tier: 'standard',
        branch_code: 'HN001',
        ownerId: 'USR001'
      }
    },
    accounts: ['ACC001']
  },
  
  {
    id: 'USR002',
    role: 'client', 
    desc: 'VIP client - owns ACC002, premium tier, fresh MFA',
    payload: {
      sub: 'USR002',
      role: 'client',
      attr: {
        id: 'USR002',
        suspended: false,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: true,
        mfa_timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
        last_password_change: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        account_tier: 'vip',
        branch_code: 'HN001',
        ownerId: 'USR002'
      }
    },
    accounts: ['ACC002']
  },

  {
    id: 'USR003',
    role: 'client',
    desc: 'Suspended client - should be denied all operations',
    payload: {
      sub: 'USR003',
      role: 'client',
      attr: {
        id: 'USR003',
        suspended: true, // This should trigger global denial
        kyc_status: 'pending',
        account_locked: false,
        mfa_verified: false,
        account_tier: 'standard',
        branch_code: 'HCM001',
        ownerId: 'USR003'
      }
    },
    accounts: ['ACC003']
  },

  {
    id: 'USR004',
    role: 'client',
    desc: 'Client with expired MFA - limited access',
    payload: {
      sub: 'USR004',
      role: 'client',
      attr: {
        id: 'USR004',
        suspended: false,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: true,
        mfa_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago - expired
        last_password_change: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
        account_tier: 'standard',
        branch_code: 'HN002',
        ownerId: 'USR004'
      }
    },
    accounts: ['ACC001'] // Same account as USR001 for cross-ownership test
  },

  {
    id: 'USR005',
    role: 'client',
    desc: 'Client with old password - should fail transaction history',
    payload: {
      sub: 'USR005',
      role: 'client',
      attr: {
        id: 'USR005',
        suspended: false,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: true,
        mfa_timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Fresh MFA
        last_password_change: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago - too old
        account_tier: 'standard',
        branch_code: 'HN001',
        ownerId: 'USR005'
      }
    },
    accounts: ['ACC004']
  },

  // ============ STAFF USERS ============
  {
    id: 'TELL001',
    role: 'teller',
    desc: 'Authorized teller - HN001 branch, Level 2, 4 years experience',
    payload: {
      sub: 'TELL001',
      role: 'teller',
      attr: {
        id: 'TELL001',
        suspended: false,
        certification_valid: true,
        certification_level: 2,
        experience_years: 4,
        kyc_authorization: true,
        supervisor_present: true,
        supervisor_id: 'SUP001',
        branch_code: 'HN001'
      }
    },
    accounts: ['ACC001', 'ACC002'] // Can access same branch accounts
  },

  {
    id: 'TELL002',
    role: 'teller',
    desc: 'Junior teller - HCM001 branch, different branch',
    payload: {
      sub: 'TELL002',
      role: 'teller',
      attr: {
        id: 'TELL002',
        suspended: false,
        certification_valid: true,
        certification_level: 1,
        experience_years: 1,
        kyc_authorization: false,
        supervisor_present: false,
        branch_code: 'HCM001' // Different branch
      }
    },
    accounts: ['ACC003']
  },

  {
    id: 'SUP001',
    role: 'supervisor',
    desc: 'Branch supervisor - HN001, Level 2 with approval authority',
    payload: {
      sub: 'SUP001',
      role: 'supervisor',
      attr: {
        id: 'SUP001',
        suspended: false,
        supervisor_level: 2,
        approval_authority: true,
        branch_code: 'HN001'
      }
    },
    accounts: ['ACC001', 'ACC002']
  },

  {
    id: 'ADMIN001',
    role: 'admin',
    desc: 'System admin - full read privileges',
    payload: {
      sub: 'ADMIN001',
      role: 'admin',
      attr: {
        id: 'ADMIN001',
        suspended: false,
        emergency_access: true,
        system_wide_access: true
      }
    },
    accounts: ['ACC001', 'ACC002', 'ACC003', 'ACC004']
  },

  {
    id: 'COMP001',
    role: 'compliance_officer',
    desc: 'Compliance officer - regional access, Level 3',
    payload: {
      sub: 'COMP001',
      role: 'compliance_officer',
      attr: {
        id: 'COMP001',
        suspended: false,
        compliance_clearance_level: 3,
        regional_access: true,
        branch_code: 'HN001'
      }
    },
    accounts: ['ACC001', 'ACC002', 'ACC003', 'ACC004']
  }
];

// ============ HELPER FUNCTIONS ============
function getUserById(id) {
  return testUsers.find(u => u.id === id);
}

function generateJWT(user) {
  return jwt.sign({
    ...user.payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
  }, JWT_SECRET, { algorithm: 'HS256' });
}

function logTestResult({ name, category, expected, actual, passed, details, user }) {
  const status = passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
  const cat = chalk.blue(`[${category}]`);
  const userInfo = chalk.gray(`(${user.id}: ${user.desc})`);
  
  console.log(`${status} ${cat} ${chalk.bold(name)} ${userInfo}`);
  
  if (!passed) {
    console.log(chalk.gray('  Expected: ') + chalk.yellow(expected));
    console.log(chalk.gray('  Actual:   ') + chalk.red(actual));
    if (details) console.log(chalk.red('  Details:  ') + details);
  }
  
  return passed;
}

// ============ READ OPERATIONS TEST EXECUTOR ============
async function executeReadTest({ 
  testName, 
  category,
  endpoint, 
  user, 
  expectedStatus, 
  expectedBodyValidation, 
  description,
  setup 
}) {
  // Optional setup for test preparation
  if (setup) {
    try {
      await setup();
    } catch (e) {
      console.log(chalk.yellow(`⚠️  Setup warning for ${testName}: ${e.message}`));
    }
  }

  const token = generateJWT(user);
  let passed = false;
  let actualResult = '';
  let details = '';

  try {
    const response = await axios({
      method: 'GET',
      url: `${API_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      validateStatus: () => true // Don't throw on HTTP errors
    });

    actualResult = `Status ${response.status}`;

    // Check status code first
    if (response.status === expectedStatus) {
      // If we have a body validation function, run it
      if (expectedBodyValidation && typeof expectedBodyValidation === 'function') {
        try {
          const bodyValid = expectedBodyValidation(response.data);
          if (bodyValid === true) {
            passed = true;
          } else {
            details = `Body validation failed: ${bodyValid}`;
            actualResult += ` - Body validation failed`;
          }
        } catch (e) {
          details = `Body validation error: ${e.message}`;
          actualResult += ` - Body validation error`;
        }
      } else {
        passed = true;
      }
    } else {
      details = `Expected status ${expectedStatus}, got ${response.status}`;
      if (response.data?.error) {
        details += ` - Error: ${response.data.error}`;
      }
      if (response.data?.message) {
        details += ` - Message: ${response.data.message}`;
      }
    }

  } catch (error) {
    actualResult = error.code || error.message;
    details = `Request failed: ${error.message}`;
  }

  return logTestResult({
    name: testName,
    category,
    expected: `Status ${expectedStatus}`,
    actual: actualResult,
    passed,
    details,
    user
  });
}

// ============ COMPREHENSIVE READ OPERATIONS TEST SUITE ============
const readOperationsTestSuite = [
  // ============ READ_BASIC_INFO TESTS ============
  {
    testName: 'Account Owner - Own Account Basic Info',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC001/basic',
    user: getUserById('USR001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (!data.id || data.id !== 'ACC001') return 'Missing or incorrect account ID';
      if (data.balance === undefined) return 'Missing balance field';
      if (!data.account_type) return 'Missing account_type field';
      return true;
    },
    description: 'verified_owner should read own account basic info'
  },

  {
    testName: 'VIP Client - Own Account Basic Info',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC002/basic',
    user: getUserById('USR002'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (data.id !== 'ACC002') return 'Wrong account ID';
      if (data.account_tier !== 'vip') return 'Missing VIP tier info';
      return true;
    },
    description: 'VIP verified_owner should read own account basic info'
  },

  {
    testName: 'Cross-Account Access Denial',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC002/basic', // ACC002 belongs to USR002
    user: getUserById('USR001'), // USR001 trying to access
    expectedStatus: 403,
    description: 'Client cannot read another client\'s account basic info'
  },

  {
    testName: 'Suspended User - Global Denial',
    category: 'READ_BASIC_INFO', 
    endpoint: '/accounts/ACC003/basic',
    user: getUserById('USR003'), // Suspended user
    expectedStatus: 403,
    description: 'Suspended user should be denied all read operations'
  },

  {
    testName: 'Authorized Teller - Same Branch',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC001/basic',
    user: getUserById('TELL001'), // Same branch as ACC001
    expectedStatus: 200,
    expectedBodyValidation: (data) => data.id === 'ACC001',
    description: 'authorized_teller should read basic info for same branch accounts'
  },

  {
    testName: 'Teller - Different Branch Denial',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC001/basic', // HN001 branch
    user: getUserById('TELL002'), // HCM001 branch - different
    expectedStatus: 403,
    description: 'Teller cannot read basic info from different branch'
  },

  {
    testName: 'Branch Supervisor - Same Branch',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC002/basic',
    user: getUserById('SUP001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => data.id === 'ACC002',
    description: 'branch_supervisor should read basic info for same branch'
  },

  {
    testName: 'System Admin - Global Access',
    category: 'READ_BASIC_INFO',
    endpoint: '/accounts/ACC003/basic',
    user: getUserById('ADMIN001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => data.id === 'ACC003',
    description: 'Admin should have global read access to basic info'
  },

  // ============ READ_FULL_DETAILS TESTS ============
  {
    testName: 'Owner with Valid MFA - Full Details',
    category: 'READ_FULL_DETAILS',
    endpoint: '/accounts/ACC002/details',
    user: getUserById('USR002'), // VIP with valid MFA
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (data.id !== 'ACC002') return 'Wrong account ID';
      if (!data.full_account_details) return 'Missing full details';
      if (!data.personal_info) return 'Missing personal info';
      return true;
    },
    description: 'verified_owner_with_mfa should read full account details'
  },

  {
    testName: 'Owner with Expired MFA - Details Denial',
    category: 'READ_FULL_DETAILS',
    endpoint: '/accounts/ACC001/details',
    user: getUserById('USR004'), // Expired MFA
    expectedStatus: 403,
    description: 'Owner with expired MFA should be denied full details access'
  },

  {
    testName: 'Standard Client - Details Access',
    category: 'READ_FULL_DETAILS',
    endpoint: '/accounts/ACC001/details',
    user: getUserById('USR001'), // Standard client with valid MFA
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (data.id !== 'ACC001') return 'Wrong account ID';
      return true;
    },
    description: 'verified_owner_with_mfa (standard) should read full details'
  },

  {
    testName: 'Teller with Approval - Full Details',
    category: 'READ_FULL_DETAILS',
    endpoint: '/accounts/ACC001/details',
    user: getUserById('TELL001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => data.id === 'ACC001',
    description: 'authorized_teller_with_approval should read full details',
    setup: async () => {
      // Setup supervisor approval for teller
      await axios.post(`${API_URL}/accounts/ACC001/setup-teller-approval`, {
        teller_id: 'TELL001',
        approved_by: 'SUP001',
        approval_timestamp: new Date().toISOString()
      }).catch(() => {}); // Ignore setup errors
    }
  },

  {
    testName: 'Admin - Full Details Access',
    category: 'READ_FULL_DETAILS',
    endpoint: '/accounts/ACC004/details',
    user: getUserById('ADMIN001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => data.id === 'ACC004',
    description: 'Admin should read full details for any account'
  },

  {
    testName: 'Compliance Officer - Full Details',
    category: 'READ_FULL_DETAILS',
    endpoint: '/accounts/ACC001/details',
    user: getUserById('COMP001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => data.id === 'ACC001',
    description: 'Compliance officer should read full details'
  },

  // ============ READ_TRANSACTION_HISTORY TESTS ============
  {
    testName: 'Owner with Valid MFA and Recent Password',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC002/transactions',
    user: getUserById('USR002'), // Valid MFA + recent password
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (!Array.isArray(data.transactions)) return 'Missing transactions array';
      if (data.account_id !== 'ACC002') return 'Wrong account ID';
      return true;
    },
    description: 'verified_owner_with_mfa should read transaction history with all conditions met'
  },

  {
    testName: 'Owner with Old Password - History Denial',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC004/transactions',
    user: getUserById('USR005'), // Old password (100 days)
    expectedStatus: 403,
    description: 'Owner with password > 90 days should be denied transaction history'
  },

  {
    testName: 'Owner with Expired MFA - History Denial',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC001/transactions',
    user: getUserById('USR004'), // Expired MFA
    expectedStatus: 403,
    description: 'Owner with expired MFA should be denied transaction history'
  },

  {
    testName: 'Standard Client - Valid Conditions',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC001/transactions',
    user: getUserById('USR001'), // Valid MFA + recent password
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (!Array.isArray(data.transactions)) return 'Missing transactions array';
      return true;
    },
    description: 'Standard client with valid MFA and recent password should read history'
  },

  {
    testName: 'Admin - Transaction History Access',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC003/transactions',
    user: getUserById('ADMIN001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (!Array.isArray(data.transactions)) return 'Missing transactions array';
      return true;
    },
    description: 'Admin should read transaction history for any account'
  },

  {
    testName: 'Compliance Officer - History Access',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC001/transactions',
    user: getUserById('COMP001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => Array.isArray(data.transactions),
    description: 'Compliance officer should read transaction history'
  },

  {
    testName: 'Teller - History Denial (No MFA)',
    category: 'READ_TRANSACTION_HISTORY',
    endpoint: '/accounts/ACC001/transactions',
    user: getUserById('TELL001'),
    expectedStatus: 403,
    description: 'Regular teller should be denied transaction history (needs MFA)'
  },

  // ============ EDGE CASES FOR READ OPERATIONS ============
  {
    testName: 'Frozen Account - Basic Info Still Readable',
    category: 'EDGE_CASES',
    endpoint: '/accounts/ACC003/basic',
    user: getUserById('ADMIN001'),
    expectedStatus: 200,
    expectedBodyValidation: (data) => {
      if (data.status !== 'frozen') return 'Account should be frozen';
      return true;
    },
    description: 'Frozen account should still allow basic info reading by authorized users',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC003/setup-status`, {
        status: 'frozen'
      }).catch(() => {});
    }
  },

  {
    testName: 'Closed Account - Admin Only Access',
    category: 'EDGE_CASES',
    endpoint: '/accounts/ACC004/basic',
    user: getUserById('USR005'), // Owner of ACC004
    expectedStatus: 403,
    description: 'Owner cannot read closed account details',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC004/setup-status`, {
        status: 'closed'
      }).catch(() => {});
    }
  },

  {
    testName: 'Regulatory Hold - Global Denial',
    category: 'EDGE_CASES',
    endpoint: '/accounts/ACC003/basic',
    user: getUserById('COMP001'), // Even compliance officer
    expectedStatus: 403,
    description: 'Regulatory hold should deny all operations, even for compliance',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC003/setup-regulatory`, {
        regulatory_hold: true
      }).catch(() => {});
    }
  }
];

// ============ TEST EXECUTION ENGINE ============
async function runReadOperationsTestSuite() {
  console.log(chalk.bold.cyan('\n🏛️  JPMORGAN CHASE - BANKING IAM READ OPERATIONS TEST'));
  console.log(chalk.bold.cyan('    Cerbos Policy Engine - READ Operations Validation'));
  console.log(chalk.cyan('    Coverage: read_basic_info, read_full_details, read_transaction_history'));
  console.log(chalk.gray('=' .repeat(80)));

  // Health check first
  console.log(chalk.bold.yellow('\n🔍 SYSTEM HEALTH CHECK'));
  console.log(chalk.gray('-'.repeat(40)));
  
  try {
    const healthResponse = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    if (healthResponse.status === 200) {
      console.log(chalk.green('✓ API Server is healthy and responding'));
    } else {
      console.log(chalk.red('✗ API Server health check failed'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`✗ Cannot connect to API server: ${error.message}`));
    console.log(chalk.yellow(`  Make sure server is running on ${API_URL}`));
    return false;
  }

  // Initialize results tracking
  const results = {
    total: readOperationsTestSuite.length,
    passed: 0,
    failed: 0,
    categories: {}
  };

  // Group tests by category for organized execution
  const categorizedTests = readOperationsTestSuite.reduce((acc, test) => {
    const category = test.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(test);
    return acc;
  }, {});

  // Execute tests by category
  for (const [category, tests] of Object.entries(categorizedTests)) {
    console.log(chalk.bold.yellow(`\n📋 ${category} (${tests.length} tests)`));
    console.log(chalk.gray('-'.repeat(50)));

    let categoryPassed = 0;
    let categoryFailed = 0;

    for (const test of tests) {
      const testResult = await executeReadTest(test);
      
      if (testResult) {
        categoryPassed++;
        results.passed++;
      } else {
        categoryFailed++;
        results.failed++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    results.categories[category] = {
      total: tests.length,
      passed: categoryPassed,
      failed: categoryFailed
    };
  }

  // ============ FINAL RESULTS SUMMARY ============
  console.log(chalk.bold.cyan('\n📊 READ OPERATIONS TEST SUMMARY'));
  console.log(chalk.gray('=' .repeat(80)));

  Object.entries(results.categories).forEach(([category, stats]) => {
    const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
    const status = stats.failed === 0 ? chalk.green('✓') : chalk.red('✗');
    console.log(`${status} ${chalk.bold(category)}: ${chalk.green(stats.passed)}/${stats.total} passed (${passRate}%)`);
  });

  const overallPassRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(chalk.gray('-'.repeat(50)));
  console.log(chalk.bold(`📈 Overall Results: ${chalk.green(results.passed)}/${results.total} passed (${overallPassRate}%)`));

  if (results.failed === 0) {
    console.log(chalk.green.bold('\n🎉 ALL READ OPERATIONS TESTS PASSED!'));
    console.log(chalk.green('✅ Cerbos read policies are correctly implemented'));
    console.log(chalk.green('✅ Ready for production evaluation'));
  } else {
    console.log(chalk.red.bold(`\n⚠️  ${results.failed} READ OPERATION TEST(S) FAILED!`));
    console.log(chalk.yellow('🔍 Please review the detailed error logs above'));
    console.log(chalk.yellow('🔧 Check Cerbos policy configurations and derived roles'));
  }

  console.log(chalk.gray('\nTest completed: ' + new Date().toISOString()));
  console.log(chalk.gray('=' .repeat(80)));

  return results.failed === 0;
}

// ============ EXPORTS & EXECUTION ============
export { 
  runReadOperationsTestSuite, 
  readOperationsTestSuite, 
  testUsers, 
  executeReadTest 
};

// Auto-run when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReadOperationsTestSuite().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}