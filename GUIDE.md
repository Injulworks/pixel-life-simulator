# Pixel Life Simulator: Reverse-Engineering Guide, Master Prompt, Specification and Reference Code

**Turn a list of daily activity logs into a playable, shareable, vertical pixel-art "day in the life" video.**

Version 1.0 · License: MIT (use it, change it, sell it, give it away) · All names, people and data in this document are fictional.

---

## Table of contents

1. How to use this document
2. What you are building
3. The master prompt (copy and paste into an AI coding assistant)
4. Follow-up prompt kit (customization prompts)
5. Product specification
6. Tech stack and why
7. Architecture
8. Data model
9. The deterministic engine
10. The world: grid, rooms, furniture, walking
11. Characters: look, poses, adding, editing, removing
12. The animation system
13. Cameras and views
14. Comic and manga effects, points cards
15. Pacing: speed, pause, "fit to N seconds"
16. Merged scenes (one scene for a cluster of logs)
17. Photo, video and audio frames
18. Sound and music
19. Recording to a video file
20. Embedding in a native mobile app
21. Testing
22. Customization cookbook (22 recipes)
23. Lessons learned: bugs that cost days, and how to avoid them
24. Roadmap ideas
25. Full reference implementation (one HTML file, runs as is)
26. Test files (node): rules and headless simulation
27. License

---

## 1. How to use this document

There are three ways to use it.

1. **Just run it.** Section 25 is a complete, working, single-file game. Copy it into `pixel-life-sim.html`, open it in any modern browser (Chrome, Safari, Edge, Firefox), press **Play the day**. No server, no build step, no libraries.
2. **Rebuild it with an AI assistant.** Paste the master prompt from section 3 into an AI coding assistant. It contains the full intent, the rules, the module list and the acceptance tests, so the assistant can build the whole thing from nothing. Then use the prompt kit in section 4 to customize.
3. **Learn and extend by hand.** Sections 7 to 19 explain how every part works; section 22 gives step by step recipes for the changes people most often want (a new character, a new room, a new activity, a new camera, a new effect, a new data source).

Every claim in this guide was taken from a working build. Where the reference code is smaller than the full design (for example it ships 4 camera views, the full design has 12), the text says so and shows how to grow it.

---

## 2. What you are building

A small game engine with one job: **take a list of things a person did today and act it out as a short animated film.**

- Input: a list of "logs", for example `07:00 Breakfast`, `08:00 Deep work 2 h`, `15:00 Workout 30 min`, `22:30 Sleep`.
- Output: a 9:16 vertical animation, 20 to 60 seconds long, that you can watch, pause, speed up, replay, or record as a video for social media.
- The star is a pixel-art character who walks through a small house, sits at the desk, lifts weights, eats, talks on the phone, goes for a walk. Points appear as comic-style cards. A camera moves between isometric, side, face and full-room shots with a smooth zoom.

Why it works as a product:

- **Video first.** Nothing is overlaid on the picture while it plays, so a screen recording is already a finished clip.
- **Honest.** The scene is generated from real logs. The character never does something that was not logged, and never has company that was not logged.
- **Cheap to make.** All art is drawn in code with rectangles. No image files, no sprite sheets, no licences to buy.
- **Moddable.** Characters, rooms, furniture, activities, cameras and effects are all plain data plus small functions.

### The three golden rules (build these in from day one)

1. **Never invent another person.** An activity is the hero alone, unless the activity itself requires someone or the log names someone. A person on a phone call is a small panel, never a body in the room.
2. **Same input, same scene.** The part that decides who is in a scene and what it looks like (the engine) has no clock and no randomness, so it can be unit tested and replayed.
3. **Playing is a preview.** The player never writes logs, points or rewards. It only reads them.

---

## 3. The master prompt

Copy everything between the lines into an AI coding assistant (Claude, GPT, Gemini, a local model; anything that can write a lot of code). It is deliberately long, because a short prompt produces a toy.

> ---
> **ROLE.** You are a senior game-and-graphics engineer. Build a complete, dependency-free, single-page web app called **Pixel Life Simulator**.
>
> **GOAL.** The app takes a list of daily activity logs and acts the day out as a short animated film starring one pixel-art hero. It must be good enough that a screen recording is a finished vertical (9:16) social-media video.
>
> **HARD RULES (never break these).**
> 1. Never invent another person. The hero is alone unless the activity requires someone or the log names them. People on a phone call are shown only as a small "on the phone" panel, never in the room. If a call names nobody, show a faceless caller.
> 2. Deterministic engine: a pure function `resolve(request)` decides who is in the scene. No `Date`, no `Math.random`, no DOM. Same input gives the same output. It must run unchanged in node.
> 3. Playing a scene never writes data. The resolved instance carries `ledgerWrite: false`.
> 4. Everything is drawn in code on one `<canvas>` (360 by 640 logical pixels). No image assets, no external libraries, no network.
> 5. While a scene plays and while recording, nothing is overlaid on the picture except the small in-canvas HUD (clock, score, caption). The control bar hides itself.
> 6. Camera changes use ONLY a zoom in or zoom out (with a short fade). No wipes, no clouds, no fire.
> 7. Every point or penalty card slides in, holds for about 2.4 real seconds, fades out and is removed. A card must never stay on screen indefinitely.
>
> **TECH.** HTML5 canvas 2D, plain JavaScript (ES2020), one file. Isometric world on a 14 by 10 grid (tile 28 by 14 px). Flat 2D camera views are drawn into a band of the canvas using a 48 by 32 unit picture grid.
>
> **WORLD.** Five rooms (bedroom, study, kitchen, living room, gym nook), a catalog of furniture (type, colour, height, optional "use anchor" where a person sits or lies), a list of placed items, a door cell for leaving the house. Walking uses A* on the grid with furniture as obstacles.
>
> **CHARACTERS.** A table of looks (shirt, pant, hair, skin colour; flags: cap, beard, long hair, glasses, kid). A figure is drawn from a handful of rectangles chosen by pose: `idle, walk, sit, type, read, eat, phone, calling, lie, lift, cheer, talk`. A kid is the same figure at 0.72 scale. Adding a character must need only one new row in the looks table.
>
> **ANIMATION.** Game clock `gt` advances by `dt * speed * boost`. Provide `wait(seconds, token)`, `until(predicate, token)`, `waitReal(seconds, token)` and `cancelAll()`; all pending waits reject with `"cancel"` when the token is cancelled. Movement primitives: `walkTo(actor, cell)`, `glide(actor, x, y, z, duration)`, `useAt(actor, furnitureType, pose, seconds)`, `goOut(group)`, `comeHome(group)`. Each activity is one `async` function written with those primitives.
>
> **ACTIVITIES.** At least: work, read, screen-time scroll (penalty), eat (hero may share the table with a partner or child), workout, phone call (remote people), walk outdoors (leave and return), family time, sleep.
>
> **CAMERAS.** `ISOMETRIC`, `SIDE`, `FULL_ROOM`, `FACE_CLOSEUP` at minimum (the full design has 12: isometric, side, front, rear, over-the-shoulder, first-person, first-person hands, face close-up, upper body, full room, split screen, cinematic zoom). In every flat view, draw ONLY the people the running scene actually moves (the cast), never everybody who happens to be at home. Provide a "suggested views" mode that cycles 2 or 3 views per activity.
>
> **EFFECTS.** Floating comic words ("KA-CHING!", "PUMP!") with a black outline and a small scale pop; spark particles; screen shake on a penalty; points cards as described in rule 7.
>
> **PACING.** Speed 1x, 2x, 3x; tap the canvas to pause. A **Fit N seconds** mode (30, 45, 60) squeezes the whole day into N real seconds: equal slice per scene (minimum 1.8 s so it can be seen), highlights first when there are too many scenes (the rest are counted silently so the score is still exact), a speed boost that ramps during a scene so it ends inside its slice, a hard cut at 1.5x the slice that still pays out any rewards exactly once.
>
> **FREE PLAY.** A mode where tapping the floor walks the hero there and tapping furniture makes him use it. Nothing is logged.
>
> **RECORDING.** A Record button using `canvas.captureStream(30)` and `MediaRecorder`, preferring MP4 then WebM, downloading the file when the day ends.
>
> **UI.** Mobile first, dark theme, controls: Play the day, Fit 30 s, camera select, speed select, Free play, Record. Large touch targets. Works at 375 px wide.
>
> **SAMPLE DATA.** Ten fictional logs for one day, all rewards as `{label, pts}`, including one negative.
>
> **TESTS.** Provide a node script that extracts the pure engine and the fit planner from the HTML and asserts: a solo activity never gains a person; a named person is refused for a solo activity; phone people are REMOTE; the `family` group expands to partner + child only; identical input gives identical JSON; `ledgerWrite` is false; fit plans never exceed their budget and keep the highest-point scenes.
>
> **DELIVERABLES.** One `pixel-life-sim.html` and one `engine.test.js`. Comment the code in plain English. Then explain, in a short README, how to add a character, a room, a furniture type, an activity, a camera and an effect.
>
> **PROCESS.** Work in this order and run the test after each step: (1) engine + tests, (2) world + A*, (3) figure drawing, (4) clock + waits, (5) activities, (6) isometric view, (7) flat views + zoom transition, (8) effects + cards, (9) fit mode, (10) free play, (11) recording. After step 11, play the sample day in fit-30 mode and report the elapsed seconds and final score.
> ---

---

## 4. Follow-up prompt kit

Paste these one at a time after the first build works. Each is self-contained.

1. **New character.** "Add a character called `coach` (tall, grey hair, red tracksuit, whistle). Add one row to `LOOKS`, allow `coach` as optional in `workout`, add a test that `work` refuses him, and show the diff only."
2. **New room and furniture.** "Add a balcony room at x 14..17, y 0..4 with a plant and a bench. The bench must have a `use` anchor so a person can sit. Extend `GW` accordingly and re-centre `OX`. Keep A* working."
3. **New activity.** "Add `cook` (kitchen, SOLO). Script: walk to the counter, chop for 3 s, walk to the stove, stir for 3 s, carry a plate to the table. Add a `SUG` entry with 3 views and a comic word."
4. **New camera.** "Add a `TOP_DOWN` view: draw the floor plan, rooms as coloured rectangles, people as dots with their initial. Use the zoom transition. Add it to the camera select and to the suggested views for `walk`."
5. **New pose.** "Add pose `stretch` to `figure()`: arms up and out, body leaning back slightly, 2 s loop. Use it in `workout` before lifting."
6. **Effects pack.** "Add halftone dots behind the points cards, a `!` mark above the head when an activity starts, and a page-turn border on each card. Do not draw anything while paused except the card."
7. **Real data.** "Replace `DAY` with a loader that reads a JSON file `[{time:'07:00', type:'meal', title:'Breakfast', minutes:20, people:['partner'], points:5}]`, maps `type` to an activity id with a table, and rejects unknown types with a visible warning."
8. **Merged scenes.** "Merge meals within 60 minutes, workouts within 120 minutes into one scene with an `items` list, and show the items collected on a card at the end of the scene."
9. **Photo frame.** "Let a log have `media: [{kind:'photo', url}]`. After the scene, pop a rounded frame out of the hero (not the screen centre), hold 2.5 s with a slow zoom, then shrink back into him."
10. **Share.** "Add a share button that records the canvas for the length of the day and calls `navigator.share({files})` when available, else downloads."

---

## 5. Product specification

### 5.1 Functional requirements

| ID | Requirement |
|----|-------------|
| F1 | Load a day (list of logs). Each log has an id, a start time in minutes, an activity type, a title, optional minutes, optional named people, a list of rewards `{label, pts}`. |
| F2 | Resolve each log to a scene instance: environment, cast (local or remote), camera plan. Unknown activities and unknown or disallowed people are refused with a reason, never silently changed. |
| F3 | Play the scene with an async animation script on a shared game clock. |
| F4 | Show points as cards that expire (about 2.4 real seconds), a running score and a clock. |
| F5 | Provide speed 1x/2x/3x and pause (tap). Pause freezes the game clock, not the page. |
| F6 | Provide camera modes: fixed view, or suggested views for each activity. Switch with a zoom. |
| F7 | Provide Fit N seconds (30/45/60). |
| F8 | Provide free play (walk and use furniture, nothing logged). |
| F9 | Provide recording to a video file. |
| F10 | Provide replay at the end of the day. |

### 5.2 Non-functional requirements

- 60 fps on a mid-range phone; the whole world is under 300 draw calls per frame.
- Cold start under 1 second (no assets to load).
- Total size under 60 KB for the reference build (the full design is about 200 KB of JavaScript).
- Works offline.
- Accessible controls: every button has a text label, 40 px minimum height.
- Deterministic engine, 100 percent unit tested.
- No personal data leaves the device. There is no network code at all.

### 5.3 Out of scope (on purpose)

3D engines, physics, sprite sheets, networking, accounts, ads.

---

## 6. Tech stack and why

| Layer | Choice | Why |
|-------|--------|-----|
| Rendering | HTML5 Canvas 2D | Runs everywhere, can be recorded with `captureStream`, no GPU feature gaps. |
| Language | Plain JavaScript (ES2020) | No build step; one script tag per module is enough. The reference is one file. |
| Art | Rectangles, polygons, ellipses | Pixel look, tiny size, trivially re-colourable, no art licences. |
| Pathfinding | A* on a grid | Furniture is a handful of rectangles; A* with 4-neighbours is plenty. |
| Animation | `async/await` over a game clock | A script reads like a story: walk, sit, type, wait, stand. Cancelling is one token. |
| Audio | Web Audio oscillators | No sound files; blips and a tiny synthesised tune. |
| Video | `MediaRecorder` + `canvas.captureStream` | Built into browsers; MP4 where supported, WebM elsewhere. |
| Tests | Plain node + `assert` | The engine is pure, so no test framework is needed. |
| Packaging | One HTML file, or a folder loaded by a native WebView | Offline, trivial to ship in an app. |

