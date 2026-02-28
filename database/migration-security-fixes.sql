-- ============================================================
-- Security Fixes Migration
-- Apply this to an existing Supabase database to patch
-- vulnerabilities V-01 through V-14 from the security audit.
-- Run in Supabase SQL Editor.
-- ============================================================


-- ========== V-03: Fix RLS policies with OR TRUE ==========

-- Drop and recreate leads_select without OR TRUE
DROP POLICY IF EXISTS leads_select ON leads;
CREATE POLICY leads_select ON leads FOR SELECT USING (is_tenant_member(tenant_id));

-- Drop and recreate consultations_select without OR TRUE
DROP POLICY IF EXISTS consultations_select ON consultations;
CREATE POLICY consultations_select ON consultations FOR SELECT USING (
  is_tenant_member(tenant_id)
  OR customer_uid = auth.uid()
);

-- Drop and recreate estimates_select with proper scoping
DROP POLICY IF EXISTS estimates_select ON estimates;
CREATE POLICY estimates_select ON estimates FOR SELECT USING (
  is_tenant_member(tenant_id)
  OR (customer_info->>'email') = auth.jwt()->>'email'
);

-- Drop and recreate timeline_select to require auth
DROP POLICY IF EXISTS timeline_select ON timeline_events;
CREATE POLICY timeline_select ON timeline_events FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS timeline_insert ON timeline_events;
CREATE POLICY timeline_insert ON timeline_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ========== V-05: Restrict INSERT policies ==========

-- task_attachments: require tenant membership
DROP POLICY IF EXISTS attachments_insert ON task_attachments;
CREATE POLICY attachments_insert ON task_attachments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_attachments.task_id AND is_tenant_member(p.tenant_id))
);

-- task_comments: require tenant membership
DROP POLICY IF EXISTS comments_insert ON task_comments;
CREATE POLICY comments_insert ON task_comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_comments.task_id AND is_tenant_member(p.tenant_id))
);

-- project_activity_log: require tenant membership + actor identity
DROP POLICY IF EXISTS activity_log_insert ON project_activity_log;
CREATE POLICY activity_log_insert ON project_activity_log FOR INSERT WITH CHECK (
  is_tenant_member(tenant_id) AND performed_by = auth.uid()::text
);

-- invoice_payments: require tenant membership via invoice
DROP POLICY IF EXISTS inv_payments_insert ON invoice_payments;
CREATE POLICY inv_payments_insert ON invoice_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_payments.invoice_id AND is_tenant_member(invoices.tenant_id))
);

-- vendor_bill_payments: require tenant membership via vendor bill
DROP POLICY IF EXISTS vb_payments_insert ON vendor_bill_payments;
CREATE POLICY vb_payments_insert ON vendor_bill_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM vendor_bills WHERE vendor_bills.id = vendor_bill_payments.bill_id AND is_tenant_member(vendor_bills.tenant_id))
);

-- activities: require auth + tenant membership if tenant_id is set
DROP POLICY IF EXISTS activities_insert ON activities;
CREATE POLICY activities_insert ON activities FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (tenant_id IS NULL OR is_tenant_member(tenant_id))
);


-- ========== V-06: Explicit DELETE policies ==========

-- Tables that should NOT allow client-side deletes
CREATE POLICY leads_delete ON leads FOR DELETE USING (FALSE);
CREATE POLICY estimates_delete ON estimates FOR DELETE USING (FALSE);
CREATE POLICY timeline_delete ON timeline_events FOR DELETE USING (FALSE);
CREATE POLICY project_activity_log_delete ON project_activity_log FOR DELETE USING (FALSE);
CREATE POLICY invoice_sequences_delete ON invoice_sequences FOR DELETE USING (FALSE);
CREATE POLICY activities_delete ON activities FOR DELETE USING (FALSE);

-- Tables where tenant members can delete within their tenant
CREATE POLICY project_phases_delete ON project_phases FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_phases.project_id AND is_tenant_member(projects.tenant_id))
);
CREATE POLICY project_tasks_delete ON project_tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_tasks.project_id AND is_tenant_member(projects.tenant_id))
);
CREATE POLICY task_attachments_delete ON task_attachments FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_attachments.task_id AND is_tenant_member(p.tenant_id))
);
CREATE POLICY task_comments_delete ON task_comments FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = task_comments.task_id AND is_tenant_member(p.tenant_id))
);
CREATE POLICY invoices_delete ON invoices FOR DELETE USING (is_tenant_owner(tenant_id) OR is_superadmin());
CREATE POLICY invoice_payments_delete ON invoice_payments FOR DELETE USING (FALSE);
CREATE POLICY vendor_bills_delete ON vendor_bills FOR DELETE USING (is_tenant_owner(tenant_id) OR is_superadmin());
CREATE POLICY vendor_bill_payments_delete ON vendor_bill_payments FOR DELETE USING (FALSE);
CREATE POLICY consultations_delete ON consultations FOR DELETE USING (is_tenant_member(tenant_id));
CREATE POLICY follow_ups_delete ON follow_ups FOR DELETE USING (is_tenant_member(tenant_id));
CREATE POLICY enterprise_req_delete ON enterprise_requests FOR DELETE USING (is_superadmin());
CREATE POLICY customers_delete ON customers FOR DELETE USING (id = auth.uid());


