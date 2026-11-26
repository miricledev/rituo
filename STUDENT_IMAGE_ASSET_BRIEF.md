# Inner Performance Student Image Asset Brief

## Purpose

This brief maps original image opportunities to the current webapp. The goal is to make the product feel more engaging for secondary-school students without making planning, habit completion, safeguarding, or school data harder to understand.

The two language-tutor hero paths are already wired into the UI. All other items are implementation-ready recommendations and should be added in priority order after the final artwork is approved. The visual direction is a distinctive IP animated universe: bold, cartoony and expressive, while remaining original rather than copying the character design of an existing television series.

## Non-Negotiable Art Direction

Use this paragraph at the start of every image prompt below:

> Create one original premium 2D cartoon illustration for Inner Performance Key Protocols (IPKP), a private UK secondary-school performance and personal-development platform for students aged 13–18. Build a distinctive modern animated-school universe with bold clean outlines, expressive faces and poses, simplified geometric character shapes, layered cel shading, subtle texture, cinematic composition and polished lighting. Aim for the energy and readability of a high-quality prime-time animated comedy, but do not imitate The Simpsons or any other existing programme: no yellow skin, copied facial proportions, recognisable character silhouettes, duplicated backgrounds or borrowed visual trademarks. Use the Inner Performance palette: deep navy #081023, violet #6D28D9, cyan #22D3EE and amber #F59E0B, with restrained rose accents. Make it optimistic, aspirational, humorous in small details and age-appropriate without looking childish. Show an inclusive mix of original teenage characters without identifying a real person, school or location. Preserve the requested negative space exactly.

### IP Character and Uniform System

Apply these instructions whenever a student or staff member appears:

> Every student belongs to the same fictional Inner Performance academy and wears a consistent modern IP uniform: a deep navy varsity-style school jacket or smart overshirt, violet and cyan piping, a clean white or charcoal base layer, dark tailored trousers or an appropriate knee-length skirt, and small amber details. Keep clothing practical, inclusive and non-gendered where possible. Place the official Inner Performance logo as a small embroidered badge on the left chest of the outer layer. Use the supplied `client/src/assets/ip-logo.jpg` as an image reference and reproduce that supplied badge faithfully rather than inventing a replacement logo. The badge must remain subtle and must not become the focal point. If the image system cannot preserve the supplied logo accurately, leave a clean circular badge patch on the left chest so the real logo can be overlaid during asset finishing. Staff should wear coordinated professional navy clothing with the same small badge, but must remain visually distinct adults. Do not place logos on every object in the scene.

### Export Rules

- Generate at the requested pixel size or the nearest larger size with the same aspect ratio.
- Export hero and scene artwork as high-quality WebP at roughly 80–88% quality.
- Keep the source PNG before conversion.
- Do not add words to raster artwork; React overlays all labels accessibly.
- The only permitted lettering is the official supplied IP chest badge. Do not generate additional slogans, school names or fake branding.
- Attach `client/src/assets/ip-logo.jpg` as a visual reference whenever the generator supports reference images.
- Prefer one clearly visible, accurate chest badge over several distorted miniature logos.
- Test each image at desktop and mobile crops before replacing the gradient fallback.
- Keep essential faces, hands, and objects away from crop edges.
- The existing IP logo remains the only logo. Do not ask an image model to redraw it.

## Priority 0 — Tutor Selection Screens

These two assets are already referenced by `LanguageTutorTool.jsx`. Until the files exist, the screen safely falls back to its gradient treatment.

### 1. GCSE Spanish Tutor Hero

- **Path:** `client/public/images/tutors/spanish-gcse-hero.webp`
- **Canvas:** 2400 × 1600 px, 3:2
- **Crop use:** Right 48% of a wide desktop hero; hidden on small screens
- **Safe area:** Keep the entire left 45% calm and low-detail. Put the main student and learning objects in the right 40%.
- **Prompt after the art-direction paragraph:**

> Show a confident but approachable mixed group of original cartoon IP students practising Spanish through floating conversational phrase cards, a notebook, vocabulary tiles, and subtle visual references to travel, culture, food, sport and everyday life. Give each character a strongly readable silhouette, expressive eyebrows, energetic hand gestures and a distinct personality while keeping the shared IP uniform consistent. Include one small humorous background detail, such as a confused vocabulary card rearranging itself, without distracting from the learning. Do not use national stereotypes, flags, monuments as the main subject, or readable words. Use warmer amber, rose and violet light, with cyan accents that suggest instant intelligent feedback. Include one clear visual moment where an incorrect phrase tile transforms into a corrected phrase tile using abstract marks rather than letters. The students should look actively involved and curious, not posed for a school brochure. Keep the left 45% dark, atmospheric and uncluttered for white heading text; concentrate faces and objects on the right.

