--
-- PostgreSQL database dump
--

\restrict RjQQ7gW5ec2CH1TeY2hAJHqqF9SBCVVRYCNdoXnEi6xtSz1PpCkdgE72k3nYdEg

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_events (
    event_id text NOT NULL,
    task_id text,
    team_id text,
    actor_id text,
    type text NOT NULL,
    data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    approval_id text NOT NULL,
    task_id text,
    team_id text NOT NULL,
    requested_by text NOT NULL,
    reviewed_by text,
    status text DEFAULT 'pending'::text NOT NULL,
    request_type text NOT NULL,
    request_data jsonb,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT approvals_request_type_check CHECK ((request_type = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text]))),
    CONSTRAINT approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automations (
    automation_id text NOT NULL,
    team_id text,
    name text NOT NULL,
    trigger jsonb NOT NULL,
    actions jsonb NOT NULL,
    enabled boolean DEFAULT true,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    last_run_at timestamp with time zone,
    run_count integer DEFAULT 0
);


--
-- Name: board_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_columns (
    column_id text NOT NULL,
    board_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color text DEFAULT '#05b7aa'::text,
    sort_order integer DEFAULT 0,
    is_done boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boards (
    board_id text NOT NULL,
    team_id text NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#0082c6'::text,
    is_default boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    category_id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#0082c6'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_members (
    channel_id text NOT NULL,
    user_id text NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    last_read_at timestamp with time zone DEFAULT now()
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    channel_id text NOT NULL,
    org_id text NOT NULL,
    type text NOT NULL,
    project_id text,
    name text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone,
    CONSTRAINT channels_type_check CHECK ((type = ANY (ARRAY['project'::text, 'general'::text, 'dm'::text])))
);


--
-- Name: dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboards (
    dashboard_id text NOT NULL,
    user_id text,
    name text NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: field_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_definitions (
    field_id text NOT NULL,
    team_id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT field_definitions_type_check CHECK ((type = ANY (ARRAY['status'::text, 'person'::text, 'date'::text, 'number'::text, 'dropdown'::text, 'files'::text, 'text'::text])))
);


--
-- Name: field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_values (
    task_id text NOT NULL,
    field_id text NOT NULL,
    value jsonb
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    invite_id text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    token text NOT NULL,
    invited_by text,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    full_name text,
    "position" text,
    company_name text,
    member_role text,
    receives_approval_emails boolean DEFAULT true NOT NULL
);


--
-- Name: mentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentions (
    mention_id text NOT NULL,
    comment_id text,
    mentioned_user_id text,
    notified_at timestamp with time zone,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    attachment_id text NOT NULL,
    message_id text NOT NULL,
    r2_key text NOT NULL,
    filename text NOT NULL,
    mime_type text,
    size_bytes bigint,
    url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reactions (
    message_id text NOT NULL,
    user_id text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    message_id text NOT NULL,
    channel_id text NOT NULL,
    sender_id text,
    body text NOT NULL,
    parent_id text,
    source text DEFAULT 'web'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_source_check CHECK ((source = ANY (ARRAY['web'::text, 'mobile'::text, 'whatsapp'::text, 'email'::text])))
);


--
-- Name: notification_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_prefs (
    user_id text NOT NULL,
    prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    quiet_start text DEFAULT '22:00'::text NOT NULL,
    quiet_end text DEFAULT '07:00'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    notification_id text NOT NULL,
    user_id text NOT NULL,
    team_id text,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    task_id text,
    url text,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);


--
-- Name: project_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assignments (
    assignment_id character varying(255) NOT NULL,
    team_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by character varying(255),
    receives_approval_emails boolean DEFAULT true NOT NULL,
    full_name text,
    "position" text,
    company_name text,
    member_role text,
    CONSTRAINT project_assignments_role_check CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying, 'client'::character varying])::text[])))
);


--
-- Name: project_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_columns (
    column_id text NOT NULL,
    team_id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#0082c6'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_done boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_templates (
    template_id text NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    subscription_id text NOT NULL,
    user_id text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id text DEFAULT ('pt_'::text || substr(md5((random())::text), 1, 12)) NOT NULL,
    user_id text NOT NULL,
    platform text NOT NULL,
    token text NOT NULL,
    device_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_web_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_web_subscriptions (
    id text DEFAULT ('pws_'::text || substr(md5((random())::text), 1, 12)) NOT NULL,
    user_id text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: report_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_schedules (
    schedule_id text DEFAULT ('sched_'::text || substr((gen_random_uuid())::text, 1, 12)) NOT NULL,
    team_id text NOT NULL,
    created_by text NOT NULL,
    frequency text NOT NULL,
    file_formats text[] DEFAULT '{pdf}'::text[] NOT NULL,
    recipients text[] DEFAULT '{}'::text[] NOT NULL,
    day_of_week smallint,
    day_of_month smallint,
    send_hour_utc smallint DEFAULT 2 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sent_at timestamp with time zone,
    next_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_schedules_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])))
);


--
-- Name: saved_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_views (
    view_id text NOT NULL,
    team_id text,
    name text NOT NULL,
    type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    created_by text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT saved_views_type_check CHECK ((type = ANY (ARRAY['kanban'::text, 'table'::text, 'calendar'::text])))
);


--
-- Name: task_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_clients (
    id text NOT NULL,
    task_id text NOT NULL,
    user_id text NOT NULL,
    invited_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    comment_id text NOT NULL,
    task_id text NOT NULL,
    user_id text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    edited boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_templates (
    template_id text NOT NULL,
    team_id text,
    name text NOT NULL,
    config jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    is_default boolean DEFAULT false,
    icon text DEFAULT '📋'::text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    task_id text NOT NULL,
    user_id text,
    team_id text,
    created_by_user_id text NOT NULL,
    assigned_by_user_id text,
    completed_by_user_id text,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    category_id text,
    tags text[] DEFAULT '{}'::text[],
    assignee_user_ids text[] DEFAULT '{}'::text[],
    assignee_emails text[] DEFAULT '{}'::text[],
    due_at timestamp with time zone,
    reminder_at timestamp with time zone,
    reminder_sent_at timestamp with time zone,
    recurrence_rule text DEFAULT 'none'::text,
    recurrence_interval integer DEFAULT 1,
    estimated_minutes integer,
    attachments jsonb DEFAULT '[]'::jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    subtasks jsonb DEFAULT '[]'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    board_id text,
    column_slug text,
    column_id text,
    requires_approval boolean DEFAULT false,
    approval_status character varying(50),
    approved_by character varying(255),
    approval_notes text,
    approval_requested_at timestamp with time zone,
    approval_decided_at timestamp with time zone,
    approval_id text,
    created_by_name text,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    member_id text NOT NULL,
    team_id text NOT NULL,
    email text NOT NULL,
    user_id text,
    role text DEFAULT 'member'::text NOT NULL,
    status text DEFAULT 'invited'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    full_name text,
    "position" text,
    company_name text,
    member_role text,
    receives_approval_emails boolean DEFAULT true NOT NULL,
    CONSTRAINT team_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'client'::text]))),
    CONSTRAINT team_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'invited'::text])))
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    team_id text NOT NULL,
    name text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by text,
    color text
);


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_entries (
    entry_id text NOT NULL,
    task_id text,
    user_id text,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    minutes integer,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    user_id character varying(255) NOT NULL,
    pagination_default integer DEFAULT 25,
    sidebar_collapsed boolean DEFAULT false,
    theme character varying(20) DEFAULT 'light'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_preferences_pagination_default_check CHECK ((pagination_default = ANY (ARRAY[25, 50, 100])))
);


--
-- Name: user_whatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_whatsapp (
    user_id text NOT NULL,
    phone text NOT NULL,
    otp text,
    otp_expires_at timestamp with time zone,
    verified_at timestamp with time zone,
    opted_in_at timestamp with time zone DEFAULT now() NOT NULL,
    opted_out_at timestamp with time zone,
    notify_approvals boolean DEFAULT true NOT NULL,
    notify_mentions boolean DEFAULT true NOT NULL,
    notify_assignments boolean DEFAULT true NOT NULL,
    notify_dms boolean DEFAULT true NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    salt text NOT NULL,
    avatar text,
    provider text DEFAULT 'local'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'member'::text NOT NULL,
    full_name text,
    "position" text,
    company_name text,
    member_role text,
    receives_approval_emails boolean DEFAULT true NOT NULL,
    password_reset_token text,
    password_reset_expires timestamp with time zone
);


--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_messages (
    wa_message_id text NOT NULL,
    user_id text,
    direction text NOT NULL,
    context_type text,
    context_id text,
    template_name text,
    body text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    CONSTRAINT whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text])))
);


--
-- Name: whatsapp_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_sessions (
    phone text NOT NULL,
    state text NOT NULL,
    context_type text,
    context_id text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval)
);


--
-- Data for Name: activity_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_events (event_id, task_id, team_id, actor_id, type, data, created_at) FROM stdin;
evt_71e56e684b7447	task_5a3d88f0b499	team_95beaa7529a9	user_f798947b8a2e	created	"{\\"title\\": \\"UK Team\\"}"	2026-06-05 21:16:03.690592+00
evt_00f35252d0854a	task_3e20f1055ddd	team_95beaa7529a9	user_f798947b8a2e	subtask_added	"{\\"title\\": \\"Insta Post\\"}"	2026-06-06 05:48:25.584981+00
evt_00055c83dcae4e	task_2e120f1d87e4	team_95beaa7529a9	user_admin001	created	"{\\"title\\": \\"Keval\\"}"	2026-06-05 21:21:48.393862+00
evt_86a9ed2681fe4c	task_3e20f1055ddd	team_95beaa7529a9	user_f798947b8a2e	commented	"{\\"preview\\": \\"@Bhoomi Shah - Client  could you please check the attached and please comment if\\"}"	2026-06-06 05:50:47.437209+00
evt_4dbd58a3fa604f	task_3e20f1055ddd	team_95beaa7529a9	user_f798947b8a2e	created	"{\\"title\\": \\"Internal Demo\\"}"	2026-06-06 05:47:02.140654+00
evt_02cd44b5565f4f	task_3e20f1055ddd	team_95beaa7529a9	user_f798947b8a2e	timer_started	"{\\"entry_id\\": \\"te_22d9b9232983\\"}"	2026-06-06 05:49:40.922374+00
evt_655037533c8f49	task_3e20f1055ddd	team_95beaa7529a9	user_f798947b8a2e	timer_stopped	"{\\"entry_id\\": \\"te_22d9b9232983\\", \\"minutes\\": 1}"	2026-06-06 05:50:03.672939+00
evt_067eb7dfd35d43	task_3e20f1055ddd	team_95beaa7529a9	user_f798947b8a2e	commented	"{\\"preview\\": \\"@Bhoomi Shah - Client  could you please check the attached and please comment if\\"}"	2026-06-06 05:50:45.309356+00
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_settings (id, key, value, updated_at) FROM stdin;
\.


