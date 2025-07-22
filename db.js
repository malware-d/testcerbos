// Banking System Database Layer with comprehensive account management
const accounts = [
  {
    id: "ACC001",
    ownerId: "USR001", 
    accountNumber: "1234567890123456",
    accountType: "savings",
    balance: 25000000, // 25M VND
    status: "active", // active, frozen, closed, suspended
    branch_code: "HN001",
    created_at: "2023-01-15T00:00:00Z",
    
    // Compliance and regulatory
    kyc_status: "verified",
    compliance_clearance: true,
    regulatory_hold: false,
    flagged_for_review: false,
    
    // Transaction limits and security
    daily_transfer_limit: 50000000, // 50M VND
    external_transfer_limit: 20000000, // 20M VND
    daily_transfer_used: 5000000, // 5M VND already used today
    
    // Account tier and special flags
    account_tier: "standard", // standard, vip, premium
    
    // Transaction tracking
    pending_transactions: 0,
    last_transaction_date: "2024-01-20T10:30:00Z",
    
    // Fraud prevention
    fraud_score: 0.1, // Lower is better
    
    // Approval tracking (for operations requiring approval)
    approved_by_supervisor: false,
    secondary_approval: false,
    fraud_check_passed: true,
    teller_approval_id: null,
    approval_timestamp: null,
    supervisor_approval_id: null,
    supervisor_approval_timestamp: null,
    
    // Transfer specific attributes
    beneficiary_verified: false,
    amount: 0, // Will be set during transfer operations
    
    // Emergency and special operations
    emergency_justification: null,
    emergency_timestamp: null
  },
  
  {
    id: "ACC002", 
    ownerId: "USR002",
    accountNumber: "1234567890123457", 
    accountType: "checking",
    balance: 150000000, // 150M VND
    status: "active",
    branch_code: "HN001",
    created_at: "2022-05-10T00:00:00Z",
    
    kyc_status: "verified",
    compliance_clearance: true, 
    regulatory_hold: false,
    flagged_for_review: false,
    
    daily_transfer_limit: 200000000, // 200M VND 
    external_transfer_limit: 100000000, // 100M VND
    daily_transfer_used: 0,
    
    account_tier: "vip", // VIP account
    
    pending_transactions: 0,
    last_transaction_date: "2024-01-21T14:15:00Z",
    
    fraud_score: 0.05,
    
    approved_by_supervisor: false,
    secondary_approval: false,
    fraud_check_passed: true,
    teller_approval_id: null,
    approval_timestamp: null,
    supervisor_approval_id: null,
    supervisor_approval_timestamp: null,
    
    beneficiary_verified: false,
    amount: 0,
    
    emergency_justification: null,
    emergency_timestamp: null
  },

  {
    id: "ACC003",
    ownerId: "USR003", 
    accountNumber: "1234567890123458",
    accountType: "savings",
    balance: 500000, // 500K VND
    status: "frozen", // Frozen account for testing
    branch_code: "HCM001",
    created_at: "2023-08-20T00:00:00Z",
    
    kyc_status: "verified",
    compliance_clearance: false, // Under review
    regulatory_hold: true, // Regulatory hold
    flagged_for_review: true, // Flagged for suspicious activity
    
    daily_transfer_limit: 10000000, // 10M VND
    external_transfer_limit: 5000000, // 5M VND  
    daily_transfer_used: 0,
    
    account_tier: "standard",
    
    pending_transactions: 1,
    last_transaction_date: "2024-01-19T09:45:00Z",
    
    fraud_score: 0.8, // High fraud score
    
    approved_by_supervisor: false,
    secondary_approval: false,
    fraud_check_passed: false,
    teller_approval_id: null,
    approval_timestamp: null,
    supervisor_approval_id: null,
    supervisor_approval_timestamp: null,
    
    beneficiary_verified: false,
    amount: 0,
    
    emergency_justification: null,
    emergency_timestamp: null
  },

  {
    id: "ACC004",
    ownerId: "USR004",
    accountNumber: "1234567890123459", 
    accountType: "premium_savings",
    balance: 0, // Zero balance for closure testing
    status: "active",
    branch_code: "HN002", 
    created_at: "2021-12-01T00:00:00Z",
    
    kyc_status: "verified",
    compliance_clearance: true,
    regulatory_hold: false,
    flagged_for_review: false,
    
    daily_transfer_limit: 500000000, // 500M VND
    external_transfer_limit: 200000000, // 200M VND
    daily_transfer_used: 0,
    
    account_tier: "premium", // Premium account
    
    pending_transactions: 0, // Ready for closure
    last_transaction_date: "2024-01-18T16:20:00Z",
    
    fraud_score: 0.02,
    
    approved_by_supervisor: false,
    secondary_approval: false, 
    fraud_check_passed: true,
    teller_approval_id: null,
    approval_timestamp: null,
    supervisor_approval_id: null,
    supervisor_approval_timestamp: null,
    
    beneficiary_verified: false,
    amount: 0,
    
    emergency_justification: null,
    emergency_timestamp: null
  }
];