### 2. GCSE French Tutor Hero

- **Path:** `client/public/images/tutors/french-gcse-hero.webp`
- **Canvas:** 2400 × 1600 px, 3:2
- **Crop use:** Right 48% of a wide desktop hero; hidden on small screens
- **Safe area:** Keep the entire left 45% calm and low-detail. Put the main student and learning objects in the right 40%.
- **Prompt after the art-direction paragraph:**

> Show an inclusive pair or small group of original cartoon IP students practising French with floating sentence-building tiles, a notebook, verb-pattern shapes, and subtle visual references to communication, travel, neighbourhoods, study and popular culture. Give each character a strongly readable silhouette, expressive eyebrows, energetic hand gestures and a distinct personality while keeping the shared IP uniform consistent. Include one small humorous background detail, such as a stubborn verb tile being pulled into the correct order, without distracting from the learning. Do not use national stereotypes, flags, or readable words. Use cooler blue and indigo lighting with refined rose and cyan accents. Visualise helpful AI marking as a clean transformation from a rough phrase tile to a polished corrected tile using symbols and colour rather than text. The scene should feel focused, intelligent and conversational. Keep the left 45% dark, atmospheric and uncluttered for white heading text; concentrate faces and objects on the right.

## Priority 1 — Highest Student Impact

### 3. Student Workspace Hero

- **Target screen:** Student dashboard and school overview
- **Path:** `client/public/images/student/student-workspace-hero.webp`
- **Canvas:** 2400 × 1000 px, 12:5
- **Safe area:** Left 52% for the welcome message and current-school details; main figures on the right.
- **Prompt:**

> Show three diverse original cartoon IP students moving through an abstract performance pathway made of five clean visual stations: a habit checkpoint, a five-day planner, a goal marker, an earned reward coin, and a calm focus space. Give the characters expressive movement and slightly exaggerated but original poses, with their consistent IP uniforms immediately establishing the app world. Use visual continuity so the stations feel like one personal journey rather than separate app icons. Place the students and bright focal elements on the right half. Leave the left 52% as a deep navy-to-violet atmospheric field with very low detail for dashboard copy. No readable labels or interface panels.

### 4. My Day Timeline Empty State

- **Target screen:** No habits due or no habits assigned in `StudentChecklistSection.jsx`
- **Path:** `client/public/images/student/my-day-ready.webp`
- **Canvas:** 1400 × 900 px, 14:9
- **Safe area:** Centre-weighted; must survive a square mobile crop.
- **Prompt:**

> Show one expressive original cartoon IP student at the beginning of a positive day, viewing an abstract chronological path that moves from wake-up through school, a focused habit, movement, and evening wind-down. Use a confident morning pose and a small humorous detail such as a sleepy alarm shape becoming alert, while keeping the scene focused. The path should contain clean clock-like circles and completion glows but no numbers or text. Communicate calm readiness rather than pressure. Keep the outer 15% low-detail and make the central subject readable when cropped to a square.

### 5. Five-Day Planner Introduction

- **Target screen:** Planner help or first-use state in `DailyHabitPlanner.jsx`
- **Path:** `client/public/images/planner/five-day-planner-intro.webp`
- **Canvas:** 1800 × 1100 px, 18:11
- **Safe area:** Main visual centred; allow a 4:3 crop.
- **Prompt:**

> Show a polished isometric five-column weekly planning surface viewed at a slight angle. Use abstract colour-coded blocks for school lessons, attack habits, defence habits, periodic habits, sleep, reminders and one-off appointments. Clearly show overlapping blocks splitting the available vertical space rather than covering each other. Include a student hand moving one time block within the same day, never across days. No words, dates, numbers, logos or imitation of Google Calendar. Make the system feel flexible but disciplined.

### 6. IP Tools Hub Hero

- **Target screen:** `StudentToolsHub.jsx`
- **Path:** `client/public/images/tools/ip-tools-hub.webp`
- **Canvas:** 2400 × 1000 px, 12:5
- **Safe area:** Left 55% for heading and tool count; tool worlds on the right.
- **Prompt:**

