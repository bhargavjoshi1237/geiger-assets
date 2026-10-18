-- Geiger Notes — demo DAM seed
--
-- Fills the "Geiger Notes" project (public.projects ebcc7910-…) with a small,
-- demonstrable library — 20 assets across UFC numbered events, CS2 Majors,
-- Formula 1, NASA and Studio Ghibli — plus rows for every module that reads
-- from the database: folders, collections, versions, duplicates, uploads,
-- portals, requests, approvals, comments, activity, share links, invites,
-- rights & licensing, royalties, galleries, delivery, channels, API/webhooks,
-- exports, workflows and the creator (fan club) modules.
--
-- Nothing is uploaded to the storage provider. Every asset points at a public,
-- hotlinkable image by URL: `thumbnail_url` is a display-sized rendition and
-- `metadata.sourceUrl` is the full-resolution original. Video rows carry a
-- poster only (no storage_key), so they preview as a still, not a player.
--
-- Re-runnable: every id is derived from a stable key (pg_temp.sid) and every
-- insert is `on conflict do nothing`, so `npm run db:seed` never duplicates or
-- overwrites anything. It never deletes, and it does nothing at all when the
-- project row is missing.

create or replace function pg_temp.sid(k text) returns uuid
language sql immutable as $f$ select md5('geiger-notes-demo:' || k)::uuid $f$;

-- Deterministic 0..n-1 pick for generated series (stable across re-runs).
create or replace function pg_temp.pick(k text, n int) returns int
language sql immutable as $f$ select abs(hashtext(k)) % greatest(n, 1) $f$;

do $seed$
declare
  pid constant uuid := 'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3'; -- Geiger Notes
  ub  constant uuid := '39149c4b-526f-445b-8a8c-ea3898e9c50c'; -- Bhargav Joshi (owner)
  ud  constant uuid := '77bc4a76-4959-4a23-a5ae-eaccdf731bb3'; -- Deep Patil (member)
  ug  constant uuid := '2541cd31-6a8a-456e-bf23-6bf0f15b3ce8'; -- Gebova (member)
  r_member constant uuid := 'dccddfae-5c90-4bd4-8f6d-80f0a3581110';
  n_b constant text := 'Bhargav Joshi';
  n_d constant text := 'Deep Patil';
  n_g constant text := 'Gebova';
  commons constant text := 'https://upload.wikimedia.org/wikipedia/commons';
  ufc_xl constant text := 'https://www.ufc.com/images/styles/background_image_xl/s3';
  ufc_cut constant text := 'https://www.ufc.com/images/styles/athlete_bio_full_body/s3';
  image_keys constant text[] := array[
    'ufc257','ufc298','ufc317','ufc324','ufc331','mcgregor','tsarukyan','pimblett',
    'cs2_stage','cs2_crowd','cs2_3dmax','f1_verstappen','f1_hamilton',
    'nasa_pillars','nasa_artemis','ghibli_spirited','ghibli_howl','ghibli_laputa'];
  countries constant text[] := array['US','US','US','GB','GB','IE','DE','DK','FR','BR','AU','CA','JP','IN','ES','AE'];
  referrers constant text[] := array['www.ufc.com','www.hltv.org','x.com','www.instagram.com','www.reddit.com','www.espn.com','www.crunchyroll.com',''];