--
-- Data for Name: approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approvals (approval_id, task_id, team_id, requested_by, reviewed_by, status, request_type, request_data, review_notes, created_at, reviewed_at) FROM stdin;
approval_41773233417c	\N	team_82fde4d09ea8	user_ccec9338cca6	user_admin001	approved	create	{"tags": ["Design", "insta", "facebook"], "title": "New Insta", "due_at": "2026-05-06T16:26:00.000Z", "status": "todo", "team_id": "team_82fde4d09ea8", "priority": "medium", "subtasks": [], "column_id": null, "recurrence": {"rule": "none", "interval": 1}, "attachments": [], "category_id": null, "description": "Let's see new post.", "reminder_at": "2026-05-05T16:30:00.000Z", "custom_fields": {}, "assignee_emails": [], "assignee_user_ids": [], "estimated_minutes": null}		2026-05-05 16:26:47.044825+00	2026-05-05 16:27:27.064201+00
approval_f9f04991a673	\N	team_82fde4d09ea8	user_ccec9338cca6	user_admin001	approved	create	{"tags": [], "title": "Insta Post for Anniversary", "due_at": "2026-05-13T11:24:00.000Z", "status": "todo", "team_id": "team_82fde4d09ea8", "priority": "high", "subtasks": [], "column_id": null, "recurrence": {"rule": "none", "interval": 1}, "attachments": [], "category_id": null, "description": "Anniversary celebrations for all group of companies and we require banner for linkedin, facebook and design for signature banner as well", "reminder_at": "2026-05-06T13:24:00.000Z", "custom_fields": {}, "assignee_emails": [], "assignee_user_ids": [], "estimated_minutes": null}		2026-05-06 11:24:35.813897+00	2026-05-06 11:25:56.484531+00
approval_154e57d2fe71	\N	team_95beaa7529a9	user_ccec9338cca6	user_admin001	approved	create	"{\\"title\\": \\"Client Task\\", \\"description\\": null, \\"status\\": \\"todo\\", \\"column_id\\": \\"col_1b1dd59ca4e0\\", \\"priority\\": \\"urgent\\", \\"category_id\\": null, \\"tags\\": [], \\"team_id\\": \\"team_95beaa7529a9\\", \\"assignee_user_ids\\": [\\"user_f798947b8a2e\\"], \\"assignee_emails\\": [], \\"due_at\\": \\"2026-06-08T21:53:00.000Z\\", \\"reminder_at\\": null, \\"recurrence\\": {\\"rule\\": \\"none\\", \\"interval\\": 1}, \\"estimated_minutes\\": null, \\"attachments\\": [], \\"custom_fields\\": {}, \\"subtasks\\": []}"		2026-06-06 05:53:21.00264+00	2026-06-06 11:09:55.915639+00
approval_d4a88d4af850	\N	team_95beaa7529a9	user_ccec9338cca6	user_admin001	approved	create	"{\\"title\\": \\"Client Task\\", \\"description\\": null, \\"status\\": \\"todo\\", \\"column_id\\": \\"col_1b1dd59ca4e0\\", \\"priority\\": \\"urgent\\", \\"category_id\\": null, \\"tags\\": [], \\"team_id\\": \\"team_95beaa7529a9\\", \\"assignee_user_ids\\": [\\"user_f798947b8a2e\\", \\"user_admin001\\"], \\"assignee_emails\\": [], \\"due_at\\": \\"2026-06-08T21:53:00.000Z\\", \\"reminder_at\\": null, \\"recurrence\\": {\\"rule\\": \\"none\\", \\"interval\\": 1}, \\"estimated_minutes\\": null, \\"attachments\\": [], \\"custom_fields\\": {}, \\"subtasks\\": []}"		2026-06-06 05:53:31.415417+00	2026-06-06 05:57:49.790827+00
\.


--
-- Data for Name: automations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.automations (automation_id, team_id, name, trigger, actions, enabled, created_by, created_at, last_run_at, run_count) FROM stdin;
\.


--
-- Data for Name: board_columns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_columns (column_id, board_id, name, slug, color, sort_order, is_done, created_at) FROM stdin;
\.


--
-- Data for Name: boards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.boards (board_id, team_id, name, description, color, is_default, sort_order, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, category_id, user_id, name, color, created_at, updated_at) FROM stdin;
a09152c7-1d75-48b5-a339-162021d76935	cat_0db8f48bd4e6	user_admin001	LinkedIn Banner	#05b7aa	2026-05-23 23:06:30.972004+00	2026-05-23 23:06:30.972004+00
\.


--
-- Data for Name: channel_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_members (channel_id, user_id, joined_at, last_read_at) FROM stdin;
ch_a74141d18969	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_1ddea0454f7e	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_1ddea0454f7e	user_ccec9338cca6	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_f862290c301b	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_61600f0170c4	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_9e280cc39c56	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_2a44eb590439	user_f798947b8a2e	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_71dea9a2c254	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_71dea9a2c254	user_f798947b8a2e	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_71dea9a2c254	user_ccec9338cca6	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_ff747e401dbf	user_admin001	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_ff747e401dbf	user_f798947b8a2e	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_ff747e401dbf	user_3339c020f0c0	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_ff747e401dbf	user_6acb621475b4	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_ff747e401dbf	user_7b40be81c656	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
ch_ff747e401dbf	user_cb74d5f7bd57	2026-06-06 15:53:19.134901+00	2026-06-06 15:53:19.134901+00
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channels (channel_id, org_id, type, project_id, name, created_by, created_at, archived_at) FROM stdin;
ch_a74141d18969	team_b9608ecabac1	project	team_b9608ecabac1	Vaijnath Infra	user_admin001	2026-06-06 15:53:19.134901+00	\N
ch_1ddea0454f7e	team_82fde4d09ea8	project	team_82fde4d09ea8	Labofab India Pvt Ltd	user_admin001	2026-06-06 15:53:19.134901+00	\N
ch_61600f0170c4	team_04d204a88487	project	team_04d204a88487	Kasti	user_admin001	2026-06-06 15:53:19.134901+00	\N
ch_f862290c301b	team_ab33b5adbffb	project	team_ab33b5adbffb	Kasti	user_admin001	2026-06-06 15:53:19.134901+00	\N
ch_ff747e401dbf	team_2e142f852880	project	team_2e142f852880	Labofab India Pvt Ltd.	user_admin001	2026-06-06 15:53:19.134901+00	\N
ch_9e280cc39c56	team_d36ee1203684	project	team_d36ee1203684	Sneha	user_admin001	2026-06-06 15:53:19.134901+00	\N
ch_2a44eb590439	team_ea27e54c6dcb	project	team_ea27e54c6dcb	Keval To Do	user_f798947b8a2e	2026-06-06 15:53:19.134901+00	\N
ch_71dea9a2c254	team_95beaa7529a9	project	team_95beaa7529a9	AekamInc-UK	user_admin001	2026-06-06 15:53:19.134901+00	\N
\.


--
-- Data for Name: dashboards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dashboards (dashboard_id, user_id, name, widgets, created_at) FROM stdin;
\.