Things deliberately NOT used: Unity/Godot/Phaser (heavy, and hard to record cleanly), SpriteKit, WebGL (not needed), React (the UI is a handful of buttons), any CDN.

---

## 7. Architecture

### 7.1 Layers

```
   data (logs)             rules                    time                    drawing
 +--------------+     +--------------+       +----------------+      +------------------+
 | DAY[] logs   | --> |  ENGINE      | -->   | scripts (ACT)  | -->  | views (ISO,flat) |
 | JSON / API   |     |  resolve()   |       | walkTo/useAt   |      | figure(), box()  |
 +--------------+     |  pure, no DOM|       | wait/until     |      | effects, HUD     |
                      +--------------+       | gt clock       |      +------------------+
                             |               +----------------+               |
                             v                       ^                          v
                       cast + env             frame loop (rAF)            canvas -> screen
                                                      |                   canvas -> MediaRecorder
                                              speed / boost / pause
```

### 7.2 Modules (the full design splits them into files; the reference keeps them in one file in this order)

1. **Constants**: canvas size, grid size, tile size, origin.
2. **Characters**: `LOOKS`, `ACTORS`.
3. **World**: `ROOMS`, `CAT` (furniture catalog), `ITEMS`, `DOOR`.
4. **Grid + A***.
5. **Engine**: `ENGINE.resolve`.
6. **Time**: `gt`, `speed`, `boost`, `wait`, `until`, `waitReal`, `cancelAll`, `pump`.
7. **Movement**: `walkTo`, `glide`, `useAt`, `goOut`, `comeHome`, `stepActors`.
8. **Activity scripts**: `ACT`.
9. **Data**: `DAY`.
10. **Rewards and cards**.
11. **Day player**: `playLog`, `runDay`, `fitPlan`, `quietApply`.
12. **Drawing**: iso helpers, `figure`, `drawIso`, `drawFlat`, camera + zoom transition.
13. **Effects and HUD**.
14. **Main loop**.
15. **Sound**.
16. **UI**.

### 7.3 Load order rule (full multi-file design)

Classic `<script>` tags share one global scope, so top-level `const` and `let` names must be unique across files. Use this order:
`art → engine → transitions → game → views → camera-picker → player → media → ui → inline`.
The engine file must not touch the DOM so that it also loads in node and in a native test runner (JavaScriptCore).

### 7.4 The frame

```
requestAnimationFrame(now):
  dt      = min(0.1, (now - last)/1000)
  boost   = fit ramp (if fit mode is running a scene)
  gt     += dt * speed * boost          (speed = 0 while paused)
  pump()                                resolve waits whose time came, reject cancelled ones
  stepActors(dt)                        follow paths, advance glides
  draw view (with zoom transition if switching)
  draw effects, cards, HUD
```

Everything that "takes time" in a script is a promise resolved by `pump()`. That is the whole trick: scripts read like a story, and pause, speed and cancel work for free.

---

## 8. Data model

All shapes are plain JSON so they can come from a file, a database or an API.

### 8.1 Log (the input)

```json
{
  "sid": "l6",                 // stable id of the log
  "min": 900,                  // start time in minutes after midnight
  "act": "workout",            // activity id, must exist in ENGINE.ACTIVITIES
  "title": "Strength, 30 min", // shown as the caption
  "minutes": 30,               // optional, used by merged scenes
  "people": ["friend"],        // optional, character ids or group shortcuts
  "rewards": [{ "label": "Workout done", "pts": 20 }],
  "media": []                  // optional photos, clips, audio for this log
}
```

### 8.2 Character look

```json
{ "name": "Alex", "shirt": "#35569a", "pant": "#1d2540", "hair": "#17141a", "skin": "#c98d5f",
  "cap": true, "beard": true, "long": false, "glasses": false, "kid": false }
```

### 8.3 Activity definition (engine)

```json
{ "name": "Meal", "env": "kitchen", "interaction": "WITH", "optional": ["partner","child","friend"] }
```

`interaction` is one of:
- `SOLO`: the hero alone. Naming anyone is refused.
- `WITH`: named people from `optional` join in the room.
- `PHONE`: named people are on the line (remote panel). Nobody named gives a faceless `caller`.

### 8.4 Resolved scene instance (engine output)

```json
{ "activityId": "eat", "env": "kitchen",
  "cast": [ {"id":"hero","presence":"LOCAL","role":"PROTAGONIST"},
            {"id":"partner","presence":"LOCAL","role":"WITH"} ],
  "ledgerWrite": false }
```

### 8.5 Scene plan (user choices before playing)

```js
const PLAN = {
  off:   new Set(),   // scene ids the viewer removed
  secs:  {},          // sid -> minimum seconds on screen
  cams:  {},          // sid -> [{view, seconds}] up to 3 shots chosen by the viewer
  cine:  {},          // sid -> false for a plain scene (no bars, no light sweep)
  media: {},          // sid -> [{kind, src}]
  trans: {}           // sid -> "none" | "zoomin" | "zoomout"
};
```

### 8.6 Furniture catalog entry

```js
bed: { color: "#5b7bd5", height: 8, use: { ax: 1.0, ay: 1.4, z: 9, dir: "S" } }
//   ax, ay: where on the item (in cells) the person's feet land; z: pixels above the floor; dir: facing
```

---

## 9. The deterministic engine

The engine answers one question: **who is in this scene, and where does it happen?** It is a pure function.

```js
const ENGINE = (() => {
  const CHARACTERS = { hero: {}, partner: {}, child: {}, mentor: {}, friend: {} };
  const GROUPS = { family: ["partner", "child"] };          // a shortcut, never a character itself
  const ACTIVITIES = {
    work:  { name: "Deep work", env: "study",   interaction: "SOLO",  optional: [] },
    eat:   { name: "Meal",      env: "kitchen", interaction: "WITH",  optional: ["partner","child","friend"] },
    call:  { name: "Phone call",env: "living",  interaction: "PHONE", optional: ["partner","mentor","friend"] }
  };
  function resolve(req) {
    const def = ACTIVITIES[req.activityId];
    if (!def) return { ok: false, rejected: [{ id: null, reason: "UNKNOWN_ACTIVITY" }] };
    const cast = [{ id: "hero", presence: "LOCAL", role: "PROTAGONIST" }], rejected = [];
    const named = []; (req.people || []).forEach(p => (GROUPS[p] || [p]).forEach(x => named.push(x)));
    for (const id of named) {
      if (!CHARACTERS[id]) { rejected.push({ id, reason: "UNKNOWN_CHARACTER" }); continue; }
      if (id === "hero" || cast.some(c => c.id === id)) continue;
      if (!def.optional.includes(id)) { rejected.push({ id, reason: "NOT_ALLOWED_FOR_ACTIVITY" }); continue; }
      cast.push({ id, presence: def.interaction === "PHONE" ? "REMOTE" : "LOCAL",
                  role: def.interaction === "PHONE" ? "CALLER" : "WITH" });
    }
    if (def.interaction === "PHONE" && !cast.some(c => c.presence === "REMOTE"))
      cast.push({ id: "caller", presence: "REMOTE", role: "CALLER" });   // never an invented person
    return { ok: true, rejected, instance: { activityId: req.activityId, env: def.env, cast, ledgerWrite: false } };
  }
  return { ACTIVITIES, resolve };
})();
```

Design decisions worth copying:

- **Refuse, never repair.** If a log says `work` with `partner`, the partner is rejected with a reason. A silent "fix" would make the film lie.
- **Groups are shortcuts.** `family` expands to exactly `partner` + `child`. Adding a third family member means editing `GROUPS`, nothing else.
- **A phone call never becomes a visit** and a visit never becomes a call. Remote people never get a body in the room.
- **Stable ids, never display names.** Rename "Alex" to anything without breaking data.
- **Sequences of camera shots** also live in the engine (the full design stores `cameraSequence` per activity) so tests can check that an unsupported view is refused.

The same file can add a tiny natural-language parser: split a sentence into keywords (`"lunch with Sam"` becomes `eat` + `partner`), then run the same `resolve()` so the same safety checks apply. Parsers are allowed to be dumb; the resolver is not.

---

## 10. The world: grid, rooms, furniture, walking

### 10.1 Coordinates

The world is a `GW x GH` grid (14 x 10). Cell `(x, y)` projects to the screen with:

```js
const P = (x, y, z = 0) => [ (x - y) * TW / 2 + OX, (x + y) * TH / 2 + OY - z ];
```

`z` is pixels above the floor. Painters algorithm: draw things sorted by `x + y` (plus a small bias for a person standing on furniture).

### 10.2 Rooms

```js
const ROOMS = [
  { id: "bed", n: "Bedroom", x: 0, y: 0, w: 5, h: 5, floor: "#8f7a6a" }, ...
];
```

Rooms are labels and floor colours. Walls are drawn as two back walls only (the front stays open so the camera sees inside). For doors and inner walls keep an "edge blocked" set and test it inside A* (the full design does this).

### 10.3 Furniture

Items are boxes: `box(x, y, w, h, z0, z1, colour)` paints three faces (top, left, right) with the left face at 78 percent brightness and the right at 60 percent. A one-line `shade(hex, factor)` produces the colours. Flat items (`mat`, `rug`) have `flat: true`: they are drawn first and do not block walking.

### 10.4 Walking

```js
async function walkTo(a, cell, tk) {
  const path = astar(cellOf(a), cell); if (!path) throw "nopath";
  a.path = path.map(c => [c[0] + .5, c[1] + .5]);
  await until(() => a.path.length === 0, tk);
}
```

`stepActors(dt)` moves each actor toward the first waypoint at 2.7 cells per second (kids 3.0), sets `dir` from the direction, and sets `pose = "walk"`.

### 10.5 Using furniture: `useAt`

1. Find the free cell next to the item nearest the person (`approach`).
2. `walkTo` that cell.
3. `glide` onto the item's anchor (`CAT[type].use`), 0.5 s with smoothstep easing.
4. Set the pose (`type`, `eat`, `lie`, `lift`...), wait the requested seconds.
5. Unless `stay: true`, glide back to the approach cell and go idle.

Anchors are the secret of a convincing result: the person's feet land at `item.x + ax, item.y + ay, z`.

### 10.6 Leaving and returning

`goOut(group)` walks everyone to the door cell then hides them (`alpha = 0`). `comeHome(group)` teleports them to the door and walks them in. A walk scene is `goOut → wait → comeHome`; the flat views show a scrolling street while the person is out.

---

## 11. Characters

### 11.1 The look table

```js
const LOOKS = {
  hero:    { name: "Alex",  shirt: "#35569a", pant: "#1d2540", hair: "#17141a", skin: "#c98d5f", cap: true, beard: true },
  partner: { name: "Sam",   shirt: "#c0504d", pant: "#a84540", hair: "#17141a", skin: "#c98f65", long: true },
  child:   { name: "Kid",   shirt: "#ff7eb6", pant: "#c94f90", hair: "#2b1d14", skin: "#d9a27b", long: true, kid: true },
  mentor:  { name: "Mentor",shirt: "#eef0f4", pant: "#3a3f55", hair: "#d8d8d8", skin: "#c08a62", glasses: true },
  friend:  { name: "Friend",shirt: "#2f8f6b", pant: "#2b3140", hair: "#17141a", skin: "#c98f65" }
};
```

Each flag adds one or two rectangles in `figure()`: `cap` (a cap and a brim), `beard`, `long` (hair falling past the shoulder), `glasses`, `kid` (0.72 scale, slightly faster walking).

### 11.2 How a figure is drawn

A figure is about 12 rectangles. `figure(x, y, look, pose, t, scale, flip)` receives the feet position `(x, y)` and picks a layout by pose:

| Pose | Layout |
|------|--------|
| `idle` | Standing; tiny vertical bob `sin(t*2)*0.35`. |
| `walk` | Legs swing `sin(t*9)*2.2`, body bobs `abs(sin(t*9))*0.8`. |
| `sit` | Thigh rectangle forward + shin down, torso shorter. |
| `type` | Sit + forearm forward + small laptop rectangle. |
| `read` | Sit + book rectangle in hands. |
| `eat` | Sit + hand moves up and down at the mouth (`sin(t*6)`). |
| `phone` | Sit + phone in hand. |
| `calling` | Stand + arm raised to the ear. |
| `lie` | Everything horizontal (head, torso, legs in a row). |
| `lift` | Stand + both arms up and down with a barbell line, `abs(sin(t*5))*7`. |
| `cheer` | Stand + both arms straight up. |
| `talk` | Stand + one forearm moving. |

All drawing is `fillRect` with rounded coordinates, so the pixels stay crisp. A soft ellipse shadow sits under the feet. `flip = -1` mirrors the figure for facing west or north.

### 11.3 Add a character (5 minutes)

1. Add a row to `LOOKS`:
   ```js
   coach: { name: "Coach", shirt: "#d2402f", pant: "#222a3a", hair: "#9aa0a6", skin: "#b9805a", whistle: true },
   ```
2. A new flag needs a new line in `figure()`, in the head section:
   ```js
   if (L.whistle) R(-1, hy + 8.5, 2, 2, "#e8e8e8");
   ```
3. Register the actor (the loop that creates `ACTORS` does it automatically from `LOOKS`).
4. Allow the character in the engine: add `"coach"` to `CHARACTERS` and to the `optional` list of the activities he can join (for example `workout`).
5. If he can also appear as a caller, he needs nothing more; the remote panel draws him from `LOOKS`.
6. Add one test: `work` with `coach` is refused; `workout` with `coach` has him LOCAL.

### 11.4 Edit a character

