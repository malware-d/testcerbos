// Enhanced Banking IAM API Test Suite
// Designed for JPMorgan Chase IAM PoC with Cerbos
// Author: Tech Lead Team
// Run: node test.js
// Requirements: npm install axios jsonwebtoken chalk

import axios from 'axios';
import jwt from 'jsonwebtoken';
import chalk from 'chalk';
import assert from 'assert';

const API_URL = 'http://localhost:3000';
const JWT_SECRET = 'd1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1';

// Enhanced user definitions matching Cerbos policy requirements
const users = [
  {
    id: 'USR001',
    role: 'client',
    desc: 'Standard client - owns ACC001',
    payload: {
      sub: 'USR001',
      role: 'client',
      attr: {
        id: 'USR001',
        suspended: false,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: true,
        mfa_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        transfer_pin_verified: true,
        last_password_change: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        daily_transfer_limit: 50000000,
        daily_transfer_used: 5000000,
        external_transfer_limit: 20000000,
        account_tier: 'standard',
        branch_code: 'HN001'
      }
    },
    account: 'ACC001'
  },
  {
    id: 'USR002',
    role: 'client',
    desc: 'VIP client - owns ACC002',
    payload: {
      sub: 'USR002',
      role: 'client',
      attr: {
        id: 'USR002',
        suspended: false,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: true,
        mfa_timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        transfer_pin_verified: true,
        last_password_change: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        daily_transfer_limit: 200000000,
        daily_transfer_used: 0,
        external_transfer_limit: 100000000,
        account_tier: 'vip',
        branch_code: 'HN001'
      }
    },
    account: 'ACC002'
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
        suspended: true,
        kyc_status: 'verified',
        account_locked: false,
        mfa_verified: false,
        account_tier: 'standard',
        branch_code: 'HN001'
      }
    },
    account: 'ACC003'
  },
  {
    id: 'TELL001',
    role: 'teller',
    desc: 'Authorized teller - HN001 branch',
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
        dual_control_required: false,
        supervisor_present: true,
        supervisor_id: 'SUP001',
        branch_code: 'HN001',
        daily_limit: 100000000
      }
    },
    account: 'ACC001'
  },
  {
    id: 'SUP001',
    role: 'supervisor',
    desc: 'Branch supervisor - HN001',
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
    account: 'ACC001'
  },
  {
    id: 'ADMIN001',
    role: 'admin',
    desc: 'System admin - full privileges',
    payload: {
      sub: 'ADMIN001',
      role: 'admin',
      attr: {
        id: 'ADMIN001',
        suspended: false,
        dual_approval_required: false,
        emergency_access: true,
        multi_person_approval: true
      }
    },
    account: 'ACC004'
  },
  {
    id: 'COMP001',
    role: 'compliance_officer',
    desc: 'Compliance officer - regional access',
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
    account: 'ACC001'
  },
  {
    id: 'FRAUD001',
    role: 'fraud_analyst',
    desc: 'Fraud analyst - investigation authority',
    payload: {
      sub: 'FRAUD001',
      role: 'fraud_analyst',
      attr: {
        id: 'FRAUD001',
        suspended: false,
        fraud_investigation_authority: true
      }
    },
    account: 'ACC003'
  }
];

function getUserById(id) {
  return users.find(u => u.id === id);
}

// Enhanced JWT generation with proper attribute structure
function genJWT(user) {
  return jwt.sign({
    ...user.payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }, JWT_SECRET, { algorithm: 'HS256' });
}

// Enhanced logging with banking context
function logResult({ name, expect, got, pass, detail, category }) {
  const status = pass ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
  const cat = category ? chalk.blue(`[${category}]`) : '';
  console.log(`${status} ${cat} ${chalk.bold(name)}`);
  if (!pass) {
    console.log(chalk.gray('  Expected: ') + expect);
    console.log(chalk.gray('  Got:      ') + got);
    if (detail) console.log(chalk.red('  Detail:   ') + detail);
  }
}