// User profiles for testing different roles and permissions
const users = [
  {
    id: "USR001",
    username: "john.doe",
    email: "john.doe@bank.com",
    role: "client",
    
    // Security and verification
    suspended: false,
    account_locked: false,
    kyc_status: "verified",
    mfa_verified: true,
    mfa_timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    transfer_pin_verified: true,
    last_password_change: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    
    // Transfer limits and usage
    daily_transfer_limit: 50000000,
    daily_transfer_used: 5000000,
    external_transfer_limit: 20000000,
    
    // Account details
    account_tier: "standard",
    branch_code: "HN001"
  },
  
  {
    id: "USR002", 
    username: "jane.smith",
    email: "jane.smith@bank.com",
    role: "client",
    
    suspended: false,
    account_locked: false,
    kyc_status: "verified", 
    mfa_verified: true,
    mfa_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    transfer_pin_verified: true,
    last_password_change: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    
    daily_transfer_limit: 200000000,
    daily_transfer_used: 0,
    external_transfer_limit: 100000000,
    
    account_tier: "vip", // VIP client
    branch_code: "HN001"
  },
  
  {
    id: "TELL001",
    username: "teller.nguyen", 
    email: "teller.nguyen@bank.com",
    role: "teller",
    
    suspended: false,
    certification_valid: true,
    certification_level: 2,
    experience_years: 4,
    kyc_authorization: true,
    dual_control_required: false,
    supervisor_present: true,
    supervisor_id: "SUP001",
    
    branch_code: "HN001",
    daily_limit: 100000000 // Teller transaction limit
  },
  
  {
    id: "SUP001",
    username: "supervisor.tran",
    email: "supervisor.tran@bank.com", 
    role: "supervisor",
    
    suspended: false,
    supervisor_level: 2,
    approval_authority: true,
    
    branch_code: "HN001"
  },
  
  {
    id: "ADMIN001",
    username: "admin.le",
    email: "admin.le@bank.com",
    role: "admin",
    
    suspended: false,
    dual_approval_required: false,
    emergency_access: true,
    multi_person_approval: true
  },
  
  {
    id: "COMP001", 
    username: "compliance.officer",
    email: "compliance@bank.com",
    role: "compliance_officer",
    
    suspended: false,
    compliance_clearance_level: 3,
    regional_access: true,
    
    branch_code: "HN001"
  },
  
  {
    id: "FRAUD001",
    username: "fraud.analyst",
    email: "fraud.analyst@bank.com", 
    role: "fraud_analyst",
    
    suspended: false,
    fraud_investigation_authority: true
  }
];

// Database operations
export default {
  accounts: {
    findOne: (id) => {
      return accounts.find((acc) => acc.id === id);
    },
    
    findByOwnerId: (ownerId) => {
      return accounts.filter((acc) => acc.ownerId === ownerId);
    },
    
    findAll: () => {
      return accounts;
    },
    
    findByBranch: (branchCode) => {
      return accounts.filter((acc) => acc.branch_code === branchCode);
    },
    
    findByStatus: (status) => {
      return accounts.filter((acc) => acc.status === status);
    },
    
    // Update account attributes for operations requiring state changes
    updateAccount: (id, updates) => {
      const accountIndex = accounts.findIndex((acc) => acc.id === id);
      if (accountIndex !== -1) {
        accounts[accountIndex] = { ...accounts[accountIndex], ...updates };
        return accounts[accountIndex];
      }
      return null;
    },
    
    // Simulate balance operations
    updateBalance: (id, amount, operation = "credit") => {
      const account = accounts.find((acc) => acc.id === id);
      if (account) {
        if (operation === "credit") {
          account.balance += amount;
        } else if (operation === "debit" && account.balance >= amount) {
          account.balance -= amount;
        } else {
          throw new Error("Insufficient balance for debit operation");
        }
        return account;
      }
      return null;
    }
  },
  
  users: {
    findOne: (id) => {
      return users.find((user) => user.id === id);
    },
    
    findByUsername: (username) => {
      return users.find((user) => user.username === username);
    },
    
    findByRole: (role) => {
      return users.filter((user) => user.role === role);
    },
    
    findByBranch: (branchCode) => {
      return users.filter((user) => user.branch_code === branchCode);
    },
    
    updateUser: (id, updates) => {
      const userIndex = users.findIndex((user) => user.id === id);
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        return users[userIndex];
      }
      return null;
    }
  },
  
  // Utility functions for testing and operations
  utils: {
    // Create a mock approval for supervisor operations
    createSupervisorApproval: (accountId, supervisorId) => {
      const account = accounts.find((acc) => acc.id === accountId);
      if (account) {
        account.supervisor_approval_id = supervisorId;
        account.supervisor_approval_timestamp = new Date().toISOString();
        account.approved_by_supervisor = true;
        return account;
      }
      return null;
    },
    
    // Update fraud score for testing
    updateFraudScore: (accountId, score) => {
      const account = accounts.find((acc) => acc.id === accountId);
      if (account) {
        account.fraud_score = score;
        return account;
      }
      return null;
    },
    
    // Verify beneficiary for external transfers
    verifyBeneficiary: (accountId, verified = true) => {
      const account = accounts.find((acc) => acc.id === accountId);
      if (account) {
        account.beneficiary_verified = verified;
        return account;
      }
      return null;
    },
    
    // Update MFA status
    updateMFA: (userId, verified = true) => {
      const user = users.find((u) => u.id === userId);
      if (user) {
        user.mfa_verified = verified;
        user.mfa_timestamp = new Date().toISOString();
        return user;
      }
      return null;
    }
  }
};