import express from "express";
import { expressjwt as jwt } from 'express-jwt';
import { GRPC as Cerbos } from "@cerbos/grpc";
import db from "./db.js";

const cerbos = new Cerbos("localhost:3593", { tls: false });
const app = express();

// Middleware
app.use(express.json());
const checkJwt = jwt({ secret: "d1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1", algorithms: ["HS256"] });

// Enhanced JWT to Principal mapping with comprehensive banking attributes
const jwtToPrincipal = (jwtUser) => {
  // Get additional user data from database
  const user = db.users.findOne(jwtUser.sub);
  
  if (!user) {
    throw new Error("User not found in database");
  }
  
  return {
    id: user.id,
    roles: [user.role], // Single role from database
    attributes: {
      // Security attributes
      suspended: user.suspended || false,
      account_locked: user.account_locked || false,
      kyc_status: user.kyc_status || "pending",
      kyc_verified: user.kyc_status === "verified",
      mfa_verified: user.mfa_verified || false,
      mfa_timestamp: user.mfa_timestamp || null,
      transfer_pin_verified: user.transfer_pin_verified || false,
      last_password_change: user.last_password_change || null,
      
      // Account and limits
      account_tier: user.account_tier || "standard",
      daily_transfer_limit: user.daily_transfer_limit || 0,
      daily_transfer_used: user.daily_transfer_used || 0,
      external_transfer_limit: user.external_transfer_limit || 0,
      daily_limit: user.daily_limit || 0,
      
      // Branch and location
      branch_code: user.branch_code || null,
      
      // Role-specific attributes
      // Teller attributes
      certification_valid: user.certification_valid || false,
      certification_level: user.certification_level || 0,
      experience_years: user.experience_years || 0,
      kyc_authorization: user.kyc_authorization || false,
      dual_control_required: user.dual_control_required || false,
      supervisor_present: user.supervisor_present || false,
      supervisor_id: user.supervisor_id || null,
      
      // Supervisor attributes  
      supervisor_level: user.supervisor_level || 0,
      approval_authority: user.approval_authority || false,
      
      // Admin attributes
      dual_approval_required: user.dual_approval_required || true,
      emergency_access: user.emergency_access || false,
      multi_person_approval: user.multi_person_approval || false,
      
      // Compliance attributes
      compliance_clearance_level: user.compliance_clearance_level || 0,
      regional_access: user.regional_access || false,
      
      // Fraud analyst attributes
      fraud_investigation_authority: user.fraud_investigation_authority || false
    }
  };
};

// Utility function to prepare resource object with current timestamp and calculated fields
const prepareResourceObject = (account, additionalAttributes = {}) => {
  const now = new Date();
  
  return {
    kind: "account",
    id: account.id,
    attributes: {
      ...account,
      ...additionalAttributes,
      
      // Add calculated fields that policies might need
      now: now.toISOString(),
      
      // Convert string dates to proper format if needed
      last_password_change: account.last_password_change || null,
      approval_timestamp: account.approval_timestamp || null,
      supervisor_approval_timestamp: account.supervisor_approval_timestamp || null,
      mfa_timestamp: account.mfa_timestamp || null
    }
  };
};

// ==================== ACCOUNT READ OPERATIONS ====================