// Enhanced test runner with better error handling
async function runTest({ name, method, url, user, data, expectStatus, expectBody, desc, category, setup }) {
  // Optional setup function for test preparation
  if (setup) {
    try {
      await setup();
    } catch (e) {
      console.log(chalk.yellow(`Setup failed for ${name}: ${e.message}`));
    }
  }

  const token = genJWT(user);
  let pass = false, got = '', detail = '';
  
  try {
    const config = {
      method,
      url: API_URL + url,
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      validateStatus: () => true // Don't throw on HTTP error status
    };
    
    if (data) config.data = data;
    
    const res = await axios(config);
    got = `Status ${res.status}`;
    
    if (expectStatus === res.status) {
      if (expectBody && typeof expectBody === 'function') {
        try {
          const bodyValid = expectBody(res.data);
          if (bodyValid === true) {
            pass = true;
          } else {
            detail = `Body validation failed: ${bodyValid}`;
          }
        } catch (e) {
          detail = `Body validation error: ${e.message}`;
        }
      } else {
        pass = true;
      }
    } else {
      detail = `Expected ${expectStatus}, got ${res.status}`;
      if (res.data?.error) detail += ` - ${res.data.error}`;
    }
  } catch (err) {
    got = err.code || err.message;
    detail = `Network/Request error: ${err.message}`;
  }
  
  logResult({ 
    name: desc || name, 
    expect: `Status ${expectStatus}`, 
    got, 
    pass, 
    detail,
    category 
  });
  
  return pass;
}