- **Colours:** change the hex values. That is all.
- **Proportions:** the numbers in `figure()` are in "units" (1 unit = 1 canvas pixel at scale 1). Make the torso taller by changing `-20` and `11` in the standing branch, the head by changing `hy` and the `7, 7` size.
- **Outfits per activity:** make the look a function: `lookFor(id, activity)` returns `{...LOOKS[id], shirt: "#eee"}` when `activity === "sleep"`. Call it where `figure()` is called.
- **Seasons / themes:** keep a second table `LOOKS_WINTER` and merge by theme.
- **Skin tones and hair:** both are single hex values; add presets as small arrays and pick by index.
- **Kid and elder variants:** `kid: true` scales 0.72. For an elder add `stoop: true` and lower the head by 1.5 units, add `cane` as a rectangle in the right hand for the walk pose.

### 11.5 Remove or rename a character

Remove the row from `LOOKS`, `CHARACTERS` and every `optional` list, and delete the rows that reference the id in your data. The engine will refuse any log that still names the removed id with `UNKNOWN_CHARACTER`, which tells you exactly what to clean.

### 11.6 Who is drawn: the cast rule (important)

Flat camera views draw only `castNow()`:

```js
const castNow = () => Object.values(ACTORS).filter(a => a.alpha > 0 && (a === H || a.inScene));
```

`inScene` is set to `true` only when a script moves the person (`walkTo` / `useAt` set it) or when the resolved cast names them, and it is cleared at the start of every log. Without this rule, everyone who is "at home" gets drawn next to the hero in every close-up. That was a real bug in the original build: the isometric view looked right (a house with a family in it), the flat views looked wrong (a partner standing next to someone doing solo work).

---

## 12. The animation system

### 12.1 The game clock

```js
let gt = 0, speed = 2, boost = 1, paused = false;
// every frame:
gt += dt * (paused ? 0 : speed) * boost;
```

- `speed` is the viewer's choice (1, 1.5, 2, 2.5, 3).
- `boost` is the engine's private multiplier used by "fit to N seconds" to finish a long scene inside its time slice.
- Pause is `speed = 0` (the canvas keeps drawing, so effects can still be rendered).

### 12.2 Waiting

```js
const wait = (s, tk) => new Promise((res, rej) => waits.push({ t: gt + s, res, rej, tk }));
const until = (fn, tk) => new Promise((res, rej) => conds.push({ fn, res, rej, tk }));
const waitReal = (s, tk) => { const end = performance.now() + s * 1000; return until(() => performance.now() >= end, tk); };
```

`wait` is game time (scales with speed and boost). `waitReal` is wall-clock time, used for titles, holds and camera shots that must not speed up.

### 12.3 Cancelling

A token is a tiny object `{ c: false }`. `cancelAll()` flips the current one and creates a fresh one. Every pending wait checks its token each frame and rejects with `"cancel"`. Scripts catch `"cancel"` at the top (in `runDay`) and stop quietly. This makes **Stop**, **Replay**, **Back to home** and **Switch day** one line each.

### 12.4 Writing an activity script

```js
const ACT = {
  work: async (cast, tk) => { await useAt(H, "chair", "type", 6, tk); },
  workout: async (cast, tk) => {
    await useAt(H, "mat", "lift", 6, tk, { onStart: () => comic("PUMP!") });
  },
  eat: async (cast, tk) => {
    const others = cast.cast.filter(p => p.id !== "hero").map(p => ACTORS[p.id]);
    await Promise.all([
      useAt(H, "stool", "eat", 5, tk, { stay: true }),
      ...others.slice(0, 1).map(o => useAt(o, "stool", "eat", 5, tk, { stay: true }))
    ]);
  }
};
```

Patterns:
- **Sequence:** `await a; await b;`
- **Together:** `await Promise.all([...])`
- **Race / cut-off:** `await Promise.race([script, waitReal(limit, tk)])`
- **Loop:** a normal `for` loop with `await`.
- **Side effects:** call `comic()`, `spark()`, `sfx()` between awaits.

### 12.5 Editing an animation

- **Change duration:** change the seconds argument.
- **Change a pose:** change the pose string (any key `figure()` knows).
- **Change the route:** replace `useAt(H, "chair", ...)` with `walkTo(H, [x, y], tk)` then `useAt(...)`.
- **Add a new pose:** add a branch in `figure()` (section 11.2); the script just names it.
- **Add a prop:** draw it inside the pose branch with `R(...)` so it moves with the body.
- **Add a reaction:** after the main await, set `H.pose = "cheer"`, `await wait(.7, tk)`, set it back to `"idle"`.

### 12.6 Easing

Gliding uses smoothstep: `e = k*k*(3 - 2*k)`. Zoom transitions use the same function. If you want a bouncier feel, replace it with `easeOutBack`.

### 12.7 Particles and floating text

Particles are plain objects `{a, vx, vy, born, c}` in an array. Each frame: age them, move with gravity `y += vy*k + 60*k*k`, fade with `globalAlpha = 1 - k`, remove at age 0.9 s. Floating text works the same with a rising `y`.

---

## 13. Cameras and views

### 13.1 The twelve views of the full design

| View | What it shows |
|------|---------------|
| `ISOMETRIC` | The whole house from above at 2:1. The default. Everyone in the scene and the family at home. |
| `SIDE` | Hero in profile, large, with a room backdrop. |
| `FRONT` | Hero facing the camera. |
| `REAR` | Hero from behind, looking at the desk or screen. |
| `OVER_SHOULDER` | The back of the hero's head and shoulder in the foreground, the others in front. |
| `FIRST_PERSON` | What the hero sees: backdrop enlarged and hands at the bottom. |
| `FIRST_PERSON_HANDS` | Hands very large, backdrop blurred; for typing, eating, writing. |
| `FACE_CLOSEUP` | The face, 7x, with eyes, brows, a smile. |
| `UPPER_BODY` | Head and arms, mid-shot. |
| `FULL_ROOM` | The room small, the people tiny; an establishing shot. |
| `SPLIT_SCREEN` | Left: hero. Right: the remote person on a call. |
| `CINEMATIC_ZOOM` | A very slow dolly in and out on the face. |

The reference build ships four: `ISO`, `SIDE`, `FULL`, `FACE`.

### 13.2 The flat band

The flat views draw into a rectangle of the canvas:

```js
const SB = { x: 0, y: 150, w: 360, h: 260 };   // on a 360x640 canvas
```

Everything outside it stays black, so the picture looks like a cinema frame. The top is free for the clock and score, the bottom for captions and comic cards. Always `clip()` to the band so nothing leaks.

### 13.3 Backdrops

A backdrop function per environment draws wall, floor, window and two or three props (desk and monitor, counter and fridge, bed, mat, sofa). While the hero is walking the window scrolls sideways so the camera feels like it is moving.

### 13.4 Zoom transitions (and nothing else)

```js
function setView(v, cut) {
  if (v === view) return;
  if (!cut) { sg.drawImage(cv, 0, 0); T = { t0: performance.now(), dur: 700 }; }  // snapshot the old frame
  view = v;
}
// in the frame:
//  1) draw the NEW view scaled from 1.22 down to 1.0 (zoom out of a slight close-up)
//  2) then draw the OLD snapshot on top, scaled up to 1.3x while its alpha fades 1 -> 0
```

The viewer reads this as a smooth push-in or pull-out. The eye accepts it far more naturally than wipes, and it works between any two views because only two images are involved. Keep the duration between 0.5 and 1.5 s; in fit mode use 0.55 s.

### 13.5 Suggested views per activity

```js
const SUG = {
  work: ["FULL", "SIDE", "FACE"], eat: ["FULL", "SIDE"], workout: ["FULL", "SIDE", "FACE"],
  call: ["FACE", "SIDE"], sleep: ["FULL", "FACE"], walk: ["ISO", "SIDE"]
};
```

Each shot lasts about 3.2 real seconds (less in fit mode: slice length divided by shot count, never under 0.9 s). Always provide a fallback list (`["FULL", "SIDE", "FACE"]`) so an activity with no entry never silently falls back to one fixed view. That exact bug shipped once: only a few activities had suggestions, so most days played in isometric no matter what the viewer chose.

### 13.6 Custom per-scene cameras

`PLAN.cams[sid] = [{ view, seconds }, ...]` (up to three) overrides the suggestion for that scene. Use real seconds for these shots, not game seconds, or a 4 s shot at 2x speed lasts 2 s.

### 13.7 Cinematic look (optional per scene)

A cheap, convincing "film" effect on every view: a radial vignette, a slow warm light sweep, twelve drifting dust specks, and black bars that slide in at the top and bottom (10 px band, 5 percent of the height in isometric). A per-scene toggle (`cine`) chooses cinematic or plain. Plain scenes cut straight with no bars.

### 13.8 Add a new view (recipe)

1. Add a name to the select and to a `VIEWS` list.
2. Write `drawTopDown(t)`: clear, loop over `ROOMS` drawing rectangles scaled to the band, loop over `castNow()` drawing dots.
3. In the frame, dispatch: `if (view === "TOP") drawTopDown(t)`.
4. Optional: add it to `SUG` entries.

---

## 14. Comic and manga effects, points cards

### 14.1 Points cards: appear, hold, disappear

A card is `{ r: {label, pts}, t, born }`. Its age is measured in real seconds regardless of game speed:

```js
const FEED_LIFE = 2.4, feedAge = f => (gt - f.born) / Math.max(.5, speed * boost);
```

- 0 to 0.25 s: slides in from the right and fades in.
- hold.
- last 0.4 s: drops 10 px and fades out.
- after `FEED_LIFE + 0.5` s: removed from the array.

Filter the array by age every frame, and when you draw show at most the last 3. **Never keep the "latest N rewards" forever.** The original build did exactly that: the last three cards stayed on screen for minutes.

### 14.2 Floating comic words

Large italic heavy font, a thick black outline (`lineWidth 7`, `strokeText` then `fillText`), tilted -0.1 rad, a quick scale pop `1 + sin(min(1, k*4)*PI)*.25`, fade in the last 30 percent. Words: `+5`, `KA-CHING!`, `PUMP!`, `POWER UP!`, `TURBO!`.

### 14.3 More ideas that worked

| Effect | How |
|--------|-----|
| Screen shake | `canvas.style.transform = translate(rand, rand)` decaying to 0 in 0.35 s; or translate the context. Use on penalties and big wins. |
| Halftone dots | A grid of small circles at 20 percent alpha behind cards and banners. |
| "!" mark | A yellow exclamation above the head for 1 s when a scene starts. |
| Sparkles | 10 styles (star, heart, coin, ring, bolt, confetti, flame, up-arrow, diamond, note). Rotate styles so the same effect never repeats twice in a row. |
| Page-turn panels | Draw the card's border with `setLineDash([perimeter])` and animate `lineDashOffset` so it draws itself; a small triangle at the leading edge looks like a turning corner. |
| Ribbon banners | A coloured band sweeps across the picture with a word (`LEVEL UP`, `POWER DOWN`). |
| Speed lines | 26 thin white lines radiating from the centre at 28 percent alpha, during workouts. |

### 14.4 One rule for taste

Vary the effect, not the intensity. Pick randomly from a small set that matches the activity (a workout gets flames and bolts, a quiet task gets a soft shine). Repeating the same sparkle ten times reads as a bug.

---

## 15. Pacing: speed, pause, "fit to N seconds"

### 15.1 Why pacing matters

Real days have 10 to 60 logs. Played naturally they take minutes. Played too fast nobody can read anything. The viewer needs a single control: **make it fit 30 seconds.**

### 15.2 The plan

```js
function fitPlan(list) {
  const MIN = 1.8, avail = Math.max(6, FIT.total - 3.5), keep = Math.max(3, Math.floor(avail / MIN));
  if (list.length <= keep) return { play: list, skip: new Set(), per: Math.min(6, avail / list.length) };
  const score = e => e.rewards.reduce((a, r) => a + Math.abs(r.pts), 0);
  const top = new Set(list.map((e, i) => ({ e, i, sc: score(e) }))
                          .sort((a, b) => b.sc - a.sc || a.i - b.i).slice(0, keep).map(x => x.e));
  return { play: list.filter(e => top.has(e)), skip: new Set(list.filter(e => !top.has(e))),
           per: MIN + (avail - keep * MIN) / keep };
}
```

- 3.5 seconds are reserved for the ending.
- Every scene gets at least 1.8 seconds, the shortest time a viewer can still read a caption and a card.
- If there are more scenes than fit, the highest-scoring ones are acted out and the rest are applied silently with `quietApply(e)`, so the final score is always exact.

### 15.3 Making a scene end on time

Natural scenes last 5 to 12 game seconds. To end inside `per` real seconds:

```js
// each frame, while a fit scene runs:
const el = (performance.now() - FIT.t0) / (FIT.per * 1000);       // 0..1+ through the slice
boost = el < .3 ? 1.6 : Math.min(8, 1.6 + (el - .3) * 12);          // speeds up the later the scene runs long
```

And a safety net:

```js
await Promise.race([ playLog(e, sceneTk, state), waitReal(plan.per * 1.5, tk) ]);
sceneTk.own = true;                                    // cancels the scene's pending waits
resetPoses();                                          // everyone back to idle, nobody floating
for (const r of e.rewards.slice(state.given)) addReward(e, r);   // pay out only what was not paid, exactly once
```

The `state` object (`{applied, given}`) is updated inside the scene as it goes, so a cut-off scene never double-counts or loses a reward.

Finally hold until the slice is over (`waitReal(per - elapsed)`), so scenes are evenly spaced and the total is predictable. In the original build the whole sample day (49 entries) played in 29.6 seconds with 46 of 46 rewards credited.

### 15.4 Other time savers in fit mode

- Clock jumps 40 minutes at a time between scenes instead of 5.
- Camera transitions shorten to 0.55 s.
- Pause cards shorten (1.5 s for a finished log, 0.9 s for a started one).

### 15.5 Pause

Pause sets `speed = 0` (and the hold waits use real time, so only the game clock freezes). A tap on the canvas toggles it. Media frames and their Ken Burns motion must respect the pause too.

---

## 16. Merged scenes (one scene for a cluster of logs)

