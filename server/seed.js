export const stages = {
  design: ["idea", "exploring", "specified", "approved", "superseded"],
  build: ["not started", "in progress", "integrated", "verified", "blocked"],
  art: ["reference", "blockout", "prototype", "polish", "approved"],
  gameplay: [
    "not tested",
    "needs test",
    "playtested",
    "accepted",
    "needs redesign",
  ],
};
export function seed() {
  const stamp = new Date().toISOString();
  const record = (id, type, title, description, section, extra = {}) => ({
    id,
    project_id: "project-demo",
    type,
    title,
    description,
    section,
    status: "active",
    created_at: stamp,
    updated_at: stamp,
    created_by: "Example workspace",
    revision: 1,
    source_refs: [],
    design: "specified",
    build: "not started",
    gameplay: "not tested",
    depends_on: [],
    ...extra,
  });
  return {
    version: 1,
    project: {
      id: "project-demo",
      title: "Scavengers Pit",
      premise:
        "A co-op extraction adventure in the ruins of a forgotten orbital colony. Scavenge, improvise, and get home before the wormhole closes.",
      example: true,
      milestone: "First playable extraction loop",
      unityRoot: "",
    },
    sections: [
      { id: "systems", title: "Game systems", icon: "boxes" },
      { id: "world", title: "World & narrative", icon: "orbit" },
      { id: "characters", title: "Characters & gear", icon: "person" },
      { id: "production", title: "Production", icon: "folder" },
    ],
    types: [
      {
        id: "mechanic",
        title: "Mechanic",
        fields: ["Player experience", "Rules", "Open questions"],
      },
      {
        id: "location",
        title: "Location",
        fields: ["Atmosphere", "Encounters"],
      },
      { id: "asset", title: "Asset", fields: ["Constraints", "Provenance"] },
      { id: "task", title: "Work item", fields: ["Acceptance criteria"] },
    ],
    workflows: stages,
    records: [
      record(
        "loop",
        "mechanic",
        "Scavenge. Survive. Extract.",
        "Players enter a derelict colony, collect salvage, and reach extraction before the event window closes. The first playable should prove the tension between one more room and getting home.",
        "systems",
        { design: "approved", build: "integrated", gameplay: "needs test" },
      ),
      record(
        "wormhole",
        "mechanic",
        "Wormhole event window",
        "Proposed event duration: 10 minutes. A visible countdown creates urgency. Confirm the duration through a human playtest before treating it as final.",
        "systems",
        { design: "exploring", build: "in progress", depends_on: ["loop"] },
      ),
      record(
        "salvage",
        "mechanic",
        "Salvage & inventory",
        "Salvage occupies backpack slots. Players choose between carrying tools and carrying loot. Weight and slot limits need a design decision.",
        "systems",
        { design: "exploring", build: "blocked" },
      ),
      record(
        "colony",
        "location",
        "The abandoned colony",
        "Cold machinery, overgrown corridors, and traces of a missing crew. Art direction proposal: worn industrial silhouettes with amber practical lighting.",
        "world",
        { design: "exploring" },
      ),
      record(
        "backpack",
        "asset",
        "Scavenger backpack",
        "A compact industrial salvage pack. Proxy target: under 2,000 triangles, meter scale, Y-up, original work. Review silhouette independently of engine integration.",
        "characters",
        {
          art: "blockout",
          build: "not started",
          revisions: [],
          provenance:
            "Example proxy generated locally; original procedural geometry.",
        },
      ),
      record(
        "task-timer",
        "task",
        "Prototype the extraction countdown",
        "Specify a countdown, warning thresholds, and extraction timeout behavior.",
        "production",
        {
          priority: 1,
          estimate: "30–60 min",
          depends_on: ["loop"],
          target: "wormhole",
          acceptance_criteria:
            "Countdown visible in HUD; timeout behavior has a test; human pacing feedback recorded.",
        },
      ),
      record(
        "task-slots",
        "task",
        "Decide the backpack capacity",
        "Choose initial slot capacity and document the tradeoffs.",
        "production",
        {
          priority: 2,
          estimate: "15–30 min",
          target: "salvage",
          acceptance_criteria:
            "An approved design decision links to the inventory specification.",
        },
      ),
      record(
        "task-pack",
        "task",
        "Review the backpack blockout",
        "Inspect the silhouette and record a specific revision request.",
        "production",
        {
          priority: 3,
          estimate: "10–15 min",
          target: "backpack",
          acceptance_criteria:
            "A visual review records silhouette feedback and the next art stage.",
        },
      ),
      record(
        "task-test",
        "task",
        "Playtest the first extraction loop",
        "Test whether the event window creates interesting risk decisions.",
        "production",
        {
          priority: 4,
          estimate: "45–90 min",
          depends_on: ["task-timer"],
          acceptance_criteria:
            "Record a human playtest with observations and follow-up tasks.",
        },
      ),
    ],
    inbox: [],
    proposals: [],
    runs: [],
    evidence: [],
    playtests: [],
    decisions: [],
    events: [
      {
        id: "welcome",
        at: stamp,
        message:
          "Example workspace initialized. No Unity or Codex execution has occurred.",
      },
    ],
    redirects: {},
  };
}