> Create a connected cartoon constellation of six performance-tool worlds on the right: focused study, age-appropriate movement, guided meditation, a focus timer, Spanish language practice and French language practice. Show one original IP-uniformed student interacting with the worlds through an expressive action pose. Connect them with subtle cyan energy paths, suggesting that consistency unlocks capability. Keep the left 55% dark and low-detail for white UI copy. Avoid literal app icons, readable screens or floating words.

### 7. IP Shop and Rewards Scene

- **Target screen:** `StudentRewardsPage.jsx` and shop first-use state
- **Path:** `client/public/images/rewards/ip-shop-hero.webp`
- **Canvas:** 2000 × 1200 px, 5:3
- **Safe area:** Left 45% for balance and explanation; rewards displayed on the right.
- **Prompt:**

> Show an original cartoon IP student opening a premium digital rewards locker earned through consistency, with glowing abstract IP Buck coins, alternative IP-uniform accessories, headphones, a subtle aura effect, a backpack accessory and portals to performance tools. Use an excited but controlled facial expression and playful animated reactions from the accessories. Make it unmistakably an earned in-app collection, not gambling, loot boxes, shopping with real money, or cryptocurrency. Put the character and rewards display on the right and leave the left 45% calm for balance information and safeguarding copy. No currency symbols, price tags or text beyond the supplied chest badge.

### 8. Meditation Lounge Cover

- **Target screen:** Meditation library and player
- **Path:** `client/public/images/tools/meditation-lounge.webp`
- **Canvas:** 1920 × 1080 px, 16:9
- **Safe area:** Central breathing circle remains unobstructed; student offset to lower-right.
- **Prompt:**

> Create a quiet cartoon Inner Performance meditation environment with one original IP-uniformed student seated comfortably, fully clothed, in a safe calm posture. Use softened outlines and restrained facial expression while preserving the same animated character universe. Centre a luminous cyan-violet breathing circle surrounded by soft concentric ripples, with an abstract horizon suggesting attention returning to one point. Use warm amber light near the horizon for hope and recovery. Leave the exact centre visually clean enough for an animated breathing timer overlay. Avoid spiritual or religious symbols, therapy claims, candles, or sleep imagery that suggests the student is unconscious.

### 9. Study Planner Tool Hero

- **Target screen:** Study Planner Pro setup in `AiPlanTools.jsx`
- **Path:** `client/public/images/tools/study-planner-hero.webp`
- **Canvas:** 1800 × 1200 px, 3:2
- **Safe area:** Student and desk on right; form content on left.
- **Prompt:**

> Show an expressive original cartoon IP student transforming a comically untidy but believable pile of revision materials into a clear seven-day pathway of short study blocks, checkpoints, active-recall cards and recovery breaks. Visualise organisation emerging from complexity without showing readable subjects or a real exam paper. Include a calm evening boundary and balanced free-time space so the scene does not glorify overwork. Concentrate the student and brighter objects on the right; keep the left 45% quiet for setup fields.

### 10. AI Fitness Coach Hero

- **Target screen:** Fitness Coach setup in `AiPlanTools.jsx`
- **Path:** `client/public/images/tools/fitness-coach-hero.webp`
- **Canvas:** 1800 × 1200 px, 3:2
- **Safe area:** Movement scene on right; form content on left.
- **Prompt:**

> Show an inclusive group of original cartoon IP students completing safe, scalable general-fitness movements such as a controlled squat to a bench, wall press, light resistance-band row and relaxed mobility. Adapt the IP uniform into coordinated school-activewear with the same navy, violet, cyan and amber system and one accurate small chest badge. Use expressive movement while preserving correct neutral technique, plenty of personal space and supportive energy. No heavy weights, body comparison, weight-loss imagery, sports supplements, military intensity or revealing clothing. Place movement on the right and keep the left 45% calm for the AI coach questionnaire.

## Priority 2 — Motivation and Community

### 11. Friendly Leaderboard Scene

- **Target screen:** Daily and weekly competition explanation
- **Path:** `client/public/images/competition/friendly-league.webp`
- **Canvas:** 1600 × 900 px, 16:9
- **Prompt:**