People often log three small things in a row: a drink, a snack, a meal; two exercises; a few steps of a routine. Playing them as three scenes feels like noise. Merge them:

```js
const CLUSTER = { eat: 60, workout: 120 };            // minutes: logs of the same kind closer than this are merged
function mergeClusters(day) {
  const out = [];
  for (const e of day) {
    const prev = out[out.length - 1];
    if (prev && prev.act === e.act && CLUSTER[e.act] && e.min - prev.lastMin <= CLUSTER[e.act]) {
      prev.items.push(e.title); prev.rewards = prev.rewards.concat(e.rewards); prev.lastMin = e.min;
    } else out.push({ ...e, items: [e.title], lastMin: e.min });
  }
  return out;
}
```

The merged scene then plays one action (sit and eat, one workout block) and shows the items on a single "collected" card at the end: a bowl with the food names, a list of the exercises with a progress bar. Points from all merged logs are paid out after the scene.

Rules that kept this honest:
- Merge only same-kind logs, and only inside a window you can explain in one sentence.
- Never lose a reward: concatenate them.
- Keep the stable ids of all merged logs so replays and edits still work.

---

## 17. Photo, video and audio frames

A viewer can attach media to a log. When that scene ends the media appears **from the character**, not from the screen centre:

1. The picture dims 40 percent and cinema bars slide in.
2. A rounded frame pops out of the hero's position (`P(hero.x, hero.y, 24)` in isometric, a point on the figure in flat views), scaling from 0 to full size in 0.4 s with a small overshoot.
3. **Photo:** 2.5 s with a slow Ken Burns zoom (follows the speed setting).
4. **Video:** plays at its own pace in a larger frame; the game music steps aside.
5. **Audio:** shows a waveform strip and a large icon; plays through.
6. The frame shrinks back into the character, dim and bars retract, the day continues.

Implementation notes:
- Decode photos with `createImageBitmap` and draw them into the canvas; draw videos with `drawImage(video, ...)`.
- A hidden `<input type="file" accept="image/*,video/*,audio/*" multiple>` is the whole "add media" UI; keep a tiny "add to which log" row so it is one tap.
- GIFs draw as a still frame on canvas unless you decode them (use `ImageDecoder` where available).
- Media is session-only in the reference design. If you persist it, treat it like user data (local storage plus whatever backup you offer).
- Respect pause: stop the video clock and the Ken Burns clock.

---

## 18. Sound and music

All sound is synthesised, so there are no files.

- **Blips:** an oscillator with a short exponential gain ramp. Coin: 880 Hz then 1320 Hz. Penalty: 220 Hz then 140 Hz. Door: a low square burst.
- **Music:** a tiny step sequencer (8 steps, one chord per bar) with moods that match the scene: *energy* (workout), *focus* (work), *family*, *night* (sleep). Each mood is a scale, a tempo and a waveform. Start a mood when the scene starts and stop it at the end; fade volume to 0 in 300 ms to avoid clicks.
- **Rule:** the browser blocks audio until a user gesture. Create the `AudioContext` inside the first click handler (the Play button) and call `resume()` there.
- Provide a "Sound and music" switch.

---

## 19. Recording to a video file

```js
const stream = cv.captureStream(30);
const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"]
             .find(m => MediaRecorder.isTypeSupported(m));
const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
rec.onstop = () => download(new Blob(chunks, { type: mime }));
rec.start(); await runDay(); setTimeout(() => rec.stop(), 800);
```

Tips:
- Hide the control bar and any stop button while recording (the reference toggles a `playing` class).
- Record the canvas only. The canvas already contains the HUD and the effects, which is exactly what you want in the video.
- Add a countdown title "3, 2, 1" in the canvas before `rec.start()` if you want a clean cut-in.
- Audio: mix your `AudioContext` into the stream with `createMediaStreamDestination()` and add its track to the canvas stream.
- Vertical 9:16 at 360 x 640 is small but upscales well because the art is pixel art; for 1080 x 1920 render the canvas at 3x (`cv.width = 1080`, `g.scale(3,3)`), and keep `image-rendering: pixelated`.
- In a native WebView where `MediaRecorder` is missing, capture frames with `toDataURL` at 30 fps and encode natively (see section 20).

---

## 20. Embedding in a native mobile app

The whole game is a folder of static files, so a native app can host it in a WebView:

1. Bundle the folder with the app as a read-only resource (no network).
2. Load it with the platform WebView (WKWebView on iOS, WebView on Android).
3. **Native to web:** inject the day as JSON (`window.DAY_DATA = ...`) or call a function after load (`PixelLife.loadDay(json)`).
4. **Web to native:** a message handler. The page calls `native("close")`, `native("record", {...})`, `native("share", {...})`. On iOS this is `window.webkit.messageHandlers.bridge.postMessage(...)`; on Android a `@JavascriptInterface`.
5. Add a close button (top right) because a full-screen WebView has no browser chrome.
6. Register a deep link or shortcut that opens the game screen directly.
7. For recording in a WebView that lacks `MediaRecorder`, capture frames from the canvas on a timer and encode them natively with the platform video encoder; mux the synthesised audio from an offline `AudioContext` render.
8. Keep the engine file DOM-free so the native test runner (for example JavaScriptCore) can run the same unit tests as node.

---

## 21. Testing

### 21.1 What to test

- **Engine rules** (section 26): solo activities stay solo, named people are refused where not allowed, remote people never local, groups expand correctly, same input same output, `ledgerWrite` false.
- **Fit planner:** every combination of totals (30/45/60) and counts (5/10/25/60) stays inside the budget, keeps the highest-point scenes, plays plus skips equals the total.
- **Rewards:** play a full day in fit mode and compare the final score to the sum of all rewards. They must be equal.
- **Cast rule:** during a flat view, sample `castNow()` every 200 ms and assert it contains only the hero unless the log named someone.
- **Cards:** after a reward, the card is gone within `FEED_LIFE + 0.5` seconds.
- **Cameras:** in suggested mode, every activity must produce at least two different views over a day.

### 21.2 Handy console helpers

The reference exposes `window.PixelLife` with `ENGINE, ACT, DAY, LOOKS, ACTORS, ITEMS, CAT, ROOMS, runDay, FIT, S`. In the console:

```js
PixelLife.FIT.on = true; PixelLife.FIT.total = 45; PixelLife.runDay();
PixelLife.ENGINE.resolve({ activityId: "call", people: ["mentor"] });
```

### 21.3 Headless simulation with a virtual clock

`simulate.js` (section 26) runs the whole game in node with a stubbed canvas and a virtual clock, so timing is exact and nothing is throttled. Measured results for the reference day (10 logs, 81 points of rewards):

| Mode | Virtual seconds | Score |
|------|-----------------|-------|
| Natural, 2x | 44.4 | 81 of 81 |
| Fit 30 s | 28.4 | 81 of 81 |
| Fit 45 s | 42.8 | 81 of 81 |
| Fit 60 s | 57.2 | 81 of 81 |

Every fit mode ends a little under its target (the ending is reserved) and never loses a point.

### 21.4 A note on timing tests in browsers

Background or hidden tabs throttle `requestAnimationFrame` to about 1 frame per second. Wall-clock timing tests (for example "the day takes 30 seconds") are only valid in a visible foreground tab, or in a headless browser with `--disable-background-timer-throttling`. The reference clamps `dt` to 0.1 s so a stall never teleports anyone.

---
## 22. Customization cookbook (22 recipes)

Each recipe lists the lines to change in the reference file (section 25). Search for the names in bold.

### Recipe 1: Rename and recolour the hero
Edit `LOOKS.hero`: `name`, `shirt`, `pant`, `hair`, `skin`. Remove `cap` or `beard` to drop them. Nothing else references the look.

### Recipe 2: Add a new character (full example)
```js
// 1. look
LOOKS.coach = { name: "Coach", shirt: "#d2402f", pant: "#222a3a", hair: "#9aa0a6", skin: "#b9805a", whistle: true };
// 2. one extra rectangle in figure(), in the head section
if (L.whistle) R(-1, hy + 8.5, 2, 2, "#e8e8e8");
// 3. the actor is created by the loop over LOOKS (it needs no code)
// 4. the engine: allow him
CHARACTERS.coach = { remoteOk: true };
ACTIVITIES.workout.optional.push("coach");
// 5. a log that uses him
{ sid: "l6", min: 900, act: "workout", title: "Strength with Coach", people: ["coach"], rewards: [{ label: "Workout done", pts: 20 }] }
```
Test: `ENGINE.resolve({activityId:"work", people:["coach"]}).rejected[0].reason === "NOT_ALLOWED_FOR_ACTIVITY"`.

### Recipe 3: Make the cast bigger or smaller
Change the scale constant in `figure` (`const k = L.kid ? .72 : 1`). A toddler can be `.55`: add `toddler: true` and `const k = L.toddler ? .55 : L.kid ? .72 : 1`.

### Recipe 4: Give a character an outfit per activity
```js
const lookFor = (id, act) => act === "sleep" ? { ...LOOKS[id], shirt: "#9aa6c4", pant: "#9aa6c4", cap: false }
                           : act === "workout" ? { ...LOOKS[id], shirt: "#222", pant: "#111" } : LOOKS[id];
// in drawIso and drawFlat, replace a.look with lookFor(a.id, curAct)
```

### Recipe 5: Add a room and furniture
```js
GW = 18;                                   // widen the grid (make GW a let), then re-centre: OX = 152 + (18 - 14) * 7
ROOMS.push({ id: "balcony", n: "Balcony", x: 14, y: 0, w: 4, h: 5, floor: "#6e8f6a" });
CAT.bench = { color: "#8a6a4a", height: 6, use: { ax: 1.0, ay: .5, z: 7, dir: "S" } };
ITEMS.push({ type: "bench", x: 15, y: 1, w: 2, h: 1 });
// rebuild the obstacle set (move the loop that fills `blocked` into a function and call it)
```

### Recipe 6: Make a piece of furniture usable
Give it `use` in `CAT`, then call `useAt(actor, "bench", "sit", 5, tk)`. The anchor decides exactly where the person's feet land. Adjust `ax`, `ay` (cells) and `z` (pixels) until the person looks seated and not floating; 10 minutes of trial is normal.

### Recipe 7: Add a new activity
```js
// engine
ENGINE.ACTIVITIES.cook = { name: "Cooking", env: "kitchen", interaction: "SOLO", optional: [] };
// script
ACT.cook = async (c, tk) => {
  await useAt(H, "counter", "type", 3, tk, { onStart: () => comic("CHOP!") });
  await useAt(H, "fridge", "idle", 1.5, tk);
  await useAt(H, "stool", "eat", 3, tk);
};
// suggested cameras
SUG.cook = ["FULL", "SIDE", "FACE"];
// data
{ sid: "l11", min: 1170, act: "cook", title: "Cook dinner", people: [], rewards: [{ label: "Home cooked", pts: 8 }] }
```

### Recipe 8: Add a pose
In `figure()`, add a branch inside the standing group:
```js
else if (pose === "stretch") { R(-6, -28, 2.5, 10, L.skin); R(5, -28, 2.5, 10, L.skin); R(-4, -20, 9, 11, L.shirt); }
```
Use it with `H.pose = "stretch"; await wait(2, tk);`.

### Recipe 9: Change the walk
Speed: `step = 2.7 * dt * speed * boost` in `stepActors`. Style: change `sw` (leg swing) and `bob`. A tired walk: smaller `sw`, slower `Math.sin(t * 6)`.

### Recipe 10: Add a camera view
```js
function drawTopDown(t) {
  g.fillStyle = "#0d1018"; g.fillRect(0, 0, LW, LH);
  const k = 22; ROOMS.forEach(r => { g.fillStyle = r.floor; g.fillRect(20 + r.x * k, 150 + r.y * k, r.w * k - 2, r.h * k - 2); });
  castNow().forEach(a => { g.fillStyle = a.look.shirt; g.beginPath(); g.arc(20 + a.x * k, 150 + a.y * k, 7, 0, 7); g.fill(); });
}
// frame(): if (view === "TOP") drawTopDown(t); else if (view === "ISO") ...
// add <option value="TOP">Top down</option> and SUG entries
```

### Recipe 11: Change the camera transition feel
In `frame`, the zoom numbers: new view starts at scale `1.22` and settles to `1`; the old snapshot scales to `1.3` while fading. Make it dramatic with `1.5` and `1.6`. For a pull-out, reverse them (new view starts at `0.85`, old snapshot shrinks to `0.7`). Keep it a zoom: it is the one transition that never looks cheap.

### Recipe 12: Add or change a points card style
`drawFx()`: change the card width and colours, or replace the roundRect with a comic panel (halftone background, jagged border). Always keep the lifetime logic (`feedAge`, `FEED_LIFE`).

### Recipe 13: Add a new comic word or sparkle
`comic("BOOM!")` anywhere in a script. For a new sparkle shape add a case to the particle draw and one string to the style list, then rotate through styles with an index so the same one never repeats twice.

### Recipe 14: Replace the sample data with your own
```js
async function loadDay(url) {
  const raw = await (await fetch(url)).json();                   // [{time:"07:00", type:"meal", title, minutes, people, points}]
  const MAP = { meal: "eat", exercise: "workout", focus: "work", reading: "read", sleep: "sleep", call: "call", walk: "walk" };
  DAY.length = 0;
  raw.forEach((r, i) => {
    const act = MAP[r.type]; if (!act) { console.warn("unknown type", r.type); return; }
    const [h, m] = r.time.split(":").map(Number);
    DAY.push({ sid: "r" + i, min: h * 60 + m, act, title: r.title, people: r.people || [], rewards: [{ label: r.title, pts: r.points || 0 }] });
  });
  DAY.sort((a, b) => a.min - b.min);
}
```
Unknown types are skipped with a visible warning, never invented.

