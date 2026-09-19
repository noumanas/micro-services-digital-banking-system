-- Each microservice owns its own database (see PRD section 23: Database Architecture).
-- Only identity_db is required for Phase 1; the rest are created ahead of time
-- so later phases can add services without touching this file.

CREATE DATABASE identity_db;
CREATE DATABASE customer_db;
CREATE DATABASE kyc_db;
CREATE DATABASE account_db;
CREATE DATABASE ledger_db;
CREATE DATABASE payment_db;
CREATE DATABASE transfer_db;
CREATE DATABASE card_db;
CREATE DATABASE fraud_db;
CREATE DATABASE reporting_db;
CREATE DATABASE notification_db;
