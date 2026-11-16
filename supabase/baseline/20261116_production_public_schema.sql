CREATE TYPE public.auth_status AS ENUM ('pending_device', 'active', 'revoked', 'expired');
CREATE TYPE public.purchase_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'cancelled');
CREATE SEQUENCE IF NOT EXISTS public.support_tickets_ticket_number_seq;
CREATE TABLE public.access_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid,
  router_id uuid,
  name text NOT NULL,
  mac_address text NOT NULL,
  ip_address inet,
  status text DEFAULT 'online'::text,
  connected_clients integer DEFAULT 0,
  uptime_seconds bigint DEFAULT 0,
  last_seen timestamp with time zone DEFAULT now()
);
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text DEFAULT 'info'::text,
  entity_id text,
  location_id uuid,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.backhauls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid,
  provider text NOT NULL,
  identifier text NOT NULL,
  status text DEFAULT 'online'::text,
  current_latency_ms numeric(6,2) DEFAULT 0,
  download_mbps numeric(8,2) DEFAULT 0,
  upload_mbps numeric(8,2) DEFAULT 0,
  monthly_data_used_gb numeric(10,2) DEFAULT 0,
  last_seen timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.campuses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  university_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  slug character varying(100) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  phone_number character varying(20) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid,
  mac_address macaddr NOT NULL,
  user_agent text,
  last_seen_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount_ngn numeric(12,2) NOT NULL,
  location_id uuid,
  description text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campus_id uuid,
  name character varying(255) NOT NULL,
  slug character varying(100) NOT NULL,
  building character varying(100),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  institution_id uuid,
  location_type text DEFAULT 'campus_facility'::text,
  address text,
  status text DEFAULT 'active'::text,
  contact_phone text
);
CREATE TABLE public.network_authorizations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  purchase_id uuid NOT NULL,
  device_id uuid NOT NULL,
  router_id uuid NOT NULL,
  assigned_ip character varying(45),
  status auth_status DEFAULT 'active'::auth_status,
  rate_limit_rule character varying(50),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.network_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  customer_id uuid,
  location_id uuid,
  router_id uuid,
  access_point_id uuid,
  mac_address text NOT NULL,
  ip_address inet NOT NULL,
  bytes_in bigint DEFAULT 0,
  bytes_out bigint DEFAULT 0,
  session_start timestamp with time zone DEFAULT now(),
  session_end timestamp with time zone,
  status text DEFAULT 'active'::text
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying(255) NOT NULL,
  slug character varying(100) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  purchase_id uuid NOT NULL,
  paystack_reference character varying(120) NOT NULL,
  amount_kobo bigint NOT NULL,
  currency character varying(3) DEFAULT 'NGN'::character varying,
  status character varying(50) NOT NULL,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid,
  name character varying(100) NOT NULL,
  price_kobo bigint NOT NULL,
  duration_seconds integer NOT NULL,
  upload_limit_kbps integer DEFAULT 3072,
  download_limit_kbps integer DEFAULT 7168,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  bandwidth_limit integer,
  duration_minutes integer,
  download_speed integer,
  upload_speed integer,
  speed_down_mbps integer NOT NULL DEFAULT 5,
  speed_up_mbps integer NOT NULL DEFAULT 2,
  data_limit_mb bigint,
  device_limit integer DEFAULT 1,
  allowed_location_ids uuid[]
);
CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid,
  plan_id uuid NOT NULL,
  location_id uuid NOT NULL,
  status purchase_status DEFAULT 'pending'::purchase_status,
  claim_token character varying(64),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  amount_paid numeric DEFAULT 0,
  location_slug text,
  phone_number text,
  reference text,
  mac_address text,
  payment_gateway text DEFAULT 'monnify'::text,
  gateway_fee_ngn numeric(10,2) DEFAULT 0.00,
  net_amount_ngn numeric(10,2) DEFAULT 0.00
);
CREATE TABLE public.qr_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  location_id uuid NOT NULL,
  public_token character varying(64) NOT NULL,
  label character varying(100) NOT NULL,
  scan_count bigint DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.routers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  location_id uuid NOT NULL,
  identifier character varying(100) NOT NULL,
  management_ip character varying(45) NOT NULL,
  api_port integer DEFAULT 8728,
  api_user character varying(100) NOT NULL,
  api_password_encrypted text NOT NULL,
  hotspot_server_name character varying(100) DEFAULT 'hs-main'::character varying,
  is_online boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  backhaul_id uuid,
  model text DEFAULT 'MikroTik RouterBOARD'::text,
  api_ip text,
  status text DEFAULT 'online'::text,
  uptime_seconds bigint DEFAULT 0,
  cpu_usage_pct integer DEFAULT 0,
  memory_usage_pct integer DEFAULT 0,
  wan_status text DEFAULT 'connected'::text,
  last_heartbeat timestamp with time zone DEFAULT now()
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  plan_id uuid,
  reference text NOT NULL,
  status text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  data_consumed_bytes bigint DEFAULT 0,
  device_limit integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_number integer NOT NULL DEFAULT nextval('support_tickets_ticket_number_seq'::regclass),
  customer_id uuid,
  location_id uuid,
  category text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open'::text,
  assigned_to text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.universities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  short_name character varying(50) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.access_points ADD CONSTRAINT access_points_mac_address_key UNIQUE (mac_address);