// Read basic account information
app.get("/accounts/:id/basic", checkJwt, async (req, res) => {
  try {
    const account = db.accounts.findOne(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["read_basic_info"]
    });

    if (decision.isAllowed("read_basic_info")) {
      // Return only basic info
      const basicInfo = {
        id: account.id,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        status: account.status,
        branch_code: account.branch_code
      };
      return res.json(basicInfo);
    } else {
      return res.status(403).json({ error: "Unauthorized to read basic account information" });
    }
  } catch (error) {
    console.error("Error in read basic info:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Read full account details
app.get("/accounts/:id/details", checkJwt, async (req, res) => {
  try {
    const account = db.accounts.findOne(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["read_full_details"]
    });

    if (decision.isAllowed("read_full_details")) {
      return res.json(account);
    } else {
      return res.status(403).json({ error: "Unauthorized to read full account details" });
    }
  } catch (error) {
    console.error("Error in read full details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Read transaction history
app.get("/accounts/:id/transactions", checkJwt, async (req, res) => {
  try {
    const account = db.accounts.findOne(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["read_transaction_history"]
    });

    if (decision.isAllowed("read_transaction_history")) {
      // Mock transaction history
      const transactions = [
        {
          id: "TXN001",
          date: "2024-01-21T10:30:00Z",
          type: "debit",
          amount: 1000000,
          description: "ATM Withdrawal",
          balance_after: account.balance
        },
        {
          id: "TXN002", 
          date: "2024-01-20T14:15:00Z",
          type: "credit",
          amount: 5000000,
          description: "Salary Deposit", 
          balance_after: account.balance + 1000000
        }
      ];
      return res.json({ account_id: account.id, transactions });
    } else {
      return res.status(403).json({ error: "Unauthorized to read transaction history" });
    }
  } catch (error) {
    console.error("Error in read transaction history:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== ACCOUNT UPDATE OPERATIONS ====================

// Update contact information
app.patch("/accounts/:id/contact", checkJwt, async (req, res) => {
  try {
    const account = db.accounts.findOne(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["update_contact_info"]
    });

    if (decision.isAllowed("update_contact_info")) {
      // Mock update contact info
      const updatedAccount = db.accounts.updateAccount(req.params.id, {
        contact_updated_at: new Date().toISOString(),
        contact_updated_by: principal.id
      });
      
      return res.json({
        result: `Contact information updated for account ${req.params.id}`,
        account: updatedAccount
      });
    } else {
      return res.status(403).json({ error: "Unauthorized to update contact information" });
    }
  } catch (error) {
    console.error("Error in update contact info:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Credit balance (add money)
app.post("/accounts/:id/credit", checkJwt, async (req, res) => {
  try {
    const { amount } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const principal = jwtToPrincipal(req.user);
    
    // Prepare resource with operation-specific attributes
    const resource = prepareResourceObject(account, {
      amount: amount,
      approved_by_supervisor: req.body.approved_by_supervisor || false,
      secondary_approval: req.body.secondary_approval || false
    });
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["update_balance_credit"]
    });

    if (decision.isAllowed("update_balance_credit")) {
      const updatedAccount = db.accounts.updateBalance(req.params.id, amount, "credit");
      
      return res.json({
        result: `Credited ${amount} VND to account ${req.params.id}`,
        new_balance: updatedAccount.balance,
        transaction_id: `TXN_${Date.now()}`
      });
    } else {
      return res.status(403).json({ error: "Unauthorized to credit account balance" });
    }
  } catch (error) {
    console.error("Error in credit balance:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Debit balance (subtract money)
app.post("/accounts/:id/debit", checkJwt, async (req, res) => {
  try {
    const { amount } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const principal = jwtToPrincipal(req.user);
    
    // For debit operations, all approvals are required by policy
    const resource = prepareResourceObject(account, {
      amount: amount,
      approved_by_supervisor: req.body.approved_by_supervisor || false,
      secondary_approval: req.body.secondary_approval || false,
      fraud_check_passed: req.body.fraud_check_passed || false
    });
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["update_balance_debit"]
    });

    if (decision.isAllowed("update_balance_debit")) {
      try {
        const updatedAccount = db.accounts.updateBalance(req.params.id, amount, "debit");
        
        return res.json({
          result: `Debited ${amount} VND from account ${req.params.id}`,
          new_balance: updatedAccount.balance,
          transaction_id: `TXN_${Date.now()}`
        });
      } catch (balanceError) {
        return res.status(400).json({ error: balanceError.message });
      }
    } else {
      return res.status(403).json({ error: "Unauthorized to debit account balance" });
    }
  } catch (error) {
    console.error("Error in debit balance:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== TRANSFER OPERATIONS ====================

// Small internal transfer (under 5M VND)
app.post("/accounts/:id/transfer/internal/small", checkJwt, async (req, res) => {
  try {
    const { amount, to_account, description } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (!amount || amount <= 0 || amount > 5000000) {
      return res.status(400).json({ error: "Invalid amount for small transfer (must be <= 5,000,000 VND)" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account, {
      amount: amount,
      to_account: to_account,
      fraud_score: account.fraud_score || 0.1
    });
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["transfer_internal_small"]
    });

    if (decision.isAllowed("transfer_internal_small")) {
      // Update daily transfer usage
      db.users.updateUser(principal.id, {
        daily_transfer_used: (principal.attributes.daily_transfer_used || 0) + amount
      });
      
      return res.json({
        result: `Small internal transfer of ${amount} VND initiated`,
        from_account: req.params.id,
        to_account: to_account,
        transaction_id: `TRANSFER_${Date.now()}`,
        description: description || "Small internal transfer"
      });
    } else {
      return res.status(403).json({ error: "Unauthorized for small internal transfer" });
    }
  } catch (error) {
    console.error("Error in small internal transfer:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Large internal transfer (5M - 100M VND)
app.post("/accounts/:id/transfer/internal/large", checkJwt, async (req, res) => {
  try {
    const { amount, to_account, description } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (!amount || amount <= 5000000 || amount > 100000000) {
      return res.status(400).json({ error: "Invalid amount for large transfer (must be > 5M and <= 100M VND)" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account, {
      amount: amount,
      to_account: to_account,
      fraud_score: account.fraud_score || 0.1
    });
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["transfer_internal_large"]
    });

    if (decision.isAllowed("transfer_internal_large")) {
      return res.json({
        result: `Large internal transfer of ${amount} VND initiated`,
        from_account: req.params.id,
        to_account: to_account,
        transaction_id: `TRANSFER_LARGE_${Date.now()}`,
        description: description || "Large internal transfer",
        requires_additional_verification: true
      });
    } else {
      return res.status(403).json({ error: "Unauthorized for large internal transfer. Check MFA and transfer PIN verification." });
    }
  } catch (error) {
    console.error("Error in large internal transfer:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// External transfer
app.post("/accounts/:id/transfer/external", checkJwt, async (req, res) => {
  try {
    const { amount, to_bank, to_account, beneficiary_name, description } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount for external transfer" });
    }

    const principal = jwtToPrincipal(req.user);
    
    // For external transfers, beneficiary must be verified
    const resource = prepareResourceObject(account, {
      amount: amount,
      to_bank: to_bank,
      to_account: to_account,
      beneficiary_verified: req.body.beneficiary_verified || false,
      fraud_score: account.fraud_score || 0.1
    });
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["transfer_external"]
    });

    if (decision.isAllowed("transfer_external")) {
      return res.json({
        result: `External transfer of ${amount} VND initiated`,
        from_account: req.params.id,
        to_bank: to_bank,
        to_account: to_account,
        beneficiary_name: beneficiary_name,
        transaction_id: `EXT_TRANSFER_${Date.now()}`,
        description: description || "External transfer",
        processing_time: "1-3 business days",
        requires_beneficiary_verification: !req.body.beneficiary_verified
      });
    } else {
      return res.status(403).json({ error: "Unauthorized for external transfer. Check MFA, transfer PIN, and beneficiary verification." });
    }
  } catch (error) {
    console.error("Error in external transfer:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== ADMINISTRATIVE OPERATIONS ====================

// Freeze account
app.post("/accounts/:id/freeze", checkJwt, async (req, res) => {
  try {
    const { reason } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["freeze_account"]
    });

    if (decision.isAllowed("freeze_account")) {
      const updatedAccount = db.accounts.updateAccount(req.params.id, {
        status: "frozen",
        frozen_at: new Date().toISOString(),
        frozen_by: principal.id,
        freeze_reason: reason || "Administrative action"
      });
      
      return res.json({
        result: `Account ${req.params.id} has been frozen`,
        reason: reason || "Administrative action",
        frozen_by: principal.id,
        account: updatedAccount
      });
    } else {
      return res.status(403).json({ error: "Unauthorized to freeze account" });
    }
  } catch (error) {
    console.error("Error in freeze account:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Close account
app.post("/accounts/:id/close", checkJwt, async (req, res) => {
  try {
    const { reason, compliance_clearance } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    
    // Account closure requires specific conditions
    const resource = prepareResourceObject(account, {
      compliance_clearance: compliance_clearance === true
    });
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["close_account"]
    });

    if (decision.isAllowed("close_account")) {
      const updatedAccount = db.accounts.updateAccount(req.params.id, {
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: principal.id,
        closure_reason: reason || "Customer request"
      });
      
      return res.json({
        result: `Account ${req.params.id} has been closed`,
        reason: reason || "Customer request",
        closed_by: principal.id,
        account: updatedAccount
      });
    } else {
      return res.status(403).json({ 
        error: "Unauthorized to close account. Ensure balance is zero, no pending transactions, and compliance clearance is obtained." 
      });
    }
  } catch (error) {
    console.error("Error in close account:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== AUDIT AND COMPLIANCE OPERATIONS ====================

// Generate account statement
app.get("/accounts/:id/statement", checkJwt, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["generate_statement"]
    });

    if (decision.isAllowed("generate_statement")) {
      // Mock statement generation
      const statement = {
        account_id: account.id,
        account_number: account.accountNumber,
        statement_period: {
          start: start_date || "2024-01-01",
          end: end_date || new Date().toISOString().split('T')[0]
        },
        opening_balance: account.balance - 1000000,
        closing_balance: account.balance,
        transactions: [
          {
            date: "2024-01-15",
            description: "Salary Credit",
            credit: 15000000,
            balance: account.balance
          }
        ],
        generated_by: principal.id,
        generated_at: new Date().toISOString()
      };
      
      return res.json({
        result: "Statement generated successfully",
        statement: statement
      });
    } else {
      return res.status(403).json({ error: "Unauthorized to generate account statement" });
    }
  } catch (error) {
    console.error("Error in generate statement:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Flag account as suspicious
app.post("/accounts/:id/flag-suspicious", checkJwt, async (req, res) => {
  try {
    const { reason, risk_level } = req.body;
    const account = db.accounts.findOne(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const principal = jwtToPrincipal(req.user);
    const resource = prepareResourceObject(account);
    
    const decision = await cerbos.checkResource({
      principal,
      resource,
      actions: ["flag_suspicious"]
    });

    if (decision.isAllowed("flag_suspicious")) {
      const updatedAccount = db.accounts.updateAccount(req.params.id, {
        flagged_for_review: true,
        flag_reason: reason || "Suspicious activity detected",
        risk_level: risk_level || "medium",
        flagged_by: principal.id,
        flagged_at: new Date().toISOString()
      });
      
      return res.json({
        result: `Account ${req.params.id} flagged for suspicious activity`,
        reason: reason || "Suspicious activity detected",
        risk_level: risk_level || "medium",
        flagged_by: principal.id,
        account: updatedAccount
      });
    } else {
      return res.status(403).json({ error: "Unauthorized to flag account as suspicious" });
    }
  } catch (error) {
    console.error("Error in flag suspicious:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== LIST AND SEARCH OPERATIONS ====================

// List accounts with authorization filtering
app.get("/accounts", checkJwt, async (req, res) => {
  try {
    const { branch, status, owner_id } = req.query;
    let accounts;
    
    // Filter accounts based on query parameters
    if (branch) {
      accounts = db.accounts.findByBranch(branch);
    } else if (status) {
      accounts = db.accounts.findByStatus(status);
    } else if (owner_id) {
      accounts = db.accounts.findByOwnerId(owner_id);
    } else {
      accounts = db.accounts.findAll();
    }

    const principal = jwtToPrincipal(req.user);
    
    // Check authorization for each account
    const accountChecks = accounts.map(account => ({
      resource: prepareResourceObject(account),
      actions: ["read_basic_info"]
    }));
    
    const decision = await cerbos.checkResources({
      principal,
      resources: accountChecks
    });

    // Filter accounts based on authorization
    const authorizedAccounts = accounts.filter(account => 
      decision.isAllowed({
        resource: { kind: "account", id: account.id },
        action: "read_basic_info"
      })
    );

    // Return basic info for authorized accounts
    const accountList = authorizedAccounts.map(account => ({
      id: account.id,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      status: account.status,
      branch_code: account.branch_code,
      balance: account.balance
    }));

    return res.json({
      total_accounts: accountList.length,
      accounts: accountList
    });
  } catch (error) {
    console.error("Error in list accounts:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== UTILITY ENDPOINTS FOR TESTING ====================

// Update MFA status (for testing purposes)
app.post("/users/:id/mfa", checkJwt, async (req, res) => {
  try {
    const { verified } = req.body;
    const user = db.utils.updateMFA(req.params.id, verified);
    
    if (user) {
      return res.json({
        result: `MFA status updated for user ${req.params.id}`,
        mfa_verified: user.mfa_verified,
        mfa_timestamp: user.mfa_timestamp
      });
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error in update MFA:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create supervisor approval (for testing purposes)
app.post("/accounts/:id/supervisor-approval", checkJwt, async (req, res) => {
  try {
    const { supervisor_id } = req.body;
    const account = db.utils.createSupervisorApproval(req.params.id, supervisor_id || "SUP001");
    
    if (account) {
      return res.json({
        result: `Supervisor approval created for account ${req.params.id}`,
        approved_by_supervisor: account.approved_by_supervisor,
        supervisor_approval_id: account.supervisor_approval_id,
        supervisor_approval_timestamp: account.supervisor_approval_timestamp
      });
    } else {
      return res.status(404).json({ error: "Account not found" });
    }
  } catch (error) {
    console.error("Error in create supervisor approval:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update fraud score (for testing purposes)
app.post("/accounts/:id/fraud-score", checkJwt, async (req, res) => {
  try {
    const { score } = req.body;
    
    if (score < 0 || score > 1) {
      return res.status(400).json({ error: "Fraud score must be between 0 and 1" });
    }
    
    const account = db.utils.updateFraudScore(req.params.id, score);
    
    if (account) {
      return res.json({
        result: `Fraud score updated for account ${req.params.id}`,
        fraud_score: account.fraud_score
      });
    } else {
      return res.status(404).json({ error: "Account not found" });
    }
  } catch (error) {
    console.error("Error in update fraud score:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "Banking IAM System",
    timestamp: new Date().toISOString(),
    cerbos_connected: true
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏦 Banking IAM System listening on port ${PORT}`);
  console.log(`🔒 Cerbos authorization enabled`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /health - System health check`);
  console.log(`   GET  /accounts/:id/basic - Read basic account info`);
  console.log(`   GET  /accounts/:id/details - Read full account details`);
  console.log(`   GET  /accounts/:id/transactions - Read transaction history`);
  console.log(`   PATCH /accounts/:id/contact - Update contact information`);
  console.log(`   POST /accounts/:id/credit - Credit account balance`);
  console.log(`   POST /accounts/:id/debit - Debit account balance`);
  console.log(`   POST /accounts/:id/transfer/internal/small - Small internal transfer`);
  console.log(`   POST /accounts/:id/transfer/internal/large - Large internal transfer`);
  console.log(`   POST /accounts/:id/transfer/external - External transfer`);
  console.log(`   POST /accounts/:id/freeze - Freeze account`);
  console.log(`   POST /accounts/:id/close - Close account`);
  console.log(`   GET  /accounts/:id/statement - Generate statement`);
  console.log(`   POST /accounts/:id/flag-suspicious - Flag as suspicious`);
  console.log(`   GET  /accounts - List authorized accounts`);
  console.log(`🧪 Testing endpoints:`);
  console.log(`   POST /users/:id/mfa - Update MFA status`);
  console.log(`   POST /accounts/:id/supervisor-approval - Create supervisor approval`);
  console.log(`   POST /accounts/:id/fraud-score - Update fraud score`);
});