### Recipe 15: Change the points rules
Keep points out of the animation. Make one table `POINTS = { meal: 5, workout: 20, focus: 10, screen: -5 }` and compute rewards when you load the day. The game only displays them.

### Recipe 16: Change the size or aspect ratio
Edit `LW`, `LH`, `cv.width/height` and `SB`. For landscape 16:9 use 640 x 360, a taller `SB`, and move the HUD. All positions in the reference are in logical canvas pixels, so nothing else needs touching.

### Recipe 17: Add a theme (night house, summer, retro)
Wrap colours in a theme object: `THEME = { floorTint: 1, wall: "#3a4256", ... }` and read from it in `drawIso` and `ENVS`. A night theme multiplies floor colours by `0.55`, adds a dark overlay `rgba(8,12,30,.35)` and warm light circles under lamp items.

### Recipe 18: Per-scene controls
Store choices in `PLAN` (section 8.5) and read them when the scene starts: `PLAN.secs[sid]` is a minimum on-screen time (`waitReal` the remainder), `PLAN.cine[sid] === false` skips the vignette and bars, `PLAN.cams[sid]` overrides the suggested cameras.

### Recipe 19: Add sound for a new activity
```js
function sfx(kind) { /* add */ if (kind === "chop") { /* a 120 Hz square burst, 60 ms */ } }
ACT.cook = async (c, tk) => { sfx("chop"); ... };
```

### Recipe 20: Add a "story" recap
Create a function `story(days)` that computes simple facts (best scene by points, longest focus block, total points) and plays them as 2-second title cards between scenes. Keep the facts computed by plain code and use text only for narration; never let generated text invent a number.

### Recipe 21: Localise
Move all captions and card labels into a dictionary `T[lang][key]`. Characters and activities use ids; only the display layer changes language. Use a font stack that includes your script.

### Recipe 22: Ship it
Single file: host the HTML anywhere (static hosting, a gist, a USB stick). App: bundle it (section 20). Share: use the record button (section 19).

---

## 23. Lessons learned: bugs that cost days, and how to avoid them

1. **A feature hidden, not removed.** When the control screens were rebuilt, the old menu (Free play, floor map, whole-house view) was wrapped in `display:none` and nothing reached it. Users thought it was deleted. *Fix: before hiding an old menu, list every button in it and give each a new home or delete it on purpose.*
2. **Everybody at home was drawn in every close-up.** The flat views drew every actor with `alpha > 0`. *Fix: the cast rule (11.6): hero plus people the scene moves.*
3. **Cards that never left.** Rewards were drawn from "the last N" with no age check. *Fix: lifetime in real seconds, filter every frame (14.1).*
4. **"Suggested views" always isometric.** Only a few activities had suggestions and each shot waited a hard-coded 7 game seconds. *Fix: fallback list per activity and real-second shots (13.5, 13.6).*
5. **Cut-off scenes lost or doubled points.** When fit mode cut a scene short, rewards were either skipped or paid twice. *Fix: a per-scene `state` with `given` counted as rewards are paid (15.3).*
6. **Stale scripts in the browser.** Cached old JavaScript made fixes look broken. *Fix: serve with `Cache-Control: no-store` while developing, and add a version query to script tags.*
7. **A hidden tab runs at 1 fps.** Timing tests reported nonsense. *Fix: test in a visible tab; clamp `dt`.*
8. **Orphan poses.** After a cut-off scene somebody stayed floating on a chair. *Fix: `resetPoses()` snaps everyone to the floor and idle.*
9. **Top-level name collisions.** Two files declared the same `const`. *Fix: one prefix per module and the load order in 7.3.*
10. **Early return in a draw function** skipped the caption bar. *Fix: wrap optional parts in `if`, never `return` out of a composite draw.*
11. **Overlapping HUD pieces** in different views. *Fix: reserve zones (top for the meter and score, bottom for captions and cards, middle for the picture) and draw an opaque panel for the top zone.*
12. **Do not invent people.** The first sleep script put a partner in the bed because the house had one. *Fix: rule 1; only named people appear.*

---

## 24. Roadmap ideas

- Health bar and hearts for streaks; a boss encounter for the hardest habit of the week.
- Streak flames, a level-title ladder, a perfect-day trophy.
- Power-up inventory: collected cards become items shown on a shelf in the house.
- More views from the full list of twelve; a top-down map view.
- Seasonal and weather themes; day-night lighting that follows the real clock.
- Voice-over from text-to-speech with captions in the lower third.
- Share targets: one tap to publish the recorded clip.
- Mod packs: a folder with `characters.json`, `rooms.json`, `activities.json` the game loads at start, so non-programmers can customise.

---

## 25. Full reference implementation

Save as `pixel-life-sim.html` and open it in a browser. It contains every system described above: the deterministic engine, the grid world with A* walking, pose-based characters, async animation scripts, four camera views with zoom transitions, points cards that expire, comic effects, Fit N seconds, free play and recording. It was run and checked while writing this guide: the sample day plays to the end in every mode, the score equals the sum of all rewards (81), Fit 30 s finishes in 28.4 virtual seconds, and the flat views draw only the people the scene uses.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pixel Life Simulator (reference build)</title>
<!-- MIT License. A tiny, complete reference of the whole design: deterministic engine, grid world, A* walking,
     pose-based pixel characters, async animation scripts, 4 camera views with zoom-only transitions, points cards that
     expire, "fit to N seconds" pacing, free play and video recording. One file, no libraries, no build step. -->