begin
  if not exists (select 1 from public.projects where id = pid and deleted_at is null) then
    raise notice 'geiger_notes_demo: project % not found — skipping', pid;
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Folders (asset.folder stores the folder path)
  -- -------------------------------------------------------------------------
  insert into assets.folders (id, project_id, name, parent_id, path, storage_location, color, size_bytes, created_by, created_at, metadata)
  select pg_temp.sid('folder:' || f.k), pid, f.name, case when f.parent is null then null else pg_temp.sid('folder:' || f.parent) end,
         f.path, f.loc, f.color, f.bytes, ub, now() - (f.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('fight',        null,      'Fight Nights',   '/Fight Nights',                'hot',       '#dc2626',   15304937, 60),
    ('fight_art',    'fight',   'Event Art',      '/Fight Nights/Event Art',      'hot',       '#ef4444',    1696406, 60),
    ('fight_ath',    'fight',   'Athletes',       '/Fight Nights/Athletes',       'hot',       '#f97316',   13608531, 58),
    ('esports',      null,      'Esports',        '/Esports',                     'hot',       '#f59e0b',   36854818, 55),
    ('esports_cs2',  'esports', 'CS2 Majors',     '/Esports/CS2 Majors',          'hot',       '#eab308',   36854818, 55),
    ('motor',        null,      'Motorsport',     '/Motorsport',                  'cloud-s3',  '#e11d48',   10728912, 50),
    ('motor_f1',     'motor',   'Formula 1',      '/Motorsport/Formula 1',        'cloud-s3',  '#be123c',   10728912, 50),
    ('space',        null,      'Space',          '/Space',                       'cold',      '#6366f1',   34000387, 45),
    ('space_nasa',   'space',   'NASA',           '/Space/NASA',                  'cold',      '#4f46e5',   34000387, 45),
    ('anime',        null,      'Anime',          '/Anime',                       'hot',       '#10b981',     902509, 40),
    ('anime_ghibli', 'anime',   'Studio Ghibli',  '/Anime/Studio Ghibli',         'hot',       '#059669',     902509, 40),
    ('video',        null,      'Video',          '/Video',                       'cloud-s3',  '#0ea5e9', 1160069120, 30),
    ('video_promos', 'video',   'Promos',         '/Video/Promos',                'cloud-s3',  '#0284c7', 1160069120, 30)
  ) as f(k, parent, name, path, loc, color, bytes, age)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Assets — 20 rows, external URLs only
  -- -------------------------------------------------------------------------
  insert into assets.assets (
    id, project_id, name, type, format, size_bytes, dimensions, folder, status, tags, description,
    downloads, color, thumbnail_url, created_by, created_at, mime_type, original_filename,
    storage_status, delivery_enabled, cdn_enabled, cdn_enabled_at, metadata)
  select pg_temp.sid('asset:' || a.k), pid, a.name, a.type, a.format, a.bytes, a.dims, a.folder, a.status, a.tags, a.descr,
         a.downloads, a.color, a.thumb, a.owner, now() - (a.age || ' days')::interval, a.mime, a.filename,
         'none', a.cdn, a.cdn, case when a.cdn then now() - ((a.age - 1) || ' days')::interval end,
         jsonb_build_object('seed', 'geiger-notes-demo', 'sourceUrl', a.source, 'credit', a.credit, 'licenseNote', a.license)
  from (values
    -- UFC numbered events — official event art (ufc.com, 2000×1333)
    ('ufc257', 'UFC 257 — Poirier vs McGregor 2 · Event Art.jpg', 'image', 'JPG', 411095::bigint, '2000×1333', '/Fight Nights/Event Art', 'approved',
      array['ufc','ufc-257','mcgregor','poirier','event-art','key-art'], 'Official fight-week key art for UFC 257 (Jan 2021, Abu Dhabi): Dustin Poirier vs Conor McGregor 2 main event.',
      342, '#dc2626', ufc_xl || '/image/2020-12/UFC-257-Hero.jpg', ufc_xl || '/image/2020-12/UFC-257-Hero.jpg',
      'UFC / Zuffa LLC', 'Licensed editorial — UFC media partner terms', 'image/jpeg', 'UFC-257-Hero.jpg', ub, 58, true),
    ('ufc298', 'UFC 298 — Volkanovski vs Topuria · Event Art.jpg', 'image', 'JPG', 232831, '2000×1333', '/Fight Nights/Event Art', 'approved',
      array['ufc','ufc-298','topuria','volkanovski','featherweight','title-fight','event-art'], 'UFC 298 (Feb 2024, Anaheim) — Alexander Volkanovski vs Ilia Topuria for the featherweight title. Hero crop for web headers.',
      418, '#b91c1c', ufc_xl || '/2024-01/021824-ufc-298-volkanovski-vs-topuria-EVENT-ART.jpg', ufc_xl || '/2024-01/021824-ufc-298-volkanovski-vs-topuria-EVENT-ART.jpg',
      'UFC / Zuffa LLC', 'Licensed editorial — UFC media partner terms', 'image/jpeg', '021824-ufc-298-volkanovski-vs-topuria-EVENT-ART.jpg', ub, 55, true),
    ('ufc317', 'UFC 317 — Topuria vs Oliveira · Event Art.jpg', 'image', 'JPG', 296109, '2000×1333', '/Fight Nights/Event Art', 'approved',
      array['ufc','ufc-317','topuria','oliveira','lightweight','title-fight','event-art'], 'UFC 317 (Jun 2025, Las Vegas) — Ilia Topuria vs Charles Oliveira for the vacant lightweight title.',
      276, '#991b1b', ufc_xl || '/2025-06/062825-ufc-317-topuria-vs-oliveira-EVENT-ART.jpg', ufc_xl || '/2025-06/062825-ufc-317-topuria-vs-oliveira-EVENT-ART.jpg',
      'UFC / Zuffa LLC', 'Licensed editorial — UFC media partner terms', 'image/jpeg', '062825-ufc-317-topuria-vs-oliveira-EVENT-ART.jpg', ud, 48, true),
    ('ufc324', 'UFC 324 — Gaethje vs Pimblett · Event Art.jpg', 'image', 'JPG', 336391, '2000×1333', '/Fight Nights/Event Art', 'review',
      array['ufc','ufc-324','pimblett','gaethje','lightweight','event-art','fight-week'], 'UFC 324 (Jan 2026) — Justin Gaethje vs Paddy Pimblett. In review for the fight-week social cutdowns.',
      129, '#ef4444', ufc_xl || '/2025-12/012426-ufc-324-gaethje-vs-pimblett-EVENT-ART.jpg', ufc_xl || '/2025-12/012426-ufc-324-gaethje-vs-pimblett-EVENT-ART.jpg',
      'UFC / Zuffa LLC', 'Licensed editorial — UFC media partner terms', 'image/jpeg', '012426-ufc-324-gaethje-vs-pimblett-EVENT-ART.jpg', ud, 20, true),
    ('ufc331', 'UFC 331 — Van vs Pantoja 2 · Event Art.jpg', 'image', 'JPG', 419980, '2000×1333', '/Fight Nights/Event Art', 'draft',
      array['ufc','ufc-331','pantoja','van','tsarukyan','flyweight','event-art'], 'UFC 331 (Sep 2026) — Joshua Van vs Alexandre Pantoja 2, with Arman Tsarukyan on the card. Latest numbered event, awaiting final crop.',
      37, '#f87171', ufc_xl || '/2026-08/091926-ufc-331-van-vs-pantoja-2-EVENT-ART.jpg', ufc_xl || '/2026-08/091926-ufc-331-van-vs-pantoja-2-EVENT-ART.jpg',
      'UFC / Zuffa LLC', 'Licensed editorial — UFC media partner terms', 'image/jpeg', '091926-ufc-331-van-vs-pantoja-2-EVENT-ART.jpg', ug, 6, false),
    -- UFC athlete cutouts — transparent PNG, full-body originals
    ('mcgregor', 'Conor McGregor — Full-Body Cutout.png', 'image', 'PNG', 5037367, '1186×3324', '/Fight Nights/Athletes', 'approved',
      array['ufc','mcgregor','athlete','cutout','transparent','lightweight'], 'Official UFC full-body athlete render of Conor McGregor on a transparent background — for poster and thumbnail compositing.',
      512, '#16a34a', ufc_cut || '/2026-07/MCGREGOR_CONOR_L_07-11.png', 'https://www.ufc.com/images/2026-07/MCGREGOR_CONOR_L_07-11.png',
      'UFC / Zuffa LLC', 'Licensed — athlete likeness, approval required for advertising', 'image/png', 'MCGREGOR_CONOR_L_07-11.png', ub, 52, true),
    ('tsarukyan', 'Arman Tsarukyan — Full-Body Cutout.png', 'image', 'PNG', 4674100, '988×3324', '/Fight Nights/Athletes', 'review',
      array['ufc','tsarukyan','athlete','cutout','transparent','lightweight','ufc-331'], 'Official UFC full-body athlete render of Arman Tsarukyan (Sep 2026 update) on a transparent background.',
      64, '#ea580c', ufc_cut || '/2026-09/TSARUKYAN_ARMAN_L_09-19.png', 'https://ufc.com/images/2026-09/TSARUKYAN_ARMAN_L_09-19.png',
      'UFC / Zuffa LLC', 'Licensed — athlete likeness, approval required for advertising', 'image/png', 'TSARUKYAN_ARMAN_L_09-19.png', ug, 4, true),
    ('pimblett', 'Paddy Pimblett — Full-Body Cutout.png', 'image', 'PNG', 3897064, '935×3324', '/Fight Nights/Athletes', 'approved',
      array['ufc','pimblett','athlete','cutout','transparent','lightweight','ufc-324'], 'Official UFC full-body athlete render of Paddy "The Baddy" Pimblett on a transparent background.',
      231, '#f97316', ufc_cut || '/2025-01/5/PIMBLETT_PADDY_L_07-27.png', 'https://ufc.com/images/2025-01/5/PIMBLETT_PADDY_L_07-27.png',
      'UFC / Zuffa LLC', 'Licensed — athlete likeness, approval required for advertising', 'image/png', 'PIMBLETT_PADDY_L_07-27.png', ud, 21, true),
    -- CS2 Majors (Wikimedia Commons)
    ('cs2_stage', 'PGL Major Copenhagen 2024 — Main Stage.jpg', 'image', 'JPG', 4647932, '3000×2000', '/Esports/CS2 Majors', 'approved',
      array['cs2','counter-strike','major','pgl','copenhagen-2024','stage','arena'], 'The PGL CS2 Major Copenhagen 2024 main stage at Royal Arena — analyst desk on the big screen, trophy on the stage, full crowd.',
      188, '#f59e0b', commons || '/thumb/7/78/PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg/1920px-PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg', commons || '/7/78/PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg',
      'European Parliament (Wikimedia Commons)', 'CC BY 2.0 — attribution required', 'image/jpeg', 'PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg', ub, 44, true),
    ('cs2_crowd', 'PGL Major Copenhagen 2024 — Crowd at the Bomb Plant.jpg', 'image', 'JPG', 4467316, '3000×2000', '/Esports/CS2 Majors', 'approved',
      array['cs2','counter-strike','major','pgl','copenhagen-2024','crowd','fans'], 'Fan in an EU-flag cape watching a round from the stands as the big screen calls "PLANTING" — Copenhagen Major playoffs.',
      97, '#d97706', commons || '/thumb/a/ac/PGL_CS2_Major_Copenhagen_2024_stage_-_02.jpg/1920px-PGL_CS2_Major_Copenhagen_2024_stage_-_02.jpg', commons || '/a/ac/PGL_CS2_Major_Copenhagen_2024_stage_-_02.jpg',
      'European Parliament (Wikimedia Commons)', 'CC BY 2.0 — attribution required', 'image/jpeg', 'PGL_CS2_Major_Copenhagen_2024_stage_-_02.jpg', ub, 44, true),
    ('cs2_3dmax', 'StarLadder Budapest Major 2025 — 3DMAX on Stage.jpg', 'image', 'JPG', 27739570, '7008×4672', '/Esports/CS2 Majors', 'review',
      array['cs2','counter-strike','major','starladder','budapest-2025','3dmax','team'], '3DMAX locked in at the StarLadder Budapest Major 2025 — 7K original, needs a sponsor-safe crop before partner delivery.',
      41, '#ea580c', commons || '/thumb/6/69/3DMAX_Budapest_Major_2025.jpg/1920px-3DMAX_Budapest_Major_2025.jpg', commons || '/6/69/3DMAX_Budapest_Major_2025.jpg',
      'RAWvico (Wikimedia Commons)', 'CC BY 4.0 — attribution required', 'image/jpeg', '3DMAX_Budapest_Major_2025.jpg', ug, 12, false),
    -- Formula 1 (Wikimedia Commons)
    ('f1_verstappen', 'Max Verstappen — 2024 British Grand Prix.jpg', 'image', 'JPG', 8824749, '6000×4000', '/Motorsport/Formula 1', 'approved',
      array['f1','formula-1','verstappen','red-bull','silverstone','british-gp-2024'], 'Max Verstappen at Silverstone during the 2024 British Grand Prix weekend — 24MP original.',
      156, '#1e3a8a', commons || '/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg', commons || '/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg',
      'Jen Ross (Wikimedia Commons)', 'CC BY 2.0 — attribution required', 'image/jpeg', '2024_British_Grand_Prix,_Verstappen_(3).jpg', ud, 38, true),
    ('f1_hamilton', 'Lewis Hamilton — Ferrari, 2025 Italian GP Qualifying.jpg', 'image', 'JPG', 1904163, '5184×3456', '/Motorsport/Formula 1', 'approved',
      array['f1','formula-1','hamilton','ferrari','monza','italian-gp-2025'], 'Lewis Hamilton in the Ferrari during qualifying for the 2025 Italian Grand Prix at Monza — his first Monza weekend in red.',
      203, '#dc2626', commons || '/thumb/f/f8/Lewis_Hamilton_2025_Italian_Grand_Prix_qualifying.jpg/1920px-Lewis_Hamilton_2025_Italian_Grand_Prix_qualifying.jpg', commons || '/f/f8/Lewis_Hamilton_2025_Italian_Grand_Prix_qualifying.jpg',
      'Eustace Bagge (Wikimedia Commons)', 'CC BY 4.0 — attribution required', 'image/jpeg', 'Lewis_Hamilton_2025_Italian_Grand_Prix_qualifying.jpg', ud, 26, true),
    -- NASA (public domain)
    ('nasa_pillars', 'Pillars of Creation — JWST NIRCam.jpg', 'image', 'JPG', 24431455, '8423×14589', '/Space/NASA', 'approved',
      array['nasa','jwst','webb','nebula','pillars-of-creation','public-domain'], 'The Pillars of Creation in the Eagle Nebula, imaged by the James Webb Space Telescope NIRCam instrument (2022). 123MP original.',
      689, '#7c3aed', commons || '/thumb/f/f1/Pillars_of_Creation_%28NIRCam_Image%29.jpg/1920px-Pillars_of_Creation_%28NIRCam_Image%29.jpg', commons || '/f/f1/Pillars_of_Creation_%28NIRCam_Image%29.jpg',
      'NASA, ESA, CSA, STScI — processing: Joseph DePasquale', 'Public domain', 'image/jpeg', 'Pillars_of_Creation_(NIRCam_Image).jpg', ub, 36, true),
    ('nasa_artemis', 'Artemis I Launch — Kennedy Space Center.jpg', 'image', 'JPG', 9568932, '3840×5760', '/Space/NASA', 'approved',
      array['nasa','artemis','sls','launch','kennedy-space-center','public-domain'], 'NASA''s Space Launch System lifts Artemis I off Launch Complex 39B, 16 November 2022.',
      377, '#f59e0b', commons || '/thumb/5/54/Artemis_I_Launch_%28NHQ202211160010%29.jpg/1920px-Artemis_I_Launch_%28NHQ202211160010%29.jpg', commons || '/5/54/Artemis_I_Launch_%28NHQ202211160010%29.jpg',
      'NASA / Joel Kowsky', 'Public domain', 'image/jpeg', 'Artemis_I_Launch_(NHQ202211160010).jpg', ub, 35, true),
    -- Studio Ghibli — official stills (ghibli.jp)
    ('ghibli_spirited', 'Spirited Away — Yubaba at Her Desk.jpg', 'image', 'JPG', 338505, '1920×1038', '/Anime/Studio Ghibli', 'approved',
      array['anime','studio-ghibli','spirited-away','miyazaki','key-frame'], 'Official Studio Ghibli still from Spirited Away (2001): Yubaba, lamp-lit, at her desk in the bathhouse.',
      264, '#b45309', 'https://www.ghibli.jp/gallery/chihiro016.jpg', 'https://www.ghibli.jp/gallery/chihiro016.jpg',
      'Studio Ghibli', 'Studio-provided still — editorial use only', 'image/jpeg', 'chihiro016.jpg', ug, 30, true),
    ('ghibli_howl', 'Howl''s Moving Castle — Calcifer.jpg', 'image', 'JPG', 245405, '1920×1038', '/Anime/Studio Ghibli', 'approved',
      array['anime','studio-ghibli','howls-moving-castle','calcifer','miyazaki','key-frame'], 'Official Studio Ghibli still from Howl''s Moving Castle (2004): Calcifer blazing in the hearth.',
      301, '#ea580c', 'https://www.ghibli.jp/gallery/howl012.jpg', 'https://www.ghibli.jp/gallery/howl012.jpg',
      'Studio Ghibli', 'Studio-provided still — editorial use only', 'image/jpeg', 'howl012.jpg', ug, 29, true),
    ('ghibli_laputa', 'Castle in the Sky — Pazu Mid-Blast.jpg', 'image', 'JPG', 318599, '1920×1038', '/Anime/Studio Ghibli', 'review',
      array['anime','studio-ghibli','castle-in-the-sky','laputa','miyazaki','action'], 'Official Studio Ghibli still from Castle in the Sky (1986): Pazu thrown through an explosion, goggles on.',
      88, '#0891b2', 'https://www.ghibli.jp/gallery/laputa045.jpg', 'https://www.ghibli.jp/gallery/laputa045.jpg',
      'Studio Ghibli', 'Studio-provided still — editorial use only', 'image/jpeg', 'laputa045.jpg', ug, 9, false),
    -- Video — poster-backed rows (no file in storage, preview is the poster)
    ('video_ufc324', 'UFC 324 Countdown — Gaethje vs Pimblett.mp4', 'video', 'MP4', 612450304, '1920×1080', '/Video/Promos', 'processing',
      array['ufc','ufc-324','pimblett','gaethje','countdown','promo','video'], 'Fight-week countdown promo for UFC 324. Poster frame is the official event art; transcode and captions in progress.',
      18, '#ef4444', ufc_xl || '/2025-12/012426-ufc-324-gaethje-vs-pimblett-EVENT-ART.jpg', ufc_xl || '/2025-12/012426-ufc-324-gaethje-vs-pimblett-EVENT-ART.jpg',
      'UFC / Zuffa LLC', 'Licensed editorial — UFC media partner terms', 'video/mp4', 'ufc324_countdown_master.mp4', ud, 14, false),
    ('video_cph', 'PGL Copenhagen Major 2024 — Grand Final Opener.mp4', 'video', 'MP4', 547618816, '3840×2160', '/Video/Promos', 'approved',
      array['cs2','counter-strike','major','copenhagen-2024','grand-final','opener','video'], 'Grand-final walkout opener cut from the Copenhagen Major arena feed. Poster frame from the main-stage photo set.',
      73, '#f59e0b', commons || '/thumb/7/78/PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg/1920px-PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg', commons || '/7/78/PGL_CS2_Major_Copenhagen_2024_stage_-_01.jpg',
      'PGL Esports', 'Licensed — partner broadcast clip', 'video/mp4', 'cph_major_gf_opener_4k.mp4', ub, 40, true)
  ) as a(k, name, type, format, bytes, dims, folder, status, tags, descr, downloads, color, thumb, source, credit, license, mime, filename, owner, age, cdn)
  on conflict do nothing;

  -- Version history for a few assets (no storage keys — metadata only)
  insert into assets.asset_versions (id, asset_id, version_number, label, is_current, size_bytes, note, created_by, created_at, mime_type, is_locked, approved_at, approved_by, metadata)
  select pg_temp.sid('ver:' || v.k || ':' || v.n), pg_temp.sid('asset:' || v.k), v.n, v.label, v.cur, v.bytes, v.note, v.who,
         now() - (v.age || ' days')::interval, v.mime, v.locked, case when v.locked then now() - (v.age || ' days')::interval end,
         case when v.locked then ub end, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc298', 1, 'v1 — Pre-fight announce', false, 198211::bigint, 'Original announce art before the co-main was confirmed.', ub, 70, 'image/jpeg', false),
    ('ufc298', 2, 'v2 — Final fight-week', true, 232831, 'Final art with updated co-main lockup.', ub, 55, 'image/jpeg', true),
    ('ufc324', 1, 'v1 — 16:9 hero', false, 301442, 'Initial 16:9 hero from the UFC media portal.', ud, 24, 'image/jpeg', false),
    ('ufc324', 2, 'v2 — Clean plate', true, 336391, 'Clean plate without the date lockup, for 9:16 cutdowns.', ud, 20, 'image/jpeg', false),
    ('mcgregor', 1, 'v1 — 2021 render', false, 4210331, 'Previous render from the UFC 264 cycle.', ub, 90, 'image/png', false),
    ('mcgregor', 2, 'v2 — 2026 render', true, 5037367, 'Updated July 2026 athlete render.', ub, 52, 'image/png', true),
    ('nasa_pillars', 1, 'v1 — Original', true, 24431455, 'Full-resolution NIRCam release (STScI 2022-052).', ub, 36, 'image/jpeg', true)
  ) as v(k, n, label, cur, bytes, note, who, age, mime, locked)
  on conflict do nothing;

  -- Relationships
  insert into assets.asset_relationships (id, asset_id, related_asset_id, relation_type, label, created_by, created_at)
  select pg_temp.sid('rel:' || r.a || ':' || coalesce(r.b, r.label)), pg_temp.sid('asset:' || r.a),
         case when r.b is null then null else pg_temp.sid('asset:' || r.b) end, r.t, r.label, ub, now() - interval '10 days'
  from (values
    ('video_ufc324', 'ufc324',   'source',   'Poster frame'),
    ('video_cph',    'cs2_stage','source',   'Poster frame'),
    ('ufc324',       'pimblett', 'variant',  'Headliner cutout'),
    ('ufc331',       'tsarukyan','campaign', 'UFC 331 fight week'),
    ('ufc298',       'ufc317',   'campaign', 'Topuria title run'),
    ('cs2_crowd',    'cs2_stage','variant',  'Same session, alternate angle'),
    ('nasa_pillars', null,       'campaign', 'Deep Space Week 2026')
  ) as r(a, b, t, label)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Collections
  -- -------------------------------------------------------------------------
  insert into assets.collections (id, project_id, name, description, type, cover_color, status, is_favorite, visibility, created_by, created_at, metadata)
  select pg_temp.sid('col:' || c.k), pid, c.name, c.descr, c.type, c.color, c.status, c.fav, c.vis, ub, now() - (c.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc',      'UFC Numbered Events — Key Art', 'Official event art for every numbered card we cover, plus athlete cutouts.', 'manual', '#dc2626', 'active',   true,  'public', 50),
    ('topuria',  'Topuria Title Run',             'UFC 298 → UFC 317: two belts, two weight classes.',                          'album',  '#b91c1c', 'active',   true,  'team',   45),
    ('cs2',      'CS2 Majors 2024–2025',          'Copenhagen 2024 and Budapest 2025 stage, crowd and team shots.',             'manual', '#f59e0b', 'active',   false, 'team',   40),
    ('racing',   'Race Weekend Selects',          'Hero frames from Silverstone and Monza for the motorsport vertical.',        'board',  '#be123c', 'active',   false, 'private',35),
    ('space',    'Public Domain Space',           'Smart: everything tagged public-domain from NASA.',                          'smart',  '#6366f1', 'active',   false, 'public', 30),
    ('ghibli',   'Studio Ghibli Stills',          'Studio-provided stills — editorial use only, no paid social.',               'manual', '#059669', 'active',   true,  'private',28),
    ('archive',  'Fight Week 2025 (Archived)',    'Last year''s fight-week drops — kept for reference.',                        'manual', '#737373', 'archived', false, 'private',80)
  ) as c(k, name, descr, type, color, status, fav, vis, age)
  on conflict do nothing;

  insert into assets.collection_assets (id, collection_id, asset_id, position, added_at)
  select pg_temp.sid('colasset:' || m.c || ':' || m.a), pg_temp.sid('col:' || m.c), pg_temp.sid('asset:' || m.a), m.pos, now() - interval '20 days'
  from (values
    ('ufc','ufc257',0),('ufc','ufc298',1),('ufc','ufc317',2),('ufc','ufc324',3),('ufc','ufc331',4),('ufc','mcgregor',5),('ufc','tsarukyan',6),('ufc','pimblett',7),
    ('topuria','ufc298',0),('topuria','ufc317',1),
    ('cs2','cs2_stage',0),('cs2','cs2_crowd',1),('cs2','cs2_3dmax',2),('cs2','video_cph',3),
    ('racing','f1_verstappen',0),('racing','f1_hamilton',1),
    ('space','nasa_pillars',0),('space','nasa_artemis',1),
    ('ghibli','ghibli_spirited',0),('ghibli','ghibli_howl',1),('ghibli','ghibli_laputa',2),
    ('archive','ufc257',0)
  ) as m(c, a, pos)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Duplicate review
  -- -------------------------------------------------------------------------
  insert into assets.duplicate_groups (id, project_id, match_type, similarity, status, recommended_action, created_at, metadata)
  values
    (pg_temp.sid('dup:cph'),     pid, 'visual', 0.83, 'open',    'Keep the main-stage frame; archive the crowd angle if only one is needed.', now() - interval '6 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('dup:topuria'), pid, 'near',   0.64, 'ignored', 'Different events — same fighter and layout template. Keep both.',          now() - interval '15 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('dup:ufc324'),  pid, 'exact',  1.00, 'resolved','Video poster reuses the event art — linked instead of duplicated.',         now() - interval '12 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.duplicate_members (id, group_id, asset_id, is_keeper, created_at)
  select pg_temp.sid('dupm:' || d.g || ':' || d.a), pg_temp.sid('dup:' || d.g), pg_temp.sid('asset:' || d.a), d.keep, now() - interval '6 days'
  from (values ('cph','cs2_stage',true),('cph','cs2_crowd',false),('topuria','ufc298',true),('topuria','ufc317',true),('ufc324','ufc324',true),('ufc324','video_ufc324',false)) as d(g, a, keep)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Upload Center + External Uploads + Asset Requests
  -- -------------------------------------------------------------------------
  insert into assets.upload_jobs (id, project_id, filename, file_type, size_bytes, status, progress, source, error, asset_id, created_by, created_at, upload_mode, metadata)
  select pg_temp.sid('job:' || j.k), pid, j.filename, j.ftype, j.bytes, j.status, j.progress, j.source, coalesce(j.err, ''),
         case when j.asset is null then null else pg_temp.sid('asset:' || j.asset) end, j.who, now() - (j.age || ' hours')::interval, 'proxy', '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('pillars',   'Pillars_of_Creation_(NIRCam_Image).jpg', 'image', 24431455::bigint, 'completed', 100, 'url',       null, 'nasa_pillars', ub, 864),
    ('artemis',   'Artemis_I_Launch_(NHQ202211160010).jpg', 'image', 9568932,  'completed', 100, 'url',       null, 'nasa_artemis', ub, 840),
    ('ghibli',    'studio-ghibli-stills.zip',               'archive', 902509, 'completed', 100, 'zip',       null, null,           ug, 700),
    ('ufc324',    'ufc324_countdown_master.mp4',            'video', 612450304,'processing', 82, 'drag-drop', null, 'video_ufc324', ud, 3),
    ('3dmax',     '3DMAX_Budapest_Major_2025.jpg',          'image', 27739570, 'completed', 100, 'url',       null, 'cs2_3dmax',    ug, 288),
    ('presser',   'UFC331_press_conference_raw.mov',        'video', 2147483648,'failed',     37, 'drag-drop', 'File exceeds the project''s 50 MB upload limit.', null, ug, 30),
    ('cutouts',   'ufc-athlete-cutouts',                    'image', 13608531, 'completed', 100, 'folder',    null, null,           ub, 1250),
    ('f1',        'monza-quali-selects',                    'image', 1904163,  'uploading',  46, 'cloud',     null, null,           ud, 1)
  ) as j(k, filename, ftype, bytes, status, progress, source, err, asset, who, age)
  on conflict do nothing;

  insert into assets.upload_portals (id, project_id, name, type, slug, status, require_metadata, destination_folder, expires_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('portal:ufc'),   pid, 'UFC Fight Week — Photographer Drop', 'link', 'gn-ufc-fight-week-drop', 'active', true,  '/Fight Nights/Event Art', now() + interval '21 days', ub, now() - interval '25 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('portal:cs2'),   pid, 'CS2 Major — Media Partner Uploads',  'form', 'gn-cs2-major-media',     'active', true,  '/Esports/CS2 Majors',     now() + interval '45 days', ug, now() - interval '18 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('portal:f1'),    pid, 'F1 Paddock Photographers',           'link', 'gn-f1-paddock',          'paused', false, '/Motorsport/Formula 1',   null,                       ud, now() - interval '40 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.upload_submissions (id, portal_id, submitter_name, submitter_email, file_count, status, note, created_at, metadata)
  select pg_temp.sid('sub:' || s.k), pg_temp.sid('portal:' || s.portal), s.name, s.email, s.files, s.status, s.note, now() - (s.age || ' hours')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc1', 'ufc', 'Octagon-side photo desk', 'photodesk@example.com',  48, 'approved', 'UFC 324 weigh-ins + face-offs, full set.', 120),
    ('ufc2', 'ufc', 'Freelance — Las Vegas',   'lv.freelance@example.com', 12, 'pending',  'Fan expo booth shots. Captions in the sidecar CSV.', 9),
    ('cs2a', 'cs2', 'HLTV photo team',         'photos@example.com',       31, 'approved', 'Budapest Major playoff stage day.', 200),
    ('cs2b', 'cs2', 'Community photographer',  'community@example.com',     6, 'rejected', 'Out of focus / below resolution minimum.', 60),
    ('f1a',  'f1',  'Paddock stringer',        'paddock@example.com',      22, 'pending',  'Monza garage and grid walk.', 400)
  ) as s(k, portal, name, email, files, status, note, age)
  on conflict do nothing;

  insert into assets.asset_requests (id, project_id, title, description, requester, assignee, priority, status, due_date, reference_asset_id, created_by, created_at, metadata)
  select pg_temp.sid('req:' || r.k), pid, r.title, r.descr, r.requester, r.assignee, r.priority, r.status, current_date + r.due,
         case when r.ref is null then null else pg_temp.sid('asset:' || r.ref) end, r.who, now() - (r.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc324_916', 'UFC 324 fight-week 9:16 cutdowns', 'Stories + Reels crops from the clean plate, Pimblett left / Gaethje right. Safe zones for UI overlays.', n_b, n_d, 'urgent', 'in_progress', 2, 'ufc324', ub, 4),
    ('ufc331_crop','UFC 331 final crop with Tsarukyan', 'Swap in the new Tsarukyan render for the co-feature slot on the homepage hero.', n_d, n_g, 'high', 'open', 5, 'ufc331', ud, 2),
    ('monza',      'Hamilton Ferrari garage selects — Monza', 'Need 6 garage/pit-lane frames to pair with the qualifying hero.', n_g, n_d, 'medium', 'open', 10, 'f1_hamilton', ug, 3),
    ('ghibli',     'Ghibli stills for spring anime feature', 'Three stills, editorial layout, credit line "© Studio Ghibli".', n_d, n_g, 'medium', 'submitted', 7, 'ghibli_spirited', ud, 9),
    ('trophy',     'CS2 Major trophy lift — Budapest', 'Winner trophy lift frame for the year-in-review piece.', n_b, n_g, 'low', 'closed', -12, 'cs2_3dmax', ub, 30),
    ('artemis',    'Artemis II rollout photos', 'Watch NASA''s gallery for rollout imagery and pull into /Space/NASA.', n_g, n_b, 'low', 'approved', 14, 'nasa_artemis', ug, 6)
  ) as r(k, title, descr, requester, assignee, priority, status, due, ref, who, age)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Approvals — pipelines, reviews, items, decisions
  -- -------------------------------------------------------------------------
  insert into assets.approval_pipelines (id, project_id, name, description, subject_type, status, mode, is_default, stages, auto_lock_version, auto_stamp_status, review_count, created_by, created_at, metadata)
  values
    (pg_temp.sid('pipe:keyart'), pid, 'Fight Night Key Art', 'Creative lead, then promotion brand sign-off, then rights clearance before anything ships.', 'asset', 'Active', 'sequential', true,
      jsonb_build_array(
        jsonb_build_object('id','stage_creative','name','Creative review','approverType','member','roleId','','memberIds',jsonb_build_array(ud),'minApprovals',1,'advance','sequential','allowChangeRequests',true,'slaHours',24),
        jsonb_build_object('id','stage_brand','name','Brand approval','approverType','member','roleId','','memberIds',jsonb_build_array(ub),'minApprovals',1,'advance','sequential','allowChangeRequests',true,'slaHours',48),
        jsonb_build_object('id','stage_rights','name','Rights clearance','approverType','member','roleId','','memberIds',jsonb_build_array(ug),'minApprovals',1,'advance','sequential','allowChangeRequests',false,'slaHours',72)),
      true, true, 3, ub, now() - interval '50 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('pipe:partner'), pid, 'Partner Delivery', 'Internal QA then account review before a collection goes to a media partner.', 'collection', 'Active', 'sequential', true,
      jsonb_build_array(
        jsonb_build_object('id','stage_qa','name','Internal QA','approverType','role','roleId',r_member::text,'memberIds',jsonb_build_array(),'minApprovals',1,'advance','sequential','allowChangeRequests',true,'slaHours',24),
        jsonb_build_object('id','stage_account','name','Account review','approverType','member','roleId','','memberIds',jsonb_build_array(ub),'minApprovals',1,'advance','sequential','allowChangeRequests',true,'slaHours',null)),
      true, true, 1, ub, now() - interval '42 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('pipe:social'), pid, 'Paid Social Clearance', 'Two approvers must agree before studio or athlete imagery runs in paid social.', 'asset', 'Draft', 'anytime', false,
      jsonb_build_array(
        jsonb_build_object('id','stage_dual','name','Dual sign-off','approverType','role','roleId',r_member::text,'memberIds',jsonb_build_array(),'minApprovals',2,'advance','anytime','allowChangeRequests',true,'slaHours',48)),
      true, false, 0, ud, now() - interval '8 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.approval_reviews (id, project_id, pipeline_id, name, description, subject_type, subject_id, status, priority, current_stage, stage_snapshot, due_at, completed_at, requested_by, created_at, metadata)
  select pg_temp.sid('review:' || r.k), pid, pg_temp.sid('pipe:' || r.pipe), r.name, r.descr, r.subject, pg_temp.sid(r.subj_key),
         r.status, r.priority, r.stage, (select stages from assets.approval_pipelines where id = pg_temp.sid('pipe:' || r.pipe)),
         now() + (r.due || ' hours')::interval, case when r.done then now() - interval '30 days' end, r.who, now() - (r.age || ' hours')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc324',  'keyart',  'UFC 324 fight-week key art',       'Clean plate + countdown poster for the fight-week push.', 'asset',      'asset:ufc324',   'In Review',         'High',   1, 30,   false, ud, 60),
    ('topuria', 'keyart',  'Topuria title run — hero set',     'UFC 298 and UFC 317 hero art for the retrospective.',      'asset',      'asset:ufc298',   'Approved',          'Normal', 2, -720, true,  ub, 900),
    ('ghibli',  'keyart',  'Ghibli stills — spring feature',   'Three stills for the anime feature. Editorial only.',       'asset',      'asset:ghibli_laputa', 'Changes Requested', 'Normal', 0, 72, false, ug, 40),
    ('cs2',     'partner', 'CS2 Majors pack → HLTV',           'Partner delivery of the CS2 Majors collection.',            'collection', 'col:cs2',        'Pending',           'Urgent', 0, 12,   false, ub, 5)
  ) as r(k, pipe, name, descr, subject, subj_key, status, priority, stage, due, done, who, age)
  on conflict do nothing;

  insert into assets.approval_review_items (id, review_id, asset_id, subject_type, label, decision, note, decided_by, decided_at, position)
  select pg_temp.sid('ritem:' || i.r || ':' || i.a), pg_temp.sid('review:' || i.r), pg_temp.sid('asset:' || i.a), 'asset', i.label, i.decision, i.note,
         case when i.decision = 'pending' then null else i.who end, case when i.decision = 'pending' then null else now() - interval '1 day' end, i.pos
  from (values
    ('ufc324', 'ufc324',       'Event art — clean plate', 'approved', 'Clean plate reads well at 9:16.', ud, 0),
    ('ufc324', 'video_ufc324', 'Countdown promo',         'pending',  '', null::uuid, 1),
    ('ufc324', 'pimblett',     'Pimblett cutout',         'approved', '', ud, 2),
    ('topuria','ufc298',       'UFC 298 hero',            'approved', '', ub, 0),
    ('topuria','ufc317',       'UFC 317 hero',            'approved', '', ub, 1),
    ('ghibli', 'ghibli_spirited','Spirited Away still',   'approved', '', ug, 0),
    ('ghibli', 'ghibli_laputa','Castle in the Sky still', 'changes',  'Swap for a calmer frame — the explosion reads as violent for the feature tone.', ub, 1),
    ('ghibli', 'ghibli_howl',  'Howl''s Moving Castle still', 'approved', '', ug, 2),
    ('cs2',    'cs2_stage',    'Main stage',              'pending',  '', null, 0),
    ('cs2',    'cs2_crowd',    'Crowd angle',             'pending',  '', null, 1),
    ('cs2',    'cs2_3dmax',    '3DMAX on stage',          'pending',  '', null, 2)
  ) as i(r, a, label, decision, note, who, pos)
  on conflict do nothing;

  insert into assets.approval_decisions (id, review_id, stage_index, stage_name, decision, note, actor_id, actor_name, created_at)
  select pg_temp.sid('decision:' || d.r || ':' || d.idx), pg_temp.sid('review:' || d.r), d.stage, d.stage_name, d.decision, d.note, d.who, d.who_name, now() - (d.age || ' hours')::interval
  from (values
    ('ufc324', 0, 0, 'Creative review',  'approved', 'Crops are clean. Moving to brand.', ud, n_d, 20),
    ('topuria',0, 0, 'Creative review',  'approved', '', ud, n_d, 880),
    ('topuria',1, 1, 'Brand approval',   'approved', 'Matches the UFC partner style guide.', ub, n_b, 860),
    ('topuria',2, 2, 'Rights clearance', 'approved', 'Covered by the UFC editorial licence through 2026.', ug, n_g, 840),
    ('ghibli', 0, 0, 'Creative review',  'changes',  'Castle in the Sky frame needs swapping — see item note.', ub, n_b, 30)
  ) as d(r, idx, stage, stage_name, decision, note, who, who_name, age)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Comments & activity
  -- -------------------------------------------------------------------------
  insert into assets.comments (id, project_id, parent_id, subject_type, subject_id, asset_id, review_id, body, anchor, mentions, status, author_id, author_name, resolved_by, resolved_at, created_at, metadata)
  select pg_temp.sid('comment:' || c.k), pid, case when c.parent is null then null else pg_temp.sid('comment:' || c.parent) end,
         'asset', pg_temp.sid('asset:' || c.a), pg_temp.sid('asset:' || c.a),
         case when c.review is null then null else pg_temp.sid('review:' || c.review) end,
         c.body, c.anchor::jsonb, c.mentions, c.status, c.who, c.who_name,
         case when c.status = 'resolved' then ub end, case when c.status = 'resolved' then now() - interval '1 day' end,
         now() - (c.age || ' hours')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('c1',  null, 'ufc324', 'ufc324', 'Pimblett''s name plate collides with the co-main lockup at 9:16 — can we get the clean plate for Stories?', '{"x":0.62,"y":0.34}', array[ud], 'resolved', ub, n_b, 70),
    ('c1r', 'c1', 'ufc324', 'ufc324', 'Uploaded v2 (clean plate). Lockup is now a separate layer in the promo kit.', null, array[]::uuid[], 'open', ud, n_d, 60),
    ('c2',  null, 'cs2_crowd', null,  'Faces in the lower-left are recognisable — blur before we send this outside editorial.', '{"x":0.18,"y":0.8}', array[ug], 'open', ub, n_b, 26),
    ('c3',  null, 'ghibli_howl', 'ghibli', 'Reminder: studio stills are editorial only. No paid social, no merch.', null, array[ud, ug], 'open', ug, n_g, 36),
    ('c4',  null, 'nasa_pillars', null, 'Use this NIRCam version, not the MIRI composite — it matches the Deep Space deck.', null, array[]::uuid[], 'resolved', ud, n_d, 200),
    ('c5',  null, 'mcgregor', null,    'New July 2026 render is in. Old v1 kept for the UFC 264 archive only.', '{"x":0.5,"y":0.2}', array[]::uuid[], 'open', ub, n_b, 12),
    ('c6',  null, 'f1_hamilton', null, 'Stunning frame. Can we get a 4:5 crop for the Monza recap carousel?', null, array[ud], 'open', ug, n_g, 7)
  ) as c(k, parent, a, review, body, anchor, mentions, status, who, who_name, age)
  on conflict do nothing;

  insert into assets.activity_events (id, project_id, verb, summary, subject_type, subject_id, subject_label, actor_id, actor_name, created_at, metadata)
  select pg_temp.sid('activity:' || e.k), pid, e.verb, e.summary, e.stype, pg_temp.sid(e.skey), e.label, e.who, e.who_name,
         now() - (e.age || ' hours')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('a01', 'asset.uploaded',   'Uploaded Pillars of Creation — JWST NIRCam.jpg', 'asset', 'asset:nasa_pillars', 'Pillars of Creation — JWST NIRCam.jpg', ub, n_b, 864),
    ('a02', 'asset.uploaded',   'Uploaded 3 Studio Ghibli stills',                'asset', 'asset:ghibli_spirited', 'Spirited Away — Yubaba at Her Desk.jpg', ug, n_g, 700),
    ('a03', 'collection.created','Created UFC Numbered Events — Key Art',        'collection', 'col:ufc', 'UFC Numbered Events — Key Art', ub, n_b, 1200),
    ('a04', 'review.requested', 'Requested review: Topuria title run — hero set', 'asset', 'asset:ufc298', 'Topuria title run — hero set', ub, n_b, 900),
    ('a05', 'review.approved',  'Approved: Topuria title run — hero set',         'asset', 'asset:ufc298', 'Topuria title run — hero set', ug, n_g, 840),
    ('a06', 'share.created',    'Shared UFC 324 Press Kit',                       'collection', 'col:ufc', 'UFC 324 Press Kit', ub, n_b, 300),
    ('a07', 'share.viewed',     'UFC 324 Press Kit viewed 48 times today',        'collection', 'col:ufc', 'UFC 324 Press Kit', null, 'Share link', 20),
    ('a08', 'review.requested', 'Requested review: UFC 324 fight-week key art',   'asset', 'asset:ufc324', 'UFC 324 fight-week key art', ud, n_d, 60),
    ('a09', 'review.advanced',  'UFC 324 key art moved to Brand approval',        'asset', 'asset:ufc324', 'UFC 324 fight-week key art', ud, n_d, 20),
    ('a10', 'comment.posted',   'Commented on UFC 324 — Gaethje vs Pimblett',      'asset', 'asset:ufc324', 'UFC 324 — Gaethje vs Pimblett · Event Art.jpg', ub, n_b, 70),
    ('a11', 'comment.resolved', 'Resolved a thread on UFC 324 event art',          'asset', 'asset:ufc324', 'UFC 324 — Gaethje vs Pimblett · Event Art.jpg', ub, n_b, 24),
    ('a12', 'review.changes',   'Changes requested on Ghibli stills',             'asset', 'asset:ghibli_laputa', 'Ghibli stills — spring feature', ub, n_b, 30),
    ('a13', 'asset.updated',    'Updated McGregor cutout to the July 2026 render', 'asset', 'asset:mcgregor', 'Conor McGregor — Full-Body Cutout.png', ub, n_b, 12),
    ('a14', 'asset.uploaded',   'Uploaded Arman Tsarukyan — Full-Body Cutout.png', 'asset', 'asset:tsarukyan', 'Arman Tsarukyan — Full-Body Cutout.png', ug, n_g, 96),
    ('a15', 'asset.uploaded',   'Uploaded UFC 331 — Van vs Pantoja 2 · Event Art.jpg', 'asset', 'asset:ufc331', 'UFC 331 — Van vs Pantoja 2 · Event Art.jpg', ug, n_g, 144),
    ('a16', 'member.invited',   'Invited sofia.reyes@example.com as a reviewer',  'member', 'invite:sofia', 'sofia.reyes@example.com', ub, n_b, 50),
    ('a17', 'share.revoked',    'Revoked Budapest Major — early access',           'asset', 'asset:cs2_3dmax', 'Budapest Major — early access', ug, n_g, 100),
    ('a18', 'asset.archived',   'Archived Fight Week 2025 collection',            'collection', 'col:archive', 'Fight Week 2025 (Archived)', ud, n_d, 400),
    ('a19', 'review.requested', 'Requested review: CS2 Majors pack → HLTV',       'collection', 'col:cs2', 'CS2 Majors pack → HLTV', ub, n_b, 5),
    ('a20', 'comment.posted',   'Commented on Lewis Hamilton — Ferrari, 2025 Italian GP', 'asset', 'asset:f1_hamilton', 'Lewis Hamilton — Ferrari, 2025 Italian GP Qualifying.jpg', ug, n_g, 7)
  ) as e(k, verb, summary, stype, skey, label, who, who_name, age)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Shared links + team invitations
  -- -------------------------------------------------------------------------
  insert into assets.share_links (id, project_id, name, token, subject_type, subject_id, visibility, expires_at, allow_download, allow_comments, require_email, status, view_count, download_count, last_viewed_at, created_by, created_at, metadata)
  select pg_temp.sid('share:' || s.k), pid, s.name, s.token, s.stype, pg_temp.sid(s.skey), s.vis, now() + (s.exp || ' days')::interval,
         s.dl, s.cm, s.em, s.status, s.views, s.downloads, now() - (s.last || ' hours')::interval, s.who, now() - (s.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('presskit', 'UFC 324 Press Kit',              'gn-ufc324-press-kit-7f3a9c', 'collection', 'col:ufc',      'public',  30,  true,  false, false, 'active',  1482, 212, 2,   ub, 12),
    ('cs2pack',  'CS2 Majors — HLTV partner pack', 'gn-cs2-majors-hltv-41b2e8',  'collection', 'col:cs2',      'private', 14,  true,  true,  true,  'active',   214,  58, 20,  ub, 6),
    ('pillars',  'Pillars of Creation — hi-res',   'gn-pillars-hires-9d0c11',    'asset',      'asset:nasa_pillars', 'public', -3, true, false, false, 'expired', 3920, 1204, 100, ud, 40),
    ('ghibli',   'Ghibli stills — editor preview', 'gn-ghibli-editor-5e7a02',    'collection', 'col:ghibli',   'private', 7,   false, true,  true,  'paused',    37,   0, 50,  ug, 9),
    ('3dmax',    'Budapest Major — early access',  'gn-budapest-early-2c9f4d',   'asset',      'asset:cs2_3dmax', 'private', 10, false, false, true, 'revoked',  12,   0, 110, ug, 8)
  ) as s(k, name, token, stype, skey, vis, exp, dl, cm, em, status, views, downloads, last, who, age)
  on conflict do nothing;

  insert into assets.team_invitations (id, project_id, email, name, role_id, kind, status, token, message, expires_at, invited_by, created_at, metadata)
  values
    (pg_temp.sid('invite:sofia'), pid, 'sofia.reyes@example.com', 'Sofia Reyes', r_member, 'reviewer', 'pending', 'gn-invite-sofia-8a1f', 'Joining to review UFC fight-week key art.', now() + interval '5 days', ub, now() - interval '2 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('invite:kenji'), pid, 'kenji.tanaka@example.com', 'Kenji Tanaka', r_member, 'guest', 'pending', 'gn-invite-kenji-3c7d', 'Guest access for the Ghibli editorial feature.', now() + interval '6 days', ug, now() - interval '1 day', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('invite:marco'), pid, 'marco.bianchi@example.com', 'Marco Bianchi', r_member, 'member', 'expired', 'gn-invite-marco-6b20', 'F1 desk.', now() - interval '3 days', ud, now() - interval '10 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Rights & licensing
  -- -------------------------------------------------------------------------
  insert into assets.rights_holders (id, project_id, name, kind, email, default_royalty_rate, payment_terms, notes, created_by, created_at, metadata)
  select pg_temp.sid('holder:' || h.k), pid, h.name, h.kind, null, h.rate, h.terms, h.notes, ub, now() - interval '60 days', '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc',     'UFC (Zuffa LLC)',              'publisher',    15.0, 'Net 30, quarterly statements', 'Event art and athlete renders under media-partner terms.'),
    ('ghibli',  'Studio Ghibli',                'publisher',    25.0, 'Net 45, quarterly with minimum guarantee', 'Studio-provided stills. Editorial only.'),
    ('pgl',     'PGL Esports',                  'agency',       10.0, 'Net 30', 'Copenhagen Major broadcast clips.'),
    ('nasa',    'NASA',                         'other',         0.0, 'N/A — public domain', 'Credit NASA; no endorsement implied.'),
    ('commons', 'Wikimedia Commons contributors','photographer', 0.0, 'Attribution only (CC BY)', 'Per-file CC licence — see each asset''s credit line.')
  ) as h(k, name, kind, rate, terms, notes)
  on conflict do nothing;

  insert into assets.rights_records (id, project_id, title, rights_holder_id, asset_id, collection_id, external_ref, acquisition_type, ownership_share, territories, channels, window_start, window_end, exclusivity, status, notes, created_by, created_at, metadata)
  select pg_temp.sid('rights:' || r.k), pid, r.title, pg_temp.sid('holder:' || r.holder),
         case when r.asset is null then null else pg_temp.sid('asset:' || r.asset) end,
         case when r.col is null then null else pg_temp.sid('col:' || r.col) end,
         r.ref, r.acq, r.share, r.terr, r.chan, current_date + r.ws, case when r.we is null then null else current_date + r.we end,
         r.excl, r.status, r.notes, ub, now() - interval '55 days', '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc_art',   'UFC numbered event art — media partner licence', 'ufc',     null,           'ufc',    'UFC-MP-2026-118',  'licensed_in',   100.0, array['worldwide'],        array['web','social','streaming'],           -260, 100,  'non_exclusive', 'active',   'Covers all numbered-event key art we hold.'),
    ('ufc_cutout','UFC athlete likeness — cutouts',                 'ufc',     'mcgregor',     null,     'UFC-ATH-2026-044', 'licensed_in',   100.0, array['north_america','europe','uk'], array['web','social'],             -200, 18,   'non_exclusive', 'expiring', 'Advertising use needs separate athlete approval.'),
    ('ghibli',    'Studio Ghibli editorial stills',                 'ghibli',  null,           'ghibli', 'SG-ED-0931',       'licensed_in',   100.0, array['worldwide'],        array['web','print'],                        -120, 190,  'non_exclusive', 'active',   'No paid social, no merchandise, credit "© Studio Ghibli".'),
    ('pgl',       'PGL Copenhagen Major clips',                     'pgl',     'video_cph',    null,     'PGL-CPH24-07',     'licensed_in',   100.0, array['europe','north_america'], array['web','social','streaming'],      -400, -20,  'non_exclusive', 'expired',  'Window lapsed — renewal quote requested.'),
    ('nasa',      'NASA imagery',                                   'nasa',    null,           'space',  '',                 'public_domain', 100.0, array['worldwide'],        array['web','social','print','tv','streaming','packaging'], -600, null, 'non_exclusive', 'active', 'Public domain. Do not imply NASA endorsement.'),
    ('f1',        'Silverstone 2024 — CC BY 2.0',                   'commons', 'f1_verstappen',null,     'commons:24/2024_British_Grand_Prix,_Verstappen_(3)', 'licensed_in', 100.0, array['worldwide'], array['web','social','print'], -440, null, 'non_exclusive', 'active', 'Attribution: Jen Ross, CC BY 2.0.'),
    ('3dmax',     'Budapest Major 2025 — CC BY 4.0',                'commons', 'cs2_3dmax',    null,     'commons:69/3DMAX_Budapest_Major_2025', 'licensed_in', 100.0, array['worldwide'], array['web','social'], -280, null, 'non_exclusive', 'disputed', 'Sponsor marks visible — partner flagged for review before commercial use.')
  ) as r(k, title, holder, asset, col, ref, acq, share, terr, chan, ws, we, excl, status, notes)
  on conflict do nothing;

  insert into assets.licensees (id, project_id, name, contact_name, email, kind, territory, website, notes, created_by, created_at, metadata)
  select pg_temp.sid('licensee:' || l.k), pid, l.name, l.contact, null, l.kind, l.terr, l.site, l.notes, ub, now() - interval '50 days', '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('espn',     'ESPN',                  'Rights & Clearances', 'broadcaster', 'north_america', 'https://www.espn.com',        'Fight-week promo usage.'),
    ('dazn',     'DAZN',                  'Content Acquisition', 'broadcaster', 'europe',        'https://www.dazn.com',        'Topuria highlights package.'),
    ('crunchy',  'Crunchyroll',           'Editorial',           'publisher',   'worldwide',     'https://www.crunchyroll.com', 'Anime feature editorial.'),
    ('hltv',     'HLTV.org',              'Photo Desk',          'publisher',   'worldwide',     'https://www.hltv.org',        'CS2 Major photo partner.'),
    ('redbull',  'Red Bull Media House',  'Licensing',           'publisher',   'worldwide',     'https://www.redbullmediahouse.com', 'Motorsport stills.'),
    ('monster',  'Monster Energy',        'Brand Partnerships',  'brand',       'north_america', 'https://www.monsterenergy.com', 'Athlete-led advertising — needs likeness approval.')
  ) as l(k, name, contact, kind, terr, site, notes)
  on conflict do nothing;

  insert into assets.license_templates (id, project_id, name, description, usage_type, default_territories, default_channels, default_duration_months, exclusivity, restrictions, terms_body, requires_approval, status, version, position, created_by, created_at, metadata)
  select pg_temp.sid('tmpl:' || t.k), pid, t.name, t.descr, t.usage, t.terr, t.chan, t.months, t.excl, t.restr, t.body, t.appr, t.status, 1, t.pos, ub, now() - interval '48 days', '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('editorial', 'Editorial — Web & Social (12 mo)', 'Standard editorial licence for news and features.', 'editorial', array['worldwide'], array['web','social'], 12, 'non_exclusive', array['No advertising','Credit line required'], 'Licensee may reproduce the licensed assets in editorial contexts only…', false, 'active', 0),
    ('broadcast', 'Broadcast — Fight Week Promo',     'Broadcast and streaming promo usage during fight week.', 'broadcast', array['north_america','europe'], array['tv','streaming','social'], 3, 'non_exclusive', array['Event window only'], 'Licensee may broadcast the licensed assets during the promotional window…', true, 'active', 1),
    ('advert',    'Advertising — Worldwide Exclusive', 'Paid advertising, category-exclusive.', 'advertising', array['worldwide'], array['web','social','ooh','tv'], 12, 'exclusive', array['Athlete likeness approval required'], 'Licensee receives category exclusivity for paid advertising…', true, 'active', 2),
    ('merch',     'Merchandise — Poster Print Run',   'Limited poster print run.', 'merchandise', array['domestic'], array['packaging'], 6, 'sole', array['Max 5,000 units'], 'Licensee may print up to the stated run…', true, 'draft', 3)
  ) as t(k, name, descr, usage, terr, chan, months, excl, restr, body, appr, status, pos)
  on conflict do nothing;

  -- Default rate card (mirrors defaultRateCard() in pricing_engine.js)
  insert into assets.license_price_rules (id, project_id, template_id, kind, rule_key, label, multiplier, flat_cents, currency, position, is_active, created_by, created_at)
  select pg_temp.sid('price:' || p.kind || ':' || p.rkey), pid, null, p.kind, p.rkey, p.label, p.mult, p.flat, 'usd', p.pos, true, ub, now() - interval '48 days'
  from (values
    ('base','default','Standard base fee',1,50000,0),
    ('territory','worldwide','Worldwide',2.5,0,1),('territory','north_america','North America',1.6,0,2),('territory','europe','Europe',1.5,0,3),
    ('territory','uk','United Kingdom',1.2,0,4),('territory','apac','Asia-Pacific',1.4,0,5),('territory','domestic','Domestic only',1,0,6),
    ('duration','3','3 months',0.5,0,7),('duration','6','6 months',0.75,0,8),('duration','12','1 year',1,0,9),
    ('duration','24','2 years',1.75,0,10),('duration','36','3 years',2.4,0,11),('duration','0','Perpetual',4,0,12),
    ('channel','web','Web',1,0,13),('channel','social','Social',1.15,0,14),('channel','print','Print',1.25,0,15),('channel','ooh','Out of home',1.6,0,16),
    ('channel','tv','TV',1.8,0,17),('channel','streaming','Streaming',1.5,0,18),('channel','packaging','Packaging',1.45,0,19),
    ('exclusivity','non_exclusive','Non-exclusive',1,0,20),('exclusivity','sole','Sole',1.5,0,21),('exclusivity','exclusive','Exclusive',2.25,0,22)
  ) as p(kind, rkey, label, mult, flat, pos)
  on conflict do nothing;

  insert into assets.licenses (id, project_id, reference, title, template_id, licensee_id, status, usage_type, territories, channels, exclusivity, start_date, end_date, grace_days, is_perpetual, auto_renew, fee_cents, currency, price_breakdown, royalty_rate, restrictions, notes, issued_at, created_by, created_at, metadata)
  select pg_temp.sid('lic:' || l.k), pid, l.ref, l.title, pg_temp.sid('tmpl:' || l.tmpl), pg_temp.sid('licensee:' || l.licensee), l.status, l.usage, l.terr, l.chan, l.excl,
         current_date + l.s, current_date + l.e, 14, false, l.auto, l.fee, 'usd',
         jsonb_build_object('baseCents', 50000, 'multiplier', round(l.fee / 50000.0, 3), 'surchargeCents', 0, 'quantity', 1, 'currency', 'usd', 'totalCents', l.fee, 'hasRateCard', true,
           'factors', jsonb_build_array(
             jsonb_build_object('kind','territory','key',l.terr[1],'label',initcap(replace(l.terr[1],'_',' ')),'multiplier',l.m_terr,'flatCents',0),
             jsonb_build_object('kind','duration','key',l.months::text,'label',l.months || ' months','multiplier',l.m_dur,'flatCents',0),
             jsonb_build_object('kind','exclusivity','key',l.excl,'label',initcap(replace(l.excl,'_','-')),'multiplier',l.m_ex,'flatCents',0))),
         l.royalty, l.restr, l.notes, case when l.status in ('draft','pending') then null else now() - ((-l.s) || ' days')::interval end,
         ub, now() - ((greatest(-l.s, 0) + 5) || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('espn324',  'GN-2026-001', 'ESPN — UFC 324 fight-week promo',        'broadcast', 'espn',    'active',   'broadcast',   array['north_america'], array['tv','streaming','social'], 'non_exclusive', -20,  70,  false, 1850000, 1.6, 0.5, 1.0, 3,  15.0, array['Event window only'], 'Countdown promo + key art.'),
    ('dazn',     'GN-2026-002', 'DAZN — Topuria title run highlights',     'broadcast', 'dazn',    'expiring', 'broadcast',   array['europe'],        array['streaming','social'],      'non_exclusive', -165, 12,  true,  1275000, 1.5, 0.75, 1.0, 6, 15.0, array['Event window only'], 'Auto-renews unless cancelled.'),
    ('crunchy',  'GN-2026-003', 'Crunchyroll — Ghibli editorial feature',  'editorial', 'crunchy', 'active',   'editorial',   array['worldwide'],     array['web','social'],            'non_exclusive', -40,  325, false, 1437500, 2.5, 1.0, 1.0, 12, 25.0, array['No advertising','Credit line required'], '© Studio Ghibli on every placement.'),
    ('hltv',     'GN-2026-004', 'HLTV.org — CS2 Majors photo package',     'editorial', 'hltv',    'active',   'editorial',   array['worldwide'],     array['web','social'],            'non_exclusive', -10,  355, false, 1250000, 2.5, 1.0, 1.0, 12, 10.0, array['Credit line required'], 'Copenhagen + Budapest sets.'),
    ('redbull',  'GN-2025-011', 'Red Bull Media House — Silverstone 2024', 'editorial', 'redbull', 'expired',  'editorial',   array['worldwide'],     array['web','print'],             'non_exclusive', -380, -15, false, 937500,  2.5, 0.75, 1.0, 6, 0.0,  array['Credit line required'], 'Lapsed — renewal quote out.'),
    ('monster',  'GN-2026-005', 'Monster Energy — McGregor campaign',      'advert',    'monster', 'pending',  'advertising', array['north_america'], array['web','social','ooh'],      'exclusive',     7,    372, false, 3600000, 1.6, 1.0, 2.25, 12, 15.0, array['Athlete likeness approval required'], 'Awaiting athlete approval.')
  ) as l(k, ref, title, tmpl, licensee, status, usage, terr, chan, excl, s, e, auto, fee, m_terr, m_dur, m_ex, months, royalty, restr, notes)
  on conflict do nothing;

  insert into assets.license_items (id, project_id, license_id, asset_id, collection_id, rights_record_id, version_label, created_at)
  select pg_temp.sid('licitem:' || i.l || ':' || coalesce(i.a, i.c)), pid, pg_temp.sid('lic:' || i.l),
         case when i.a is null then null else pg_temp.sid('asset:' || i.a) end,
         case when i.c is null then null else pg_temp.sid('col:' || i.c) end,
         pg_temp.sid('rights:' || i.r), i.ver, now() - interval '20 days'
  from (values
    ('espn324','ufc324',null,'ufc_art','v2'),('espn324','video_ufc324',null,'ufc_art',''),('espn324','pimblett',null,'ufc_cutout',''),
    ('dazn','ufc298',null,'ufc_art','v2'),('dazn','ufc317',null,'ufc_art',''),
    ('crunchy',null,'ghibli','ghibli',''),
    ('hltv','cs2_stage',null,'pgl',''),('hltv','cs2_crowd',null,'pgl',''),('hltv','cs2_3dmax',null,'3dmax',''),
    ('redbull','f1_verstappen',null,'f1',''),
    ('monster','mcgregor',null,'ufc_cutout','v2')
  ) as i(l, a, c, r, ver)
  on conflict do nothing;

  insert into assets.license_quotes (id, project_id, licensee_id, template_id, subject, scope, computed_cents, quoted_cents, currency, status, license_id, note, created_by, created_at, metadata)
  select pg_temp.sid('quote:' || q.k), pid, pg_temp.sid('licensee:' || q.licensee), pg_temp.sid('tmpl:' || q.tmpl), q.subject, q.scope::jsonb, q.computed, q.quoted, 'usd', q.status,
         case when q.lic is null then null else pg_temp.sid('lic:' || q.lic) end, q.note, ub, now() - (q.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('monster', 'monster', 'advert',    'McGregor cutout — paid social + OOH', '{"territories":["north_america"],"channels":["web","social","ooh"],"duration":12,"exclusivity":"exclusive"}', 1800000, 3600000, 'converted', 'monster', 'Converted to GN-2026-005.', 10),
    ('redbull', 'redbull', 'editorial', 'Silverstone 2024 renewal — 12 months', '{"territories":["worldwide"],"channels":["web","print"],"duration":12,"exclusivity":"non_exclusive"}', 1250000, 1100000, 'quoted', null, 'Loyalty discount applied.', 4),
    ('pgl',     'hltv',    'broadcast', 'Copenhagen Major clips — re-licence', '{"territories":["europe","north_america"],"channels":["streaming","social"],"duration":6,"exclusivity":"non_exclusive"}', 900000, 0, 'requested', null, 'Awaiting PGL confirmation of clip list.', 2),
    ('espn331', 'espn',    'broadcast', 'UFC 331 fight-week promo',           '{"territories":["north_america"],"channels":["tv","streaming"],"duration":3,"exclusivity":"non_exclusive"}', 800000, 850000, 'accepted', null, 'Issue once UFC 331 art is final.', 1)
  ) as q(k, licensee, tmpl, subject, scope, computed, quoted, status, lic, note, age)
  on conflict do nothing;

  insert into assets.license_renewals (id, project_id, license_id, action, previous_end_date, new_end_date, fee_cents, currency, note, created_by, created_at)
  select pg_temp.sid('renewal:' || r.k), pid, pg_temp.sid('lic:' || r.lic), r.action, current_date + r.prev, case when r.next is null then null else current_date + r.next end, r.fee, 'usd', r.note, ub, now() - (r.age || ' days')::interval
  from (values
    ('redbull_lapse', 'redbull', 'lapsed',         -15, null, 0,      'Window ended without renewal.', 15),
    ('dazn_remind',   'dazn',    'reminded',        12, null, 0,      '30-day renewal reminder sent to DAZN.', 18),
    ('espn_grace',    'espn324', 'grace_extended',  56, 70,   0,      'Extended 14 days for the rescheduled co-main.', 3),
    ('crunchy_renew', 'crunchy', 'renewed',        -40, 325,  1437500,'Renewed for the spring feature.', 40)
  ) as r(k, lic, action, prev, next, fee, note, age)
  on conflict do nothing;

  -- Royalties
  insert into assets.royalty_rules (id, project_id, rights_holder_id, label, scope_kind, scope_id, rate_percent, flat_cents, minimum_guarantee_cents, recoupable, priority, is_active, created_by, created_at)
  values
    (pg_temp.sid('rule:ufc'),    pid, pg_temp.sid('holder:ufc'),    'UFC media partner share',   'collection', pg_temp.sid('col:ufc'),    15.0, 0, 0,       false, 0, true, ub, now() - interval '45 days'),
    (pg_temp.sid('rule:ghibli'), pid, pg_temp.sid('holder:ghibli'), 'Studio Ghibli editorial',   'collection', pg_temp.sid('col:ghibli'), 25.0, 0, 250000,  true,  0, true, ub, now() - interval '45 days'),
    (pg_temp.sid('rule:pgl'),    pid, pg_temp.sid('holder:pgl'),    'PGL clip share',            'rights_record', pg_temp.sid('rights:pgl'), 10.0, 0, 0,   false, 1, true, ub, now() - interval '45 days')
  on conflict do nothing;

  insert into assets.royalty_statements (id, project_id, rights_holder_id, period_start, period_end, gross_cents, royalty_cents, minimum_guarantee_cents, recouped_cents, payable_cents, currency, status, issued_at, paid_at, note, created_by, created_at)
  values
    (pg_temp.sid('stmt:ufc:q2'),    pid, pg_temp.sid('holder:ufc'),    date_trunc('quarter', current_date - interval '6 months')::date, (date_trunc('quarter', current_date - interval '3 months') - interval '1 day')::date, 2212500, 331875, 0, 0, 331875, 'usd', 'paid', now() - interval '80 days', now() - interval '60 days', 'Q-2 statement.', ub, now() - interval '82 days'),
    (pg_temp.sid('stmt:ghibli:q3'), pid, pg_temp.sid('holder:ghibli'), date_trunc('quarter', current_date - interval '3 months')::date, (date_trunc('quarter', current_date) - interval '1 day')::date, 1437500, 359375, 250000, 0, 359375, 'usd', 'issued', now() - interval '5 days', null, 'Includes minimum guarantee.', ub, now() - interval '6 days')
  on conflict do nothing;

  insert into assets.royalty_lines (id, project_id, license_id, rights_holder_id, royalty_rule_id, statement_id, basis_cents, rate_percent, amount_cents, currency, period_start, status, note, created_by, created_at)
  select pg_temp.sid('rline:' || r.k), pid, pg_temp.sid('lic:' || r.lic), pg_temp.sid('holder:' || r.holder), pg_temp.sid('rule:' || r.rule),
         case when r.stmt is null then null else pg_temp.sid(r.stmt) end, r.basis, r.rate, round(r.basis * r.rate / 100.0)::int, 'usd',
         date_trunc('month', current_date - (r.age || ' days')::interval)::date, r.status, r.note, ub, now() - (r.age || ' days')::interval
  from (values
    ('espn',    'espn324', 'ufc',    'ufc',    null,               1850000, 15.0, 'accrued',     'ESPN UFC 324 promo', 20),
    ('dazn',    'dazn',    'ufc',    'ufc',    'stmt:ufc:q2',      1275000, 15.0, 'paid',        'DAZN Topuria package', 160),
    ('crunchy', 'crunchy', 'ghibli', 'ghibli', 'stmt:ghibli:q3',   1437500, 25.0, 'statemented', 'Crunchyroll feature', 40),
    ('hltv',    'hltv',    'pgl',    'pgl',    null,               1250000, 10.0, 'accrued',     'HLTV CS2 package', 10)
  ) as r(k, lic, holder, rule, stmt, basis, rate, status, note, age)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Galleries
  -- -------------------------------------------------------------------------
  insert into assets.galleries (id, project_id, slug, name, headline, description, source_kind, collection_id, cover_asset_id, layout, theme, nav, visibility, require_email, download_mode, allow_favorites, seo, status, published_at, expires_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('gal:ufc'), pid, 'ufc-fight-week', 'UFC Fight Week — Press Gallery', 'Every numbered card, one press room.',
      'Official event art and athlete cutouts for accredited media. Request downloads for anything outside editorial.', 'collection', pg_temp.sid('col:ufc'), pg_temp.sid('asset:ufc324'),
      'masonry', '{"accent":"#ef4444","ground":"dark","typography":"sans","gap":"comfortable","radius":"rounded","caption":"overlay"}', '[]', 'public', true, 'request', true,
      '{"title":"UFC Fight Week Press Gallery","description":"Official UFC event art and athlete renders for accredited media."}', 'published', now() - interval '12 days', null, ub, now() - interval '14 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('gal:showcase'), pid, 'majors-and-motorsport', 'Majors & Motorsport Showcase', 'Stages, grids and launch pads.',
      'A curated reel across CS2 Majors, Formula 1 and NASA launches.', 'curated', null, pg_temp.sid('asset:cs2_stage'),
      'justified', '{"accent":"#f59e0b","ground":"dark","typography":"sans","gap":"tight","radius":"square","caption":"below"}', '[]', 'unlisted', false, 'open', true,
      '{"title":"Majors & Motorsport","description":"CS2 Majors, F1 and NASA in one reel."}', 'published', now() - interval '7 days', null, ud, now() - interval '9 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('gal:ghibli'), pid, 'ghibli-client-preview', 'Ghibli Stills — Client Preview', 'Editorial preview for Crunchyroll.',
      'Private preview of the licensed stills. Downloads off.', 'collection', pg_temp.sid('col:ghibli'), pg_temp.sid('asset:ghibli_howl'),
      'slideshow', '{"accent":"#10b981","ground":"light","typography":"serif","gap":"airy","radius":"rounded","caption":"below"}', '[]', 'private', true, 'off', false,
      '{}', 'draft', null, now() + interval '30 days', ug, now() - interval '3 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.gallery_items (id, project_id, gallery_id, asset_id, position, caption, is_hidden, created_by, created_at)
  select pg_temp.sid('galitem:showcase:' || g.a), pid, pg_temp.sid('gal:showcase'), pg_temp.sid('asset:' || g.a), g.pos, g.caption, g.hidden, ud, now() - interval '9 days'
  from (values
    ('cs2_stage', 0, 'PGL Major Copenhagen 2024 — main stage', false),
    ('cs2_crowd', 1, 'Copenhagen crowd on the plant', false),
    ('cs2_3dmax', 2, '3DMAX at the Budapest Major 2025', false),
    ('f1_verstappen', 3, 'Verstappen, Silverstone 2024', false),
    ('f1_hamilton', 4, 'Hamilton in red at Monza, 2025', false),
    ('nasa_artemis', 5, 'Artemis I lifts off, Nov 2022', false),
    ('nasa_pillars', 6, 'Pillars of Creation — Webb NIRCam', true)
  ) as g(a, pos, caption, hidden)
  on conflict do nothing;

  insert into assets.gallery_domains (id, project_id, gallery_id, hostname, kind, verification_token, dns_record_type, dns_record_name, dns_record_value, status, ssl_status, is_primary, verified_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('galdom:press'), pid, pg_temp.sid('gal:ufc'), 'press.geigernotes-demo.com', 'custom', 'gn-verify-press-71c2', 'CNAME', 'press', 'galleries.geiger.studio', 'active', 'issued', true, now() - interval '11 days', ub, now() - interval '12 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('galdom:show'),  pid, pg_temp.sid('gal:showcase'), 'showcase.geigernotes-demo.com', 'custom', 'gn-verify-show-19ab', 'TXT', '_geiger-verify.showcase', 'gn-verify-show-19ab', 'verifying', 'pending', false, null, ud, now() - interval '2 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.gallery_visitors (id, project_id, gallery_id, token, name, email, first_seen_at, last_seen_at, created_at)
  select pg_temp.sid('visitor:' || v.k), pid, pg_temp.sid('gal:' || v.gal), 'gn-visitor-' || v.k, v.name, v.email,
         now() - (v.first || ' days')::interval, now() - (v.last || ' hours')::interval, now() - (v.first || ' days')::interval
  from (values
    ('v1', 'ufc', 'Aoife Byrne',     'aoife.byrne@example.com',   11, 3),
    ('v2', 'ufc', 'Marcus Webb',     'marcus.webb@example.com',   9,  30),
    ('v3', 'ufc', 'Yuki Sato',       'yuki.sato@example.com',     6,  5),
    ('v4', 'ufc', 'Lena Kowalski',   'lena.k@example.com',        3,  50),
    ('v5', 'showcase', 'Rafael Costa','rafael.costa@example.com', 6,  8),
    ('v6', 'showcase', 'Priya Nair', 'priya.nair@example.com',    4,  20)
  ) as v(k, gal, name, email, first, last)
  on conflict do nothing;

  insert into assets.gallery_favorites (id, project_id, gallery_id, visitor_id, asset_id, created_at)
  select pg_temp.sid('fav:' || f.v || ':' || f.a), pid, pg_temp.sid('gal:' || f.gal), pg_temp.sid('visitor:' || f.v), pg_temp.sid('asset:' || f.a), now() - interval '2 days'
  from (values ('ufc','v1','ufc324'),('ufc','v1','pimblett'),('ufc','v2','mcgregor'),('ufc','v3','ufc298'),('ufc','v3','ufc317'),('ufc','v4','ufc324'),
               ('showcase','v5','cs2_stage'),('showcase','v5','f1_hamilton'),('showcase','v6','nasa_artemis')) as f(gal, v, a)
  on conflict do nothing;

  insert into assets.gallery_download_requests (id, project_id, gallery_id, visitor_id, scope, asset_ids, message, status, decision_note, decided_by, decided_at, created_at)
  values
    (pg_temp.sid('dlreq:1'), pid, pg_temp.sid('gal:ufc'), pg_temp.sid('visitor:v1'), 'selection', array[pg_temp.sid('asset:ufc324'), pg_temp.sid('asset:pimblett')], 'For the Irish Independent fight preview, print + web.', 'pending', '', null, null, now() - interval '5 hours'),
    (pg_temp.sid('dlreq:2'), pid, pg_temp.sid('gal:ufc'), pg_temp.sid('visitor:v2'), 'asset',     array[pg_temp.sid('asset:mcgregor')], 'Podcast thumbnail for our UFC show.', 'denied', 'Athlete likeness is not cleared for podcast artwork.', ub, now() - interval '1 day', now() - interval '2 days'),
    (pg_temp.sid('dlreq:3'), pid, pg_temp.sid('gal:ufc'), pg_temp.sid('visitor:v3'), 'selection', array[pg_temp.sid('asset:ufc298'), pg_temp.sid('asset:ufc317')], 'Topuria retrospective for a Japanese MMA magazine.', 'approved', 'Editorial only, credit UFC.', ud, now() - interval '3 days', now() - interval '4 days')
  on conflict do nothing;

  -- ~30 days of gallery traffic
  insert into assets.gallery_events (id, project_id, gallery_id, visitor_id, asset_id, kind, occurred_at, created_at)
  select pg_temp.sid('galevt:' || g), pid,
         case when pg_temp.pick('gg' || g, 3) = 0 then pg_temp.sid('gal:showcase') else pg_temp.sid('gal:ufc') end,
         pg_temp.sid('visitor:v' || (1 + pg_temp.pick('gv' || g, 6))),
         pg_temp.sid('asset:' || image_keys[1 + pg_temp.pick('ga' || g, 8)]),
         (array['view','view','view','item_view','item_view','item_view','favorite','download'])[1 + pg_temp.pick('gk' || g, 8)],
         now() - ((pg_temp.pick('gt' || g, 30 * 24)) || ' hours')::interval,
         now()
  from generate_series(1, 240) as g
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Delivery — profile, domain, keys, dynamic links, video, embeds, channels
  -- -------------------------------------------------------------------------
  insert into assets.delivery_profiles (id, project_id, cache_ttl_seconds, origin_protection, allowed_referrers, format_negotiation, status, created_by, created_at, metadata)
  values (pg_temp.sid('dprofile'), pid, 86400, 'signed', array['www.ufc.com','www.hltv.org','*.geigernotes-demo.com'], true, 'active', ub, now() - interval '40 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.delivery_domains (id, project_id, hostname, kind, verification_token, dns_record_type, dns_record_name, dns_record_value, status, ssl_status, is_primary, verified_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('ddom:cdn'), pid, 'cdn.geigernotes-demo.com', 'custom', 'gn-verify-cdn-40ef', 'CNAME', 'cdn', 'delivery.geiger.studio', 'active', 'issued', true, now() - interval '30 days', ub, now() - interval '31 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('ddom:img'), pid, 'img.geigernotes-demo.com', 'custom', 'gn-verify-img-8813', 'CNAME', 'img', 'delivery.geiger.studio', 'failed', 'error', false, null, ud, now() - interval '4 days', '{"seed":"geiger-notes-demo","lastError":"CNAME points to an old origin."}')
  on conflict do nothing;

  insert into assets.delivery_keys (id, project_id, name, prefix, key_hash, scopes, last_used_at, revoked_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('dkey:web'), pid, 'Website — headless reads', 'gd_live_Wq3x', md5('geiger-notes-demo:dkey:web'), array['assets:read','delivery:read'], now() - interval '20 minutes', null, ub, now() - interval '30 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('dkey:app'), pid, 'Fan app — embeds',          'gd_live_Pz81', md5('geiger-notes-demo:dkey:app'), array['embeds:read'], now() - interval '3 days', now() - interval '1 day', ud, now() - interval '25 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.dynamic_links (id, project_id, name, token, asset_id, transform, signed, expires_at, status, created_by, created_at, metadata)
  select pg_temp.sid('dlink:' || d.k), pid, d.name, d.token, pg_temp.sid('asset:' || d.a), d.t::jsonb, d.signed,
         case when d.exp is null then null else now() + (d.exp || ' days')::interval end, d.status, ub, now() - (d.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('ufc324_hero', 'UFC 324 — homepage hero (1600w WebP)', 'gn-dl-ufc324-hero', 'ufc324',      '{"w":1600,"h":900,"fit":"cover","format":"webp","quality":82,"dpr":1}', false, null, 'active', 10),
    ('ufc324_story','UFC 324 — Story 9:16',                 'gn-dl-ufc324-story','ufc324',      '{"w":1080,"h":1920,"fit":"cover","format":"jpg","quality":85}',          false, null, 'active', 8),
    ('f1_square',   'Hamilton Monza — IG square',           'gn-dl-f1-square',   'f1_hamilton', '{"w":1080,"h":1080,"fit":"cover","format":"auto","quality":80}',         true,  30,   'active', 6),
    ('pillars_mob', 'Pillars — mobile wallpaper',           'gn-dl-pillars-mob', 'nasa_pillars','{"w":1170,"h":2532,"fit":"cover","format":"avif","quality":70}',         false, null, 'paused', 20),
    ('ghibli_card', 'Ghibli — article card',                'gn-dl-ghibli-card', 'ghibli_howl', '{"w":1200,"h":630,"fit":"cover","format":"webp","quality":80}',          true,  -2,   'expired', 25)
  ) as d(k, name, token, a, t, signed, exp, status, age)
  on conflict do nothing;

  insert into assets.video_delivery (id, project_id, asset_id, streaming_mode, ladder, poster_asset_id, captions, signed, player, status, created_by, created_at, metadata)
  values
    (pg_temp.sid('vdel:ufc324'), pid, pg_temp.sid('asset:video_ufc324'), 'hls',
      '[{"label":"1080p","width":1920,"height":1080,"bitrateKbps":6000},{"label":"720p","width":1280,"height":720,"bitrateKbps":3000},{"label":"480p","width":854,"height":480,"bitrateKbps":1200},{"label":"360p","width":640,"height":360,"bitrateKbps":700}]',
      pg_temp.sid('asset:ufc324'), '[{"id":"cap-en","lang":"en","label":"English"},{"id":"cap-es","lang":"es","label":"Español"}]', true,
      '{"autoplay":false,"muted":false,"loop":false,"controls":true,"preload":"metadata"}', 'processing', ud, now() - interval '3 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('vdel:cph'), pid, pg_temp.sid('asset:video_cph'), 'hls',
      '[{"label":"2160p","width":3840,"height":2160,"bitrateKbps":16000},{"label":"1080p","width":1920,"height":1080,"bitrateKbps":6000},{"label":"720p","width":1280,"height":720,"bitrateKbps":3000}]',
      pg_temp.sid('asset:cs2_stage'), '[{"id":"cap-en","lang":"en","label":"English"},{"id":"cap-pt","lang":"pt","label":"Português"},{"id":"cap-ru","lang":"ru","label":"Русский"}]', false,
      '{"autoplay":true,"muted":true,"loop":true,"controls":true,"preload":"auto"}', 'ready', ub, now() - interval '38 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.embeds (id, project_id, name, kind, subject_kind, subject_id, version_mode, params, status, created_by, created_at, metadata)
  select pg_temp.sid('embed:' || e.k), pid, e.name, e.kind, e.skind, pg_temp.sid(e.skey), e.vmode, e.params::jsonb, e.status, ub, now() - (e.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('cph_player',  'Copenhagen opener — article player', 'video',  'asset',      'asset:video_cph',   'latest', '{"width":1280,"height":720}', 'active', 30),
    ('ufc_gallery', 'UFC press gallery — iframe',         'iframe', 'collection', 'col:ufc',           'latest', '{"width":1200,"height":800}', 'active', 12),
    ('pillars_img', 'Pillars — blog image',               'img',    'asset',      'asset:nasa_pillars','pinned', '{"width":800,"height":1386}', 'active', 25),
    ('ghibli_oem',  'Ghibli still — oEmbed',              'oembed', 'asset',      'asset:ghibli_spirited', 'latest', '{"width":800,"height":433}', 'paused', 15)
  ) as e(k, name, kind, skind, skey, vmode, params, status, age)
  on conflict do nothing;

  insert into assets.channels (id, project_id, name, kind, source_kind, source_id, schedule, status, created_by, created_at, metadata)
  values
    (pg_temp.sid('chan:cms'),  pid, 'Newsroom CMS — UFC event art', 'cms',       'collection', pg_temp.sid('col:ufc'),    'daily',   'active', ub, now() - interval '30 days', '{"seed":"geiger-notes-demo","endpoint":"https://cms.example.com/api/assets"}'),
    (pg_temp.sid('chan:ig'),   pid, 'Instagram — Fight Week',       'social',    'collection', pg_temp.sid('col:topuria'),'manual',  'active', ud, now() - interval '20 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('chan:shop'), pid, 'Poster Store — Shopify',       'ecommerce', 'collection', pg_temp.sid('col:space'),  'weekly',  'paused', ug, now() - interval '15 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('chan:pim'),  pid, 'Partner PIM — HLTV',           'pim',       'collection', pg_temp.sid('col:cs2'),    'manual',  'draft',  ub, now() - interval '2 days',  '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.channel_runs (id, project_id, channel_id, started_at, finished_at, status, published_count, failed_count, error, created_at)
  select pg_temp.sid('crun:' || r.k), pid, pg_temp.sid('chan:' || r.chan), now() - (r.age || ' hours')::interval,
         case when r.status = 'running' then null else now() - (r.age || ' hours')::interval + interval '47 seconds' end, r.status, r.ok, r.fail, coalesce(r.err, ''), now() - (r.age || ' hours')::interval
  from (values
    ('cms1','cms','succeeded',8,0,null,24),('cms2','cms','succeeded',8,0,null,48),('cms3','cms','failed',5,3,'CMS returned 429 — rate limited after 5 items.',72),
    ('ig1','ig','succeeded',2,0,null,100),('shop1','shop','succeeded',2,0,null,200),('cms4','cms','running',3,0,null,0)
  ) as r(k, chan, status, ok, fail, err, age)
  on conflict do nothing;

  -- ~30 days of CDN traffic (delivery_daily is rolled up by trigger)
  insert into assets.delivery_events (id, project_id, asset_id, link_id, embed_id, kind, bytes, cache_status, status_code, country, referrer_host, transform, occurred_at, created_at)
  select pg_temp.sid('devt:' || g), pid,
         pg_temp.sid('asset:' || image_keys[1 + pg_temp.pick('da' || g, array_length(image_keys, 1))]),
         case when k = 'dynamic' then pg_temp.sid('dlink:' || (array['ufc324_hero','ufc324_story','f1_square'])[1 + pg_temp.pick('dl' || g, 3)]) end,
         case when k = 'embed' then pg_temp.sid('embed:' || (array['ufc_gallery','pillars_img'])[1 + pg_temp.pick('de' || g, 2)]) end,
         k, 40000 + pg_temp.pick('db' || g, 900000),
         (array['hit','hit','hit','hit','miss','revalidated'])[1 + pg_temp.pick('dc' || g, 6)],
         case when pg_temp.pick('ds' || g, 50) = 0 then 404 else 200 end,
         countries[1 + pg_temp.pick('dn' || g, array_length(countries, 1))],
         referrers[1 + pg_temp.pick('dr' || g, array_length(referrers, 1))],
         case when k = 'dynamic' then '{"w":1080,"format":"webp"}'::jsonb else '{}'::jsonb end,
         now() - ((pg_temp.pick('dt' || g, 30 * 24 * 60)) || ' minutes')::interval,
         now()
  from generate_series(1, 900) as g
  cross join lateral (select (array['file','file','file','dynamic','dynamic','embed','video'])[1 + pg_temp.pick('dk' || g, 7)] as k) as kk
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Platform — API keys, webhooks, exports
  -- -------------------------------------------------------------------------
  insert into assets.api_keys (id, project_id, name, prefix, key_hash, scopes, last_used_at, expires_at, revoked_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('apikey:cms'),    pid, 'Newsroom CMS sync',  'gk_live_N3wS', md5('geiger-notes-demo:apikey:cms'),    array['assets:read','collections:read','delivery:read'], now() - interval '2 hours', null, null, ub, now() - interval '30 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('apikey:ingest'), pid, 'Portal ingest bot',  'gk_live_1nG5', md5('geiger-notes-demo:apikey:ingest'), array['assets:write','upload:write','folders:read'],     now() - interval '1 day',   now() + interval '60 days', null, ud, now() - interval '18 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('apikey:old'),    pid, 'Legacy site (2025)', 'gk_live_0lDx', md5('geiger-notes-demo:apikey:old'),    array['assets:read'], now() - interval '70 days', null, now() - interval '40 days', ub, now() - interval '200 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.webhook_endpoints (id, project_id, name, url, description, events, status, signing_secret, created_by, created_at, metadata)
  values
    (pg_temp.sid('hook:slack'), pid, 'Slack — #fight-week',   'https://hooks.example.com/services/fight-week', 'Pings the desk when key art is approved.', array['asset.approved','review.completed','share.created'], 'active', 'whsec_' || md5('geiger-notes-demo:hook:slack'), ub, now() - interval '28 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('hook:cms'),   pid, 'Newsroom CMS ingest',   'https://cms.example.com/webhooks/geiger',       'Pushes new uploads into the CMS media library.', array['asset.created','asset.updated','asset.deleted'], 'active', 'whsec_' || md5('geiger-notes-demo:hook:cms'), ud, now() - interval '20 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('hook:old'),   pid, 'Legacy archive mirror', 'https://archive.example.com/hook',              'Paused while the archive is migrated.', array['asset.created'], 'paused', 'whsec_' || md5('geiger-notes-demo:hook:old'), ub, now() - interval '90 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.webhook_deliveries (id, project_id, endpoint_id, event, payload, status, attempt_count, response_code, error, duration_ms, created_at)
  select pg_temp.sid('hookdel:' || g), pid,
         case when pg_temp.pick('he' || g, 2) = 0 then pg_temp.sid('hook:slack') else pg_temp.sid('hook:cms') end,
         (array['asset.created','asset.updated','asset.approved','review.completed','share.created'])[1 + pg_temp.pick('hv' || g, 5)],
         jsonb_build_object('projectId', pid, 'assetId', pg_temp.sid('asset:' || image_keys[1 + pg_temp.pick('ha' || g, array_length(image_keys, 1))])),
         (array['delivered','delivered','delivered','delivered','failed','queued'])[1 + pg_temp.pick('hs' || g, 6)],
         1 + pg_temp.pick('hn' || g, 3),
         (array[200,200,200,200,500,null])[1 + pg_temp.pick('hs' || g, 6)],
         case when pg_temp.pick('hs' || g, 6) = 4 then 'Endpoint responded 500 — will retry with backoff.' else '' end,
         80 + pg_temp.pick('hd' || g, 900),
         now() - ((pg_temp.pick('ht' || g, 14 * 24 * 60)) || ' minutes')::interval
  from generate_series(1, 36) as g
  on conflict do nothing;

  insert into assets.export_runs (id, project_id, format, scope_type, scope_id, scope_label, options, status, file_count, total_bytes, error, created_by, created_at, metadata)
  values
    (pg_temp.sid('export:ufc'),  pid, 'zip',  'collection', pg_temp.sid('col:ufc'), 'UFC Numbered Events — Key Art', '{"fields":["name","format","tags"]}', 'completed', 8, 16110000, '', ub, now() - interval '9 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('export:csv'),  pid, 'csv',  'project',    null, 'Whole project',  '{"fields":["name","type","format","folder","status","tags","sizeBytes"]}', 'completed', 20, 18432, '', ud, now() - interval '3 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('export:json'), pid, 'json', 'folder',     pg_temp.sid('folder:space_nasa'), '/Space/NASA', '{"fields":["name","description","tags"]}', 'failed', 0, 0, 'Export timed out while reading the 123MP original.', ub, now() - interval '1 day', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Workflows + run history
  -- -------------------------------------------------------------------------
  insert into assets.workflows (id, project_id, name, description, status, trigger, scope, collection_id, steps, graph, view_mode, run_count, last_run_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('wf:fightart'), pid, 'Tag & route incoming fight art', 'Tag new images from the photographer portal and send them to Creative review.', 'Active', 'asset.uploaded', 'workspace', null,
      '[{"kind":"trigger","type":"asset.uploaded","config":{}},{"kind":"condition","type":"if.asset_type","config":{"assetType":"Image"}},{"kind":"action","type":"tag.add","config":{"tag":"fight-week"}},{"kind":"action","type":"review.request","config":{"assignee":"editors"}}]',
      '{}', 'canvas', 5, now() - interval '3 hours', ub, now() - interval '25 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('wf:publish'), pid, 'Publish approved to CDN', 'When an asset is approved, turn on delivery and notify the newsroom.', 'Active', 'asset.approved', 'collection', pg_temp.sid('col:ufc'),
      '[{"kind":"trigger","type":"asset.approved","config":{}},{"kind":"action","type":"rendition.generate","config":{"preset":"web"}},{"kind":"action","type":"cdn.publish","config":{}}]',
      '{}', 'canvas', 3, now() - interval '1 day', ub, now() - interval '20 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.workflow_runs (id, workflow_id, project_id, trigger, status, started_at, finished_at, duration_ms, steps_total, steps_completed, error, context, steps_log, created_at)
  select pg_temp.sid('wfrun:' || r.k), pg_temp.sid('wf:' || r.wf), pid, r.trig, r.status,
         now() - (r.age || ' hours')::interval, case when r.status = 'Running' then null else now() - (r.age || ' hours')::interval + (r.ms || ' milliseconds')::interval end,
         r.ms, r.total, r.done, r.err, jsonb_build_object('asset', r.asset_name, 'actor', r.actor), r.log::jsonb, now() - (r.age || ' hours')::interval
  from (values
    ('f1', 'fightart', 'asset.uploaded', 'Success', 3,   1840, 4, 4, null, 'UFC 324 — Gaethje vs Pimblett · Event Art.jpg', n_d,
      '[{"type":"asset.uploaded","label":"Asset uploaded","status":"Success","durationMs":12},{"type":"if.asset_type","label":"Is an image","status":"Success","durationMs":4},{"type":"tag.add","label":"Tag fight-week","status":"Success","durationMs":220},{"type":"review.request","label":"Request Creative review","status":"Success","durationMs":1604}]'),
    ('f2', 'fightart', 'asset.uploaded', 'Skipped', 60,  30,   4, 2, null, 'ufc324_countdown_master.mp4', n_d,
      '[{"type":"asset.uploaded","label":"Asset uploaded","status":"Success","durationMs":10},{"type":"if.asset_type","label":"Is an image","status":"Skipped","durationMs":20}]'),
    ('f3', 'fightart', 'asset.uploaded', 'Success', 96,  2110, 4, 4, null, 'Arman Tsarukyan — Full-Body Cutout.png', n_g,
      '[{"type":"asset.uploaded","label":"Asset uploaded","status":"Success","durationMs":9},{"type":"if.asset_type","label":"Is an image","status":"Success","durationMs":3},{"type":"tag.add","label":"Tag fight-week","status":"Success","durationMs":301},{"type":"review.request","label":"Request Creative review","status":"Success","durationMs":1797}]'),
    ('f4', 'fightart', 'asset.uploaded', 'Failed',  144, 5020, 4, 3, 'Reviewer group "editors" has no active members.', 'UFC 331 — Van vs Pantoja 2 · Event Art.jpg', n_g,
      '[{"type":"asset.uploaded","label":"Asset uploaded","status":"Success","durationMs":11},{"type":"if.asset_type","label":"Is an image","status":"Success","durationMs":5},{"type":"tag.add","label":"Tag fight-week","status":"Success","durationMs":260},{"type":"review.request","label":"Request Creative review","status":"Failed","durationMs":4744,"error":"Reviewer group \"editors\" has no active members."}]'),
    ('f5', 'fightart', 'asset.uploaded', 'Running', 0,   0,    4, 2, null, '3DMAX_Budapest_Major_2025.jpg', n_g,
      '[{"type":"asset.uploaded","label":"Asset uploaded","status":"Success","durationMs":8},{"type":"if.asset_type","label":"Is an image","status":"Success","durationMs":4},{"type":"tag.add","label":"Tag fight-week","status":"Running","durationMs":0}]'),
    ('p1', 'publish',  'asset.approved', 'Success', 24,  6420, 3, 3, null, 'UFC 298 — Volkanovski vs Topuria · Event Art.jpg', n_b,
      '[{"type":"asset.approved","label":"Asset approved","status":"Success","durationMs":6},{"type":"rendition.generate","label":"Generate web rendition","status":"Success","durationMs":5310},{"type":"cdn.publish","label":"Publish to CDN","status":"Success","durationMs":1104}]'),
    ('p2', 'publish',  'asset.approved', 'Success', 26,  5980, 3, 3, null, 'UFC 317 — Topuria vs Oliveira · Event Art.jpg', n_b,
      '[{"type":"asset.approved","label":"Asset approved","status":"Success","durationMs":7},{"type":"rendition.generate","label":"Generate web rendition","status":"Success","durationMs":4870},{"type":"cdn.publish","label":"Publish to CDN","status":"Success","durationMs":1103}]'),
    ('p3', 'publish',  'asset.approved', 'Failed',  200, 30000, 3, 1, 'Rendition timed out after 30s (123MP source).', 'Pillars of Creation — JWST NIRCam.jpg', n_b,
      '[{"type":"asset.approved","label":"Asset approved","status":"Success","durationMs":6},{"type":"rendition.generate","label":"Generate web rendition","status":"Failed","durationMs":29994,"error":"Rendition timed out after 30s (123MP source)."}]')
  ) as r(k, wf, trig, status, age, ms, total, done, err, asset_name, actor, log)
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Creator — Fight Night Fan Club
  -- -------------------------------------------------------------------------
  insert into assets.membership_tiers (id, project_id, name, description, price_cents, currency, interval, is_free, is_active, position, perks, created_by, created_at, metadata)
  values
    (pg_temp.sid('tier:free'),    pid, 'Fight Fan',          'Free tier — weekly card previews and public galleries.', 0,     'usd', 'month', true,  true,  0, '["Weekly card previews","Public galleries"]', ub, now() - interval '60 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('tier:octagon'), pid, 'Octagon Pass',       'Fight-week wallpapers and early event art.',             999,   'usd', 'month', false, true,  1, '["Early event art","4K wallpapers","Members-only polls"]', ub, now() - interval '60 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('tier:main'),    pid, 'Main Card',          'Everything in Octagon Pass plus BTS photo sets and PPV discounts.', 2499, 'usd', 'month', false, true, 2, '["BTS photo sets","20% off PPV","Monthly Q&A"]', ub, now() - interval '60 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('tier:title'),   pid, 'Title Shot (Annual)','Annual pass — all PPV sets unlocked and signed print raffle.', 19900, 'usd', 'year', false, true, 3, '["All PPV unlocked","Signed print raffle","Priority DMs"]', ub, now() - interval '60 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('tier:major'),   pid, 'Major Pass',         'CS2 Major weekends — stage shots and player cards.',    699,   'usd', 'month', false, false, 4, '["Major stage shots","Player cards"]', ud, now() - interval '30 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.members (id, project_id, fan_name, fan_email, status, total_spent_cents, last_seen_at, created_by, created_at, metadata)
  select pg_temp.sid('member:' || m.k), pid, m.name, m.email, m.status, m.spent, now() - (m.seen || ' hours')::interval, ub, now() - (m.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('m01', 'Ciarán Doyle',     'ciaran.doyle@example.com',   'active',    54800, 2,   58),
    ('m02', 'Nino Beridze',     'nino.b@example.com',         'active',    19900, 6,   40),
    ('m03', 'Jake Morrison',    'jake.m@example.com',         'active',    12495, 30,  45),
    ('m04', 'Sofía Hernández',  'sofia.h@example.com',        'trialing',  0,     4,   5),
    ('m05', 'Hayk Petrosyan',   'hayk.p@example.com',         'active',    29970, 12,  50),
    ('m06', 'Liam Walsh',       'liam.w@example.com',         'past_due',  4995,  200, 70),
    ('m07', 'Mei Tanaka',       'mei.t@example.com',          'active',    9990,  20,  33),
    ('m08', 'Oskar Lindqvist',  'oskar.l@example.com',        'cancelled', 2097,  900, 90),
    ('m09', 'Tom Hughes',       'tom.h@example.com',          'active',    24990, 1,   28),
    ('m10', 'Spambot 3000',     'spam@example.com',           'blocked',   0,     2000,100)
  ) as m(k, name, email, status, spent, seen, age)
  on conflict do nothing;

  insert into assets.subscriptions (id, project_id, member_id, tier_id, status, current_period_start, current_period_end, trial_end, cancel_at_period_end, created_by, created_at)
  select pg_temp.sid('sub:' || s.m), pid, pg_temp.sid('member:' || s.m), pg_temp.sid('tier:' || s.tier), s.status,
         now() - (s.days_in || ' days')::interval, now() - (s.days_in || ' days')::interval + case when s.tier = 'title' then interval '1 year' else interval '1 month' end,
         case when s.status = 'trialing' then now() + interval '9 days' end, s.cancel, ub, now() - (s.age || ' days')::interval
  from (values
    ('m01','title','active',20,false,58),('m02','title','active',35,false,40),('m03','main','active',12,false,45),('m04','octagon','trialing',5,false,5),
    ('m05','main','active',8,true,50),('m06','octagon','past_due',33,false,70),('m07','octagon','active',3,false,33),('m08','main','cancelled',60,true,90),('m09','main','active',15,false,28)
  ) as s(m, tier, status, days_in, cancel, age)
  on conflict do nothing;

  insert into assets.ppv_posts (id, project_id, title, teaser_text, asset_id, price_cents, currency, status, unlock_count, revenue_cents, published_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('ppv:ufc324'),  pid, 'UFC 324 fight-week — behind the scenes', 'Weigh-ins, face-offs and the walkout tunnel — 48 frames.', pg_temp.sid('asset:ufc324'),  499, 'usd', 'published', 4, 1996, now() - interval '10 days', ud, now() - interval '11 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('ppv:topuria'), pid, 'Topuria title run — unseen frames',     'Two belts, two divisions, never-published angles.',          pg_temp.sid('asset:ufc317'),  799, 'usd', 'published', 3, 2397, now() - interval '30 days', ub, now() - interval '31 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('ppv:cph'),     pid, 'Copenhagen Major — backstage',          'Player lounge and stage prep from the Royal Arena.',          pg_temp.sid('asset:cs2_stage'),399, 'usd', 'draft',     0, 0,    null,                      ug, now() - interval '2 days',  '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.ppv_unlocks (id, project_id, ppv_post_id, member_id, price_cents, unlocked_at, created_at)
  select pg_temp.sid('unlock:' || u.p || ':' || u.m), pid, pg_temp.sid('ppv:' || u.p), pg_temp.sid('member:' || u.m), u.price, now() - (u.age || ' days')::interval, now() - (u.age || ' days')::interval
  from (values ('ufc324','m01',499,9),('ufc324','m03',499,8),('ufc324','m05',499,6),('ufc324','m09',499,2),('topuria','m02',799,28),('topuria','m05',799,20),('topuria','m07',799,15)) as u(p, m, price, age)
  on conflict do nothing;

  insert into assets.paid_messages (id, project_id, member_id, body, attachment_asset_id, price_cents, currency, status, sent_at, unlocked_at, created_by, created_at, metadata)
  select pg_temp.sid('msg:' || m.k), pid, pg_temp.sid('member:' || m.m), m.body, pg_temp.sid('asset:' || m.a), m.price, 'usd', m.status,
         case when m.status = 'draft' then null else now() - (m.age || ' days')::interval end,
         case when m.status = 'unlocked' then now() - ((m.age - 1) || ' days')::interval end, ub, now() - (m.age || ' days')::interval, '{"seed":"geiger-notes-demo"}'::jsonb
  from (values
    ('pm1', 'm01', 'Signed-print raffle winner preview 👀', 'mcgregor', 299, 'unlocked', 6),
    ('pm2', 'm09', 'UFC 324 clean plate in 4K — for your lock screen.', 'ufc324', 199, 'locked', 2),
    ('pm3', 'm05', 'Tsarukyan render before anyone else.', 'tsarukyan', 199, 'unlocked', 3),
    ('pm4', 'm06', 'Your Octagon Pass is past due — here''s a free wallpaper while you update.', 'ufc298', 0, 'expired', 20),
    ('pm5', 'm02', 'Title Shot exclusive: Topuria double-champ print.', 'ufc317', 499, 'draft', 1)
  ) as m(k, m, body, a, price, status, age)
  on conflict do nothing;

  insert into assets.tips (id, project_id, member_id, target_type, target_id, amount_cents, currency, note, status, created_at)
  select pg_temp.sid('tip:' || t.k), pid, pg_temp.sid('member:' || t.m), t.target,
         case when t.target = 'post' then pg_temp.sid('ppv:ufc324') end, t.amount, 'usd', t.note, t.status, now() - (t.age || ' days')::interval
  from (values
    ('t1','m01','post',   1000, 'Best BTS set yet.',             'succeeded', 9),
    ('t2','m09','profile', 500, 'Keep the Pimblett content coming', 'succeeded', 3),
    ('t3','m05','post',    300, 'Tsarukyan > everyone',          'succeeded', 5),
    ('t4','m03','profile',2500, 'For the Monza set 🏎️',          'succeeded', 12),
    ('t5','m07','profile', 200, '',                              'pending',   1),
    ('t6','m06','profile', 500, 'Chargeback',                    'refunded',  25)
  ) as t(k, m, target, amount, note, status, age)
  on conflict do nothing;

  insert into assets.payouts (id, project_id, period_start, period_end, gross_cents, fees_cents, net_cents, status, destination, paid_at, created_by, created_at, metadata)
  values
    (pg_temp.sid('payout:1'), pid, date_trunc('month', now() - interval '2 months'), date_trunc('month', now() - interval '1 month') - interval '1 second', 142300, 14230, 128070, 'paid',       'Bank ••••4821', now() - interval '45 days', ub, now() - interval '50 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('payout:2'), pid, date_trunc('month', now() - interval '1 month'), date_trunc('month', now()) - interval '1 second',                     188450, 18845, 169605, 'paid',       'Bank ••••4821', now() - interval '15 days', ub, now() - interval '20 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('payout:3'), pid, date_trunc('month', now()),                      now(),                                                                96120,  9612,  86508,  'processing', 'Bank ••••4821', null,                      ub, now() - interval '1 day',   '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.promo_codes (id, project_id, code, kind, percent_off, amount_off_cents, duration_months, max_redemptions, redeemed_count, expires_at, is_active, created_by, created_at, metadata)
  values
    (pg_temp.sid('promo:fw'),    pid, 'FIGHTWEEK25', 'discount',   25,   null, 3,    500, 3, now() + interval '10 days', true,  ub, now() - interval '12 days', '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('promo:major'), pid, 'MAJORTRIAL',  'trial',      null, null, 1,    200, 1, now() + interval '30 days', true,  ud, now() - interval '8 days',  '{"seed":"geiger-notes-demo"}'),
    (pg_temp.sid('promo:oct'),   pid, 'OCTAGON1',    'free_month', null, null, 1,    100, 0, now() - interval '5 days',  false, ub, now() - interval '40 days', '{"seed":"geiger-notes-demo"}')
  on conflict do nothing;

  insert into assets.promo_redemptions (id, project_id, promo_id, member_id, subscription_id, redeemed_at, created_at)
  select pg_temp.sid('redeem:' || r.p || ':' || r.m), pid, pg_temp.sid('promo:' || r.p), pg_temp.sid('member:' || r.m), pg_temp.sid('sub:' || r.m), now() - (r.age || ' days')::interval, now() - (r.age || ' days')::interval
  from (values ('fw','m03',11),('fw','m07',6),('fw','m09',4),('major','m04',5)) as r(p, m, age)
  on conflict do nothing;

  raise notice 'geiger_notes_demo: seeded project %', pid;
end
$seed$;
