-- Geiger Notes — creator page demo seed ("Fight Night Club")
--
-- Layers a complete, demonstrable fan platform on top of geiger_notes_demo.sql
-- (run that first — this reuses its tiers, members, subscriptions, promo codes
-- and hotlinked assets):
--
--   * the public page at /c/geiger-notes — identity, a designed layout (theme,
--     hero header, 12 Home sections incl. member-only and tier-only blocks),
--     published
--   * 13 posts across every visibility (public, members, tier, pay-per-view),
--     multi-image sets, a pinned welcome post, two bundles
--   * fan logins for every lifecycle state, linked to the seeded members, with
--     likes, bookmarks, comments (and creator replies), follows, unlocks, DMs,
--     mass messages and billing invoices
--
-- Every fan account signs in with the password:  fightclub123
--
--   ciaran.doyle@example.com    Title Shot, annual — top supporter, owns PPV sets, DMs
--   jake.m@example.com          Main Card, monthly — FIGHTWEEK25 discount running
--   mei.t@example.com           Octagon Pass, monthly
--   sofia.h@example.com         Octagon Pass free trial
--   hayk.p@example.com          Main Card, cancelled — access until period end
--   liam.w@example.com          Octagon Pass, payment failed (past due)
--   oskar.l@example.com         former member (lapsed) — sees the win-back banner
--   riya.follower@example.com   follows for free, never paid
--   aarav.new@example.com       brand-new account — nothing yet
--
-- Re-runnable: stable ids + `on conflict do nothing`; the page layout and profile
-- are only written while the page has never been published from the builder,
-- so creator edits are never overwritten.

create or replace function pg_temp.sid(k text) returns uuid
language sql immutable as $f$ select md5('geiger-notes-demo:' || k)::uuid $f$;

-- Swap @A:asset@ / @P:post@ / @T:tier@ tokens for their seeded ids, and @DATE@
-- for the next fight-week countdown.
create or replace function pg_temp.fill(t text) returns text
language plpgsql as $f$
declare m text[];
begin
  for m in select regexp_matches(t, '@([APT]):([a-z0-9_]+)@', 'g') loop
    t := replace(t, '@' || m[1] || ':' || m[2] || '@',
      pg_temp.sid(case m[1] when 'A' then 'asset:' when 'P' then 'cpost:' else 'tier:' end || m[2])::text);
  end loop;
  return replace(t, '@DATE@', to_char(now() + interval '6 days 5 hours', 'YYYY-MM-DD"T"HH24:00'));
end
$f$;

do $seed$
declare
  pid constant uuid := 'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3'; -- Geiger Notes
  ub  constant uuid := '39149c4b-526f-445b-8a8c-ea3898e9c50c'; -- Bhargav Joshi (owner)
  -- scrypt of "fightclub123" in lib/creator/fan_auth.js's format.
  pw  constant text := 'scrypt$5eed0f5eed0f5eed0f5eed0f5eed0f00$edd1b0e0b8d2f7c446e6d0fcd4ec85fbb0517d694ddb85976c106bf7b4b157b48f1319d73621f0b678257b52921342fdd340b3d07920fd9c748eb2891755032a';
  creator_name constant text := 'Fight Night Club';
  page jsonb;