// Comprehensive test cases aligned with Cerbos policies
const testCases = [
  // ============ HEALTH CHECK ============
  {
    name: 'Health Check',
    method: 'get',
    url: '/health',
    user: getUserById('USR001'),
    expectStatus: 200,
    expectBody: d => d.status === 'healthy',
    desc: 'API health endpoint',
    category: 'SYSTEM'
  },

  // ============ READ OPERATIONS ============
  {
    name: 'Read Basic Info - Account Owner',
    method: 'get',
    url: '/accounts/ACC001/basic',
    user: getUserById('USR001'),
    expectStatus: 200,
    expectBody: d => d.id === 'ACC001' && d.balance !== undefined,
    desc: 'verified_owner should read own account basic info',
    category: 'READ'
  },
  
  {
    name: 'Read Basic Info - Teller Same Branch',
    method: 'get',
    url: '/accounts/ACC001/basic',
    user: getUserById('TELL001'),
    expectStatus: 200,
    expectBody: d => d.id === 'ACC001',
    desc: 'authorized_teller in same branch should read basic info',
    category: 'READ'
  },
  
  {
    name: 'Read Basic Info - Wrong Owner',
    method: 'get',
    url: '/accounts/ACC002/basic', // ACC002 belongs to USR002
    user: getUserById('USR001'), // USR001 trying to access
    expectStatus: 403,
    desc: 'Client cannot read another client\'s account',
    category: 'READ'
  },
  
  {
    name: 'Read Basic Info - Suspended User',
    method: 'get',
    url: '/accounts/ACC003/basic',
    user: getUserById('USR003'), // Suspended user
    expectStatus: 403,
    desc: 'Suspended user should be denied all operations',
    category: 'READ'
  },

  {
    name: 'Read Full Details - Owner with MFA',
    method: 'get',
    url: '/accounts/ACC002/details',
    user: getUserById('USR002'), // VIP user with valid MFA
    expectStatus: 200,
    expectBody: d => d.id === 'ACC002' && d.account_tier === 'vip',
    desc: 'verified_owner_with_mfa should read full details',
    category: 'READ'
  },

  {
    name: 'Read Transaction History - Owner with MFA',
    method: 'get',
    url: '/accounts/ACC002/transactions',
    user: getUserById('USR002'),
    expectStatus: 200,
    expectBody: d => Array.isArray(d.transactions),
    desc: 'Owner with valid MFA and password should read transaction history',
    category: 'READ'
  },

  // ============ UPDATE OPERATIONS ============
  {
    name: 'Update Contact Info - Verified Owner',
    method: 'put',
    url: '/accounts/ACC001/contact',
    user: getUserById('USR001'),
    data: { phone: '+84901234567', email: 'new@email.com' },
    expectStatus: 200,
    expectBody: d => d.success === true,
    desc: 'KYC verified owner should update contact info',
    category: 'UPDATE'
  },

  {
    name: 'Update Contact Info - Frozen Account',
    method: 'put',
    url: '/accounts/ACC003/contact', // ACC003 is frozen
    user: getUserById('USR003'),
    data: { phone: '+84901234567' },
    expectStatus: 403,
    desc: 'Cannot update contact info on frozen account',
    category: 'UPDATE'
  },

  {
    name: 'Credit Balance - Admin',
    method: 'post',
    url: '/accounts/ACC001/credit',
    user: getUserById('ADMIN001'),
    data: { amount: 1000000, approved_by_supervisor: true, secondary_approval: true },
    expectStatus: 200,
    expectBody: d => d.new_balance !== undefined,
    desc: 'Admin can credit with proper approvals',
    category: 'UPDATE',
    setup: async () => {
      // Setup supervisor approval via utility endpoint
      await axios.post(`${API_URL}/accounts/ACC001/setup-approval`, {
        approved_by_supervisor: true,
        secondary_approval: false
      });
    }
  },

  {
    name: 'Credit Balance - Teller without Approval',
    method: 'post',
    url: '/accounts/ACC001/credit',
    user: getUserById('TELL001'),
    data: { amount: 1000000 },
    expectStatus: 403,
    desc: 'Teller cannot credit without supervisor approval',
    category: 'UPDATE'
  },

  {
    name: 'Debit Balance - Admin with All Approvals',
    method: 'post',
    url: '/accounts/ACC002/debit',
    user: getUserById('ADMIN001'),
    data: { 
      amount: 500000, 
      approved_by_supervisor: true, 
      secondary_approval: true,
      fraud_check_passed: true 
    },
    expectStatus: 200,
    expectBody: d => d.new_balance !== undefined,
    desc: 'Admin can debit with all required approvals',
    category: 'UPDATE',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC002/setup-approval`, {
        approved_by_supervisor: true,
        secondary_approval: true,
        fraud_check_passed: true
      });
    }
  },

  // ============ TRANSFER OPERATIONS ============
  {
    name: 'Small Internal Transfer - Standard Client',
    method: 'post',
    url: '/accounts/ACC001/transfer/internal/small',
    user: getUserById('USR001'),
    data: { 
      amount: 2000000, // 2M VND - within 5M limit
      to_account: 'ACC002',
      fraud_score: 0.2 // Below 0.3 threshold
    },
    expectStatus: 200,
    expectBody: d => d.transaction_id !== undefined,
    desc: 'verified_owner_small_transfer should work for amounts <= 5M VND',
    category: 'TRANSFER',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC001/setup-transfer`, {
        amount: 2000000,
        fraud_score: 0.2
      });
    }
  },

  {
    name: 'Small Internal Transfer - Amount Too Large',
    method: 'post',
    url: '/accounts/ACC001/transfer/internal/small',
    user: getUserById('USR001'),
    data: { amount: 6000000, to_account: 'ACC002' }, // 6M > 5M limit
    expectStatus: 400,
    desc: 'Small transfer should reject amounts > 5M VND',
    category: 'TRANSFER'
  },

  {
    name: 'Large Internal Transfer - VIP Client',
    method: 'post',
    url: '/accounts/ACC002/transfer/internal/large',
    user: getUserById('USR002'), // VIP user
    data: { 
      amount: 50000000, // 50M VND - between 5M and 100M
      to_account: 'ACC001',
      fraud_score: 0.1 // Below 0.2 threshold
    },
    expectStatus: 200,
    expectBody: d => d.transaction_id !== undefined,
    desc: 'VIP client should handle large internal transfers',
    category: 'TRANSFER',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC002/setup-transfer`, {
        amount: 50000000,
        fraud_score: 0.1
      });
    }
  },

  {
    name: 'External Transfer - With All Validations',
    method: 'post',
    url: '/accounts/ACC002/transfer/external',
    user: getUserById('USR002'),
    data: { 
      amount: 10000000, // 10M VND
      to_account: 'EXT123456',
      beneficiary_verified: true,
      fraud_score: 0.05
    },
    expectStatus: 200,
    expectBody: d => d.transaction_id !== undefined,
    desc: 'External transfer with all security validations',
    category: 'TRANSFER',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC002/setup-external-transfer`, {
        amount: 10000000,
        beneficiary_verified: true,
        fraud_score: 0.05
      });
    }
  },

  {
    name: 'External Transfer - Unverified Beneficiary',
    method: 'post',
    url: '/accounts/ACC002/transfer/external',
    user: getUserById('USR002'),
    data: { 
      amount: 5000000,
      to_account: 'EXT123456',
      beneficiary_verified: false // Should fail
    },
    expectStatus: 403,
    desc: 'External transfer should require beneficiary verification',
    category: 'TRANSFER'
  },

  // ============ ADMINISTRATIVE OPERATIONS ============
  {
    name: 'Freeze Account - Admin',
    method: 'post',
    url: '/accounts/ACC001/freeze',
    user: getUserById('ADMIN001'),
    data: { reason: 'Suspected fraud' },
    expectStatus: 200,
    expectBody: d => d.account.status === 'frozen',
    desc: 'Admin should freeze accounts',
    category: 'ADMIN'
  },

  {
    name: 'Freeze Account - Regular User',
    method: 'post',
    url: '/accounts/ACC001/freeze',
    user: getUserById('USR001'),
    data: { reason: 'Test' },
    expectStatus: 403,
    desc: 'Regular user cannot freeze accounts',
    category: 'ADMIN'
  },

  {
    name: 'Close Account - Zero Balance',
    method: 'post',
    url: '/accounts/ACC004/close', // ACC004 has zero balance
    user: getUserById('ADMIN001'),
    data: { 
      reason: 'Customer request',
      compliance_clearance: true,
      balance: 0,
      pending_transactions: 0
    },
    expectStatus: 200,
    expectBody: d => d.account.status === 'closed',
    desc: 'Admin can close account with zero balance and compliance clearance',
    category: 'ADMIN',
    setup: async () => {
      await axios.post(`${API_URL}/accounts/ACC004/setup-closure`, {
        balance: 0,
        pending_transactions: 0,
        compliance_clearance: true
      });
    }
  },

  {
    name: 'Close Account - Non-Zero Balance',
    method: 'post',
    url: '/accounts/ACC001/close',
    user: getUserById('ADMIN001'),
    data: { reason: 'Test' },
    expectStatus: 403,
    desc: 'Cannot close account with non-zero balance',
    category: 'ADMIN'
  },

  // ============ AUDIT AND COMPLIANCE ============
  {
    name: 'Generate Statement - Account Owner',
    method: 'get',
    url: '/accounts/ACC001/statement',
    user: getUserById('USR001'),
    expectStatus: 200,
    expectBody: d => d.statement && d.statement.account_id === 'ACC001',
    desc: 'Account owner should generate statements',
    category: 'AUDIT'
  },

  {
    name: 'Generate Statement - Compliance Officer',
    method: 'get',
    url: '/accounts/ACC001/statement',
    user: getUserById('COMP001'),
    expectStatus: 200,
    expectBody: d => d.statement !== undefined,
    desc: 'Compliance officer should generate statements for same branch',
    category: 'AUDIT'
  },

  {
    name: 'Flag Suspicious - Fraud Analyst',
    method: 'post',
    url: '/accounts/ACC003/flag-suspicious',
    user: getUserById('FRAUD001'),
    data: { reason: 'Unusual transaction pattern', risk_level: 'high' },
    expectStatus: 200,
    expectBody: d => d.account.flagged_for_review === true,
    desc: 'Fraud analyst should flag suspicious accounts',
    category: 'AUDIT'
  },

  {
    name: 'Flag Suspicious - Regular User',
    method: 'post',
    url: '/accounts/ACC001/flag-suspicious',
    user: getUserById('USR001'),
    data: { reason: 'Test', risk_level: 'low' },
    expectStatus: 403,
    desc: 'Regular user cannot flag accounts',
    category: 'AUDIT'
  },

  // ============ EXPLICIT DENIALS ============
  {
    name: 'Delete Account - Always Denied',
    method: 'delete',
    url: '/accounts/ACC001',
    user: getUserById('ADMIN001'), // Even admin should be denied
    expectStatus: 403,
    desc: 'Delete operation should always be denied per policy',
    category: 'SECURITY'
  },

  {
    name: 'Regulatory Hold Account - All Operations Denied',
    method: 'get',
    url: '/accounts/ACC003/basic',
    user: getUserById('ADMIN001'),
    expectStatus: 403,
    desc: 'All operations on regulatory hold accounts should be denied',
    category: 'SECURITY'
  },

  // ============ EDGE CASES ============
  {
    name: 'Expired MFA Token',
    method: 'get',
    url: '/accounts/ACC001/transactions',
    user: {
      ...getUserById('USR001'),
      payload: {
        ...getUserById('USR001').payload,
        attr: {
          ...getUserById('USR001').payload.attr,
          mfa_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 min ago - expired
        }
      }
    },
    expectStatus: 403,
    desc: 'Expired MFA should deny transaction history access',
    category: 'SECURITY'
  },

  {
    name: 'Daily Transfer Limit Exceeded',
    method: 'post',
    url: '/accounts/ACC001/transfer/internal/small',
    user: {
      ...getUserById('USR001'),
      payload: {
        ...getUserById('USR001').payload,
        attr: {
          ...getUserById('USR001').payload.attr,
          daily_transfer_used: 45000000, // 45M already used
          daily_transfer_limit: 50000000  // 50M limit
        }
      }
    },
    data: { amount: 6000000 }, // Would exceed limit
    expectStatus: 403,
    desc: 'Transfer exceeding daily limit should be denied',
    category: 'SECURITY'
  }
];