> Show several diverse original cartoon IP students progressing up parallel illuminated paths toward personal checkpoints, with two compact podium-like progress markers suggesting daily and weekly effort. Use expressive friendly rivalry, including characters encouraging one another, while their matching IP uniforms make them feel part of one community. Communicate friendly competition and consistency rather than winners humiliating losers. No ranking numbers, trophies dominating the scene, crowds, score text or aggressive sports imagery. Keep the centre clear enough for two small leaderboard cards to overlay.

### 12. Class Community Hero

- **Target screen:** Student class list and class community chat
- **Path:** `client/public/images/school/class-community.webp`
- **Canvas:** 1800 × 1200 px, 3:2
- **Prompt:**

> Show a safe cartoon digital class community where an original adult IP staff character and diverse IP-uniformed secondary students collaborate around subject cards, a lesson schedule and moderated message bubbles. Use expressive reactions and conversational poses, while making the adult clearly an adult and the students clearly teenagers in a professional school context. Show positive group discussion without readable messages, personal data, profile photographs or another school logo. Use connected cyan lines to suggest one secure school workspace.

### 13. Teacher Desk Hero

- **Target screen:** `TeacherDesk.jsx`
- **Path:** `client/public/images/teacher/teacher-desk-hero.webp`
- **Canvas:** 2400 × 1000 px, 12:5
- **Safe area:** Left 52% for operational copy; adult teacher and class signals on right.
- **Prompt:**

> Show an original cartoon adult IP teacher calmly coordinating a class register, student support signals, behaviour notes and lesson priorities through abstract panels with no readable data. Use professional coordinated navy clothing with violet and cyan trim and the supplied small IP badge. The teacher should look organised, expressive and attentive, not overwhelmed. Include a subtle path from class-level information to one supportive intervention moment. Keep all detailed subjects on the right half and the left 52% dark and uncluttered for page headings.

### 14. Landing Platform Hero

- **Target screen:** Logged-out landing hero in `Landing.jsx`
- **Path:** `client/public/images/landing/private-school-platform.webp`
- **Canvas:** 2560 × 1440 px, 16:9
- **Safe area:** Left 50% for headline and calls to action; school ecosystem on right.
- **Prompt:**

> Show one secure connected cartoon school ecosystem with an original adult IP administrator, an adult IP teacher and several IP-uniformed secondary students each seeing a role-appropriate abstract workspace. Give the cast distinct expressive personalities while maintaining one coherent original animated universe. Weave together habits, goals, five-day planning, student performance insight, classes, rewards and responsible AI assistance. Use a subtle protective boundary around the ecosystem to communicate private authorised school software without padlock clichés. Place the ecosystem on the right and keep the left 50% deep navy with very low detail for the landing headline.

### 15. Login Focus Panel

- **Target screen:** Desktop split panel in `Login.jsx`
- **Path:** `client/public/images/auth/login-focus-panel.webp`
- **Canvas:** 1600 × 2000 px, 4:5 portrait
- **Safe area:** Keep the upper-left quiet for brand copy; one student centred lower-right.
- **Prompt:**

> Show one original cartoon IP-uniformed secondary student stepping from a distracted field of scattered shapes into a clear illuminated pathway containing a goal marker, schedule block and completed habit signal. Use a strong expressive transition from mild distraction to calm determination, not anxiety. Use a portrait composition with the student in the lower-right and a dark low-detail upper-left area for authentication copy. No phone screen, passwords, biometric graphics or readable interface.

### 16. Mind. Heart. Gut. Affirmation Background

- **Target screen:** Full-screen affirmation gate after login
- **Path:** `client/public/images/onboarding/mind-heart-gut-gate.webp`
- **Canvas:** 2560 × 1440 px, 16:9
- **Safe area:** Centre 40% must remain calm for logo, affirmations and Enter button.
- **Prompt:**

> Create an abstract performance landscape expressing Mind, Heart and Gut as three connected energies: focused cyan clarity, warm rose-violet purpose and grounded amber instinct. Let the three streams converge into one subtle path toward a bright horizon. Do not draw anatomical brains, hearts or organs. Keep the central 40% dark, calm and low-detail for the IP logo and affirmation sequence, with visual energy around the outer edges.

## Priority 3 — Empty States

These should be used sparingly at roughly 220–360 CSS pixels wide. They must never replace an actionable explanation or button.

### 17. No School Yet