--
-- Data for Name: field_definitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.field_definitions (field_id, team_id, name, type, config, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: field_values; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.field_values (task_id, field_id, value) FROM stdin;
\.


--
-- Data for Name: invites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invites (invite_id, email, role, token, invited_by, expires_at, accepted_at, created_at, full_name, "position", company_name, member_role, receives_approval_emails) FROM stdin;
inv_d79b0538bc41	06bhoomi@gmail.com	client	BkGRhsWbMeHMReqDSi27HCtDph9h8vEEHF7N8zHk2OI	user_admin001	2026-05-11 19:33:42.431575+00	2026-05-05 06:37:11.845583+00	2026-05-04 19:33:42.506796+00	\N	\N	\N	\N	t
inv_8620d3434816	aekaminc5@gmail.com	member	GylgBOtE_RInw5x_yN6TrrJFy9_QqQ5Ulql_CMJ-5gw	user_admin001	2026-06-13 09:47:57.896875+00	2026-06-06 09:54:45.377504+00	2026-06-06 09:47:57.971566+00	Manthan Varaliya	\N	\N	Video Editor	t
inv_ca1827a421a8	aekaminc1@gmail.com	member	TcbVuZHLCDb3AV8Up0t02Ek7pbREHOKowPr_2KggJbs	user_admin001	2026-06-13 09:38:34.539755+00	2026-06-06 10:14:50.487772+00	2026-06-06 09:38:34.614066+00	Kasti Pranami	\N	\N	SM Account Manager	t
inv_69b9782697f6	kelisweet@gmail.com	member	79SqlDAHDpuGwApZBOkXMdr0xUN0hkzmivQfHC6ki0A	user_admin001	2026-05-06 09:25:38.853624+00	\N	2026-05-05 15:50:37.271746+00	\N	\N	\N	\N	t
inv_c6aa60711cb6	sid@aekaminc.com	member	PKNBaXqGmMmrQKTipF1GyyRbpiXb4dV7WbldOPHAINQ	user_admin001	2026-05-15 23:30:01.744689+00	\N	2026-05-05 15:50:25.138793+00	\N	\N	\N	\N	t
inv_da0595dabf03	kelisweet@gmail.com	member	lKm8B5cuemeRp_Z1zNZedSYU9hGUl2p7PV7cDxYkrpI	user_admin001	2026-05-15 23:30:04.413172+00	\N	2026-05-05 22:36:28.383448+00	\N	\N	\N	\N	t
inv_8abe2dedff25	aekaminc7@gmail.com	member	uQqCnEbd7bRBau-p5-dr-IwVMV45EBMCjZcv-I4OcAA	user_admin001	2026-06-13 11:03:33.738311+00	2026-06-06 11:05:11.294794+00	2026-06-06 11:03:33.806971+00	Parth Chavda	\N	\N	Video Editor	t
inv_0dbb92e5cdd5	kelisweet@gmail.com	member	D0WCOdmMj3eCB2myIlx7srS9wC3Vtiz2Stp5-aKQVNs	user_admin001	2026-05-15 23:30:11.299005+00	\N	2026-05-05 22:36:24.985587+00	\N	\N	\N	\N	t
inv_b2e72f5cd43a	aekaminc3@gmail.com	member	tiFIFcWxg0S7j54lmZwv26mNoM5wjmQ0MVXoEkitoIY	user_admin001	2026-06-13 11:05:55.688907+00	2026-06-06 11:06:31.027395+00	2026-06-06 11:05:55.757767+00	Bhumi Shrimali	\N	\N	Content Writer	t
inv_53f6ed53465f	bhoomi@aekaminc.com	admin	nmzpobiDFBdDuURyHCZcpLtme7ow2FjwIa0e9feZL5M	user_admin001	2026-06-11 11:17:43.208042+00	2026-06-04 11:21:40.76036+00	2026-06-04 11:17:43.28058+00	Bhoomi Shah	\N	\N	Founder	t
inv_aaebfccc5964	aekaminc4@gmail.com	member	AhawK2fmG81yXqBX4W-ulS9s8JFFtgov5ye_ytIPfPU	user_admin001	2026-06-16 06:09:32.873563+00	2026-06-09 06:13:52.426745+00	2026-06-09 06:09:32.942351+00	Om Chauhan	\N	\N	Editor	t
inv_034398e2daba	aekaminc2@gmail.com	member	opuI5Z1GPSgKDr-vV3OMY3rprEJeaOlk0vxuDhWuk_E	user_admin001	2026-06-16 07:18:22.886366+00	2026-06-09 07:19:10.858259+00	2026-06-09 07:18:22.975586+00	Sneha Kshtriya	\N	\N	SM Account Manager	t
\.


--
-- Data for Name: mentions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mentions (mention_id, comment_id, mentioned_user_id, notified_at, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: message_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.message_attachments (attachment_id, message_id, r2_key, filename, mime_type, size_bytes, url, created_at) FROM stdin;
\.


--
-- Data for Name: message_reactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.message_reactions (message_id, user_id, emoji, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (message_id, channel_id, sender_id, body, parent_id, source, metadata, edited_at, deleted_at, created_at) FROM stdin;
\.


--
-- Data for Name: notification_prefs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_prefs (user_id, prefs, quiet_start, quiet_end, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, notification_id, user_id, team_id, type, title, message, task_id, url, created_at, read_at) FROM stdin;
6bea372b-c7e0-4ab7-847c-cbea54d60b51	notif_e6371a9d0054	user_ccec9338cca6	team_82fde4d09ea8	comment	New comment on New Insta	Keval Shah: Lets gets this done ASAP	task_d5b41e113357	/tasks	2026-05-09 09:29:47.239452+00	2026-05-14 08:55:54.500687+00
21b8ac07-2f6c-4669-a567-54ee07087def	notif_cbe8afdaf39e	user_ccec9338cca6	team_82fde4d09ea8	task_approved	Task approved: New Insta	Keval Shah has approved your task 'New Insta'.	task_d5b41e113357	\N	2026-05-06 11:28:07.98592+00	2026-05-14 08:55:54.500687+00
93a30596-9844-491c-9bdb-ec293acc51f7	notif_29069cfb005d	user_admin001	\N	request	Approval Requested: New task		task_6b6e26d8dc0d	\N	2026-05-19 21:47:32.431901+00	2026-05-20 22:04:34.311436+00
19530030-052b-4218-a5a6-b30e46b5242e	notif_d761c5995e61	user_admin001	team_58bcf2e6ffbb	comment	New comment on New task	Bhoomi Shah: keval client test	task_6b6e26d8dc0d	/tasks	2026-05-19 21:46:40.613768+00	2026-05-20 22:04:55.388821+00
6cddaad6-a1ca-441d-a888-5776e5c455f5	notif_7712027e9211	user_admin001	team_58bcf2e6ffbb	assigned	Task assigned	You were assigned: New task	task_6b6e26d8dc0d	/tasks	2026-05-19 20:49:29.211792+00	2026-05-20 22:13:22.005447+00
639ae1af-4dea-4baf-9a60-708c31ccd4ad	notif_9d6c9e5d28df	user_admin001	\N	request	Approval Requested: Approval process	Sid Sir please approve	task_86f7fe556250	\N	2026-05-19 20:37:55.951477+00	2026-05-20 22:13:49.515606+00
d208cad4-1bc0-4cbd-84f0-aa4f38cae1d3	notif_de16e33c168b	user_admin001	\N	request	Approval Requested: Insta		task_b58b5429ea10	\N	2026-05-23 08:55:23.177685+00	2026-05-23 09:39:48.593607+00
4f2ea987-773b-4083-b2d3-122cd6a26bbe	notif_610938bb2a2c	user_84aa7cf71d5b	team_58bcf2e6ffbb	assigned	Task assigned	You were assigned: Mobile	task_b9157f633286	/tasks	2026-05-27 20:41:16.714787+00	\N
2ce3fd55-8101-45c6-a05e-17756964136a	notif_a802f74884b1	user_84aa7cf71d5b	team_58bcf2e6ffbb	reminder	Task reminder	Due soon: Mobile	task_b9157f633286	/tasks	2026-05-31 11:17:29.74792+00	\N
b1136b2b-f55b-46c5-a674-6d4d48f06deb	notif_b55891ad8f2d	user_admin001	team_58bcf2e6ffbb	comment	New comment on Insta	Keval Aekam UK: @Keval Aekam UK check email	task_b58b5429ea10	/tasks	2026-05-25 12:01:45.547835+00	2026-05-31 11:32:22.803502+00
9989baf2-e57b-4f1e-ac9b-1a45ee0c5892	notif_9793001f838b	user_admin001	team_58bcf2e6ffbb	assigned	Task assigned	You were assigned: Keval Client new task	task_03a8fbc47a64	/tasks	2026-05-25 12:10:09.884137+00	2026-05-31 11:32:22.803502+00
05bc86d2-cc93-4d62-ba64-d638e090e8c1	notif_c53684ff3f8d	user_admin001	team_58bcf2e6ffbb	request	Approval Requested: Approve New Project		task_75bda32dc872	/tasks	2026-05-25 12:13:45.906792+00	2026-05-31 11:32:22.803502+00
c3ec5a2f-13b5-4533-b681-00a1a48fc57c	notif_c06969536cf9	user_admin001	team_58bcf2e6ffbb	approved	Task Approved: Approve New Project		task_75bda32dc872	/tasks	2026-05-25 14:04:59.590725+00	2026-05-31 11:32:22.803502+00
b2c83cac-334c-4b48-8442-7f77da266116	notif_631d14ec63df	user_admin001	team_58bcf2e6ffbb	approved	Task Approved: Approval process		task_86f7fe556250	/tasks	2026-05-25 14:05:09.365979+00	2026-05-31 11:32:22.803502+00
f8a59fb3-fd75-4152-94be-4eb4b6a28764	notif_cd65724302d2	user_ccec9338cca6	team_58bcf2e6ffbb	comment	New comment on New task	Keval Shah: sure madan	task_6b6e26d8dc0d	/tasks	2026-05-19 21:47:28.460127+00	2026-06-06 05:51:52.194798+00
3d620e8a-36a1-4c32-81df-08564c5a0f78	notif_9be4478ab501	user_ccec9338cca6	team_58bcf2e6ffbb	comment	New comment on New task	Keval Shah: file updaloed	task_6b6e26d8dc0d	/tasks	2026-05-19 21:50:26.831982+00	2026-06-06 05:51:52.194798+00
bc640c8d-ddbe-4bd2-9ab6-94303f390950	notif_6cfe2f6915fe	user_ccec9338cca6	team_58bcf2e6ffbb	comment	New comment on New task	Keval Shah: file updaloed	task_6b6e26d8dc0d	/tasks	2026-05-19 21:50:30.112328+00	2026-06-06 05:51:52.194798+00
94a46b7e-5fe3-4ca0-b4a5-d6e932cfef6a	notif_5103187ff71d	user_ccec9338cca6	team_58bcf2e6ffbb	assigned	Task assigned	You were assigned: Test client task	task_0eb6acde4099	/tasks	2026-05-25 11:52:41.447302+00	2026-06-06 05:51:52.194798+00
e34077ce-168f-4b17-b666-ec3af1bb8044	notif_08d05b8c52a9	user_ccec9338cca6	team_58bcf2e6ffbb	comment	New comment on Insta	Keval Aekam UK: @Keval Aekam UK check email	task_b58b5429ea10	/tasks	2026-05-25 12:01:45.124215+00	2026-06-06 05:51:52.194798+00
f089cd73-5131-4be0-a618-cbb6db1dddab	notif_623bdd91edd7	user_ccec9338cca6	team_58bcf2e6ffbb	approved	Task Approved: New task		task_6b6e26d8dc0d	/tasks	2026-05-25 14:05:10.88436+00	2026-06-06 05:51:52.194798+00
ffa66281-2543-403a-9a1b-68f610310b14	notif_7839d68dda13	user_ccec9338cca6	team_58bcf2e6ffbb	reminder	Task reminder	Due soon: Test client task	task_0eb6acde4099	/tasks	2026-05-27 20:34:30.798023+00	2026-06-06 05:51:52.194798+00
1a03c30d-a219-4dab-8fb2-dc8d1e2c97ba	notif_d6b4e2346af6	user_admin001	team_58bcf2e6ffbb	approved	Task Approved: Insta		task_b58b5429ea10	/tasks	2026-05-25 14:05:10.202838+00	2026-05-31 11:32:22.803502+00
9bce6c3f-b6aa-4113-b717-89a2f7b30dfd	notif_0e46e7dc5517	user_admin001	team_58bcf2e6ffbb	reminder	Task reminder	Due soon: LinkedIn Banner	task_217e5f82473f	/tasks	2026-05-27 20:34:29.85307+00	2026-05-31 11:32:22.803502+00
881c4870-fca1-4b0a-8598-03ecdba8dec1	notif_f39799779732	user_admin001	team_58bcf2e6ffbb	reminder	Task reminder	Due soon: Keval Client new task	task_03a8fbc47a64	/tasks	2026-05-27 20:34:31.753541+00	2026-05-31 11:32:22.803502+00
81f8f95c-3b18-45b0-a6b3-29c29418ed3d	notif_3beefa9ef714	user_admin001	\N	reminder	Task reminder	Due soon: Offline	task_e8715f822ccd	/tasks	2026-05-27 21:19:50.816416+00	2026-05-31 11:32:22.803502+00
f9741c6a-ba83-4d40-a516-493f462fcaa4	notif_df19668e7cb6	user_admin001	\N	reminder	Task reminder	Due soon: Offline	task_66dc2803b27a	/tasks	2026-05-27 21:19:51.685871+00	2026-05-31 11:32:22.803502+00
ab35c832-7d69-4f4a-b3cd-4e8ac1707da2	notif_756d7054e04a	user_admin001	team_58bcf2e6ffbb	request	Approval Requested: LinkedIn Banner		task_217e5f82473f	/tasks	2026-05-27 21:40:24.971964+00	2026-05-31 11:32:22.803502+00
07b64452-a4cc-4a1f-a1ea-f1d111087f54	notif_592fb6ec86b8	user_admin001	team_58bcf2e6ffbb	reminder	Task reminder	Due soon: Mobile	task_b9157f633286	/tasks	2026-05-31 11:17:29.259443+00	2026-05-31 11:32:22.803502+00
f401e26e-2338-48a2-ac3a-adc4b78b9aec	notif_6b08b11fdca2	user_f798947b8a2e	team_95beaa7529a9	assigned	Task assigned	You were assigned: Keval	task_2e120f1d87e4	/tasks	2026-06-05 21:21:46.550801+00	\N
538c8ba9-39b9-4ba3-b038-d265b5f99bfb	notif_6f8d01d987c4	user_f798947b8a2e	team_95beaa7529a9	reminder	Task reminder	Due soon: Keval	task_2e120f1d87e4	/tasks	2026-06-05 22:00:25.075034+00	\N
39051783-a6b2-4228-b7cd-c7a420b222f1	notif_d21ca52a8d52	user_admin001	team_95beaa7529a9	reminder	Task reminder	Due soon: Keval	task_2e120f1d87e4	/tasks	2026-06-05 22:00:25.534602+00	\N
901118ce-930b-400b-bb39-a085fc3b611f	notif_47ca740b6716	user_ccec9338cca6	team_95beaa7529a9	assigned	Task assigned	You were assigned: Keval	task_2e120f1d87e4	/tasks	2026-06-05 21:21:47.469763+00	2026-06-06 05:51:52.194798+00
318f470a-ea4e-4368-8c29-fd56d527add3	notif_f86a57fbbf6e	user_ccec9338cca6	team_95beaa7529a9	reminder	Task reminder	Due soon: Keval	task_2e120f1d87e4	/tasks	2026-06-05 22:00:26.055468+00	2026-06-06 05:51:52.194798+00
c1d79547-1744-41eb-8f94-2b9bf479a8ca	notif_218c3f80ea9b	user_f798947b8a2e	team_95beaa7529a9	reminder	Task reminder	Due soon: UK Team	task_5a3d88f0b499	/tasks	2026-06-06 08:29:33.978261+00	\N
1bd964ee-401c-4ef5-bf26-8fb53107e364	notif_c8f93d15a58b	user_admin001	team_95beaa7529a9	request	Approval Requested: Internal Demo		task_3e20f1055ddd	/tasks	2026-06-06 05:55:05.386283+00	2026-06-06 11:01:06.312191+00
\.


--
-- Data for Name: project_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_assignments (assignment_id, team_id, user_id, role, assigned_at, assigned_by, receives_approval_emails, full_name, "position", company_name, member_role) FROM stdin;
assign_30d0f37d8c0d88cc6ffb109799ad088c8fac30f86d85	team_82fde4d09ea8	user_admin001	owner	2026-05-05 09:39:56.110792+00	\N	t	Keval Shah	\N	\N	\N
assign_25e602a845dc3dd4e657ca23fe49f0dc112b578c6ef7	team_b9608ecabac1	user_admin001	owner	2026-05-05 09:39:56.110792+00	\N	t	Keval Shah	\N	\N	\N
assign_c774296bbbae374e30c640d2215a0f45bb7b19b958a4	team_82fde4d09ea8	user_ccec9338cca6	client	2026-05-05 09:39:56.110792+00	\N	t	06bhoomi@gmail.com	\N	\N	\N
assign_8b5cf504dbae	team_ab33b5adbffb	user_admin001	owner	2026-06-04 11:02:47.025542+00	user_admin001	t	\N	\N	\N	\N
assign_e1f8a1c1ebd4	team_04d204a88487	user_admin001	owner	2026-06-04 11:02:51.707268+00	user_admin001	t	\N	\N	\N	\N
assign_ffef071d28a5	team_d36ee1203684	user_admin001	owner	2026-06-04 11:03:26.065813+00	user_admin001	t	\N	\N	\N	\N
assign_c4c789983a93	team_ea27e54c6dcb	user_f798947b8a2e	owner	2026-06-05 20:28:39.63666+00	user_f798947b8a2e	t	\N	\N	\N	\N
assign_3720a9c155c9	team_95beaa7529a9	user_admin001	owner	2026-06-05 20:29:23.226858+00	user_admin001	t	\N	\N	\N	\N
assign_2482d5db31f3	team_95beaa7529a9	user_f798947b8a2e	member	2026-06-05 21:06:10.091406+00	user_admin001	t	\N	\N	\N	\N
assign_bfd89cb7e09b	team_95beaa7529a9	user_ccec9338cca6	member	2026-06-05 21:06:32.544941+00	user_admin001	t	\N	\N	\N	\N
assign_32fed214e9cf	team_2e142f852880	user_admin001	owner	2026-06-06 06:08:16.236154+00	user_admin001	t	\N	\N	\N	\N
assign_15e66b1b8380	team_2e142f852880	user_f798947b8a2e	member	2026-06-06 06:11:20.972922+00	user_admin001	t	\N	\N	\N	\N
assign_808530e767a2	team_2e142f852880	user_3339c020f0c0	member	2026-06-06 10:26:11.38342+00	user_admin001	t	\N	\N	\N	\N
assign_d09e376000c3	team_2e142f852880	user_6acb621475b4	member	2026-06-06 10:26:44.99637+00	user_admin001	t	\N	\N	\N	\N
assign_f5cee4059218	team_2e142f852880	user_7b40be81c656	member	2026-06-06 11:09:37.80137+00	user_admin001	t	\N	\N	\N	\N
assign_477de0847c57	team_2e142f852880	user_cb74d5f7bd57	member	2026-06-06 11:10:51.515342+00	user_admin001	t	\N	\N	\N	\N
assign_99c16ed960dd	team_2e142f852880	user_a86b030763f4	member	2026-06-09 11:14:36.115358+00	user_admin001	t	\N	\N	\N	\N
assign_ee004d36e644	team_2e142f852880	user_da1d14e5d7c9	member	2026-06-09 11:30:25.938298+00	user_admin001	t	\N	\N	\N	\N
\.


--
-- Data for Name: project_columns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_columns (column_id, team_id, name, color, sort_order, is_done, created_at, updated_at) FROM stdin;
col_c31cbaed7218	team_2e142f852880	To Do	#0082c6	0	f	2026-06-06 06:08:17.132462+00	2026-06-06 06:08:17.132462+00
col_4480beeb2c85	team_2e142f852880	In Progress	#03a1b6	1	f	2026-06-06 06:08:17.580919+00	2026-06-06 06:08:17.580919+00
col_659d6a25f784	team_2e142f852880	In Review	#8b5cf6	2	f	2026-06-06 06:08:18.026245+00	2026-06-06 06:08:18.026245+00
col_c7d426172ee3	team_2e142f852880	Approval	#f59e0b	3	f	2026-06-06 06:08:18.471387+00	2026-06-06 06:08:18.471387+00
col_1a3add9eea80	team_2e142f852880	Done	#05b7aa	4	t	2026-06-06 06:08:18.916823+00	2026-06-06 06:08:18.916823+00
col_83da070cf45b	team_b9608ecabac1	To Do	#0082c6	0	f	2026-05-04 19:26:53.081823+00	2026-05-04 19:26:53.081823+00
col_04302cb71035	team_b9608ecabac1	In Progress	#03a1b6	1	f	2026-05-04 19:26:53.527168+00	2026-05-04 19:26:53.527168+00
col_5d3155a58ff9	team_b9608ecabac1	In Review	#8b5cf6	2	f	2026-05-04 19:26:53.97078+00	2026-05-04 19:26:53.97078+00
col_43f366ae3052	team_b9608ecabac1	Approval	#f59e0b	3	f	2026-05-04 19:26:54.414374+00	2026-05-04 19:26:54.414374+00
col_b4547c40ef55	team_b9608ecabac1	Done	#05b7aa	4	t	2026-05-04 19:26:54.85776+00	2026-05-04 19:26:54.85776+00
col_0a171ca23901	team_82fde4d09ea8	To Do	#0082c6	0	f	2026-05-04 19:34:14.853499+00	2026-05-04 19:34:14.853499+00
col_6cf6731ce9da	team_82fde4d09ea8	In Progress	#03a1b6	1	f	2026-05-04 19:34:15.299577+00	2026-05-04 19:34:15.299577+00
col_35302d0ff2a2	team_82fde4d09ea8	In Review	#8b5cf6	2	f	2026-05-04 19:34:15.745664+00	2026-05-04 19:34:15.745664+00
col_b0b26a6def38	team_82fde4d09ea8	Approval	#f59e0b	3	f	2026-05-04 19:34:16.191916+00	2026-05-04 19:34:16.191916+00
col_2e49a20a9fa4	team_82fde4d09ea8	Done	#05b7aa	4	t	2026-05-04 19:34:16.637624+00	2026-05-04 19:34:16.637624+00
col_1945d55748a8	team_ab33b5adbffb	To Do	#0082c6	0	f	2026-06-04 11:02:47.929996+00	2026-06-04 11:02:47.929996+00
col_15367dc4969e	team_ab33b5adbffb	In Progress	#03a1b6	1	f	2026-06-04 11:02:48.379992+00	2026-06-04 11:02:48.379992+00
col_3df3a374be7a	team_ab33b5adbffb	In Review	#8b5cf6	2	f	2026-06-04 11:02:48.824229+00	2026-06-04 11:02:48.824229+00
col_f673509a7cb4	team_ab33b5adbffb	Approval	#f59e0b	3	f	2026-06-04 11:02:49.268294+00	2026-06-04 11:02:49.268294+00
col_eb1e62678c38	team_ab33b5adbffb	Done	#05b7aa	4	t	2026-06-04 11:02:49.712824+00	2026-06-04 11:02:49.712824+00
col_7e465fe56877	team_04d204a88487	To Do	#0082c6	0	f	2026-06-04 11:02:52.589196+00	2026-06-04 11:02:52.589196+00
col_af5722b76b0d	team_04d204a88487	In Progress	#03a1b6	1	f	2026-06-04 11:02:53.030964+00	2026-06-04 11:02:53.030964+00
col_e3a3ffd76b46	team_04d204a88487	In Review	#8b5cf6	2	f	2026-06-04 11:02:53.472287+00	2026-06-04 11:02:53.472287+00
col_2abb050944c7	team_04d204a88487	Approval	#f59e0b	3	f	2026-06-04 11:02:53.913236+00	2026-06-04 11:02:53.913236+00
col_cabc94b4285a	team_04d204a88487	Done	#05b7aa	4	t	2026-06-04 11:02:54.354411+00	2026-06-04 11:02:54.354411+00
col_c5ddbe0b26fc	team_d36ee1203684	To Do	#0082c6	0	f	2026-06-04 11:03:26.952859+00	2026-06-04 11:03:26.952859+00
col_44a7d9c25067	team_d36ee1203684	In Progress	#03a1b6	1	f	2026-06-04 11:03:27.396597+00	2026-06-04 11:03:27.396597+00
col_103dfee58e10	team_d36ee1203684	In Review	#8b5cf6	2	f	2026-06-04 11:03:27.840724+00	2026-06-04 11:03:27.840724+00
col_d39d6bf539e4	team_d36ee1203684	Approval	#f59e0b	3	f	2026-06-04 11:03:28.284593+00	2026-06-04 11:03:28.284593+00
col_8eef5df17505	team_d36ee1203684	Done	#05b7aa	4	t	2026-06-04 11:03:28.72848+00	2026-06-04 11:03:28.72848+00
col_89f2a302ebfc	team_ea27e54c6dcb	To Do	#0082c6	0	f	2026-06-05 20:28:40.543607+00	2026-06-05 20:28:40.543607+00
col_54917c0b5fc1	team_ea27e54c6dcb	In Progress	#03a1b6	1	f	2026-06-05 20:28:40.993016+00	2026-06-05 20:28:40.993016+00
col_78247dfabac6	team_ea27e54c6dcb	In Review	#8b5cf6	2	f	2026-06-05 20:28:41.439563+00	2026-06-05 20:28:41.439563+00
col_66bf1600ffac	team_ea27e54c6dcb	Approval	#f59e0b	3	f	2026-06-05 20:28:41.888509+00	2026-06-05 20:28:41.888509+00
col_d5658d3a7177	team_ea27e54c6dcb	Done	#05b7aa	4	t	2026-06-05 20:28:42.334902+00	2026-06-05 20:28:42.334902+00
col_1b1dd59ca4e0	team_95beaa7529a9	To Do	#0082c6	0	f	2026-06-05 20:29:24.119775+00	2026-06-05 20:29:24.119775+00
col_dfaa30cd09ef	team_95beaa7529a9	In Progress	#03a1b6	1	f	2026-06-05 20:29:24.568402+00	2026-06-05 20:29:24.568402+00
col_941fab5a074e	team_95beaa7529a9	In Review	#8b5cf6	2	f	2026-06-05 20:29:25.035739+00	2026-06-05 20:29:25.035739+00
col_9449c5e66e0a	team_95beaa7529a9	Approval	#f59e0b	3	f	2026-06-05 20:29:25.482164+00	2026-06-05 20:29:25.482164+00
col_fa3e59de83a9	team_95beaa7529a9	Done	#05b7aa	4	t	2026-06-05 20:29:25.928956+00	2026-06-05 20:29:25.928956+00
col_8480ab414e83	team_2e142f852880	Branding Guidleines	#ee6911	5	f	2026-06-06 06:30:16.953426+00	2026-06-06 06:30:16.953426+00
\.


--
-- Data for Name: project_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_templates (template_id, name, description, config, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_subscriptions (id, subscription_id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_tokens (id, user_id, platform, token, device_id, created_at) FROM stdin;
\.


--
-- Data for Name: push_web_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_web_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at) FROM stdin;
pws_938e4e183602	user_admin001	https://fcm.googleapis.com/fcm/send/e8C_IY5503U:APA91bFD20PBg5lqh3tIgej-kVCUPSGARCgKNTgKflM43Vm4Np4RXU-XwfoWMEJq3cf4KFTEZMd5s39ANEZ4jkZycgrObUCWvnnnBA5LR31Bc1QeOL_Ii-mMRFMG42W-Abfv720j9bss	BK2yVmoEa_zx4-DSkVpzmTSoACatK8hHOZ3bpeY5fSKTarFwFTUSJOvp1OI4m_j_pE1-V2vaXyyBrHqiSiRgY3c	TXJNxc5iNDaE_4OHLe6WlQ	2026-05-25 13:10:10.847536+00	2026-05-25 13:10:10.847536+00
pws_433b36e87c6c	user_admin001	https://fcm.googleapis.com/fcm/send/eE8Hw_SvZMU:APA91bHzqGLlHP7ccNZF7lRhc4BxNyo_1nY65mlTNUOfQDW_ZYrrFZ1xMdJhb1i7bRf7szKyut3pppaWCeX8z8gX4QRrtI6CV4rHEN-100QdO19K8WjcmlThKZ44BmauOrbFefLTBTVA	BI-GB3eMnEUhwrGfdGoDwd6OGnZ-IVY6bPQKZqbNhd24R466piO7HSNUFg5QQ2j9nbPyQ9je6hZ1PVx4HQQmDMs	xh3EQecHty_PzQLtAHyolQ	2026-06-04 11:01:37.193762+00	2026-06-04 11:01:37.193762+00
pws_8f54c14739d2	user_cb74d5f7bd57	https://fcm.googleapis.com/fcm/send/cfcwVk39LI4:APA91bF0828SOcXGr9lfAHKTE1EUOU2emDKkuM9IZ9ejs7sk3oquibzJvpIRxwKuqrYmqHouvICyNrstEge9J9EW3EBFlPi4mOso9apn_frOeGxgixWvBefsHLbf1Hb6wGxxraMIzBKZ	BKjQ-2kQY0OEtwV61prqplX48U8WWt8enN6t1lDLFGozlNBifgewvnbbb4VDVQ0ojEiNFMBGazY4moj4q-lvqNU	_AyGGbNCPeLTDrab9MspcA	2026-06-06 11:05:57.095798+00	2026-06-06 11:05:57.095798+00
pws_6cee09122351	user_a86b030763f4	https://fcm.googleapis.com/fcm/send/eWX7dTTJfEM:APA91bE-R-lPbaOhSxCLbm0XXT0uQ5vsUc907LrI6jLgc-znE9mPd7GpsR7fut1v2OEY7-bRN8B6Vff0Gvd7Ce3fEaNPNujHAIY4yZW0rgn49bQI_FjxcstuidFW_AM-ZK3Qmqqt04vr	BABavEfzP2Qt-ooaKMU33b-zkBtdZDTd4RJPNV-ip8mnKZ_BvcM3nhRbKbKQR86YAn6CAgarfY_aK_3snJxdC1A	WNCXtHBiTS7n4jnFV3evaQ	2026-06-09 06:15:47.460202+00	2026-06-09 06:15:47.460202+00
pws_cf1ef9f73d40	user_3339c020f0c0	https://fcm.googleapis.com/fcm/send/c81XfQZ789c:APA91bGlgG3-vHIyVn3yS7abXVyrpvxaiy5Rm5yU1YigKfl_H9F0Ea2zKAmS-FnZJz8DbI_tL1dXVuvUxENHrCIJcjPVZ3wXwc1wkNyOOM275KYdxVBoYQRNdh1d05iOtgTWQkbs7CwQ	BPjE44dP2usAdQhDJPtIFzvmFd-A99BgYyM9KmB1E1WYt2-LyS_8vBEwUv-9D5ewRSwUJLtCXJ1aBuFjyc6slEA	c6s2c6VLf45dZWr-fLgg9Q	2026-06-09 13:36:33.904237+00	2026-06-09 13:36:33.904237+00
\.


--
-- Data for Name: report_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_schedules (schedule_id, team_id, created_by, frequency, file_formats, recipients, day_of_week, day_of_month, send_hour_utc, is_active, last_sent_at, next_run_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: saved_views; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.saved_views (view_id, team_id, name, type, config, created_by, is_default, created_at) FROM stdin;
\.


--
-- Data for Name: task_clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_clients (id, task_id, user_id, invited_by, created_at) FROM stdin;
\.


--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_comments (comment_id, task_id, user_id, body, created_at, edited, updated_at) FROM stdin;
cmt_3793fb4c1ef9	task_3e20f1055ddd	user_f798947b8a2e	@Bhoomi Shah - Client  could you please check the attached and please comment if any changes needed	2026-06-06 05:50:42.156299+00	f	2026-06-06 05:50:42.156299+00
cmt_6dc088a228db	task_3e20f1055ddd	user_f798947b8a2e	@Bhoomi Shah - Client  could you please check the attached and please comment if any changes needed	2026-06-06 05:50:44.320457+00	f	2026-06-06 05:50:44.320457+00
\.


--
-- Data for Name: task_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_templates (template_id, team_id, name, config, created_at, created_by, is_default, icon, updated_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, task_id, user_id, team_id, created_by_user_id, assigned_by_user_id, completed_by_user_id, title, description, status, priority, category_id, tags, assignee_user_ids, assignee_emails, due_at, reminder_at, reminder_sent_at, recurrence_rule, recurrence_interval, estimated_minutes, attachments, custom_fields, subtasks, sort_order, created_at, updated_at, completed_at, board_id, column_slug, column_id, requires_approval, approval_status, approved_by, approval_notes, approval_requested_at, approval_decided_at, approval_id, created_by_name) FROM stdin;
04f40127-48e2-4f97-b96a-de7c213c6d74	task_4f683252f3f0	user_admin001	\N	user_admin001	\N	\N	mobile	\N	todo	medium	\N	{}	{}	{}	\N	\N	\N	none	1	\N	"[]"	"{}"	"[]"	0	2026-06-01 18:56:36.60161+00	2026-06-01 18:56:36.60161+00	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	Aekam INC.
5f5e1841-58a2-488e-b8c1-3a7d51b0bf62	task_2e120f1d87e4	\N	team_95beaa7529a9	user_admin001	user_admin001	\N	Keval	Please review	in_progress	urgent	\N	{}	{user_f798947b8a2e,user_admin001,user_ccec9338cca6}	{}	2026-06-06 00:00:00+00	2026-06-05 22:00:00+00	2026-06-05 22:00:26.513719+00	none	1	\N	"[{\\"name\\": \\"kartavya-vaijnath-infra-2026-05-18-2026-05-25.pdf\\", \\"url\\": \\"https://pub-bf2d2af5de044466a0456010568b7fd6.r2.dev/uploads/user_admin001/25c48f8506ec41afaeea9878ab313122.pdf\\", \\"key\\": \\"uploads/user_admin001/25c48f8506ec41afaeea9878ab313122.pdf\\"}]"	"{}"	"[]"	0	2026-06-05 21:21:45.62375+00	2026-06-05 22:05:34.068986+00	\N	\N	\N	col_9449c5e66e0a	f	\N	\N	\N	\N	\N	\N	Aekam INC.
b657cb4c-12ea-481f-ad15-3e45b6e2b114	task_0dd27c22b973	\N	team_95beaa7529a9	user_ccec9338cca6	\N	\N	Client Task	\N	todo	urgent	\N	{}	{}	{}	\N	\N	\N	none	1	\N	[]	{}	[]	0	2026-06-06 05:57:50.685773+00	2026-06-06 05:57:50.685773+00	\N	\N	\N	col_1b1dd59ca4e0	f	\N	\N	\N	\N	\N	approval_d4a88d4af850	\N
f9fdaaad-a9b9-4ce0-b039-df1a860f2ea4	task_cb236ac84827	\N	team_95beaa7529a9	user_ccec9338cca6	\N	\N	Client Task	\N	todo	urgent	\N	{}	{}	{}	\N	\N	\N	none	1	\N	[]	{}	[]	0	2026-06-06 11:09:56.761442+00	2026-06-06 11:09:56.761442+00	\N	\N	\N	col_1b1dd59ca4e0	f	\N	\N	\N	\N	\N	approval_154e57d2fe71	\N
10325bc6-b899-466c-8ea5-9515ada00ad4	task_40e4473e9959	user_f798947b8a2e	\N	user_f798947b8a2e	\N	\N	Bhoomi Madam	\N	done	medium	\N	{}	{}	{}	\N	\N	\N	none	1	\N	[]	{}	[]	0	2026-05-04 09:23:24.055987+00	2026-05-04 09:25:19.837152+00	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	KEVAL SHAH
a611e843-0060-41ad-b60c-fcfa097b28ad	task_5a3d88f0b499	\N	team_95beaa7529a9	user_f798947b8a2e	user_f798947b8a2e	\N	UK Team	Oksy	todo	high	\N	{}	{user_f798947b8a2e}	{}	2026-06-06 10:20:00+00	2026-06-06 08:20:00+00	2026-06-06 08:29:34.454819+00	none	1	\N	"[{\\"name\\": \\"aekaminc_kartavya_bg - Copy.png\\", \\"url\\": \\"https://pub-bf2d2af5de044466a0456010568b7fd6.r2.dev/uploads/user_f798947b8a2e/a83123309dcb40e0abfcb10a1e0b21bf.png\\", \\"key\\": \\"uploads/user_f798947b8a2e/a83123309dcb40e0abfcb10a1e0b21bf.png\\"}, {\\"name\\": \\"aekaminc_kartavya_bg.png\\", \\"url\\": \\"https://pub-bf2d2af5de044466a0456010568b7fd6.r2.dev/uploads/user_f798947b8a2e/bb1e089bb83c49e587e46db2f14f3f21.png\\", \\"key\\": \\"uploads/user_f798947b8a2e/bb1e089bb83c49e587e46db2f14f3f21.png\\"}, {\\"name\\": \\"Storyboard Template.png\\", \\"url\\": \\"https://pub-bf2d2af5de044466a0456010568b7fd6.r2.dev/uploads/user_f798947b8a2e/e90fd859910145dca4f4f53758f65d62.png\\", \\"key\\": \\"uploads/user_f798947b8a2e/e90fd859910145dca4f4f53758f65d62.png\\"}]"	"{}"	"[]"	0	2026-06-05 21:16:02.745252+00	2026-06-06 08:29:34.454819+00	\N	\N	\N	col_1b1dd59ca4e0	f	\N	\N	\N	\N	\N	\N	KEVAL SHAH
bd842606-736f-46b8-8dd4-e2814c104525	task_3e20f1055ddd	\N	team_95beaa7529a9	user_f798947b8a2e	user_f798947b8a2e	user_admin001	Internal Demo	Internal Flow Test	done	urgent	\N	{}	{user_f798947b8a2e}	{}	2026-06-07 00:00:00+00	2026-06-06 22:00:00+00	\N	none	1	\N	"[{\\"name\\": \\"aekaminc_kartavya_bg - Copy.png\\", \\"url\\": \\"https://pub-bf2d2af5de044466a0456010568b7fd6.r2.dev/uploads/user_f798947b8a2e/0e6fe3d1da964de58aa6dabad528faa7.png\\", \\"key\\": \\"uploads/user_f798947b8a2e/0e6fe3d1da964de58aa6dabad528faa7.png\\"}]"	"{}"	"[{\\"subtask_id\\": \\"sub_98c8bac82a5d\\", \\"title\\": \\"Insta Post\\", \\"is_done\\": true, \\"order\\": 0, \\"assignee_user_id\\": \\"user_admin001\\"}]"	0	2026-06-06 05:47:01.207131+00	2026-06-06 11:23:23.385942+00	2026-06-06 11:23:23.385942+00	\N	\N	col_fa3e59de83a9	f	approved	user_admin001		2026-06-06 05:55:04.477848+00	2026-06-06 11:23:23.385942+00	\N	KEVAL SHAH
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.team_members (id, member_id, team_id, email, user_id, role, status, created_at, updated_at, full_name, "position", company_name, member_role, receives_approval_emails) FROM stdin;
e8c223b9-d504-49a0-a415-5be14d5c1579	mem_62d5f9b38319	team_b9608ecabac1	admin@aekaminc.com	user_admin001	owner	active	2026-05-04 19:26:52.186814+00	2026-05-04 19:26:52.186814+00	Keval Shah	\N	\N	\N	t
f6b5d69d-b072-4766-b946-5220ce4b47e9	mem_0a16af7f88a8	team_82fde4d09ea8	admin@aekaminc.com	user_admin001	owner	active	2026-05-04 19:34:13.961257+00	2026-05-04 19:34:13.961257+00	Keval Shah	\N	\N	\N	t
312b11c6-e3e6-48bc-a890-77f3a77687b2	mem_8bc5e6dd7186	team_82fde4d09ea8	06bhoomi@gmail.com	user_ccec9338cca6	client	active	2026-05-05 06:38:17.599863+00	2026-05-05 06:38:41.207796+00	06bhoomi@gmail.com	\N	\N	\N	t
ef641ed3-618f-423f-9088-f03e29551737	mem_e42392d3d9f3	team_ab33b5adbffb	admin@aekaminc.com	user_admin001	owner	active	2026-06-04 11:02:46.56251+00	2026-06-04 11:02:46.56251+00	\N	\N	\N	\N	t
6c38ee8e-56cc-499c-9c0f-e8b7b6f934eb	mem_682978f2043f	team_04d204a88487	admin@aekaminc.com	user_admin001	owner	active	2026-06-04 11:02:51.265949+00	2026-06-04 11:02:51.265949+00	\N	\N	\N	\N	t
0eb810c2-f001-4761-a035-3cd3b09984c7	mem_f7bd9a65a0d2	team_d36ee1203684	admin@aekaminc.com	user_admin001	owner	active	2026-06-04 11:03:25.621508+00	2026-06-04 11:03:25.621508+00	\N	\N	\N	\N	t
843755c2-4747-403e-8b49-bf8efa2bb892	mem_bd4f8d309408	team_ea27e54c6dcb	kevalvshah03@gmail.com	user_f798947b8a2e	owner	active	2026-06-05 20:28:39.173867+00	2026-06-05 20:28:39.173867+00	\N	\N	\N	\N	t
b8d92f2f-b464-451d-9623-7bed327ef1e2	mem_b15a7b1db91f	team_95beaa7529a9	admin@aekaminc.com	user_admin001	owner	active	2026-06-05 20:29:22.780476+00	2026-06-05 20:29:22.780476+00	\N	\N	\N	\N	t
2a84b32b-d09d-4be6-9b8e-6cf8743a34fd	mem_9d7293864ad7	team_95beaa7529a9	kevalvshah03@gmail.com	user_f798947b8a2e	member	active	2026-06-05 21:06:09.641561+00	2026-06-05 21:06:09.641561+00	\N	\N	\N	\N	t
cde9c63e-d8ba-4dbc-96c6-7328fd014d1e	mem_bf80e4a0fc0e	team_95beaa7529a9	06bhoomi@gmail.com	user_ccec9338cca6	member	active	2026-06-05 21:06:32.09537+00	2026-06-05 21:06:32.09537+00	\N	\N	\N	\N	t
1061ff42-3189-4761-ae23-16cbaa8fc434	mem_df4103bce7e6	team_2e142f852880	admin@aekaminc.com	user_admin001	owner	active	2026-06-06 06:08:15.779394+00	2026-06-06 06:08:15.779394+00	\N	\N	\N	\N	t
91e26481-de88-4d0e-b52e-283eed3627f1	mem_ee354fe94a1b	team_2e142f852880	kevalvshah03@gmail.com	user_f798947b8a2e	member	active	2026-06-06 06:11:20.525143+00	2026-06-06 06:11:20.525143+00	\N	\N	\N	\N	t
de6abf93-5f16-4bc1-a7f9-00abe58e100d	mem_bb8e9fc64975	team_2e142f852880	aekaminc1@gmail.com	user_3339c020f0c0	member	active	2026-06-06 10:26:10.92195+00	2026-06-06 10:26:10.92195+00	\N	\N	\N	\N	t
541b89b7-72d7-4942-848e-a8ffd07acc18	mem_2ed9d161fb7b	team_2e142f852880	aekaminc5@gmail.com	user_6acb621475b4	member	active	2026-06-06 10:26:44.548306+00	2026-06-06 10:26:44.548306+00	\N	\N	\N	\N	t
8e822f87-8b3a-4b28-af4a-e61d8907ba39	mem_681031eccc22	team_2e142f852880	aekaminc3@gmail.com	user_7b40be81c656	member	active	2026-06-06 11:09:37.307052+00	2026-06-06 11:09:37.307052+00	\N	\N	\N	\N	t
fe2ae53a-c0d2-4db8-b70a-fdbc4daaafa2	mem_326c96bfe00f	team_2e142f852880	aekaminc7@gmail.com	user_cb74d5f7bd57	member	active	2026-06-06 11:10:51.089286+00	2026-06-06 11:10:51.089286+00	\N	\N	\N	\N	t
9978ff9d-1c23-48e5-9d5b-34ea36e2e38e	mem_0325e481a0df	team_2e142f852880	aekaminc4@gmail.com	user_a86b030763f4	member	active	2026-06-09 11:14:35.423583+00	2026-06-09 11:14:35.423583+00	\N	\N	\N	\N	t
2ed91843-b6b0-402c-bbc1-fd88f86f8628	mem_2a3a1e2d73c7	team_2e142f852880	aekaminc2@gmail.com	user_da1d14e5d7c9	member	active	2026-06-09 11:30:25.35037+00	2026-06-09 11:30:25.35037+00	\N	\N	\N	\N	t
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.teams (id, team_id, name, created_by, created_at, updated_at, deleted_at, deleted_by, color) FROM stdin;
7f226709-417f-42a6-bf3e-be2b8ea8ba94	team_82fde4d09ea8	Labofab India Pvt Ltd	user_admin001	2026-05-04 19:34:13.513143+00	2026-05-04 19:34:13.513143+00	2026-05-31 11:31:39.142548+00	user_admin001	\N
c9655c29-89c2-4bca-881c-69da981925ba	team_b9608ecabac1	Vaijnath Infra	user_admin001	2026-05-04 19:26:51.697069+00	2026-05-04 19:26:51.697069+00	2026-05-31 11:32:08.114397+00	user_admin001	\N
4a520212-0c12-4902-9aa6-2a82c8b8d0c5	team_d36ee1203684	Sneha	user_admin001	2026-06-04 11:03:25.177105+00	2026-06-04 11:03:25.177105+00	2026-06-04 11:13:19.683024+00	user_admin001	\N
f8701812-a3eb-4eb1-b939-217f168c6a5f	team_ab33b5adbffb	Kasti	user_admin001	2026-06-04 11:02:46.084459+00	2026-06-04 11:02:46.084459+00	2026-06-04 11:13:32.162363+00	user_admin001	\N
0c5ee0a3-a5ce-4e21-a1b2-db868e05ad6a	team_04d204a88487	Kasti	user_admin001	2026-06-04 11:02:50.824609+00	2026-06-04 11:02:50.824609+00	2026-06-04 11:13:41.724781+00	user_admin001	\N
155a74c1-d16e-43a2-9233-eecf4fcbb4e5	team_95beaa7529a9	AekamInc-UK	user_admin001	2026-06-05 20:29:22.332755+00	2026-06-05 20:29:22.332755+00	\N	\N	\N
7510f7e0-c54f-4035-8a51-8d873543ee47	team_ea27e54c6dcb	Keval To Do	user_f798947b8a2e	2026-06-05 20:28:38.692996+00	2026-06-05 20:28:38.692996+00	2026-06-05 21:07:50.94984+00	user_admin001	\N
66bc812d-b4ff-412a-9f1f-df597d851362	team_2e142f852880	Labofab India Pvt Ltd.	user_admin001	2026-06-06 06:08:15.329349+00	2026-06-06 06:08:15.329349+00	\N	\N	\N
\.


--
-- Data for Name: time_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.time_entries (entry_id, task_id, user_id, started_at, ended_at, minutes, description, created_at) FROM stdin;
te_22d9b9232983	task_3e20f1055ddd	user_f798947b8a2e	2026-06-06 05:49:40.029183+00	2026-06-06 05:50:02.779246+00	1	\N	2026-06-06 05:49:40.029183+00
\.


--
-- Data for Name: user_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_preferences (user_id, pagination_default, sidebar_collapsed, theme, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_whatsapp; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_whatsapp (user_id, phone, otp, otp_expires_at, verified_at, opted_in_at, opted_out_at, notify_approvals, notify_mentions, notify_assignments, notify_dms) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, user_id, email, name, password_hash, salt, avatar, provider, created_at, updated_at, role, full_name, "position", company_name, member_role, receives_approval_emails, password_reset_token, password_reset_expires) FROM stdin;
f9c873c8-6eb3-4728-8582-1d927a740100	user_cb74d5f7bd57	aekaminc7@gmail.com	Parth Chavda	a7bb97b484e0350e25b8d38e85c7208dc77e995bbd57fbd22f317e81940211f0	0a15a80bc9eb46cf8c893a92c4292bd1	\N	local	2026-06-06 11:05:10.846163+00	2026-06-06 11:05:10.846163+00	member	Parth Chavda	\N	\N	Video Editor	t	\N	\N
daf8d038-ae30-4f9a-ad6e-6a911b331ec5	user_7b40be81c656	aekaminc3@gmail.com	Bhumi Shrimali	e9e5898c42b0ca4cd7e17f966ad81fb97f78354594dd4d425eda6809a62609c5	902a9623038b438daa35a4074ba65a50	\N	local	2026-06-06 11:06:30.611972+00	2026-06-06 11:06:30.611972+00	member	Bhumi Shrimali	\N	\N	Content Writer	t	\N	\N
d5970c2b-bb2c-4af7-9a0d-cf4d249c974d	user_a86b030763f4	aekaminc4@gmail.com	Om Chauhan	133f549005c440e403df2e6e085e39b8d0cae359351bfd7d29312523d36d4e18	0fda3c5f06dc455ebd826e327d4e62ca	\N	local	2026-06-09 06:13:51.958846+00	2026-06-09 06:13:51.958846+00	member	Om Chauhan	\N	\N	Editor	t	\N	\N
24abef91-6a42-47f1-ad30-de2419ecd516	user_da1d14e5d7c9	aekaminc2@gmail.com	Sneha Kshatriya	4277c08ba2c4cec5c8910a60abe4680fd337c537123a8cb17b8b678371110639	7be8eaae55dd4c33b8225c7de43d2070	\N	local	2026-06-09 07:19:10.253084+00	2026-06-09 07:19:10.253084+00	member	Sneha Kshtriya	\N	\N	SM Account Manager	t	\N	\N
703b1d82-d5a8-4f3b-b574-908ad0c57a64	user_admin001	admin@aekaminc.com	Keval Shah	47734a54f9b903cfe94fee6da01d3a0d533c6c627a972c1489150013178b40ca	a3f8e2d1c4b5960748392e1f5d6a7b8c	\N	local	2026-05-04 09:32:21.225069+00	2026-05-23 22:18:14.440255+00	admin	Aekam INC.	\N	Aekam INC	Kartavya Admin	t	\N	\N
126ddfd8-ff3e-4205-911c-473d0fdc0ab1	user_ccec9338cca6	06bhoomi@gmail.com	06bhoomi@gmail.com	8651cdd0ffb13b38bc19c808a3f0f4de9b4a5c14c97b37934f38a8939f4ad98a	080301c2269e414a83086a84caf37cff	\N	local	2026-05-05 06:37:11.372377+00	2026-06-04 11:19:08.847617+00	client	Bhoomi Shah - Client	\N	Kartavya owner	CFO	t	\N	\N
b53ccbd7-74c6-4cce-a461-a6e4e1e66b6e	user_f798947b8a2e	kevalvshah03@gmail.com	KEVAL SHAH	2cee7ad4bb996506c618d121eee706ca6eb0a2d79323b16324f83ee7ecfb2c61	90fa56172ee04722849c9435fcd79ade	\N	local	2026-05-04 09:22:55.543918+00	2026-05-04 09:22:55.543918+00	member	KEVAL SHAH	\N	\N	\N	t	\N	\N
1b0662ba-346b-4b43-b28e-cc8cfabebf17	user_c8cef1de88d7	bhoomi@aekaminc.com	Bhoomi Shah	7c14b8a8d29d95deeac30d0215857c542df9d24ed2dee7277021d39080cfe6c5	d55bc1d58c7e452e9f0eb24d6fffd3b9	\N	local	2026-06-04 11:21:40.299127+00	2026-06-04 11:21:40.299127+00	admin	Bhoomi Shah	\N	\N	Founder	t	\N	\N
2b08f605-8777-4dc4-a033-6d5313d2cf5a	user_6acb621475b4	aekaminc5@gmail.com	manthan varaliya	da56994a0fce7bc521efc882c843c79037c0bc6483d0d2b606fca64287c067de	8497c3998a9c49529b994b17be91c06b	\N	local	2026-06-06 09:54:44.91257+00	2026-06-06 09:54:44.91257+00	member	Manthan Varaliya	\N	\N	Video Editor	t	\N	\N
8a5ec1c2-18f7-44df-8acf-400bdb8f8bcf	user_3339c020f0c0	aekaminc1@gmail.com	Kasti Pranami	20542ada8eb6deb407e08b3863ea0b8d97a68c1ec7b97635757b43730b2a0abc	30494965d75941e9ac2aa63b407ec441	\N	local	2026-06-06 10:14:50.039039+00	2026-06-06 10:14:50.039039+00	member	Kasti Pranami	\N	\N	SM Account Manager	t	\N	\N
\.


--
-- Data for Name: whatsapp_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_messages (wa_message_id, user_id, direction, context_type, context_id, template_name, body, sent_at, delivered_at, read_at) FROM stdin;
\.


--
-- Data for Name: whatsapp_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_sessions (phone, state, context_type, context_id, created_at, expires_at) FROM stdin;
\.


--
-- Name: activity_events activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (event_id);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (approval_id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (automation_id);


--
-- Name: board_columns board_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_columns
    ADD CONSTRAINT board_columns_pkey PRIMARY KEY (column_id);


--
-- Name: boards boards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boards
    ADD CONSTRAINT boards_pkey PRIMARY KEY (board_id);


--
-- Name: categories categories_category_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_category_id_key UNIQUE (category_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: channel_members channel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_pkey PRIMARY KEY (channel_id, user_id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (channel_id);


--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (dashboard_id);


--
-- Name: field_definitions field_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_definitions
    ADD CONSTRAINT field_definitions_pkey PRIMARY KEY (field_id);


--
-- Name: field_values field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_values
    ADD CONSTRAINT field_values_pkey PRIMARY KEY (task_id, field_id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (invite_id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: mentions mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_pkey PRIMARY KEY (mention_id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (attachment_id);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (message_id, user_id, emoji);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id);


--
-- Name: notification_prefs notification_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_prefs
    ADD CONSTRAINT notification_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_notification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_notification_id_key UNIQUE (notification_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: project_assignments project_assignments_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: project_columns project_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_columns
    ADD CONSTRAINT project_columns_pkey PRIMARY KEY (column_id);


--
-- Name: project_templates project_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_pkey PRIMARY KEY (template_id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_subscription_id_key UNIQUE (subscription_id);


--
-- Name: push_subscriptions push_subscriptions_user_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);


--
-- Name: push_tokens push_tokens_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_device_id_key UNIQUE (device_id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_web_subscriptions push_web_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_web_subscriptions
    ADD CONSTRAINT push_web_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_web_subscriptions push_web_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_web_subscriptions
    ADD CONSTRAINT push_web_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: report_schedules report_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_pkey PRIMARY KEY (schedule_id);


--
-- Name: saved_views saved_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_pkey PRIMARY KEY (view_id);


--
-- Name: task_clients task_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_clients
    ADD CONSTRAINT task_clients_pkey PRIMARY KEY (id);


--
-- Name: task_clients task_clients_task_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_clients
    ADD CONSTRAINT task_clients_task_id_user_id_key UNIQUE (task_id, user_id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (comment_id);


--
-- Name: task_templates task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (template_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_task_id_key UNIQUE (task_id);


--
-- Name: team_members team_members_member_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_member_id_key UNIQUE (member_id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_email_key UNIQUE (team_id, email);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: teams teams_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_team_id_key UNIQUE (team_id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (entry_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: user_whatsapp user_whatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_whatsapp
    ADD CONSTRAINT user_whatsapp_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_id_key UNIQUE (user_id);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (wa_message_id);


--
-- Name: whatsapp_sessions whatsapp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessions
    ADD CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (phone);


--
-- Name: activity_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_actor_idx ON public.activity_events USING btree (actor_id, created_at DESC);


--
-- Name: activity_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_task_idx ON public.activity_events USING btree (task_id, created_at DESC);


--
-- Name: activity_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_team_idx ON public.activity_events USING btree (team_id, created_at DESC);


--
-- Name: field_values_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_values_task_idx ON public.field_values USING btree (task_id);


--
-- Name: idx_activity_events_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_events_team ON public.activity_events USING btree (team_id, created_at DESC);


--
-- Name: idx_activity_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_team ON public.activity_events USING btree (team_id, created_at DESC);


--
-- Name: idx_approvals_requested_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_requested_by ON public.approvals USING btree (requested_by);


--
-- Name: idx_approvals_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_reviewed_by ON public.approvals USING btree (reviewed_by);


--
-- Name: idx_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_status ON public.approvals USING btree (status);


--
-- Name: idx_approvals_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_task_id ON public.approvals USING btree (task_id);


--
-- Name: idx_approvals_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_team ON public.approvals USING btree (team_id);


--
-- Name: idx_automations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automations_created_by ON public.automations USING btree (created_by);


--
-- Name: idx_automations_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automations_team_id ON public.automations USING btree (team_id);


--
-- Name: idx_board_columns_board; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_board_columns_board ON public.board_columns USING btree (board_id);


--
-- Name: idx_boards_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boards_team ON public.boards USING btree (team_id);


--
-- Name: idx_categories_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_user ON public.categories USING btree (user_id);


--
-- Name: idx_channels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_org ON public.channels USING btree (org_id);


--
-- Name: idx_channels_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_project ON public.channels USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_dashboards_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboards_user_id ON public.dashboards USING btree (user_id);


--
-- Name: idx_field_definitions_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_definitions_team_id ON public.field_definitions USING btree (team_id);


--
-- Name: idx_field_values_field_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_values_field_id ON public.field_values USING btree (field_id);


--
-- Name: idx_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_email ON public.invites USING btree (email);


--
-- Name: idx_invites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_token ON public.invites USING btree (token);


--
-- Name: idx_mentions_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentions_comment_id ON public.mentions USING btree (comment_id);


--
-- Name: idx_messages_channel_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel_created ON public.messages USING btree (channel_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_messages_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_parent ON public.messages USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, read_at) WHERE (read_at IS NULL);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifs_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifs_user_unread ON public.notifications USING btree (user_id, read_at) WHERE (read_at IS NULL);


--
-- Name: idx_project_assignments_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_by ON public.project_assignments USING btree (assigned_by);


--
-- Name: idx_project_assignments_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_team ON public.project_assignments USING btree (team_id);


--
-- Name: idx_project_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_user ON public.project_assignments USING btree (user_id);


--
-- Name: idx_project_columns_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_columns_team ON public.project_columns USING btree (team_id);


--
-- Name: idx_pws_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pws_user ON public.push_web_subscriptions USING btree (user_id);


--
-- Name: idx_report_sched_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_sched_next ON public.report_schedules USING btree (next_run_at) WHERE (is_active = true);


--
-- Name: idx_report_sched_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_sched_team ON public.report_schedules USING btree (team_id);


--
-- Name: idx_report_schedules_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_schedules_by ON public.report_schedules USING btree (created_by);


--
-- Name: idx_report_schedules_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_schedules_next_run ON public.report_schedules USING btree (next_run_at) WHERE (is_active = true);


--
-- Name: idx_report_schedules_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_schedules_team_id ON public.report_schedules USING btree (team_id);


--
-- Name: idx_saved_views_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_views_created_by ON public.saved_views USING btree (created_by);


--
-- Name: idx_saved_views_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_views_team_id ON public.saved_views USING btree (team_id);


--
-- Name: idx_task_clients_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_clients_task ON public.task_clients USING btree (task_id);


--
-- Name: idx_task_clients_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_clients_user ON public.task_clients USING btree (user_id);


--
-- Name: idx_task_comments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_user_id ON public.task_comments USING btree (user_id);


--
-- Name: idx_task_templates_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_task_templates_default ON public.task_templates USING btree (team_id) WHERE (is_default = true);


--
-- Name: idx_task_templates_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_templates_team_id ON public.task_templates USING btree (team_id);


--
-- Name: idx_tasks_approval_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_approval_id ON public.tasks USING btree (approval_id);


--
-- Name: idx_tasks_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_approval_status ON public.tasks USING btree (approval_status) WHERE (approval_status IS NOT NULL);


--
-- Name: idx_tasks_approved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_approved_by ON public.tasks USING btree (approved_by);


--
-- Name: idx_tasks_board; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_board ON public.tasks USING btree (board_id);


--
-- Name: idx_tasks_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_category_id ON public.tasks USING btree (category_id);


--
-- Name: idx_tasks_column; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_column ON public.tasks USING btree (column_id);


--
-- Name: idx_tasks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_created_by ON public.tasks USING btree (created_by_user_id);


--
-- Name: idx_tasks_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_at ON public.tasks USING btree (due_at) WHERE (due_at IS NOT NULL);


--
-- Name: idx_tasks_due_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_status ON public.tasks USING btree (due_at, status) WHERE (due_at IS NOT NULL);


--
-- Name: idx_tasks_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_reminder ON public.tasks USING btree (reminder_at, reminder_sent_at) WHERE (reminder_at IS NOT NULL);


--
-- Name: idx_tasks_team_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_team_status ON public.tasks USING btree (team_id, status, sort_order);


--
-- Name: idx_tasks_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user_status ON public.tasks USING btree (user_id, status, sort_order);


--
-- Name: idx_team_members_approval_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_approval_email ON public.team_members USING btree (team_id, receives_approval_emails) WHERE (receives_approval_emails = true);


--
-- Name: idx_team_members_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_email ON public.team_members USING btree (email, status);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id, status);


--
-- Name: idx_user_whatsapp_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_whatsapp_phone ON public.user_whatsapp USING btree (phone);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_full_name ON public.users USING btree (full_name);


--
-- Name: idx_wa_messages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_messages_user ON public.whatsapp_messages USING btree (user_id, sent_at DESC);


--
-- Name: mentions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mentions_user_idx ON public.mentions USING btree (mentioned_user_id, read_at);


--
-- Name: time_entries_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_entries_task_idx ON public.time_entries USING btree (task_id);


--
-- Name: time_entries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_entries_user_idx ON public.time_entries USING btree (user_id, started_at DESC);


--
-- Name: activity_events activity_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(user_id);


--
-- Name: activity_events activity_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: activity_events activity_events_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: approvals approvals_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id);


--
-- Name: approvals approvals_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id);


--
-- Name: approvals approvals_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: approvals approvals_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: automations automations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: automations automations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: board_columns board_columns_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_columns
    ADD CONSTRAINT board_columns_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(board_id) ON DELETE CASCADE;


--
-- Name: boards boards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boards
    ADD CONSTRAINT boards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: boards boards_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boards
    ADD CONSTRAINT boards_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(channel_id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: channels channels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: channels channels_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: channels channels_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: dashboards dashboards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: field_definitions field_definitions_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_definitions
    ADD CONSTRAINT field_definitions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: field_values field_values_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_values
    ADD CONSTRAINT field_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field_definitions(field_id) ON DELETE CASCADE;


--
-- Name: field_values field_values_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_values
    ADD CONSTRAINT field_values_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: invites invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: mentions mentions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.task_comments(comment_id) ON DELETE CASCADE;


--
-- Name: mentions mentions_mentioned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.users(user_id);


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(message_id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(message_id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: messages messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(channel_id) ON DELETE CASCADE;


--
-- Name: messages messages_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.messages(message_id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: notification_prefs notification_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_prefs
    ADD CONSTRAINT notification_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(user_id);


--
-- Name: project_assignments project_assignments_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: project_columns project_columns_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_columns
    ADD CONSTRAINT project_columns_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: project_templates project_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: push_web_subscriptions push_web_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_web_subscriptions
    ADD CONSTRAINT push_web_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: report_schedules report_schedules_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: saved_views saved_views_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: saved_views saved_views_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: task_clients task_clients_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_clients
    ADD CONSTRAINT task_clients_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: task_clients task_clients_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_clients
    ADD CONSTRAINT task_clients_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: task_clients task_clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_clients
    ADD CONSTRAINT task_clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: task_templates task_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: task_templates task_templates_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: tasks tasks_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(approval_id);


--
-- Name: tasks tasks_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id);


--
-- Name: tasks tasks_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(board_id) ON DELETE SET NULL;


--
-- Name: tasks tasks_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id) ON DELETE SET NULL;


--
-- Name: tasks tasks_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.project_columns(column_id) ON DELETE SET NULL;


--
-- Name: tasks tasks_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE SET NULL;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_whatsapp user_whatsapp_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_whatsapp
    ADD CONSTRAINT user_whatsapp_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: whatsapp_messages whatsapp_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: project_assignments Admins and owners can manage project assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can manage project assignments" ON public.project_assignments USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.user_id = (auth.uid())::text) AND (users.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.project_assignments pa
  WHERE (((pa.team_id)::text = (project_assignments.team_id)::text) AND ((pa.user_id)::text = (auth.uid())::text) AND ((pa.role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::text[])))))));


--
-- Name: tasks Admins and task creators can delete tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and task creators can delete tasks" ON public.tasks FOR DELETE USING (((created_by_user_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.user_id = (auth.uid())::text) AND (users.role = 'admin'::text))))));


--
-- Name: task_clients Admins can manage task clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage task clients" ON public.task_clients USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.user_id = (auth.uid())::text) AND (users.role = 'admin'::text)))));


--
-- Name: activity_events Authenticated users can access activity_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access activity_events" ON public.activity_events TO authenticated USING (true) WITH CHECK (true);


--
-- Name: automations Authenticated users can access automations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access automations" ON public.automations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: dashboards Authenticated users can access dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access dashboards" ON public.dashboards TO authenticated USING (true) WITH CHECK (true);


--
-- Name: field_definitions Authenticated users can access field_definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access field_definitions" ON public.field_definitions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: field_values Authenticated users can access field_values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access field_values" ON public.field_values TO authenticated USING (true) WITH CHECK (true);


--
-- Name: mentions Authenticated users can access mentions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access mentions" ON public.mentions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: project_templates Authenticated users can access project_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access project_templates" ON public.project_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: saved_views Authenticated users can access saved_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access saved_views" ON public.saved_views TO authenticated USING (true) WITH CHECK (true);


--
-- Name: task_templates Authenticated users can access task_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access task_templates" ON public.task_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: time_entries Authenticated users can access time_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access time_entries" ON public.time_entries TO authenticated USING (true) WITH CHECK (true);


--
-- Name: approvals Clients can create approval requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create approval requests" ON public.approvals FOR INSERT WITH CHECK (((requested_by = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = approvals.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text) AND ((project_assignments.role)::text = 'client'::text))))));


--
-- Name: project_columns Owners and admins can manage columns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can manage columns" ON public.project_columns USING ((EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = project_columns.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text) AND ((project_assignments.role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::text[]))))));


--
-- Name: teams Owners and admins can manage teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can manage teams" ON public.teams USING ((((auth.uid())::text = created_by) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.user_id = (auth.uid())::text) AND (users.role = 'admin'::text))))));


--
-- Name: approvals Owners and admins can review approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can review approvals" ON public.approvals FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = approvals.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text) AND ((project_assignments.role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::text[]))))));


--
-- Name: task_comments Users can create comments on accessible tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create comments on accessible tasks" ON public.task_comments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.task_id = task_comments.task_id) AND ((t.user_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
           FROM public.project_assignments
          WHERE (((project_assignments.team_id)::text = t.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text)))) OR (EXISTS ( SELECT 1
           FROM public.task_clients
          WHERE ((task_clients.task_id = t.task_id) AND (task_clients.user_id = (auth.uid())::text)))))))));


--
-- Name: tasks Users can create tasks in assigned projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create tasks in assigned projects" ON public.tasks FOR INSERT WITH CHECK (((user_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = tasks.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text))))));


--
-- Name: categories Users can manage their own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own categories" ON public.categories USING (((auth.uid())::text = user_id));


--
-- Name: user_preferences Users can manage their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own preferences" ON public.user_preferences USING (((auth.uid())::text = (user_id)::text));


--
-- Name: tasks Users can update tasks they created or are assigned to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tasks they created or are assigned to" ON public.tasks FOR UPDATE USING (((created_by_user_id = (auth.uid())::text) OR ((auth.uid())::text = ANY (assignee_user_ids)) OR (EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = tasks.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text) AND ((project_assignments.role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::text[])))))));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (((auth.uid())::text = user_id));


--
-- Name: users Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (((auth.uid())::text = user_id));


--
-- Name: approvals Users can view approvals in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approvals in their projects" ON public.approvals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = approvals.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text)))));


--
-- Name: project_columns Users can view columns in their assigned projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view columns in their assigned projects" ON public.project_columns FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = project_columns.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text)))));


--
-- Name: task_comments Users can view comments on accessible tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments on accessible tasks" ON public.task_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.task_id = task_comments.task_id) AND ((t.user_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
           FROM public.project_assignments
          WHERE (((project_assignments.team_id)::text = t.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text)))) OR (EXISTS ( SELECT 1
           FROM public.task_clients
          WHERE ((task_clients.task_id = t.task_id) AND (task_clients.user_id = (auth.uid())::text)))))))));