<style>
  :root{--bg:#0d1018;--panel:#171c25;--line:#2a3140;--fg:#e8ecf3;--muted:#98a2b3;--accent:#4fd1b8}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100dvh}
  #stage{position:relative;width:min(100vw,calc(100dvh * 9 / 16 - 60px));aspect-ratio:9/16;margin-top:8px}
  canvas{width:100%;height:100%;display:block;border-radius:14px;background:#000;image-rendering:pixelated}
  #bar{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 10px;max-width:520px}
  button,select{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;min-height:40px}
  button[aria-pressed=true]{background:var(--accent);color:#06251f;border-color:var(--accent)}
  #bar.playing{opacity:.0;pointer-events:none;height:0;padding:0;overflow:hidden}
</style>
</head>
<body>
<div id="stage"><canvas id="cv" width="360" height="640" aria-label="Pixel life simulator"></canvas></div>
<div id="bar" role="group" aria-label="Controls">
  <button id="bPlay">Play the day</button>
  <button id="bFit" aria-pressed="false">Fit 30 s</button>
  <select id="sView" aria-label="Camera"><option value="SUGGEST">Suggested views</option><option value="ISO">Isometric</option><option value="SIDE">Side</option><option value="FULL">Full room</option><option value="FACE">Face close-up</option></select>
  <select id="sSpeed" aria-label="Speed"><option>1</option><option selected>2</option><option>3</option></select>
  <button id="bFree">Free play</button>
  <button id="bRec">Record</button>
</div>
<script>
"use strict";
/* =====================================================================================================
   0. CONSTANTS
   ===================================================================================================== */
const cv = document.getElementById("cv"), g = cv.getContext("2d");
const LW = 360, LH = 640;                       // logical canvas size (9:16, ready for a vertical video)
const GW = 14, GH = 10, TW = 28, TH = 14;       // grid size and isometric tile size
const OX = 152, OY = 190;                       // where grid cell (0,0) lands on screen
const SB = { x: 0, y: 150, w: 360, h: 260 };    // the band the flat 2D views draw into

/* =====================================================================================================
   1. CHARACTERS: add a person = add one row here (look) + (optionally) one row in ACTORS
   ===================================================================================================== */
const LOOKS = {
  hero:    { name: "Alex",  shirt: "#35569a", pant: "#1d2540", hair: "#17141a", skin: "#c98d5f", cap: true, beard: true },
  partner: { name: "Sam",   shirt: "#c0504d", pant: "#a84540", hair: "#17141a", skin: "#c98f65", long: true },
  child:   { name: "Kid",   shirt: "#ff7eb6", pant: "#c94f90", hair: "#2b1d14", skin: "#d9a27b", long: true, kid: true },
  mentor:  { name: "Mentor",shirt: "#eef0f4", pant: "#3a3f55", hair: "#d8d8d8", skin: "#c08a62", glasses: true },
  friend:  { name: "Friend",shirt: "#2f8f6b", pant: "#2b3140", hair: "#17141a", skin: "#c98f65" }
};
const ACTORS = {};                               // id -> live actor (position, pose, path ...)
for (const id of Object.keys(LOOKS)) ACTORS[id] = { id, look: LOOKS[id], x: 7.5, y: 7.5, z: 0, dir: "S", pose: "idle", path: [], glide: null, alpha: 0, inScene: false };

/* =====================================================================================================
   2. WORLD: rooms, furniture catalog, items. Everything is plain data.
   ===================================================================================================== */
const ROOMS = [
  { id: "bed",     n: "Bedroom", x: 0, y: 0, w: 5, h: 5, floor: "#8f7a6a" },
  { id: "study",   n: "Study",   x: 5, y: 0, w: 4, h: 5, floor: "#7d8aa0" },
  { id: "kitchen", n: "Kitchen", x: 9, y: 0, w: 5, h: 5, floor: "#a9a08c" },
  { id: "living",  n: "Living",  x: 0, y: 5, w: 9, h: 5, floor: "#6f8f7e" },
  { id: "gym",     n: "Gym nook",x: 9, y: 5, w: 5, h: 5, floor: "#7a7f8c" }
];
// type -> { color, height, walkable, use: anchor where a person sits/lies/stands (cell units, z in px) }
const CAT = {
  bed:    { color: "#5b7bd5", height: 8,  use: { ax: 1.0, ay: 1.4, z: 9,  dir: "S" } },
  desk:   { color: "#8a6a4a", height: 10 },
  chair:  { color: "#3d4a5e", height: 6,  use: { ax: .5,  ay: .45, z: 7,  dir: "N" } },
  sofa:   { color: "#4f9a7d", height: 7,  use: { ax: 1.0, ay: .55, z: 7,  dir: "S" } },
  table:  { color: "#b08a5a", height: 9 },
  stool:  { color: "#6b5a4a", height: 5,  use: { ax: .5,  ay: .5,  z: 6,  dir: "E" } },
  fridge: { color: "#d8dde6", height: 22 },
  counter:{ color: "#9a9a9a", height: 10 },
  mat:    { color: "#d2675c", height: .6, flat: true, use: { ax: 1.0, ay: .5, z: .8, dir: "S" } },
  rug:    { color: "#c9a14a", height: .4, flat: true, use: { ax: 1.0, ay: .5, z: .6, dir: "S" } }
};
const ITEMS = [
  { type: "bed", x: 0, y: 0, w: 2, h: 3 }, { type: "desk", x: 5, y: 0, w: 3, h: 1 }, { type: "chair", x: 6, y: 1, w: 1, h: 1 },
  { type: "fridge", x: 13, y: 0, w: 1, h: 1 }, { type: "counter", x: 10, y: 0, w: 3, h: 1 },
  { type: "table", x: 10, y: 2, w: 2, h: 2 }, { type: "stool", x: 10, y: 4, w: 1, h: 1 }, { type: "stool", x: 12, y: 4, w: 1, h: 1 },
  { type: "sofa", x: 1, y: 6, w: 3, h: 1 }, { type: "rug", x: 4, y: 7, w: 2, h: 2 },
  { type: "mat", x: 10, y: 6, w: 2, h: 2 }
];
const DOOR = [6, 9];                            // the cell people use to leave and come back

/* =====================================================================================================
   3. GRID + A* PATHFINDING
   ===================================================================================================== */
const blocked = new Set();
for (const it of ITEMS) if (!CAT[it.type].flat) for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) blocked.add(y * GW + x);
const free = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !blocked.has(y * GW + x);
function astar(s, e) {
  const key = (c) => c[1] * GW + c[0], open = [[s, 0, 0]], came = new Map(), gs = new Map([[key(s), 0]]);
  while (open.length) {
    open.sort((a, b) => a[2] - b[2]); const [cur] = open.shift();
    if (cur[0] === e[0] && cur[1] === e[1]) { const p = [cur]; let k = key(cur); while (came.has(k)) { const q = came.get(k); p.unshift(q); k = key(q); } return p; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [cur[0] + dx, cur[1] + dy]; if (!free(n[0], n[1])) continue;
      const ng = gs.get(key(cur)) + 1; if (ng < (gs.get(key(n)) ?? 1e9)) { gs.set(key(n), ng); came.set(key(n), cur); open.push([n, ng, ng + Math.abs(n[0] - e[0]) + Math.abs(n[1] - e[1])]); }
    }
  }
  return null;
}
const cellOf = (a) => [Math.floor(a.x), Math.floor(a.y)];
function nearestFree(c) { for (let r = 0; r < 8; r++) for (let y = c[1] - r; y <= c[1] + r; y++) for (let x = c[0] - r; x <= c[0] + r; x++) if (free(x, y)) return [x, y]; return DOOR; }
function approach(a, it) {                      // the free cell next to a piece of furniture that is nearest to the person
  let best = null, bd = 1e9;
  for (let y = it.y - 1; y <= it.y + it.h; y++) for (let x = it.x - 1; x <= it.x + it.w; x++) {
    if (x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h) continue;
    if (!free(x, y)) continue; const d = Math.hypot(x + .5 - a.x, y + .5 - a.y); if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

/* =====================================================================================================
   4. THE DETERMINISTIC ENGINE (pure: no DOM, no clock, no randomness; copy this block into node to unit-test it)
      Rule 1: never invent another person. Rule 2: same input, same scene. Rule 3: a preview never writes anything.
   ===================================================================================================== */
const ENGINE = (() => {
  const CHARACTERS = { hero: { remoteOk: false }, partner: { remoteOk: true }, child: { remoteOk: true }, mentor: { remoteOk: true }, friend: { remoteOk: true } };
  const GROUPS = { family: ["partner", "child"] };                       // a shortcut, never a character
  // interaction: SOLO (hero alone) | WITH (named people may join, in the room) | PHONE (named people are on the line, never in the room)
  const ACTIVITIES = {
    work:   { name: "Deep work",   env: "study",   interaction: "SOLO",  optional: [] },
    read:   { name: "Reading",     env: "living",  interaction: "SOLO",  optional: [] },
    scroll: { name: "Screen time", env: "living",  interaction: "SOLO",  optional: [] },
    eat:    { name: "Meal",        env: "kitchen", interaction: "WITH",  optional: ["partner", "child", "friend"] },
    workout:{ name: "Workout",     env: "gym",     interaction: "WITH",  optional: ["friend"] },
    call:   { name: "Phone call",  env: "living",  interaction: "PHONE", optional: ["partner", "mentor", "friend"] },
    walk:   { name: "Walk",        env: "street",  interaction: "WITH",  optional: ["partner", "child", "friend"] },
    family: { name: "Family time", env: "living",  interaction: "WITH",  optional: ["partner", "child"] },
    sleep:  { name: "Sleep",       env: "bed",     interaction: "SOLO",  optional: [] }
  };
  function resolve(req) {
    const def = ACTIVITIES[req.activityId]; if (!def) return { ok: false, rejected: [{ id: null, reason: "UNKNOWN_ACTIVITY" }] };
    const cast = [{ id: "hero", presence: "LOCAL", role: "PROTAGONIST" }], rejected = [];
    const named = []; (req.people || []).forEach(p => (GROUPS[p] || [p]).forEach(x => named.push(x)));
    for (const id of named) {
      if (!CHARACTERS[id]) { rejected.push({ id, reason: "UNKNOWN_CHARACTER" }); continue; }
      if (id === "hero" || cast.some(c => c.id === id)) continue;
      if (!def.optional.includes(id)) { rejected.push({ id, reason: "NOT_ALLOWED_FOR_ACTIVITY" }); continue; }
      cast.push({ id, presence: def.interaction === "PHONE" ? "REMOTE" : "LOCAL", role: def.interaction === "PHONE" ? "CALLER" : "WITH" });
    }
    if (def.interaction === "PHONE" && !cast.some(c => c.presence === "REMOTE")) cast.push({ id: "caller", presence: "REMOTE", role: "CALLER" }); // nobody named: a faceless caller, never an invented person
    return { ok: true, rejected, instance: { activityId: req.activityId, env: def.env, cast, ledgerWrite: false } };
  }
  return { ACTIVITIES, resolve };
})();

/* =====================================================================================================
   5. TIME: game clock, speed, boost, waits, cancel tokens. All animation scripts are async functions built on these.
   ===================================================================================================== */
let gt = 0, speed = 2, boost = 1, paused = false;
let tok = { c: false };                                                // cancel token: cancelAll() flips it, every pending wait rejects "cancel"
const waits = [], conds = [];
const wait = (s, tk) => new Promise((res, rej) => waits.push({ t: gt + s, res, rej, tk }));              // game seconds (scales with speed)
const until = (fn, tk) => new Promise((res, rej) => conds.push({ fn, res, rej, tk }));
const waitReal = (s, tk) => { const end = performance.now() + s * 1000; return until(() => performance.now() >= end, tk); };   // real seconds
function cancelAll() { tok.c = true; tok = { c: false }; }
function pump() {
  for (let i = waits.length - 1; i >= 0; i--) { const w = waits[i]; if (w.tk && w.tk.c) { waits.splice(i, 1); w.rej("cancel"); } else if (gt >= w.t) { waits.splice(i, 1); w.res(); } }
  for (let i = conds.length - 1; i >= 0; i--) { const c = conds[i]; if (c.tk && c.tk.c) { conds.splice(i, 1); c.rej("cancel"); } else if (c.fn()) { conds.splice(i, 1); c.res(); } }
}

/* =====================================================================================================
   6. MOVEMENT PRIMITIVES
   ===================================================================================================== */
async function walkTo(a, cell, tk) {
  a.inScene = true; a.alpha = 1; a.z = 0; if (a.host) a.host = null;
  let s = cellOf(a); if (!free(...s)) { s = nearestFree(s); a.x = s[0] + .5; a.y = s[1] + .5; }
  const p = astar(s, cell); if (!p) throw "nopath";
  a.path = p.map(c => [c[0] + .5, c[1] + .5]); await until(() => a.path.length === 0, tk); a.pose = "idle";
}
function glide(a, x, y, z, dur, tk) { a.glide = { fx: a.x, fy: a.y, fz: a.z, tx: x, ty: y, tz: z, t0: gt, dur }; return until(() => !a.glide, tk); }
async function useAt(a, type, pose, secs, tk, o = {}) {
  a.inScene = true; a.alpha = 1;
  const it = ITEMS.find(i => i.type === type); if (!it) { a.pose = pose; await wait(secs, tk); a.pose = "idle"; return; }
  const ap = approach(a, it); if (ap) await walkTo(a, ap, tk);
  const U = CAT[type].use; await glide(a, it.x + U.ax, it.y + U.ay, U.z, .5, tk);
  a.dir = U.dir; a.pose = pose; if (o.onStart) o.onStart(); await wait(secs, tk);
  if (!o.stay && ap) { a.pose = "idle"; await glide(a, ap[0] + .5, ap[1] + .5, 0, .4, tk); }
}
async function goOut(group, tk) { await Promise.all(group.map((a, i) => walkTo(a, [DOOR[0] + i % 2, DOOR[1]], tk))); group.forEach(a => { a.alpha = 0; }); }
async function comeHome(group, tk) { group.forEach(a => { a.x = DOOR[0] + .5; a.y = DOOR[1] + .5; a.alpha = 1; }); await Promise.all(group.map((a, i) => walkTo(a, [DOOR[0] - 1 - i, 7], tk))); }
function stepActors(dt) {
  for (const a of Object.values(ACTORS)) {
    if (a.glide) { const k = Math.min(1, (gt - a.glide.t0) / a.glide.dur), e = k * k * (3 - 2 * k), G = a.glide; a.x = G.fx + (G.tx - G.fx) * e; a.y = G.fy + (G.ty - G.fy) * e; a.z = G.fz + (G.tz - G.fz) * e; if (k >= 1) a.glide = null; continue; }
    if (a.path.length) {
      const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), step = (a.look.kid ? 3 : 2.7) * dt * speed * boost;
      a.pose = "walk"; a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
      if (d <= step) { a.x = tx; a.y = ty; a.path.shift(); } else { a.x += dx / d * step; a.y += dy / d * step; }
    }
  }
}

/* =====================================================================================================
   7. ANIMATION SCRIPTS (one async function per activity). To add an activity: add it to ENGINE.ACTIVITIES and ACT.
   ===================================================================================================== */
const S = { clock: 360, score: 0, caption: "", feed: [], remote: null, fx: [], comics: [], shake: 0 };
const H = ACTORS.hero;
const ACT = {
  work:   async (c, tk) => { await useAt(H, "chair", "type", 6, tk); },
  read:   async (c, tk) => { await useAt(H, "sofa", "read", 6, tk); },
  scroll: async (c, tk) => { await useAt(H, "sofa", "phone", 5, tk); },
  sleep:  async (c, tk) => { await useAt(H, "bed", "lie", 6, tk); },
  eat:    async (c, tk) => {
    const others = c.cast.filter(p => p.id !== "hero").map(p => ACTORS[p.id]);
    await Promise.all([useAt(H, "stool", "eat", 5, tk, { stay: true }), ...others.slice(0, 1).map(o => useAt(o, "stool", "eat", 5, tk, { stay: true }))]);
  },
  workout:async (c, tk) => { await useAt(H, "mat", "lift", 6, tk, { onStart: () => comic("PUMP!") }); },
  call:   async (c, tk) => { S.remote = c.cast.filter(p => p.presence === "REMOTE").map(p => p.id); H.pose = "calling"; await wait(5, tk); S.remote = null; H.pose = "idle"; },  // remote people are a panel, never in the room
  walk:   async (c, tk) => {
    const group = c.cast.filter(p => p.presence === "LOCAL").map(p => ACTORS[p.id]);
    await goOut(group, tk); await wait(2.5, tk); await comeHome(group, tk);
  },
  family: async (c, tk) => {
    const others = c.cast.filter(p => p.id !== "hero").map(p => ACTORS[p.id]);
    await Promise.all([walkTo(H, [5, 8], tk), ...others.map((o, i) => walkTo(o, [6 + i, 8], tk))]);
    others.forEach(o => { o.pose = "talk"; }); H.pose = "talk"; spark(H); await wait(4, tk); H.pose = "idle"; others.forEach(o => { o.pose = "idle"; });
  }
};

/* =====================================================================================================
   8. A DAY OF LOGS (sample data, no real person). In your product this array comes from your own database.
   ===================================================================================================== */
const DAY = [
  { sid: "l1", min: 420, act: "eat",     title: "Breakfast with Sam",  people: ["partner"], rewards: [{ label: "Healthy meal", pts: 5 }] },
  { sid: "l2", min: 480, act: "work",    title: "Deep work, 2 hours",  people: [],          rewards: [{ label: "Focus block", pts: 10 }] },
  { sid: "l3", min: 640, act: "call",    title: "Call with Mentor",    people: ["mentor"],  rewards: [{ label: "Reached out", pts: 3 }] },
  { sid: "l4", min: 720, act: "scroll",  title: "Social media, 40 min",people: [],          rewards: [{ label: "Screen time penalty", pts: -5 }] },
  { sid: "l5", min: 780, act: "eat",     title: "Lunch",               people: [],          rewards: [{ label: "Healthy meal", pts: 5 }] },
  { sid: "l6", min: 900, act: "workout", title: "Strength, 30 min",    people: [],          rewards: [{ label: "Workout done", pts: 20 }] },
  { sid: "l7", min: 1020,act: "walk",    title: "Walk with Kid",       people: ["child"],   rewards: [{ label: "Time with Kid", pts: 15 }] },
  { sid: "l8", min: 1110,act: "family",  title: "Family evening",      people: ["family"],  rewards: [{ label: "Family time", pts: 15 }] },
  { sid: "l9", min: 1290,act: "read",    title: "Read 20 pages",       people: [],          rewards: [{ label: "Read before bed", pts: 8 }] },
  { sid: "l10",min: 1380,act: "sleep",   title: "Sleep",               people: [],          rewards: [{ label: "On time", pts: 5 }] }
];

/* =====================================================================================================
   9. POINTS CARDS (they slide in, hold for FEED_LIFE real seconds, fade; they never stay forever)
   ===================================================================================================== */
const FEED_LIFE = 2.4, feedAge = (f) => (gt - f.born) / Math.max(.5, speed * boost);
function addReward(e, r) {
  S.score += r.pts; S.feed.push({ r, t: fmt(e.min), born: gt });
  if (r.pts > 0) { sfx("coin"); spark(H); comic(r.pts >= 15 ? "KA-CHING!" : "+" + r.pts); if (H.pose === "idle") H.pose = "cheer"; setTimeout(() => { if (H.pose === "cheer") H.pose = "idle"; }, 600); }
  else { sfx("low"); S.shake = 1; }
}
const fmt = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

/* =====================================================================================================
   10. PLAYING ONE LOG, PLAYING THE DAY, AND "FIT TO N SECONDS"
   ===================================================================================================== */
const FIT = { on: false, total: 30, per: 0, t0: 0 };
function fitPlan(list) {                        // equal slices, at least 1.8 s each; too many scenes -> only the highlights are acted out
  const MIN = 1.8, avail = Math.max(6, FIT.total - 3.5), keep = Math.max(3, Math.floor(avail / MIN));
  if (list.length <= keep) return { play: list, skip: new Set(), per: Math.min(6, avail / list.length) };
  const score = (e) => e.rewards.reduce((a, r) => a + Math.abs(r.pts), 0);
  const top = new Set(list.map((e, i) => ({ e, i, sc: score(e) })).sort((a, b) => b.sc - a.sc || a.i - b.i).slice(0, keep).map(x => x.e));
  return { play: list.filter(e => top.has(e)), skip: new Set(list.filter(e => !top.has(e))), per: MIN + (avail - keep * MIN) / keep };
}
function quietApply(e) { for (const r of e.rewards) { S.score += r.pts; } }                // a skipped scene still counts
function resetActors() { for (const a of Object.values(ACTORS)) { a.path = []; a.glide = null; a.pose = "idle"; a.inScene = false; a.alpha = 0; a.z = 0; } H.alpha = 1; H.inScene = true; const d = nearestFree([2, 8]); H.x = d[0] + .5; H.y = d[1] + .5; }
async function playLog(e, tk, state) {
  const res = ENGINE.resolve({ activityId: e.act, people: e.people }); if (!res.ok) return;
  Object.values(ACTORS).forEach(a => { a.inScene = false; }); H.inScene = true;          // other views draw only people the scene moves
  S.caption = e.title; S.clock = e.min; S.cast = res.instance.cast;
  await ACT[e.act](res.instance, tk);
  if (state) state.applied = true;
  for (let i = 0; i < e.rewards.length; i++) { await wait(.3, tk); addReward(e, e.rewards[i]); if (state) state.given = i + 1; }
}
let running = false;
async function runDay() {
  cancelAll(); const tk = tok; running = true; document.getElementById("bar").classList.add("playing");
  resetActors(); S.score = 0; S.feed = []; S.clock = 360; setView("ISO", true);
  const plan = FIT.on ? fitPlan(DAY) : null;
  try {
    for (const e of DAY) {
      if (tk.c) return;
      if (plan && plan.skip.has(e)) { quietApply(e); continue; }
      pickCamera(e);
      if (plan) {
        const r0 = performance.now(); FIT.per = plan.per; FIT.t0 = r0; const st = { applied: false, given: 0 }, sceneTk = { own: false, get c() { return this.own || tk.c; } };
        await Promise.race([playLog(e, sceneTk, st).catch(x => { if (x !== "cancel" && x !== "nopath") throw x; }), waitReal(plan.per * 1.5, tk)]);
        sceneTk.own = true; boost = 1; FIT.t0 = 0; resetPoses();
        for (const r of e.rewards.slice(st.given)) addReward(e, r);                  // a cut-off scene still pays out, exactly once
        const left = plan.per - (performance.now() - r0) / 1000; if (left > .15) await waitReal(left, tk);        // hold so the slice is really 'per' seconds
      } else { await playLog(e, tk); await wait(.6, tk); }
    }
    await wait(1, tk); S.caption = "Day complete: " + S.score + " points";
  } catch (err) { if (err !== "cancel" && err !== "nopath") console.error(err); }
  finally { running = false; document.getElementById("bar").classList.remove("playing"); }
}
function resetPoses() { for (const a of Object.values(ACTORS)) { a.path = []; a.glide = null; if (a.pose !== "lie") a.pose = "idle"; if (a.z > 0) { const f = nearestFree(cellOf(a)); a.x = f[0] + .5; a.y = f[1] + .5; a.z = 0; } } S.remote = null; }

/* =====================================================================================================
   11. DRAWING HELPERS
   ===================================================================================================== */
const P = (x, y, z = 0) => [(x - y) * TW / 2 + OX, (x + y) * TH / 2 + OY - z];
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")"; }
function poly(pts, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); g.closePath(); g.fill(); }
function box(x, y, w, h, z0, z1, col) {
  poly([P(x, y + h, z1), P(x + w, y + h, z1), P(x + w, y + h, z0), P(x, y + h, z0)], shade(col, .78));          // left face
  poly([P(x + w, y, z1), P(x + w, y + h, z1), P(x + w, y + h, z0), P(x + w, y, z0)], shade(col, .6));           // right face
  poly([P(x, y, z1), P(x + w, y, z1), P(x + w, y + h, z1), P(x, y + h, z1)], col);                              // top
}
/* The character: a handful of rectangles, chosen by pose. (x,y) = feet. s = scale. flip = -1 to face left. */
function figure(x, y, L, pose, t, s = 1, flip = 1) {
  const k = L.kid ? .72 : 1, u = s * k;
  const R = (rx, ry, w, h, c) => { g.fillStyle = c; const px = x + (flip > 0 ? rx : -rx - w) * u, py = y + ry * u; g.fillRect(Math.round(px), Math.round(py), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u))); };
  const sw = pose === "walk" ? Math.sin(t * 9) * 2.2 : 0, bob = pose === "walk" ? Math.abs(Math.sin(t * 9)) * .8 : (pose === "idle" ? Math.sin(t * 2) * .35 : 0);
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(x, y + 1, 6 * u, 2.2 * u, 0, 0, 7); g.fill();               // shadow
  let hy;                                                                                                             // head top y
  if (pose === "lie") {
    R(-10, -5, 16, 5, L.pant); R(-4, -7, 10, 7, L.shirt); R(-14, -8, 7, 7, L.skin); R(-14, -9, 7, 3, L.hair); return;
  }
  if (pose === "sit" || pose === "type" || pose === "read" || pose === "eat" || pose === "phone") {
    R(-1, -5, 7, 3, L.pant); R(4, -5, 3, 5, L.pant);                                                                  // thigh + shin
    R(-3, -16, 8, 11, L.shirt); hy = -23;
    if (pose === "type") { R(3, -13, 7, 3, L.skin); R(8, -12, 3, 2, "#cfd6e0"); }
    else if (pose === "read") { R(3, -13, 5, 4, L.skin); R(6, -15, 5, 7, "#f4f1ea"); }
    else if (pose === "eat") { R(3, -13 - (Math.sin(t * 6) > 0 ? 4 : 0), 4, 3, L.skin); }
    else if (pose === "phone") { R(3, -16, 4, 6, L.skin); R(6, -17, 3, 6, "#1b1f2a"); }
    else R(3, -12, 3, 6, L.skin);
  } else {
    const lift = pose === "lift" ? Math.abs(Math.sin(t * 5)) * 7 : 0;
    R(-3 + sw, -10, 3, 10, L.pant); R(1 - sw, -10, 3, 10, L.pant); R(-4, -20 + bob, 9, 11, L.shirt); hy = -27 + bob;
    if (pose === "lift") { R(-6, -20 - lift, 2.5, 9, L.skin); R(5, -20 - lift, 2.5, 9, L.skin); R(-8, -22 - lift, 18, 2, "#555"); }
    else if (pose === "cheer") { R(-6, -26, 2.5, 9, L.skin); R(5, -26, 2.5, 9, L.skin); }
    else if (pose === "calling") { R(2, -26, 3, 7, L.skin); R(4, -28, 2.5, 5, "#1b1f2a"); }
    else if (pose === "talk") { R(4, -19 - Math.abs(Math.sin(t * 5)) * 3, 3, 8, L.skin); R(-6, -19, 2.5, 8, L.skin); }
    else { R(-6 - sw * .5, -19, 2.5, 8, L.skin); R(5 + sw * .5, -19, 2.5, 8, L.skin); }
  }
  R(-3, hy, 7, 7, L.skin); R(-3.5, hy - 1.5, 8, 3.5, L.hair);                                                         // head + hair
  if (L.long) R(-4, hy, 2, 9, L.hair);
  if (L.cap) { R(-3.5, hy - 2.5, 8, 3, "#2f6fd6"); R(3, hy - .5, 4.5, 1.5, "#2f6fd6"); }
  if (L.beard) R(-2.5, hy + 5, 6, 2.5, L.hair);
  if (L.glasses) R(-2, hy + 2.5, 6, 1.4, "#222");
  R(1.5, hy + 2.5, 1.3, 1.3, "#14111a");                                                                              // eye
}
/* =====================================================================================================
   12. ISOMETRIC VIEW
   ===================================================================================================== */