// Enhanced test runner with categorized results
async function runAll() {
  console.log(chalk.bold.cyan('\n🏛️  JPMORGAN CHASE - BANKING IAM SYSTEM TEST SUITE'));
  console.log(chalk.bold.cyan('    Cerbos Policy Validation - Proof of Concept'));
  console.log(chalk.gray('=' .repeat(60)));
  
  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    categories: {}
  };
  
  // Group tests by category
  const categorizedTests = testCases.reduce((acc, test) => {
    const cat = test.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(test);
    return acc;
  }, {});
  
  // Run tests by category
  for (const [category, tests] of Object.entries(categorizedTests)) {
    console.log(chalk.bold.yellow(`\n📋 ${category} Operations (${tests.length} tests)`));
    console.log(chalk.gray('-'.repeat(40)));
    
    let categoryPassed = 0;
    for (const test of tests) {
      const success = await runTest(test);
      if (success) {
        results.passed++;
        categoryPassed++;
      } else {
        results.failed++;
      }
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    results.categories[category] = {
      total: tests.length,
      passed: categoryPassed,
      failed: tests.length - categoryPassed
    };
  }
  
  // Final summary
  console.log(chalk.bold.cyan('\n📊 TEST EXECUTION SUMMARY'));
  console.log(chalk.gray('=' .repeat(60)));
  
  Object.entries(results.categories).forEach(([cat, stats]) => {
    const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
    const status = stats.failed === 0 ? chalk.green('✓') : chalk.red('✗');
    console.log(`${status} ${chalk.bold(cat)}: ${stats.passed}/${stats.total} (${passRate}%)`);
  });
  
  const overallPassRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(chalk.gray('-'.repeat(40)));
  console.log(chalk.bold(`Overall: ${results.passed}/${results.total} (${overallPassRate}%)`));
  
  if (results.failed === 0) {
    console.log(chalk.green.bold('\n🎉 ALL TESTS PASSED! Cerbos policies are working correctly.'));
    console.log(chalk.green('✅ Ready for production evaluation.'));
  } else {
    console.log(chalk.red.bold(`\n⚠️  ${results.failed} TEST(S) FAILED!`));
    console.log(chalk.yellow('🔍 Review the detailed logs above and check policy configurations.'));
  }
  
  console.log(chalk.gray('\n' + '=' .repeat(60)));
  return results.failed === 0;
}

