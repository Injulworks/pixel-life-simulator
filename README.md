# Pixel Life Simulator

Turn a list of daily activity logs into a playable, shareable, vertical pixel-art "day in the life" video. One HTML file, no libraries, no build step.

- **Run it:** open `pixel-life-sim.html` in a browser and press **Play the day**. Try **Fit 30 s**, the camera menu, **Free play** and **Record**.
- **Learn it / rebuild it:** read [`GUIDE.md`](GUIDE.md): master prompt for an AI coding assistant, full spec, architecture, characters, animation, cameras, effects, pacing, 22 customization recipes, and the complete code.
- **Test it:** `node engine.test.js` (engine rules and the fit planner) and `node simulate.js pixel-life-sim.html fit 30` (headless run with a virtual clock).

Golden rules: never invent another person; same input gives the same scene; playing never writes data.

License: MIT. All people and data in the sample are fictional.