function drawIso(t) {
  g.fillStyle = "#0d1018"; g.fillRect(0, 0, LW, LH);
  for (const r of ROOMS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], shade(r.floor, (x + y) % 2 ? 1 : .94));
  poly([P(0, 0, 40), P(GW, 0, 40), P(GW, 0), P(0, 0)], "#3a4256"); poly([P(0, 0, 40), P(0, GH, 40), P(0, GH), P(0, 0)], "#2e3547");   // back walls
  g.fillStyle = "#fff"; g.font = "700 8px system-ui"; g.textAlign = "center"; for (const r of ROOMS) { const [sx, sy] = P(r.x + r.w / 2, r.y + r.h / 2 + .2); g.globalAlpha = .55; g.fillText(r.n.toUpperCase(), sx, sy); g.globalAlpha = 1; }
  const list = [];
  for (const it of ITEMS) list.push({ d: it.x + it.y + (it.w + it.h) / 2 - (CAT[it.type].flat ? 99 : 0), fn: () => box(it.x, it.y, it.w, it.h, 0, CAT[it.type].height, CAT[it.type].color) });
  for (const a of Object.values(ACTORS)) if (a.alpha > 0) list.push({ d: a.x + a.y + .4 + (a.z > 0 ? .6 : 0), fn: () => { const [sx, sy] = P(a.x, a.y, a.z); figure(sx, sy, a.look, a.pose, t, 1, a.dir === "W" || a.dir === "N" ? -1 : 1); } });
  list.sort((a, b) => a.d - b.d).forEach(o => o.fn());
}
/* =====================================================================================================
   13. FLAT 2D VIEWS. They draw ONLY the cast of the running scene: the hero, plus people the scene actually moved.
   ===================================================================================================== */
const castNow = () => Object.values(ACTORS).filter(a => a.alpha > 0 && (a === H || a.inScene));
const ENVS = { study: ["#33405a", "#6b5a4a"], kitchen: ["#5d5a4c", "#8c8672"], bed: ["#2b3350", "#6a5a52"], living: ["#2e4a3e", "#5b6d63"], gym: ["#3a3f4d", "#5f6370"], street: ["#6fa8d8", "#5a5f66"] };
function drawBand(env, t, scrolling) {
  const [wall, floor] = ENVS[env] || ENVS.living; g.save(); g.beginPath(); g.rect(SB.x, SB.y, SB.w, SB.h); g.clip();
  g.fillStyle = wall; g.fillRect(SB.x, SB.y, SB.w, SB.h * .72); g.fillStyle = floor; g.fillRect(SB.x, SB.y + SB.h * .72, SB.w, SB.h * .28);
  g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(40 + (scrolling ? -(t * 30 % 120) : 0), SB.y + 30, 90, 70);   // a window (it scrolls while walking)
  const D = { study: () => { g.fillStyle = "#8a6a4a"; g.fillRect(190, SB.y + SB.h * .5, 120, 14); g.fillStyle = "#1b1f2a"; g.fillRect(230, SB.y + SB.h * .5 - 34, 40, 34); },
              kitchen: () => { g.fillStyle = "#9a9a9a"; g.fillRect(0, SB.y + SB.h * .52, 360, 12); g.fillStyle = "#d8dde6"; g.fillRect(300, SB.y + 40, 40, 130); },
              bed: () => { g.fillStyle = "#5b7bd5"; g.fillRect(150, SB.y + SB.h * .56, 190, 22); },
              gym: () => { g.fillStyle = "#d2675c"; g.fillRect(40, SB.y + SB.h * .74, 280, 8); },
              living: () => { g.fillStyle = "#4f9a7d"; g.fillRect(170, SB.y + SB.h * .5, 170, 28); } }[env]; if (D) D();
  g.restore();
}
function drawFlat(view, t) {
  const env = (S.cast && ENGINE.ACTIVITIES[curAct] || {}).env || "living", cast = castNow(), moving = H.pose === "walk";
  g.fillStyle = "#0d1018"; g.fillRect(0, 0, LW, LH); drawBand(env, t, moving);
  g.save(); g.beginPath(); g.rect(SB.x, SB.y, SB.w, SB.h); g.clip();
  if (view === "FACE") { const L = H.look; g.translate(SB.w / 2, SB.y + 190); g.scale(7, 7); figure(0, 0, L, "idle", t, 1, 1); }
  else { const k = view === "FULL" ? 2.2 : 4.4, base = SB.y + SB.h * .9; cast.forEach((a, i) => figure(70 + i * (view === "FULL" ? 60 : 78) + (moving ? Math.sin(t * .7) * 10 : 0), base - (a.z > 0 ? a.z * 1.4 : 0), a.look, a.pose === "walk" || a.pose === "idle" || ["lie", "sit"].includes(a.pose) ? a.pose : a.pose, t, k, 1)); }
  g.restore();
}
/* =====================================================================================================
   14. CAMERA: one view at a time, switched with a ZOOM (never a wipe). A snapshot of the old frame zooms in and fades out
       while the new view settles from slightly zoomed-in to normal.
   ===================================================================================================== */
let view = "ISO", curAct = "work", T = null; const snap = document.createElement("canvas"); snap.width = LW; snap.height = LH; const sg = snap.getContext("2d");
function setView(v, cut) { if (v === view) return; if (!cut) { sg.drawImage(cv, 0, 0); T = { t0: performance.now(), dur: 700 }; } view = v; }
const SUG = { work: ["FULL", "SIDE", "FACE"], eat: ["FULL", "SIDE"], workout: ["FULL", "SIDE", "FACE"], call: ["FACE", "SIDE"], scroll: ["SIDE", "FACE"], read: ["SIDE", "FACE"], sleep: ["FULL", "FACE"], family: ["ISO", "SIDE"], walk: ["ISO", "SIDE"] };
let camTimer = 0;
function pickCamera(e) {
  curAct = e.act; const mode = document.getElementById("sView").value; clearTimeout(camTimer);
  if (mode === "SUGGEST") { const seq = (SUG[e.act] || ["FULL", "SIDE"]).slice(0, FIT.on ? 2 : 3), per = FIT.on ? Math.max(.9, FIT.per / seq.length) : 3.2; seq.forEach((v, i) => setTimeout(() => { if (running) { setView(v); } }, i * per * 1000)); setView(seq[0]); }
  else setView(mode);
}
/* =====================================================================================================
   15. EFFECTS: floating comic words, sparks, screen shake, points cards, HUD
   ===================================================================================================== */