// Export for programmatic use
export { runAll, testCases, users };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAll().then(success => {
    process.exit(success ? 0 : 1);
  });
}
// // Tool test tự động cho Banking IAM API
// // Chạy: node test.js
// // Yêu cầu: npm install axios jsonwebtoken chalk

// import axios from 'axios';
// import jwt from 'jsonwebtoken';
// import chalk from 'chalk';
// import assert from 'assert';

// const API_URL = 'http://localhost:3000';
// const JWT_SECRET = 'd1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1';

// // Danh sách user mẫu (khớp với db.js)
// const users = [
//   {
//     id: 'USR001',
//     role: 'client',
//     desc: 'Khách hàng thường, KYC verified, không bị khóa',
//     payload: { sub: 'USR001', role: 'client' },
//     account: 'ACC001'
//   },
//   {
//     id: 'USR002',
//     role: 'client',
//     desc: 'Khách hàng VIP',
//     payload: { sub: 'USR002', role: 'client' },
//     account: 'ACC002'
//   },
//   {
//     id: 'TELL001',
//     role: 'teller',
//     desc: 'Teller, có chứng chỉ, supervisor present',
//     payload: { sub: 'TELL001', role: 'teller' },
//     account: 'ACC002'
//   },
//   {
//     id: 'SUP001',
//     role: 'supervisor',
//     desc: 'Supervisor, có quyền duyệt',
//     payload: { sub: 'SUP001', role: 'supervisor' },
//     account: 'ACC003'
//   },
//   {
//     id: 'ADMIN001',
//     role: 'admin',
//     desc: 'Admin, có dual approval',
//     payload: { sub: 'ADMIN001', role: 'admin' },
//     account: 'ACC004'
//   },
//   {
//     id: 'COMP001',
//     role: 'compliance_officer',
//     desc: 'Compliance, clearance cao',
//     payload: { sub: 'COMP001', role: 'compliance_officer' },
//     account: 'ACC004'
//   },
//   {
//     id: 'FRAUD001',
//     role: 'fraud_analyst',
//     desc: 'Fraud analyst',
//     payload: { sub: 'FRAUD001', role: 'fraud_analyst' },
//     account: 'ACC003'
//   }
// ];