--
-- Name: tasks Users can view tasks in their assigned projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tasks in their assigned projects" ON public.tasks FOR SELECT USING (((user_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = tasks.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text)))) OR (EXISTS ( SELECT 1
   FROM public.task_clients
  WHERE ((task_clients.task_id = tasks.task_id) AND (task_clients.user_id = (auth.uid())::text))))));


--
-- Name: teams Users can view teams they are assigned to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view teams they are assigned to" ON public.teams FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.project_assignments
  WHERE (((project_assignments.team_id)::text = teams.team_id) AND ((project_assignments.user_id)::text = (auth.uid())::text)))));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (((auth.uid())::text = user_id));


--
-- Name: users Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (((auth.uid())::text = user_id));


--
-- Name: project_assignments Users can view their own project assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own project assignments" ON public.project_assignments FOR SELECT USING (((auth.uid())::text = (user_id)::text));


--
-- Name: task_clients Users can view their own task client assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own task client assignments" ON public.task_clients FOR SELECT USING (((auth.uid())::text = user_id));


--
-- Name: activity_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: automations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

--
-- Name: board_columns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

--
-- Name: boards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

--
-- Name: field_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: field_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_values ENABLE ROW LEVEL SECURITY;

--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: mentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

--
-- Name: message_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: message_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: project_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_columns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