begin
  if not exists (select 1 from public.projects where id = pid) then
    raise notice 'geiger_notes_creator_page: project % missing — skipped', pid;
    return;
  end if;
  if not exists (select 1 from assets.membership_tiers where id = pg_temp.sid('tier:main')) then
    raise notice 'geiger_notes_creator_page: run geiger_notes_demo.sql first — skipped';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Tiers: annual pricing and a trial on the entry tier
  -- -------------------------------------------------------------------------
  update assets.membership_tiers set metadata = metadata || '{"annualPriceCents": 9590, "trialDays": 7}'::jsonb
   where id = pg_temp.sid('tier:octagon') and not metadata ? 'annualPriceCents';
  update assets.membership_tiers set metadata = metadata || '{"annualPriceCents": 23990}'::jsonb
   where id = pg_temp.sid('tier:main') and not metadata ? 'annualPriceCents';

  -- -------------------------------------------------------------------------
  -- Posts
  -- -------------------------------------------------------------------------
  insert into assets.ppv_posts (id, project_id, title, teaser_text, body, visibility, min_tier_id, asset_id, asset_ids, price_cents, currency, status, is_pinned, published_at, created_by, created_at, metadata)
  select pg_temp.sid('cpost:' || p.k), pid, p.title, p.teaser, p.body, p.vis,
         case when p.tier is not null then pg_temp.sid('tier:' || p.tier) end,
         case when cardinality(p.media) > 0 then pg_temp.sid('asset:' || p.media[1]) end,
         array(select pg_temp.sid('asset:' || x.k) from unnest(p.media) with ordinality as x(k, n) order by x.n),
         p.price, 'usd', 'published', p.pinned,
         now() - (p.age || ' hours')::interval, ub, now() - (p.age || ' hours')::interval, '{"seed":"geiger-notes-creator"}'::jsonb
  from (values
    ('welcome', 'public', null, 0, array['ufc331','ufc324'], true, 700,
      'Welcome to Fight Night Club — start here',
      'Who I am, what drops when, and which tier gets you what.',
      E'I shoot fight weeks cage-side and backstage — weigh-ins, face-offs, walkouts — plus the odd esports Major and Grand Prix.\n\nPublic posts are free forever. Members get every fight-week set, 4K wallpapers and the monthly Q&A. Main Card adds the full behind-the-scenes galleries, and Title Shot gets the signed print raffle.\n\nPin this, turn on follow, and I will see you at the next card.'),
    ('poster331', 'public', null, 0, array['ufc331'], false, 20,
      'UFC 331 poster just dropped',
      'Van vs Pantoja 2 — the official art, in full.',
      E'Fight week starts Monday. Full-res poster and the phone wallpaper cut are in the Octagon Pass pack below.'),
    ('poll', 'members', null, 0, array['pimblett','tsarukyan'], false, 30,
      'Members poll: who gets the next BTS feature?',
      'Pimblett or Tsarukyan — you pick who I follow around fight week.',
      E'Reply in the comments with your pick. Whoever wins gets the full walkout-to-cage sequence next card.'),
    ('wallpapers', 'tier', 'octagon', 0, array['ufc257','ufc298','ufc317','ufc324','ufc331'], false, 52,
      '4K wallpaper pack — UFC 257 to 331',
      'Five event posters, cropped for desktop and phone.',
      E'Every poster from McGregor–Poirier 2 to this weekend, re-cropped for 16:9 and 19.5:9. Tap an image for the full file.'),
    ('bts324', 'tier', 'main', 0, array['ufc324','mcgregor','pimblett'], false, 96,
      'BTS: the walkout tunnel, UFC 324',
      'Thirty seconds before the lights — the frames nobody else gets.',
      E'Shot on a 35mm from the tunnel mouth. The Pimblett frame is my favourite of the year.'),
    ('raffle', 'tier', 'title', 0, array['ufc317'], false, 120,
      'Title Shot print raffle — October entries',
      'This month: the Topuria double-champ print, signed.',
      E'Every Title Shot member is entered automatically. Winner drawn on the last Friday of the month and announced in DMs.'),
    ('cph_set', 'ppv', null, 699, array['cs2_stage','cs2_crowd','cs2_3dmax'], false, 150,
      'Copenhagen & Budapest Majors — the full stage set',
      'Main stage, the crowd at the bomb plant, and 3DMAX lifting the roof.',
      E'Three Majors worth of stage photography. Unlock once, keep forever.'),
    ('monza', 'ppv', null, 499, array['f1_hamilton','f1_verstappen'], false, 190,
      'Monza & Silverstone — Hamilton in red',
      'Qualifying at Monza and Max at a wet Silverstone.',
      E'Two paddock sets from this season. Pit-lane passes courtesy of a very patient press officer.'),
    ('pillars', 'public', null, 0, array['nasa_pillars'], false, 240,
      'Off-topic: the best desk wallpaper ever made',
      'JWST, Pillars of Creation, NIRCam. That is the post.',
      ''),
    ('artemis', 'members', null, 0, array['nasa_artemis'], false, 300,
      'Artemis launch stills',
      'Kennedy Space Center, the night the rocket turned the sky orange.',
      E'Not a fight, but the loudest thing I have ever photographed.'),
    ('schedule', 'public', null, 0, array[]::text[], false, 360,
      'What drops when',
      'The weekly rhythm of the club.',
      E'Monday — fight-week poster + wallpapers (Octagon Pass)\nWednesday — media day and face-offs (members)\nFriday — weigh-in set (Main Card)\nSunday — the full event BTS gallery (Main Card) and a PPV set\nLast Friday of the month — Title Shot print raffle'),
    ('ghibli', 'ppv', null, 299, array['ghibli_spirited','ghibli_laputa'], false, 420,
      'Ghibli double feature — hand-picked frames',
      'Spirited Away and Castle in the Sky, colour-graded for print.',
      E'A little something between fight weeks.'),
    ('qa_sept', 'tier', 'main', 0, array['mcgregor'], false, 500,
      'September Q&A recap',
      'Gear, getting credentials, and the McGregor cutout story.',
      E'Top questions this month: which lens for cage-side (a 24-70 and a lot of luck), how to get credentialed (start local, shoot everything), and yes, the McGregor cutout took nine hours.')
  ) as p(k, vis, tier, price, media, pinned, age, title, teaser, body)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Bundles
  -- -------------------------------------------------------------------------
  insert into assets.post_bundles (id, project_id, title, description, price_cents, currency, post_ids, cover_asset_id, is_active, sales_count, revenue_cents, created_by, created_at, metadata)
  values
    (pg_temp.sid('bundle:fightweek'), pid, 'Fight Week Collection', 'Both UFC PPV sets — UFC 324 behind the scenes and the Topuria title run.', 999, 'usd',
      array[pg_temp.sid('ppv:ufc324'), pg_temp.sid('ppv:topuria')], pg_temp.sid('asset:ufc317'), true, 6, 5994, ub, now() - interval '12 days', '{"seed":"geiger-notes-creator"}'),
    (pg_temp.sid('bundle:weekend'), pid, 'Weekend Specials', 'The esports Majors, the F1 paddock sets and the Ghibli frames in one go.', 1099, 'usd',
      array[pg_temp.sid('cpost:cph_set'), pg_temp.sid('cpost:monza'), pg_temp.sid('cpost:ghibli')], pg_temp.sid('asset:cs2_stage'), true, 3, 3297, ub, now() - interval '6 days', '{"seed":"geiger-notes-creator"}')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Fan accounts (password: fightclub123), linked to the seeded members
  -- -------------------------------------------------------------------------
  insert into assets.fan_accounts (id, email, display_name, password_hash, last_login_at, created_at, metadata)
  select pg_temp.sid('fan:' || f.k), f.email, f.name, pw, now() - (f.seen || ' hours')::interval, now() - (f.age || ' days')::interval, '{"seed":"geiger-notes-creator"}'::jsonb
  from (values
    ('ciaran', 'ciaran.doyle@example.com',  'Ciarán Doyle',    2,  58),
    ('jake',   'jake.m@example.com',        'Jake Morrison',   30, 45),
    ('mei',    'mei.t@example.com',         'Mei Tanaka',      20, 33),
    ('sofia',  'sofia.h@example.com',       'Sofía Hernández', 4,  5),
    ('hayk',   'hayk.p@example.com',        'Hayk Petrosyan',  12, 50),
    ('liam',   'liam.w@example.com',        'Liam Walsh',      200, 70),
    ('oskar',  'oskar.l@example.com',       'Oskar Lindqvist', 900, 90),
    ('riya',   'riya.follower@example.com', 'Riya Shah',       6,  14),
    ('aarav',  'aarav.new@example.com',     'Aarav Mehta',     1,  1)
  ) as f(k, email, name, seen, age)
  on conflict do nothing;

  -- Everything below resolves fans by email, so a pre-existing account with the
  -- same address is reused rather than duplicated.
  create temp table if not exists seed_fans (k text primary key, id uuid not null, member_k text, name text);
  truncate seed_fans;
  insert into seed_fans (k, id, member_k, name)
  select f.k, a.id, f.m, a.display_name
  from (values
    ('ciaran', 'ciaran.doyle@example.com', 'm01'), ('jake', 'jake.m@example.com', 'm03'), ('mei', 'mei.t@example.com', 'm07'),
    ('sofia', 'sofia.h@example.com', 'm04'), ('hayk', 'hayk.p@example.com', 'm05'), ('liam', 'liam.w@example.com', 'm06'),
    ('oskar', 'oskar.l@example.com', 'm08'), ('riya', 'riya.follower@example.com', null), ('aarav', 'aarav.new@example.com', null)
  ) as f(k, email, m)
  join assets.fan_accounts a on a.email = f.email and a.deleted_at is null;

  update assets.members m set fan_account_id = s.id
    from seed_fans s
   where s.member_k is not null and m.id = pg_temp.sid('member:' || s.member_k) and m.fan_account_id is null;

  -- Ciarán last visited three days ago, so "new since your last visit" has something to count.
  update assets.members set last_seen_at = now() - interval '3 days'
   where id = pg_temp.sid('member:m01') and (last_seen_at is null or last_seen_at > now() - interval '1 day');

  -- -------------------------------------------------------------------------
  -- Subscriptions: billing cycles, the promo discount, a cancellation reason,
  -- and a trial that is still running
  -- -------------------------------------------------------------------------
  update assets.subscriptions set metadata = metadata || '{"cycle":"year","priceCents":19900}'::jsonb where id = pg_temp.sid('sub:m01') and not metadata ? 'cycle';
  update assets.subscriptions set metadata = metadata || '{"cycle":"year","priceCents":19900}'::jsonb where id = pg_temp.sid('sub:m02') and not metadata ? 'cycle';
  update assets.subscriptions set metadata = metadata || jsonb_build_object(
      'cycle', 'month', 'priceCents', 2499, 'promoId', pg_temp.sid('promo:fw'), 'promoCode', 'FIGHTWEEK25',
      'discount', jsonb_build_object('percentOff', 25, 'amountOffCents', null, 'remaining', 2))
   where id = pg_temp.sid('sub:m03') and not metadata ? 'cycle';
  update assets.subscriptions set metadata = metadata || '{"cycle":"month","priceCents":2499,"cancelReason":"break","cancelNote":"Back after exams!"}'::jsonb
   where id = pg_temp.sid('sub:m05') and not metadata ? 'cycle';
  update assets.subscriptions set metadata = metadata || '{"cycle":"month","priceCents":999}'::jsonb where id = pg_temp.sid('sub:m07') and not metadata ? 'cycle';
  update assets.subscriptions set metadata = metadata || '{"cycle":"month","priceCents":2499}'::jsonb where id = pg_temp.sid('sub:m09') and not metadata ? 'cycle';
  update assets.subscriptions set metadata = metadata || '{"cancelReason":"price"}'::jsonb where id = pg_temp.sid('sub:m08') and not metadata ? 'cancelReason';
  -- Keep the demo states true over time: an active trial, and paid periods that
  -- haven't quietly run out.
  update assets.subscriptions set trial_end = now() + interval '4 days', current_period_end = now() + interval '4 days'
   where id = pg_temp.sid('sub:m04') and status = 'trialing' and trial_end < now() + interval '1 day';
  update assets.subscriptions set current_period_end = now() + interval '18 days'
   where id in (pg_temp.sid('sub:m03'), pg_temp.sid('sub:m05'), pg_temp.sid('sub:m07'), pg_temp.sid('sub:m09'))
     and status = 'active' and current_period_end < now() + interval '2 days';

  -- -------------------------------------------------------------------------
  -- Engagement: unlocks, likes, bookmarks, comments, follows
  -- -------------------------------------------------------------------------
  insert into assets.ppv_unlocks (id, project_id, ppv_post_id, member_id, price_cents, unlocked_at, created_at)
  select pg_temp.sid('unlock:' || u.p || ':' || u.m), pid, pg_temp.sid('cpost:' || u.p), pg_temp.sid('member:' || u.m), u.price, now() - (u.age || ' days')::interval, now() - (u.age || ' days')::interval
  from (values ('cph_set','m01',699,5),('monza','m01',499,7),('monza','m07',499,4),('ghibli','m03',299,10),('cph_set','m09',699,3),('ghibli','m05',299,12)) as u(p, m, price, age)
  on conflict do nothing;

  insert into assets.post_likes (id, project_id, post_id, fan_account_id, created_at)
  select pg_temp.sid('like:' || l.p || ':' || l.f), pid, pg_temp.sid('cpost:' || l.p), s.id, now() - (l.age || ' hours')::interval
  from (values
    ('welcome','ciaran',600),('welcome','jake',500),('welcome','mei',480),('welcome','riya',300),('welcome','sofia',90),('welcome','hayk',550),
    ('poster331','ciaran',18),('poster331','riya',15),('poster331','jake',12),('poster331','mei',10),('poster331','aarav',2),
    ('poll','ciaran',28),('poll','jake',25),('poll','mei',22),('poll','sofia',20),
    ('wallpapers','ciaran',50),('wallpapers','mei',40),('wallpapers','jake',44),
    ('bts324','ciaran',90),('bts324','jake',80),('bts324','hayk',70),
    ('raffle','ciaran',110),
    ('cph_set','ciaran',140),
    ('monza','ciaran',180),('monza','mei',100),
    ('pillars','riya',230),('pillars','mei',220),('pillars','oskar',235),
    ('schedule','ciaran',350),('schedule','riya',300),
    ('qa_sept','jake',480),('qa_sept','ciaran',490)
  ) as l(p, f, age)
  join seed_fans s on s.k = l.f
  on conflict do nothing;

  insert into assets.post_bookmarks (id, project_id, post_id, fan_account_id, created_at)
  select pg_temp.sid('mark:' || b.p || ':' || b.f), pid, pg_temp.sid('cpost:' || b.p), s.id, now() - interval '1 day'
  from (values ('wallpapers','ciaran'),('bts324','ciaran'),('schedule','ciaran'),('wallpapers','mei'),('pillars','riya')) as b(p, f)
  join seed_fans s on s.k = b.f
  on conflict do nothing;

  insert into assets.post_comments (id, project_id, post_id, fan_account_id, member_id, author_name, is_creator, body, created_at, metadata)
  select pg_temp.sid('comment:' || c.k), pid, pg_temp.sid('cpost:' || c.p), s.id,
         case when s.member_k is not null then pg_temp.sid('member:' || s.member_k) end,
         coalesce(s.name, creator_name), c.f is null, c.body, now() - (c.age || ' hours')::interval, '{"seed":"geiger-notes-creator"}'::jsonb
  from (values
    ('c01', 'welcome',   'ciaran', 640, 'Been here since day one. The BTS sets are worth every cent.'),
    ('c02', 'welcome',   null,     630, 'Legend. Title Shot raffle entry is on me this month.'),
    ('c03', 'welcome',   'riya',   290, 'Following for now — joining when the next card drops!'),
    ('c04', 'poster331', 'jake',   14,  'That colour grade is unreal.'),
    ('c05', 'poster331', 'mei',    9,   'Phone crop please 🙏'),
    ('c06', 'poster331', null,     8,   'Phone crop is in the Octagon Pass wallpaper pack, Mei.'),
    ('c07', 'poll',      'jake',   26,  'Pimblett. Obviously.'),
    ('c08', 'poll',      'sofia',  19,  'Tsarukyan — nobody covers his camp.'),
    ('c09', 'poll',      'ciaran', 27,  'Tsarukyan for me too.'),
    ('c10', 'bts324',    'hayk',   72,  'The tunnel light on that Pimblett frame 🔥'),
    ('c11', 'bts324',    null,     70,  'One frame, one chance — glad it landed.'),
    ('c12', 'pillars',   'oskar',  236, 'Miss this place. Might be back for UFC 331.'),
    ('c13', 'schedule',  'riya',   320, 'Super clear, thank you.'),
    ('c14', 'qa_sept',   'jake',   485, 'Nine hours on the cutout is insane.')
  ) as c(k, p, f, age, body)
  left join seed_fans s on s.k = c.f
  on conflict do nothing;

  insert into assets.creator_follows (id, project_id, fan_account_id, created_at)
  select pg_temp.sid('follow:' || s.k), pid, s.id, now() - (f.age || ' days')::interval
  from (values ('ciaran',58),('jake',44),('mei',33),('sofia',5),('hayk',49),('oskar',80),('riya',14)) as f(k, age)
  join seed_fans s on s.k = f.k
  on conflict do nothing;

  -- Counters the page and the Posts screen read.
  update assets.ppv_posts p set
    like_count = (select count(*) from assets.post_likes l where l.post_id = p.id),
    comment_count = (select count(*) from assets.post_comments c where c.post_id = p.id and c.deleted_at is null and not c.is_hidden),
    unlock_count = greatest(p.unlock_count, (select count(*) from assets.ppv_unlocks u where u.ppv_post_id = p.id)),
    revenue_cents = greatest(p.revenue_cents, (select coalesce(sum(u.price_cents), 0) from assets.ppv_unlocks u where u.ppv_post_id = p.id))
  where p.project_id = pid;

  -- -------------------------------------------------------------------------
  -- Messages: 1:1 threads (both directions), paid DMs and mass drops
  -- -------------------------------------------------------------------------
  insert into assets.paid_messages (id, project_id, member_id, batch_id, body, attachment_asset_id, price_cents, currency, status, direction, sent_at, unlocked_at, read_at, created_by, created_at, metadata)
  select pg_temp.sid('dm:' || d.k), pid,
         case when d.m is not null then pg_temp.sid('member:' || d.m) end,
         case when d.m is null then pg_temp.sid('batch:' || d.k) end,
         d.body, case when d.a is not null then pg_temp.sid('asset:' || d.a) end, d.price, 'usd', d.status, d.dir,
         now() - (d.age || ' hours')::interval,
         case when d.status = 'unlocked' and d.price > 0 then now() - ((d.age - 1) || ' hours')::interval end,
         case when d.dir = 'outbound' and d.age > 24 then now() - ((d.age - 2) || ' hours')::interval end,
         case when d.dir = 'outbound' then ub end,
         now() - (d.age || ' hours')::interval, '{"seed":"geiger-notes-creator"}'::jsonb
  from (values
    ('ci1', 'm01', 'outbound', 'Welcome to Title Shot, Ciarán — you are in every raffle from here on. Anything you want to see more of?', null, 0, 'unlocked', 470),
    ('ci2', 'm01', 'inbound',  'Cheers! More tunnel shots please. And any chance of a print of the UFC 317 poster?', null, 0, 'unlocked', 460),
    ('ci3', 'm01', 'outbound', 'Tunnel shots are coming at 324. And here is the 317 print file, on the house.', 'ufc317', 0, 'unlocked', 450),
    ('ci4', 'm01', 'outbound', 'Unreleased: the McGregor cutout in 8K. Only sending this one to Title Shot members.', 'mcgregor', 399, 'locked', 20),
    ('ja1', 'm03', 'outbound', 'Your FIGHTWEEK25 discount is locked in for your next two renewals. Enjoy the Main Card sets!', null, 0, 'unlocked', 250),
    ('ja2', 'm03', 'inbound',  'Nice, thanks! The walkout set was worth it alone.', null, 0, 'unlocked', 240),
    ('so1', 'm04', 'outbound', 'Hey Sofía — your Octagon Pass trial runs a few more days. The wallpaper pack is yours to keep either way.', null, 0, 'unlocked', 30),
    ('li1', 'm06', 'outbound', 'Heads up, Liam — your last payment did not go through. Renew from the page to keep your Octagon Pass.', null, 0, 'unlocked', 60),
    ('bc1', null,  'outbound', 'Fight week is here. UFC 331 art pack drops Friday — members get it first.', null, 0, 'unlocked', 40),
    ('bc2', null,  'outbound', 'Mass drop: an alternate Tsarukyan render that did not make the poster.', 'tsarukyan', 199, 'locked', 10)
  ) as d(k, m, dir, body, a, price, status, age)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Billing invoices (Recurring Billing screen)
  -- -------------------------------------------------------------------------
  insert into assets.billing_invoices (id, project_id, number, member_id, subscription_id, tier_id, amount_cents, currency, status, period_start, period_end, due_at, paid_at, attempt_count, next_retry_at, created_by, created_at, metadata)
  select pg_temp.sid('inv:' || i.k), pid, i.num, pg_temp.sid('member:' || i.m), pg_temp.sid('sub:' || i.m), pg_temp.sid('tier:' || i.tier), i.amount, 'usd', i.status,
         now() - (i.age || ' days')::interval,
         now() - (i.age || ' days')::interval + case when i.tier = 'title' then interval '1 year' else interval '1 month' end,
         now() - (i.age || ' days')::interval,
         case when i.status = 'paid' then now() - (i.age || ' days')::interval end,
         i.attempts, case when i.status = 'failed' then now() + interval '2 days' end,
         ub, now() - (i.age || ' days')::interval, '{"seed":"geiger-notes-creator"}'::jsonb
  from (values
    ('i01', 'INV-D1001', 'm01', 'title',   19900, 'paid',   20, 1),
    ('i02', 'INV-D1002', 'm02', 'title',   19900, 'paid',   35, 1),
    ('i03', 'INV-D1003', 'm03', 'main',    1874,  'paid',   42, 1),
    ('i04', 'INV-D1004', 'm03', 'main',    1874,  'paid',   12, 1),
    ('i05', 'INV-D1005', 'm05', 'main',    2499,  'paid',   8,  1),
    ('i06', 'INV-D1006', 'm07', 'octagon', 999,   'paid',   3,  1),
    ('i07', 'INV-D1007', 'm09', 'main',    2499,  'paid',   15, 1),
    ('i08', 'INV-D1008', 'm06', 'octagon', 999,   'paid',   63, 1),
    ('i09', 'INV-D1009', 'm06', 'octagon', 999,   'failed', 3,  3),
    ('i10', 'INV-D1010', 'm08', 'main',    2499,  'refunded', 60, 1)
  ) as i(k, num, m, tier, amount, status, age, attempts)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Fan payment history (the fan profile's Payments tab and totals)
  -- -------------------------------------------------------------------------
  insert into assets.fan_payments (id, project_id, fan_account_id, member_id, kind, target_id, tier_id, amount_cents, currency, status, provider, note, paid_at, created_at, metadata)
  select pg_temp.sid('fpay:' || f.k), pid, s.id, pg_temp.sid('member:' || s.member_k), f.kind,
         case f.kind
           when 'post_unlock' then pg_temp.sid('cpost:' || f.target)
           when 'message_unlock' then pg_temp.sid('msg:' || f.target)
           when 'tip' then case when f.target is not null then pg_temp.sid('cpost:' || f.target) end
         end,
         case when f.kind = 'subscription' then pg_temp.sid('tier:' || f.target) end,
         f.amount, 'usd', f.status, 'test', f.note,
         now() - (f.age || ' days')::interval, now() - (f.age || ' days')::interval,
         jsonb_build_object('seed', 'geiger-notes-creator') || case when f.kind = 'tip' then '{"target_type":"post"}'::jsonb else '{}'::jsonb end
  from (values
    ('p01', 'ciaran', 'subscription',   'title',    19900, 'paid',     20, ''),
    ('p02', 'ciaran', 'post_unlock',    'cph_set',  699,   'paid',     5,  ''),
    ('p03', 'ciaran', 'post_unlock',    'monza',    499,   'paid',     7,  ''),
    ('p04', 'ciaran', 'message_unlock', 'pm1',      299,   'paid',     6,  ''),
    ('p05', 'ciaran', 'tip',            'welcome',  1000,  'paid',     9,  'Best BTS set yet.'),
    ('p06', 'jake',   'subscription',   'main',     1874,  'paid',     42, ''),
    ('p07', 'jake',   'subscription',   'main',     1874,  'paid',     12, ''),
    ('p08', 'jake',   'post_unlock',    'ghibli',   299,   'paid',     10, ''),
    ('p09', 'jake',   'tip',            'bts324',   2500,  'paid',     12, 'For the tunnel shots'),
    ('p10', 'mei',    'subscription',   'octagon',  999,   'paid',     3,  ''),
    ('p11', 'mei',    'post_unlock',    'monza',    499,   'paid',     4,  ''),
    ('p12', 'hayk',   'subscription',   'main',     2499,  'paid',     8,  ''),
    ('p13', 'hayk',   'post_unlock',    'ghibli',   299,   'paid',     12, ''),
    ('p14', 'liam',   'subscription',   'octagon',  999,   'paid',     63, ''),
    ('p15', 'oskar',  'subscription',   'main',     2499,  'refunded', 60, ''),
    ('p16', 'oskar',  'subscription',   'main',     2499,  'paid',     90, '')
  ) as f(k, fan, kind, target, amount, status, age, note)
  join seed_fans s on s.k = f.fan
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- The page itself: identity + a designed, published layout
  -- -------------------------------------------------------------------------
  page := pg_temp.fill($json$
  {
    "version": 1,
    "theme": {
      "preset": "custom", "background": "#0a0a0c", "surface": "#141418", "text": "#f5f5f4", "muted": "#a8a29e",
      "border": "#27272a", "accent": "#ef4444", "fontHeading": "bricolage", "fontBody": "inter",
      "radius": "lg", "card": "elevated", "width": "standard", "backdrop": "glow", "backdropAssetId": null
    },
    "header": { "layout": "hero", "showStats": true, "showSocials": true },
    "nav": {
      "style": "underline", "sticky": true,
      "tabs": { "home": true, "posts": true, "membership": true, "shop": true, "about": true },
      "links": [{ "label": "Print shop", "url": "https://example.com/prints" }]
    },
    "cta": { "label": "Join the club", "mobileBar": true },
    "sections": [
      { "id": "s-hero", "type": "hero", "hidden": false, "audience": "guests", "minTierId": null, "props": {
        "eyebrow": "New drops every fight week",
        "heading": "Cage-side, backstage and on the big stage.",
        "body": "Weigh-ins, walkouts and the frames nobody else gets — plus esports Majors and the F1 paddock. Free to follow, from $9.99 to go all-access.",
        "mediaAssetId": "@A:ufc324@", "ctaLabel": "See the tiers", "ctaAction": "join", "ctaUrl": "", "align": "left" } },
      { "id": "s-countdown", "type": "countdown", "hidden": false, "audience": "all", "minTierId": null, "props": {
        "title": "UFC 331 fight week", "body": "Poster, wallpapers and the full media-day set land the moment the clock hits zero.",
        "date": "@DATE@", "ctaLabel": "Get it first", "ctaAction": "join", "ctaUrl": "" } },
      { "id": "s-featured", "type": "featured", "hidden": false, "audience": "all", "minTierId": null, "props": {
        "title": "Start here", "mode": "picked", "postIds": ["@P:welcome@", "@P:bts324@", "@P:wallpapers@"], "limit": 3 } },
      { "id": "s-tiers", "type": "tiers", "hidden": false, "audience": "guests", "minTierId": null, "props": {
        "title": "Pick your corner", "subtitle": "Cancel any time. Go annual and save 20%.", "highlightTierId": "@T:main@" } },
      { "id": "s-members", "type": "text", "hidden": false, "audience": "members", "minTierId": null, "props": {
        "heading": "Members corner", "body": "This week: vote in the BTS poll, grab the UFC 331 wallpapers, and send your Q&A questions by DM before Sunday.", "align": "left" } },
      { "id": "s-title", "type": "text", "hidden": false, "audience": "tier", "minTierId": "@T:title@", "props": {
        "heading": "Title Shot lounge", "body": "You are entered in this month's signed print raffle. Every PPV set drops in your DMs first.", "align": "left" } },
      { "id": "s-feed", "type": "feed", "hidden": false, "audience": "all", "minTierId": null, "props": {
        "title": "Latest from the club", "limit": 4, "layout": "list", "filter": "all" } },
      { "id": "s-gallery", "type": "gallery", "hidden": false, "audience": "all", "minTierId": null, "props": {
        "title": "From the archive", "layout": "masonry", "columns": 3, "limit": 12, "includeLocked": true } },
      { "id": "s-bundles", "type": "bundles", "hidden": false, "audience": "all", "minTierId": null, "props": { "title": "Bundles — save on sets" } },
      { "id": "s-tip", "type": "tip", "hidden": false, "audience": "all", "minTierId": null, "props": {
        "heading": "Buy the photographer a coffee", "body": "Tips go straight into travel for the next card." } },
      { "id": "s-faq", "type": "faq", "hidden": false, "audience": "all", "minTierId": null, "props": { "title": "Questions", "items": [
        { "q": "Can I cancel any time?", "a": "Yes. Cancel from the Membership tab and you keep access until the end of the period you paid for." },
        { "q": "What does annual billing save?", "a": "Octagon Pass and Main Card are about 20% cheaper paid yearly — flip the Monthly / Annual switch on the tiers." },
        { "q": "Are pay-per-view sets included in a tier?", "a": "PPV sets are one-off unlocks you keep forever. Bundles group several at a discount." },
        { "q": "Do you take commissions?", "a": "Occasionally — send a DM once you are a member." } ] } },
      { "id": "s-follow", "type": "follow", "hidden": false, "audience": "guests", "minTierId": null, "props": {
        "heading": "Not ready to join?", "body": "Follow for free — public posts, fight-week posters and a heads-up when new sets drop." } }
    ],
    "seo": {
      "title": "Fight Night Club — cage-side fight photography",
      "description": "Behind-the-scenes UFC, esports and F1 photography. Free to follow, members get every fight-week set."
    },
    "footer": { "text": "All photography © Fight Night Club. Event art belongs to its respective owners.", "showBranding": true }
  }
  $json$)::jsonb;

  update assets.creator_profiles set
    display_name = creator_name,
    tagline = 'Cage-side fight photography · esports Majors · the F1 paddock',
    bio = E'I have been shooting fight weeks for six years — weigh-ins, face-offs, the walkout tunnel and everything after the final bell.\n\nThis club is where the full sets live. Public posts stay free; members get every fight-week gallery, 4K wallpapers and a monthly Q&A.\n\nBased in Dublin, travelling for every numbered card.',
    avatar_asset_id = pg_temp.sid('asset:ufc298'),
    banner_asset_id = pg_temp.sid('asset:ufc331'),
    accent_color = '#ef4444',
    links = '[{"label":"Print shop","url":"https://example.com/prints"},{"label":"Portfolio","url":"https://example.com/portfolio"},{"label":"Newsletter","url":"https://example.com/newsletter"}]'::jsonb,
    is_published = true,
    tips_enabled = true,
    min_tip_cents = 200,
    suggested_tips = '[300, 500, 1000, 2500]'::jsonb,
    messages_enabled = true,
    welcome_message = 'No messages yet — say hi, I read every one.',
    page_draft = page,
    page_config = page,
    page_published_at = now()
  where project_id = pid and deleted_at is null and page_config is null;

  insert into assets.creator_profiles (project_id, handle, display_name, is_published, page_draft, page_config, page_published_at, accent_color, created_by)
  select pid, 'geiger-notes', creator_name, true, page, page, now(), '#ef4444', ub
  where not exists (select 1 from assets.creator_profiles where project_id = pid and deleted_at is null);

  drop table if exists seed_fans;
  raise notice 'geiger_notes_creator_page: seeded /c/geiger-notes for project %', pid;
end
$seed$;