// function getUserById(id) {
//   return users.find(u => u.id === id);
// }

// // Hàm sinh JWT
// function genJWT(user) {
//   return jwt.sign(user.payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
// }

// // Hàm log kết quả test
// function logResult({ name, expect, got, pass, detail }) {
//   const status = pass ? chalk.green('PASS') : chalk.red('FAIL');
//   console.log(chalk.bold(`\n[${status}] ${name}`));
//   console.log(chalk.gray('  Mong đợi: ') + expect);
//   console.log(chalk.gray('  Kết quả:  ') + got);
//   if (detail) console.log(chalk.gray('  Chi tiết: ') + detail);
// }

// // Hàm gửi request và kiểm tra
// async function runTest({ name, method, url, user, data, expectStatus, expectBody, desc }) {
//   const token = genJWT(user);
//   let pass = false, got = '', detail = '';
//   try {
//     const res = await axios({
//       method,
//       url: API_URL + url,
//       headers: { Authorization: `Bearer ${token}` },
//       data
//     });
//     got = `Status ${res.status}`;
//     if (expectStatus === res.status) {
//       if (expectBody) {
//         try {
//           assert.deepStrictEqual(expectBody(res.data), true);
//           pass = true;
//         } catch (e) {
//           detail = e.message;
//         }
//       } else {
//         pass = true;
//       }
//     }
//   } catch (err) {
//     if (err.response) {
//       got = `Status ${err.response.status}`;
//       if (expectStatus === err.response.status) pass = true;
//       else detail = err.response.data?.error || err.message;
//     } else {
//       got = err.message;
//       detail = err.stack;
//     }
//   }
//   logResult({ name: desc || name, expect: `Status ${expectStatus}`, got, pass, detail });
//   return pass;
// }