function comic(word) { S.comics.push({ word, born: performance.now() }); }
function spark(a) { for (let i = 0; i < 14; i++) S.fx.push({ a, vx: (Math.random() - .5) * 60, vy: -30 - Math.random() * 50, born: performance.now(), c: ["#ffd23f", "#ff6b4a", "#4fd1b8"][i % 3] }); }
function drawFx() {
  const now = performance.now(); S.comics = S.comics.filter(c => now - c.born < 1400); S.fx = S.fx.filter(p => now - p.born < 900);
  for (const c of S.comics) { const k = (now - c.born) / 1400, sc = 1 + Math.sin(Math.min(1, k * 4) * Math.PI) * .25; g.save(); g.translate(LW / 2, 120); g.rotate(-.1); g.scale(sc, sc); g.globalAlpha = 1 - Math.max(0, k - .7) / .3;
    g.font = "900 italic 38px 'Arial Black',Impact,system-ui"; g.textAlign = "center"; g.lineWidth = 7; g.strokeStyle = "#14111a"; g.strokeText(c.word, 0, 0); g.fillStyle = "#ffd23f"; g.fillText(c.word, 0, 0); g.restore(); }
  for (const p of S.fx) { const k = (now - p.born) / 1000, [sx, sy] = P(p.a.x, p.a.y, 22); g.fillStyle = p.c; g.globalAlpha = 1 - k; g.fillRect(sx + p.vx * k, sy + p.vy * k + 60 * k * k, 3, 3); g.globalAlpha = 1; }
  S.feed = S.feed.filter(f => feedAge(f) < FEED_LIFE + .5);                                                          // points cards: expire
  S.feed.slice(-3).forEach((f, i) => { const a = feedAge(f), slide = Math.max(0, 1 - a * 4) * 70, out = Math.max(0, (a - (FEED_LIFE - .4)) / .4), x = 250 + slide, y = 20 + i * 34 + out * 10;
    g.save(); g.globalAlpha = Math.min(1, a * 4) * (1 - out); g.fillStyle = f.r.pts > 0 ? "#fff3c4" : "#e3e6ee"; g.beginPath(); g.roundRect(x, y, 100, 28, 8); g.fill();
    g.fillStyle = f.r.pts > 0 ? "#b5650f" : "#6a7383"; g.font = "800 13px system-ui"; g.textAlign = "left"; g.fillText((f.r.pts > 0 ? "+" : "") + f.r.pts, x + 8, y + 18); g.fillStyle = "#3a3226"; g.font = "600 8px system-ui"; g.fillText(f.r.label.slice(0, 18), x + 38, y + 17); g.restore(); });
}
function drawHud() {
  g.fillStyle = "rgba(12,16,24,.8)"; g.beginPath(); g.roundRect(8, 8, 120, 34, 10); g.fill(); g.fillStyle = "#fff"; g.textAlign = "left"; g.font = "800 16px ui-monospace,monospace"; g.fillText(fmt(S.clock), 16, 30);
  g.font = "700 11px system-ui"; g.fillStyle = "#ffc65a"; g.fillText(S.score + " pts", 76, 30);
  if (S.caption) { g.fillStyle = "rgba(12,16,24,.85)"; g.beginPath(); g.roundRect(8, LH - 70, 344, 44, 12); g.fill(); g.fillStyle = "#fff"; g.font = "700 14px system-ui"; g.fillText(S.caption.slice(0, 40), 20, LH - 43); }
  if (S.remote) { const ids = S.remote; g.fillStyle = "#23304a"; g.beginPath(); g.roundRect(250, 110, 100, 80, 10); g.fill(); ids.slice(0, 2).forEach((id, i) => { const L = LOOKS[id] || { skin: "#8a93a3", hair: "#6b7486", shirt: "#6b7486", pant: "#6b7486" }; g.save(); g.beginPath(); g.rect(252, 112, 96, 76); g.clip(); g.translate(300 + (i - (ids.length - 1) / 2) * 34, 178); g.scale(3, 3); figure(0, 0, L, "idle", 0, 1, 1); g.restore(); }); g.fillStyle = "#9fd8c9"; g.font = "700 8px system-ui"; g.fillText("ON THE PHONE", 262, 124); }
}
/* =====================================================================================================
   16. MAIN LOOP
   ===================================================================================================== */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;   // clamp: a long stall (background tab) must not teleport anyone
  const sp = paused ? 0 : speed;
  if (FIT.on && FIT.t0) { const el = (performance.now() - FIT.t0) / (FIT.per * 1000); boost = el < .3 ? 1.6 : Math.min(8, 1.6 + (el - .3) * 12); }   // ramp so every scene ends inside its slice
  const keep = speed; speed = sp; gt += dt * speed * boost; pump(); stepActors(dt); speed = keep;
  const t = now / 1000;
  g.save();
  if (S.shake > 0) { g.translate((Math.random() - .5) * 6 * S.shake, (Math.random() - .5) * 6 * S.shake); S.shake = Math.max(0, S.shake - dt * 3); }
  let e = 1; if (T) { const p = Math.min(1, (now - T.t0) / T.dur); e = p * p * (3 - 2 * p); const s = 1.22 - .22 * e; g.translate(LW / 2, LH / 2); g.scale(s, s); g.translate(-LW / 2, -LH / 2); }
  if (view === "ISO") drawIso(t); else drawFlat(view, t);
  g.restore();
  if (T) { const p = Math.min(1, (now - T.t0) / T.dur), ee = p * p * (3 - 2 * p), s = 1 + .3 * ee; g.save(); g.globalAlpha = 1 - ee; g.translate(LW / 2, LH / 2); g.scale(s, s); g.drawImage(snap, -LW / 2, -LH / 2); g.restore(); if (p >= 1) T = null; }
  drawFx(); drawHud();
  requestAnimationFrame(frame);
}
/* =====================================================================================================
   17. SOUND (tiny synthesised blips, no files)
   ===================================================================================================== */
let AC = null;
function sfx(kind) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), v = AC.createGain(); o.connect(v); v.connect(AC.destination); const f = kind === "coin" ? [880, 1320] : [220, 140]; o.frequency.setValueAtTime(f[0], AC.currentTime); o.frequency.setValueAtTime(f[1], AC.currentTime + .08); v.gain.setValueAtTime(.08, AC.currentTime); v.gain.exponentialRampToValueAtTime(.001, AC.currentTime + .25); o.start(); o.stop(AC.currentTime + .26); } catch (e) { } }
/* =====================================================================================================
   18. UI: play, fit, speed, view, free play, record
   ===================================================================================================== */
const $ = (id) => document.getElementById(id);
$("bPlay").onclick = () => { if (AC && AC.state === "suspended") AC.resume(); runDay(); };
$("bFit").onclick = () => { FIT.on = !FIT.on; $("bFit").setAttribute("aria-pressed", String(FIT.on)); };
$("sSpeed").onchange = () => { speed = +$("sSpeed").value; };
$("sView").onchange = () => { if ($("sView").value !== "SUGGEST") setView($("sView").value); };
cv.addEventListener("click", (ev) => {                                       // while playing a tap pauses; in free play a tap walks
  const r = cv.getBoundingClientRect(), lx = (ev.clientX - r.left) * LW / r.width, ly = (ev.clientY - r.top) * LH / r.height;
  if (running) { paused = !paused; return; }
  if (!free$.on) return;
  const a = (lx - OX) / (TW / 2), b = (ly - OY) / (TH / 2), gx = Math.floor((a + b) / 2), gy = Math.floor((b - a) / 2);
  const hit = ITEMS.slice().reverse().find(f => gx >= f.x && gx < f.x + f.w && gy >= f.y && gy < f.y + f.h);
  cancelAll(); const tk = tok;
  (async () => { try { if (hit && CAT[hit.type].use) { const pose = { bed: "lie", sofa: "sit", chair: "type", stool: "eat", mat: "lift", rug: "sit" }[hit.type] || "sit"; S.caption = "You: " + hit.type; await useAt(H, hit.type, pose, 4, tk); } else if (free(gx, gy)) { S.caption = "Walking"; await walkTo(H, [gx, gy], tk); } } catch (e) { } })();
});
const free$ = { on: false };
$("bFree").onclick = () => { cancelAll(); running = false; resetActors(); setView("ISO", true); free$.on = true; S.caption = "Free play: tap the floor to walk, tap furniture to use it. Nothing is logged."; S.score = 0; S.feed = []; };
$("bRec").onclick = () => {                                                   // record the canvas (and nothing else) to a video file
  const stream = cv.captureStream(30), mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  if (!mime) { alert("This browser cannot record video."); return; }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 }), chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
  rec.onstop = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(chunks, { type: mime })); a.download = "day." + (mime.includes("mp4") ? "mp4" : "webm"); a.click(); };
  rec.start(); runDay().then(() => setTimeout(() => rec.stop(), 800));
};
resetActors(); S.caption = "Press Play the day"; requestAnimationFrame(frame);
window.PixelLife = { ENGINE, ACT, DAY, LOOKS, ACTORS, ITEMS, CAT, ROOMS, runDay, FIT, S };   // handy for the console and for tests
</script>
</body>
</html>
```

---

## 26. Test files

### 26.1 `engine.test.js`

Save next to the HTML and run `node engine.test.js`. It extracts the pure engine and the fit planner from the HTML and checks the golden rules. Expected output:

```
engine: all tests passed
fit-to-N: all tests passed
```

```js
// Run with: node engine.test.js   (extracts the pure ENGINE block from pixel-life-sim.html and tests the three golden rules)
const fs = require("fs"), assert = require("assert");
const html = fs.readFileSync(__dirname + "/pixel-life-sim.html", "utf8");
const a = html.indexOf("const ENGINE = (() => {"), b = html.indexOf("})();", a) + 5;
const ENGINE = new Function(html.slice(a, b) + "; return ENGINE;")();

// Rule 1: never invent another person
const solo = ENGINE.resolve({ activityId: "work", people: [] });
assert.deepStrictEqual(solo.instance.cast.map(c => c.id), ["hero"]);
const refused = ENGINE.resolve({ activityId: "work", people: ["partner"] });          // work is SOLO: a named partner is refused, not silently added
assert.deepStrictEqual(refused.instance.cast.map(c => c.id), ["hero"]);
assert.strictEqual(refused.rejected[0].reason, "NOT_ALLOWED_FOR_ACTIVITY");
assert.strictEqual(ENGINE.resolve({ activityId: "eat", people: ["stranger"] }).rejected[0].reason, "UNKNOWN_CHARACTER");

// A phone call: the other person is REMOTE (a panel), never in the room; nobody named -> a faceless caller
const call = ENGINE.resolve({ activityId: "call", people: ["mentor"] }).instance.cast;
assert.strictEqual(call.find(c => c.id === "mentor").presence, "REMOTE");
assert.strictEqual(ENGINE.resolve({ activityId: "call", people: [] }).instance.cast[1].id, "caller");

// A group shortcut expands to real members only
assert.deepStrictEqual(ENGINE.resolve({ activityId: "family", people: ["family"] }).instance.cast.map(c => c.id), ["hero", "partner", "child"]);

// Rule 2: the same input gives the same output
const j = (x) => JSON.stringify(x);
assert.strictEqual(j(ENGINE.resolve({ activityId: "eat", people: ["partner", "child"] })), j(ENGINE.resolve({ activityId: "eat", people: ["partner", "child"] })));

// Rule 3: a preview never writes
assert.strictEqual(ENGINE.resolve({ activityId: "workout", people: [] }).instance.ledgerWrite, false);
console.log("engine: all tests passed");

// "Fit to N seconds": the plan always fits the budget, keeps highlights first, and every skipped scene still counts
const fa = html.indexOf("const FIT = {"), fb = html.indexOf("function quietApply");
const { fitPlan, FIT } = new Function(html.slice(fa, fb) + "; return { fitPlan, FIT };")();
const mk = (n) => Array.from({ length: n }, (_, i) => ({ sid: "s" + i, rewards: [{ pts: i % 7 === 0 ? 20 : 3 }] }));
for (const total of [30, 45, 60]) for (const n of [5, 10, 25, 60]) {
  FIT.total = total; const plan = fitPlan(mk(n)); const used = plan.play.length * plan.per;
  assert(used <= total - 3.4, `n=${n} total=${total} used=${used}`);                         // leaves room for the ending
  assert(plan.per >= 1.79 || plan.play.length === n, "slice too short to see");
  assert.strictEqual(plan.play.length + plan.skip.size, n);                                  // nothing lost: played + silently counted
}
FIT.total = 30; const hl = fitPlan(mk(60)); assert(hl.play.some(e => e.rewards[0].pts === 20), "highlights kept");
console.log("fit-to-N: all tests passed");
```

### 26.2 `simulate.js`

Save next to the HTML and run `node simulate.js pixel-life-sim.html fit 30`. Expected last line: `{"mode":"fit","virtualSecs":"28.4","done":true,"score":81,...}`.

```js
// simulate.js: runs the reference game headless in node with a virtual clock (no browser, no throttling).
// Usage: node simulate.js pixel-life-sim.html natural        or        node simulate.js pixel-life-sim.html fit 30
// It stubs the canvas and DOM, drives frame() by hand at 60 fps of virtual time, and prints the elapsed virtual seconds and the score.
const fs=require("fs"); const html=fs.readFileSync(process.argv[2],"utf8");
const src=html.slice(html.indexOf("<script>")+8, html.lastIndexOf("</script>"));
let vnow=0; const ctx=new Proxy({}, {get:(t,k)=>k==="measureText"?()=>({width:10}):()=>{}, set:()=>true});
const el=()=>new Proxy({classList:{add(){},remove(){}},style:{},getContext:()=>ctx,addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:360,height:640}),setAttribute(){},value:"SUGGEST",captureStream(){}}, {get:(t,k)=>k in t?t[k]:undefined,set:(t,k,v)=>{t[k]=v;return true}});
const els={}; global.document={getElementById:(id)=>els[id]||(els[id]=el()),createElement:()=>el()};
global.window=global; global.performance={now:()=>vnow}; let rafCb=null; global.requestAnimationFrame=(f)=>{rafCb=f}; global.setTimeout=(f,ms)=>{pend.push([vnow+ms,f])}; global.clearTimeout=()=>{}; const pend=[];
global.alert=()=>{}; global.AudioContext=undefined; global.MediaRecorder=undefined; global.URL={createObjectURL(){}}; global.Blob=class{};
new Function(src+"; global.__PL = window.PixelLife; global.__frame = frame;")();
const PL=global.__PL; const mode=process.argv[3]||"fit";
if(mode==="fit"){PL.FIT.on=true; PL.FIT.total=+process.argv[4]||30;}
document.getElementById("sSpeed").value="2";
let done=false; PL.runDay().then(()=>{done=true});
(async()=>{
  while(!done && vnow<300000){ vnow+=16; for(let i=pend.length-1;i>=0;i--) if(pend[i][0]<=vnow){const f=pend.splice(i,1)[0][1]; f();} global.__frame(vnow); for(let k=0;k<8;k++) await Promise.resolve(); }
  const exp=PL.DAY.flatMap(e=>e.rewards).reduce((a,r)=>a+r.pts,0);
  console.log(JSON.stringify({mode, virtualSecs:(vnow/1000).toFixed(1), done, score:PL.S.score, expected:exp, caption:PL.S.caption}));
})();
```

---

## 27. License

MIT License

Copyright (c) 2026 The Pixel Life Simulator authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

*End of document.*
