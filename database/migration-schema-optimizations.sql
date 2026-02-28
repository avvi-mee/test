-- ============================================================
-- UNMATRIX — Schema Optimization Migration
-- PostgreSQL product architecture review findings + fixes
-- Run AFTER schema-v2.sql is deployed
-- ============================================================


-- ========================== 1. MISSING FOREIGN KEYS ==========================

-- consultations.customer_uid should reference auth.users
ALTER TABLE consultations
  ADD CONSTRAINT consultations_customer_fk
  FOREIGN KEY (customer_uid) REFERENCES auth.users(id) ON DELETE SET NULL;

-- activity_logs.entity_id is not FK'd (polymorphic reference — acceptable)
-- BUT entity_type should be constrained to known values via CHECK
ALTER TABLE activity_logs
  ADD CONSTRAINT chk_entity_type
  CHECK (entity_type IN ('lead','project','task','invoice','vendor_bill','consultation','estimate'));

-- portfolio_projects missing images array column that frontend uses
-- (frontend reads row.images, schema only has image_url, before_image_url, after_image_url)
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';


-- ========================== 2. INDEX GAPS ==========================

-- Missing: customers lookup by email (used in auth flow)
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Missing: leads lookup by email (dedup check in consultation form)
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(tenant_id, email) WHERE email IS NOT NULL;

-- Missing: estimates by customer_email (storefront order lookup)
CREATE INDEX IF NOT EXISTS idx_estimates_customer_email ON estimates(tenant_id, customer_email)
  WHERE customer_email IS NOT NULL;

-- Missing: follow_ups by scheduled_at (today's follow-ups query)
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(tenant_id, scheduled_at)
  WHERE status = 'pending';

-- Missing: invoices by project_id (finance page project lookup)
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id) WHERE project_id IS NOT NULL;

-- Missing: vendor_bills by project_id
CREATE INDEX IF NOT EXISTS idx_vendor_bills_project ON vendor_bills(project_id) WHERE project_id IS NOT NULL;

-- Missing: activity_logs by tenant + entity_type (filtered realtime subscription)
CREATE INDEX IF NOT EXISTS idx_activity_tenant_entity ON activity_logs(tenant_id, entity_type, created_at DESC);

-- Missing: tenants by owner_id (owner login lookup)
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);

-- Missing: tenants by email (tenant login lookup)
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);

-- Missing: cities by tenant + name (alphabetical listing)
CREATE INDEX IF NOT EXISTS idx_cities_tenant_name ON cities(tenant_id, name);


-- ========================== 3. NULLABLE MISTAKES ==========================

-- leads.email should probably not be nullable for a CRM lead
-- But storefront forms may not always collect email, so keep nullable.
-- However, leads.name should always be set — it already is NOT NULL. Good.

-- estimates.customer_name is NOT NULL — correct.
-- estimates.customer_email SHOULD be NOT NULL for order tracking.
-- Can't change in production without backfilling, so add a CHECK instead:
-- (skip — may have existing nulls from storefront submissions)

-- follow_ups: missing notes column that frontend writes to
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;


-- ========================== 4. MONEY HANDLING ==========================

-- All money columns already use NUMERIC(12,2) — CORRECT.
-- NUMERIC is the right type for money (not FLOAT, not MONEY).
-- CHECK constraints ensure non-negative values — CORRECT.
-- Generated balance columns prevent sync bugs — CORRECT.
-- No changes needed.


-- ========================== 5. CASCADE DELETE SAFETY ==========================

-- Current CASCADE behavior:
--   tenants CASCADE → leads, estimates, projects, invoices, etc.
--   This means deleting a tenant wipes ALL business data.
--   At scale, this should be soft-delete only.

-- Add a soft-delete pattern for tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(id) WHERE deleted_at IS NULL;

-- For projects: ON DELETE CASCADE from phases → tasks → attachments/comments
-- is correct (deleting a project should clean up its children).

-- For invoices: invoice_payments CASCADE is correct (orphan payments make no sense).

-- leads: ON DELETE SET NULL for estimate_id and project_id is correct.


-- ========================== 6. MISSING VIEWS ==========================

-- Tenant revenue view (derived from invoices, not stored)
CREATE OR REPLACE VIEW v_tenant_revenue AS
SELECT
  tenant_id,
  COALESCE(SUM(amount), 0) AS total_invoiced,
  COALESCE(SUM(paid_amount), 0) AS total_received,
  COALESCE(SUM(amount - paid_amount), 0) AS outstanding
FROM invoices
WHERE status NOT IN ('cancelled', 'written_off')
GROUP BY tenant_id;

-- Team roster view (joins tenant_users + users + roles)
CREATE OR REPLACE VIEW v_team_roster AS
SELECT
  tu.id AS tenant_user_id,
  tu.tenant_id,
  tu.user_id,
  tu.is_owner,
  tu.is_active,
  tu.area,
  tu.joined_at,
  u.email,
  u.full_name,
  u.phone,
  u.avatar_url,
  COALESCE(
    (SELECT array_agg(r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.tenant_user_id = tu.id),
    ARRAY[]::TEXT[]
  ) AS role_names
FROM tenant_users tu
JOIN users u ON u.id = tu.user_id;


-- ========================== 7. REALTIME PUBLICATION (v2 tables) ==========================

-- Update realtime publication for v2 table names
ALTER PUBLICATION supabase_realtime ADD TABLE
  leads, estimates, projects, phases, tasks,
  invoices, vendor_bills, consultations, follow_ups,
  tenant_users, user_roles, roles,
  pricing_configs, tenant_page_configs, portfolio_projects,
  testimonials, team_members, custom_pages, cities,
  activity_logs, invoice_payments, vendor_payments;


-- ========================== 8. PREVENT ENUM RIGIDITY ==========================

-- The schema has 17 enum types. Adding values requires ALTER TYPE.
-- For the most-changed ones, consider replacing with TEXT + CHECK:
-- (Not doing this now — it's a larger migration. Document for future.)
--
-- Candidates to convert from enum to TEXT + CHECK:
--   follow_up_type (new channels like 'sms', 'telegram' are inevitable)
--   lead_source (new acquisition channels)
--   payment_method (new payment rails)
--   page_type (new page types as website builder grows)
--
-- Stable enums that should stay:
--   tenant_status, project_status, invoice_status (well-defined state machines)


-- ========================== DONE ==========================
-- Summary:
-- 1. Added missing FK: consultations.customer_uid → auth.users
-- 2. Added entity_type CHECK constraint on activity_logs
-- 3. Added 10 missing indexes for common query patterns
-- 4. Added missing columns: follow_ups.notes, .created_by, .completed_at
-- 5. Added portfolio_projects.images array column
-- 6. Added soft-delete support for tenants (deleted_at)
-- 7. Created v_tenant_revenue and v_team_roster views
-- 8. Updated realtime publication for v2 tables