// // Danh sách test case (chỉ dùng user/account có trong db.js)
// const testCases = [
//   // Health check
//   {
//     name: 'Health check',
//     method: 'get',
//     url: '/health',
//     user: getUserById('USR001'),
//     expectStatus: 200,
//     expectBody: d => d.status === 'healthy',
//     desc: 'Kiểm tra health endpoint trả về healthy'
//   },
//   // Đọc basic info (positive)
//   {
//     name: 'Read basic info (client)',
//     method: 'get',
//     url: `/accounts/ACC001/basic`,
//     user: getUserById('USR001'),
//     expectStatus: 200,
//     expectBody: d => d.id === 'ACC001',
//     desc: 'Client đọc basic info tài khoản của mình'
//   },
//   // Đọc basic info (negative)
//   {
//     name: 'Read basic info (client, wrong account)',
//     method: 'get',
//     url: `/accounts/ACC002/basic`,
//     user: getUserById('USR001'),
//     expectStatus: 403,
//     desc: 'Client đọc tài khoản không phải của mình, mong đợi bị từ chối'
//   },
//   // Đọc full details (teller, positive)
//   {
//     name: 'Read full details (teller)',
//     method: 'get',
//     url: `/accounts/ACC002/details`,
//     user: getUserById('TELL001'),
//     expectStatus: 200,
//     expectBody: d => d.id === 'ACC002',
//     desc: 'Teller đọc full details tài khoản được phân công'
//   },
//   // Đọc full details (client, negative)
//   {
//     name: 'Read full details (client)',
//     method: 'get',
//     url: `/accounts/ACC002/details`,
//     user: getUserById('USR001'),
//     expectStatus: 403,
//     desc: 'Client đọc full details tài khoản khác, mong đợi bị từ chối'
//   },
//   // Credit (teller, positive)
//   {
//     name: 'Credit (teller)',
//     method: 'post',
//     url: `/accounts/ACC002/credit`,
//     user: getUserById('TELL001'),
//     data: { amount: 1000000 },
//     expectStatus: 200,
//     expectBody: d => d.new_balance !== undefined,
//     desc: 'Teller nạp tiền vào tài khoản'
//   },
//   // Credit (client, negative)
//   {
//     name: 'Credit (client)',
//     method: 'post',
//     url: `/accounts/ACC002/credit`,
//     user: getUserById('USR001'),
//     data: { amount: 1000000 },
//     expectStatus: 403,
//     desc: 'Client thử nạp tiền vào tài khoản, mong đợi bị từ chối'
//   },
//   // Debit (teller, positive)
//   {
//     name: 'Debit (teller)',
//     method: 'post',
//     url: `/accounts/ACC002/debit`,
//     user: getUserById('TELL001'),
//     data: { amount: 500000 },
//     expectStatus: 200,
//     expectBody: d => d.new_balance !== undefined,
//     desc: 'Teller rút tiền từ tài khoản'
//   },
//   // Debit (client, negative)
//   {
//     name: 'Debit (client)',
//     method: 'post',
//     url: `/accounts/ACC002/debit`,
//     user: getUserById('USR001'),
//     data: { amount: 500000 },
//     expectStatus: 403,
//     desc: 'Client thử rút tiền, mong đợi bị từ chối'
//   },
//   // Small internal transfer (client, positive)
//   {
//     name: 'Small internal transfer (client)',
//     method: 'post',
//     url: `/accounts/ACC001/transfer/internal/small`,
//     user: getUserById('USR001'),
//     data: { amount: 1000000, to_account: 'ACC002' },
//     expectStatus: 200,
//     expectBody: d => d.transaction_id,
//     desc: 'Client chuyển khoản nội bộ nhỏ'
//   },
//   // Small internal transfer (negative, amount lớn)
//   {
//     name: 'Small internal transfer (amount > 5M)',
//     method: 'post',
//     url: `/accounts/ACC001/transfer/internal/small`,
//     user: getUserById('USR001'),
//     data: { amount: 6000000, to_account: 'ACC002' },
//     expectStatus: 400,
//     desc: 'Chuyển khoản nhỏ nhưng amount > 5M, mong đợi lỗi 400'
//   },
//   // Freeze account (admin)
//   {
//     name: 'Freeze account (admin)',
//     method: 'post',
//     url: `/accounts/ACC004/freeze`,
//     user: getUserById('ADMIN001'),
//     data: { reason: 'Fraud' },
//     expectStatus: 200,
//     expectBody: d => d.account.status === 'frozen',
//     desc: 'Admin đóng băng tài khoản'
//   },
//   // Freeze account (client, negative)
//   {
//     name: 'Freeze account (client)',
//     method: 'post',
//     url: `/accounts/ACC001/freeze`,
//     user: getUserById('USR001'),
//     data: { reason: 'Test' },
//     expectStatus: 403,
//     desc: 'Client thử đóng băng tài khoản, mong đợi bị từ chối'
//   },
//   // Close account (compliance_officer, positive)
//   {
//     name: 'Close account (compliance_officer)',
//     method: 'post',
//     url: `/accounts/ACC004/close`,
//     user: getUserById('COMP001'),
//     data: { reason: 'Customer request', compliance_clearance: true },
//     expectStatus: 200,
//     expectBody: d => d.account.status === 'closed',
//     desc: 'Compliance officer đóng tài khoản với clearance'
//   },
//   // Close account (client, negative)
//   {
//     name: 'Close account (client)',
//     method: 'post',
//     url: `/accounts/ACC001/close`,
//     user: getUserById('USR001'),
//     data: { reason: 'Test', compliance_clearance: false },
//     expectStatus: 403,
//     desc: 'Client thử đóng tài khoản, mong đợi bị từ chối'
//   },
//   // Flag suspicious (fraud analyst)
//   {
//     name: 'Flag suspicious (fraud analyst)',
//     method: 'post',
//     url: `/accounts/ACC003/flag-suspicious`,
//     user: getUserById('FRAUD001'),
//     data: { reason: 'Suspicious', risk_level: 'high' },
//     expectStatus: 200,
//     expectBody: d => d.account.flagged_for_review === true,
//     desc: 'Fraud analyst flag suspicious account'
//   },
//   // Flag suspicious (client, negative)
//   {
//     name: 'Flag suspicious (client)',
//     method: 'post',
//     url: `/accounts/ACC001/flag-suspicious`,
//     user: getUserById('USR001'),
//     data: { reason: 'Test', risk_level: 'low' },
//     expectStatus: 403,
//     desc: 'Client thử flag suspicious, mong đợi bị từ chối'
//   },
//   // Generate statement (client)
//   {
//     name: 'Generate statement (client)',
//     method: 'get',
//     url: `/accounts/ACC001/statement`,
//     user: getUserById('USR001'),
//     expectStatus: 200,
//     expectBody: d => d.statement && d.statement.account_id === 'ACC001',
//     desc: 'Client lấy statement tài khoản của mình'
//   },
//   // List accounts (admin)
//   {
//     name: 'List accounts (admin)',
//     method: 'get',
//     url: `/accounts`,
//     user: getUserById('ADMIN001'),
//     expectStatus: 200,
//     expectBody: d => Array.isArray(d.accounts),
//     desc: 'Admin lấy danh sách tài khoản'
//   },
//   // MFA update (client)
//   {
//     name: 'Update MFA (client)',
//     method: 'post',
//     url: `/users/USR001/mfa`,
//     user: getUserById('USR001'),
//     data: { verified: true },
//     expectStatus: 200,
//     expectBody: d => d.mfa_verified === true,
//     desc: 'Client cập nhật trạng thái MFA'
//   },
//   // Supervisor approval (teller)
//   {
//     name: 'Supervisor approval (teller)',
//     method: 'post',
//     url: `/accounts/ACC002/supervisor-approval`,
//     user: getUserById('TELL001'),
//     data: { supervisor_id: 'SUP001' },
//     expectStatus: 200,
//     expectBody: d => d.approved_by_supervisor === true,
//     desc: 'Teller tạo supervisor approval'
//   },
//   // Fraud score update (fraud analyst)
//   {
//     name: 'Update fraud score (fraud analyst)',
//     method: 'post',
//     url: `/accounts/ACC003/fraud-score`,
//     user: getUserById('FRAUD001'),
//     data: { score: 0.8 },
//     expectStatus: 200,
//     expectBody: d => d.fraud_score === 0.8,
//     desc: 'Fraud analyst cập nhật fraud score'
//   }
// ];

// // Hàm chạy toàn bộ test
// async function runAll() {
//   console.log(chalk.bold.cyan('BẮT ĐẦU CHẠY TOÀN BỘ TEST CASE CHO BANKING IAM API'));
//   let passCount = 0;
//   for (let i = 0; i < testCases.length; i++) {
//     const ok = await runTest(testCases[i]);
//     if (ok) passCount++;
//   }
//   console.log(chalk.bold(`\nTổng kết: ${passCount}/${testCases.length} test PASS`));
//   if (passCount === testCases.length) {
//     console.log(chalk.green.bold('TẤT CẢ TEST ĐỀU PASS!'));  
//   } else {
//     console.log(chalk.red.bold('CÓ TEST BỊ FAIL, kiểm tra lại log chi tiết ở trên.'));
//   }
// }

// runAll(); 