ALTER TABLE ONLY public.access_points ADD CONSTRAINT access_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.access_points ADD CONSTRAINT access_points_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text])));
ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text, 'critical'::text])));
ALTER TABLE ONLY public.backhauls ADD CONSTRAINT backhauls_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.backhauls ADD CONSTRAINT backhauls_status_check CHECK ((status = ANY (ARRAY['online'::text, 'degraded'::text, 'offline'::text])));
ALTER TABLE ONLY public.campuses ADD CONSTRAINT campuses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.campuses ADD CONSTRAINT campuses_university_id_slug_key UNIQUE (university_id, slug);
ALTER TABLE ONLY public.customers ADD CONSTRAINT customers_phone_number_key UNIQUE (phone_number);
ALTER TABLE ONLY public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.devices ADD CONSTRAINT devices_mac_address_key UNIQUE (mac_address);
ALTER TABLE ONLY public.devices ADD CONSTRAINT devices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_category_check CHECK ((category = ANY (ARRAY['backhaul'::text, 'equipment'::text, 'installation'::text, 'repairs'::text, 'power'::text, 'staff'::text, 'marketing'::text, 'software'::text, 'other'::text])));
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.institutions ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.institutions ADD CONSTRAINT institutions_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.locations ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.locations ADD CONSTRAINT locations_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.locations ADD CONSTRAINT locations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'degraded'::text, 'offline'::text])));
ALTER TABLE ONLY public.network_authorizations ADD CONSTRAINT network_authorizations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'terminated'::text])));
ALTER TABLE ONLY public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.payments ADD CONSTRAINT payments_paystack_reference_key UNIQUE (paystack_reference);
ALTER TABLE ONLY public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_claim_token_key UNIQUE (claim_token);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.qr_codes ADD CONSTRAINT qr_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.qr_codes ADD CONSTRAINT qr_codes_public_token_key UNIQUE (public_token);
ALTER TABLE ONLY public.routers ADD CONSTRAINT routers_identifier_key UNIQUE (identifier);
ALTER TABLE ONLY public.routers ADD CONSTRAINT routers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.routers ADD CONSTRAINT routers_status_check CHECK ((status = ANY (ARRAY['online'::text, 'degraded'::text, 'offline'::text])));
ALTER TABLE ONLY public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subscriptions ADD CONSTRAINT subscriptions_reference_key UNIQUE (reference);
ALTER TABLE ONLY public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'depleted'::text, 'suspended'::text])));
ALTER TABLE ONLY public.support_tickets ADD CONSTRAINT support_tickets_category_check CHECK ((category = ANY (ARRAY['connection'::text, 'payment'::text, 'account'::text, 'hardware'::text, 'other'::text])));
ALTER TABLE ONLY public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.support_tickets ADD CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text])));
ALTER TABLE ONLY public.support_tickets ADD CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number);
ALTER TABLE ONLY public.universities ADD CONSTRAINT universities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.access_points ADD CONSTRAINT access_points_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.access_points ADD CONSTRAINT access_points_router_id_fkey FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.backhauls ADD CONSTRAINT backhauls_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.campuses ADD CONSTRAINT campuses_university_id_fkey FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.devices ADD CONSTRAINT devices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.locations ADD CONSTRAINT locations_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.locations ADD CONSTRAINT locations_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.network_authorizations ADD CONSTRAINT network_authorizations_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.network_authorizations ADD CONSTRAINT network_authorizations_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.network_authorizations ADD CONSTRAINT network_authorizations_router_id_fkey FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_access_point_id_fkey FOREIGN KEY (access_point_id) REFERENCES access_points(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_router_id_fkey FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.network_sessions ADD CONSTRAINT network_sessions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payments ADD CONSTRAINT payments_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.plans ADD CONSTRAINT plans_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.qr_codes ADD CONSTRAINT qr_codes_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.routers ADD CONSTRAINT routers_backhaul_id_fkey FOREIGN KEY (backhaul_id) REFERENCES backhauls(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.routers ADD CONSTRAINT routers_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subscriptions ADD CONSTRAINT subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.support_tickets ADD CONSTRAINT support_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.support_tickets ADD CONSTRAINT support_tickets_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.universities ADD CONSTRAINT universities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_activity_logs_location ON public.activity_logs USING btree (location_id);
CREATE INDEX idx_activity_logs_time ON public.activity_logs USING btree (created_at DESC);
CREATE INDEX idx_ap_location ON public.access_points USING btree (location_id);
CREATE INDEX idx_devices_mac ON public.devices USING btree (mac_address);
CREATE INDEX idx_locations_slug ON public.locations USING btree (slug);
CREATE INDEX idx_payments_reference ON public.payments USING btree (paystack_reference);
CREATE INDEX idx_purchases_claim_token ON public.purchases USING btree (claim_token);
CREATE INDEX idx_purchases_location ON public.purchases USING btree (location_id);
CREATE INDEX idx_purchases_status ON public.purchases USING btree (status);
CREATE INDEX idx_qr_public_token ON public.qr_codes USING btree (public_token);
CREATE INDEX idx_routers_location ON public.routers USING btree (location_id);
CREATE INDEX idx_sessions_customer ON public.network_sessions USING btree (customer_id);
CREATE INDEX idx_sessions_location ON public.network_sessions USING btree (location_id);
CREATE INDEX idx_sessions_status ON public.network_sessions USING btree (status);
CREATE INDEX idx_subscriptions_customer ON public.subscriptions USING btree (customer_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);
ALTER TABLE public.access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backhauls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_authorizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.routers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view activity logs" ON public.activity_logs AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read access to purchases" ON public.purchases AS PERMISSIVE FOR SELECT TO public USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.backhauls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.network_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.routers;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.access_points TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.access_points TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.access_points TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_logs TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_logs TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.backhauls TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.backhauls TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.backhauls TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campuses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campuses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campuses TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.customers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.customers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.customers TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.devices TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.devices TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.devices TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.institutions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.institutions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.institutions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.locations TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.locations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.locations TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.network_authorizations TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.network_authorizations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.network_authorizations TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.network_sessions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.network_sessions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.network_sessions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.organizations TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.organizations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.organizations TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.payments TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.payments TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.payments TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.plans TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.plans TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.plans TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchases TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchases TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.purchases TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.qr_codes TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.qr_codes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.qr_codes TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.routers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.routers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.routers TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscriptions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscriptions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscriptions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.support_tickets TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.support_tickets TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.support_tickets TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.universities TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.universities TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.universities TO service_role;