- **Path:** `client/public/images/empty-states/no-school.webp`
- **Canvas:** 1200 × 900 px, 4:3
- **Prompt:**

> Show a student avatar at the entrance to a softly illuminated secure school workspace, with an adult administrator preparing an invitation path in the distance. Communicate that access is waiting to be provisioned, not that the student has failed. Keep the centre clear for an overlaid “ask your school administrator” message. No closed padlocks, rejection symbols or readable text.

### 18. No Active Challenge

- **Path:** `client/public/images/empty-states/no-challenge.webp`
- **Canvas:** 1200 × 900 px, 4:3
- **Prompt:**

> Show a calm performance track between completed and upcoming stages, with the current section intentionally resting and softly lit. Include a student avatar reviewing goals while waiting for the next challenge to begin. Communicate recovery and preparation rather than emptiness or failure. Keep the central lower area clear for dates and guidance.

### 19. No Habits Assigned

- **Path:** `client/public/images/empty-states/no-habits.webp`
- **Canvas:** 1200 × 900 px, 4:3
- **Prompt:**

> Show an empty but inviting habit pathway with several unfilled attack, defence and periodic habit slots, while an adult coach or teacher prepares the first card off to one side. The student should look ready rather than confused. Use simple geometric habit symbols, no readable labels, and preserve the centre for the page explanation and next action.

### 20. No Meditation Sessions

- **Path:** `client/public/images/empty-states/no-meditations.webp`
- **Canvas:** 1200 × 900 px, 4:3
- **Prompt:**

> Show a quiet empty meditation lounge with a dormant breathing circle and soft horizon light, suggesting that guided sessions will appear here after publication. Keep the mood hopeful and calm rather than lonely. No person is necessary. Preserve the centre for an availability message.

## Optional Class Subject Card Set

Use only if classes are later shown as visual cards. Generate all five with identical camera, lighting and framing so the set feels coherent. Each file is 1200 × 800 px, 3:2, with the main objects centred and no people required.

- `client/public/images/subjects/stem.webp` — abstract experiment glassware, geometry, circuit and data forms; no hazardous experiment.
- `client/public/images/subjects/languages.webp` — conversational shapes, travel journal and language-building tiles; no flags or readable words.
- `client/public/images/subjects/humanities.webp` — map contours, timeline forms, civic building silhouettes and archival layers; no political symbols.
- `client/public/images/subjects/creative-arts.webp` — colour, rhythm, stage light, camera and design forms; no copied artwork.
- `client/public/images/subjects/sport-wellbeing.webp` — movement arcs, ball, running track curve and calm recovery shapes; no body comparison.

Append this scene sentence to the shared art-direction paragraph for each file, then add:

> Compose this as a premium subject-category cover with bold depth, one clear focal cluster, quiet corners for UI badges, no text and no recognisable brand or institution.

## Where Images Should Not Be Added

- Do not place decorative artwork inside the five-day planner grid; it would reduce time and overlap readability.
- Do not add large illustrations to My Day when habits are present; the chronological habit timeline must remain the focus.
- Do not use student portraits in performance statistics, colour charts, registers, safeguarding notes or admin tables.
- Do not replace the generated SVG IP Avatar with raster characters. Its custom colours, equipment and expressions need to remain code-driven.
- Do not decorate password packs, CSV review tables, account management, timetable editors or AI confirmation dialogs.
- Do not use imagery as the only indicator of attack, defence, periodic, completed, locked or unavailable states.

## Recommended Production Order

1. Spanish and French tutor heroes.
2. Student Workspace and IP Tools Hub heroes.
3. Planner introduction, Meditation Lounge and IP Shop.
4. Study Planner and Fitness Coach setup scenes.
5. Landing, login and affirmation artwork.
6. Class, teacher and leaderboard scenes.
7. Empty states only after real empty-state frequency is measured.

## Integration Checklist

- Add explicit `width` and `height` attributes when each image is wired into React to reduce layout shift.
- Use meaningful alt text only when the image adds information; use `alt=""` for decorative heroes.
- Keep the existing gradient behind every image as a loading and failure fallback.
- Use `object-position` per breakpoint so faces and focal objects are never cropped awkwardly.
- Lazy-load below-the-fold images; do not lazy-load the landing or first visible dashboard hero.
- Keep each WebP hero preferably below 350 KB and each card/empty-state image below 180 KB.
- Run contrast checks against all overlaid copy in light and dark mode.