--
-- Name: project_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: push_web_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_web_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: report_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: report_schedules report_schedules_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY report_schedules_all ON public.report_schedules USING (((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.user_id = ( SELECT (auth.uid())::text AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'owner'::text]))))) OR (team_id IN ( SELECT pa.team_id
   FROM public.project_assignments pa
  WHERE (((pa.user_id)::text = ( SELECT (auth.uid())::text AS uid)) AND ((pa.role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::text[]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.user_id = ( SELECT (auth.uid())::text AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'owner'::text]))))) OR (team_id IN ( SELECT pa.team_id
   FROM public.project_assignments pa
  WHERE (((pa.user_id)::text = ( SELECT (auth.uid())::text AS uid)) AND ((pa.role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::text[])))))));


--
-- Name: report_schedules report_schedules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY report_schedules_select ON public.report_schedules FOR SELECT USING (((team_id IN ( SELECT pa.team_id
   FROM public.project_assignments pa
  WHERE ((pa.user_id)::text = ( SELECT (auth.uid())::text AS uid)))) OR (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.user_id = ( SELECT (auth.uid())::text AS uid)) AND (u.role = 'admin'::text))))));


--
-- Name: saved_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

--
-- Name: task_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_whatsapp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_whatsapp ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict RjQQ7gW5ec2CH1TeY2hAJHqqF9SBCVVRYCNdoXnEi6xtSz1PpCkdgE72k3nYdEg