-- ========== V-08: Public tenant view (v2 columns) ==========

DROP VIEW IF EXISTS tenants_public;
CREATE OR REPLACE VIEW tenants_public AS
SELECT
  id,
  name,
  slug,
  status,
  subscription,
  settings,
  created_at
FROM tenants
WHERE status = 'active';

GRANT SELECT ON tenants_public TO anon, authenticated;

-- ========== V-15: Restrict tenants table from world-readable ==========
-- Replace the USING(TRUE) policy with member/owner/superadmin only
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT USING (
  owner_id = auth.uid()
  OR is_tenant_member(id)
  OR is_superadmin()
  -- Allow slug lookup for storefront routing (anon can match on slug)
  OR (auth.uid() IS NULL AND status = 'active')
);

-- ========== V-16: Close open INSERT policies ==========
-- leads: require valid active tenant reference (blocks anonymous spam)
DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tenants WHERE id = leads.tenant_id AND status = 'active')
);

-- estimates: require valid active tenant reference
DROP POLICY IF EXISTS estimates_insert ON estimates;
CREATE POLICY estimates_insert ON estimates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tenants WHERE id = estimates.tenant_id AND status = 'active')
);

-- consultations: require valid active tenant reference
DROP POLICY IF EXISTS consultations_insert ON consultations;
DROP POLICY IF EXISTS consult_insert ON consultations;
CREATE POLICY consultations_insert ON consultations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tenants WHERE id = consultations.tenant_id AND status = 'active')
);

-- ========== V-17: Lock legacy timeline_events to superadmin ==========
DROP POLICY IF EXISTS timeline_select ON timeline_events;
DROP POLICY IF EXISTS timeline_insert ON timeline_events;
DROP POLICY IF EXISTS timeline_delete ON timeline_events;
CREATE POLICY timeline_select_admin ON timeline_events FOR SELECT USING (is_superadmin());
CREATE POLICY timeline_insert_admin ON timeline_events FOR INSERT WITH CHECK (is_superadmin());

-- ========== V-18: activity_logs tenant isolation ==========
DROP POLICY IF EXISTS al_select ON activity_logs;
DROP POLICY IF EXISTS al_insert ON activity_logs;
CREATE POLICY al_select ON activity_logs FOR SELECT USING (
  is_tenant_member(tenant_id) OR is_superadmin()
);
CREATE POLICY al_insert ON activity_logs FOR INSERT WITH CHECK (
  is_tenant_member(tenant_id) OR is_superadmin()
);


-- ========== V-09: Prevent role self-escalation ==========

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = OLD.role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: cannot change user role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON users;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_escalation();


-- ========== V-13: Mark security functions VOLATILE ==========

CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_tenant_owner(tid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants WHERE id = tid AND owner_uid = auth.uid()
  );
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_tenant_employee(tid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE tenant_id = tid AND auth_uid = auth.uid() AND is_active = TRUE
  );
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_tenant_member(tid UUID) RETURNS BOOLEAN AS $$
  SELECT is_tenant_owner(tid) OR is_tenant_employee(tid) OR is_superadmin();
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;


-- ========== V-04: Fix storage policies ==========

-- Drop old permissive storage policies
DROP POLICY IF EXISTS "Auth upload tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth update tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload private-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Auth read private-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete private-uploads" ON storage.objects;

-- Remove SVG from allowed MIME types (XSS vector)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf']
WHERE id = 'tenant-assets';

-- tenant-assets: tenant-scoped upload/update/delete
CREATE POLICY "Tenant upload tenant-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = user_tenant_id()::text
  );

CREATE POLICY "Tenant update tenant-assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = user_tenant_id()::text
  );

CREATE POLICY "Owner delete tenant-assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-assets'
    AND owner = auth.uid()::text
  );

-- private-uploads: tenant-scoped read/upload/delete
CREATE POLICY "Tenant upload private-uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'private-uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = user_tenant_id()::text
  );

CREATE POLICY "Tenant read private-uploads"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'private-uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = user_tenant_id()::text
  );

CREATE POLICY "Owner delete private-uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'private-uploads'
    AND owner = auth.uid()::text
  );


-- ============================================================
-- DONE — All security fixes applied.
-- Remember to also:
-- 1. Set CRON_SECRET env var for server-to-server API calls
-- 2. Deploy updated Next.js code (middleware, API route auth)
-- 3. Test RLS policies as described in the verification plan
-- ============================================================
