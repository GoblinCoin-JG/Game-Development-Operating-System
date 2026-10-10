import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Flame,
  Files,
  Search,
  GitBranch,
  Box,
  Network,
  Settings,
  PanelRight,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Play,
  Check,
  Clock,
  Terminal,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Inbox,
  Home,
  Layers,
  Folder,
  FileText,
  MoreHorizontal,
  Command,
  ExternalLink,
  ShieldCheck,
  Activity,
  X,
  RefreshCw,
  Download,
  Upload,
  Beaker,
  Grip,
  Orbit,
  Target,
  Send,
  Link,
  SlidersHorizontal,
  Pause,
  Undo2,
} from "lucide-react";
import { api, mutate, download, upload } from "./api";
import { Viewer } from "./Viewer";
import "./style.css";
type Data = any;
const navs = [
  { id: "home", label: "Overview", icon: Home },
  { id: "explorer", label: "Project explorer", icon: Files },
  { id: "work", label: "Work board", icon: GitBranch },
  { id: "assets", label: "Asset studio", icon: Box },
  { id: "graph", label: "Knowledge graph", icon: Network },
  { id: "review", label: "Inbox & review", icon: Inbox },
  { id: "playtests", label: "Playtests", icon: Beaker },
];
const pretty = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
function Badge({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function App() {
  const [data, setData] = useState<Data>(null),
    [integrations, setIntegrations] = useState<Data>(null),
    [view, setView] = useState("home"),
    [section, setSection] = useState(""),
    [selected, setSelected] = useState("wormhole"),
    [inspector, setInspector] = useState(false),
    [search, setSearch] = useState(""),
    [focus, setFocus] = useState("all"),
    [modal, setModal] = useState<Data>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [bottom, setBottom] = useState(true),
    [palette, setPalette] = useState(false),
    [asset, setAsset] = useState("backpack"),
    [recordView, setRecordView] = useState("list");
  const refresh = async () => {
    setData(await api("state?focus=" + focus));
  };
  useEffect(() => {
    refresh().catch((e) => setToast(e.message));
    api("integrations")
      .then(setIntegrations)
      .catch((e) => setToast(e.message));
  }, [focus]);
  useEffect(() => {
    if (!data?.runs.some((r: Data) => r.status === "running")) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [data?.runs]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") {
        setModal(null);
        setPalette(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const perform = async (op: string, payload: Data) => {
    setBusy(true);
    try {
      await mutate(op, payload);
      await refresh();
      setToast("Workspace saved");
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const open = (id: string) => {
    const seen = new Set();
    while (data?.redirects[id] && !seen.has(id)) {
      seen.add(id);
      id = data.redirects[id];
    }
    setSelected(id);
    setInspector(true);
  };
  if (!data)
    return (
      <div className="loading">
        <Flame size={38} />
        <h1>Forge</h1>
        <p>{toast || "Opening your development workspace…"}</p>
      </div>
    );
  const records = data.records as Data[],
    current = records.find((r) => r.id === selected),
    assets = records.filter((r) => r.type === "asset"),
    currentAsset = assets.find((r) => r.id === asset) || assets[0],
    pending = data.proposals.filter((p: Data) => p.status === "pending"),
    tasks = records.filter((r) => r.type === "task"),
    filtered = records.filter(
      (r) =>
        (!section || r.section === section) &&
        `${r.title} ${r.description} ${r.type}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
    activeNav = navs.find((n) => n.id === view),
    verified = tasks.filter((t) => t.build === "verified").length;
  const analysis = async (kind: string, entity_id?: string) => {
    try {
      setModal({
        kind,
        analysis: await api(
          kind === "impact" ? "impact?id=" + entity_id : "overlaps",
        ),
      });
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const plan = async (r: Data, request?: string, inbox_id?: string) => {
    if (await perform("plan", { entity_id: r.id, request, inbox_id })) {
      setView("review");
      setSection("");
    }
  };
  function Heading({
    eyebrow,
    title,
    description,
    children,
  }: {
    eyebrow: string;
    title: string;
    description: string;
    children?: React.ReactNode;
  }) {
    return (
      <div className="page-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="heading-actions">{children}</div>
      </div>
    );
  }
  const recordRow = (r: Data) => (
    <button className="record-row" key={r.id} onClick={() => open(r.id)}>
      <span className={"record-icon " + r.type}>
        {r.type === "asset" ? (
          <Box size={18} />
        ) : r.type === "task" ? (
          <CheckCircle2 size={18} />
        ) : (
          <FileText size={18} />
        )}
      </span>
      <div>
        <strong>{r.title}</strong>
        <small>
          {data.types.find((t: Data) => t.id === r.type)?.title} ·{" "}
          {data.sections.find((s: Data) => s.id === r.section)?.title}
        </small>
      </div>
      <Badge
        tone={
          r.build === "verified" ? "green" : r.build === "blocked" ? "red" : ""
        }
      >
        {pretty(r.build)}
      </Badge>
      <ChevronRight size={15} />
    </button>
  );
  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="wordmark">
          <Flame size={21} />
          <b>FORGE</b>
          <span>GAME DEVELOPMENT OS</span>
        </div>
        <button className="command-search" onClick={() => setPalette(true)}>
          <Search size={14} />
          <span>Search your workspace or run a command</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="titlebar-right">
          <span className="local-dot" />
          Local workspace
          <button
            aria-label="Toggle inspector"
            onClick={() => setInspector(!inspector)}
          >
            <PanelRight size={17} />
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="activitybar">
          {navs.map((n) => (
            <button
              key={n.id}
              title={n.label}
              aria-label={n.label}
              className={view === n.id ? "active" : ""}
              onClick={() => {
                setView(n.id);
                setSection("");
                setSearch("");
              }}
            >
              <n.icon size={22} />
              {n.id === "review" && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </button>
          ))}
          <div className="activity-spacer" />
          <button
            title="Settings"
            aria-label="Settings"
            onClick={() => setView("settings")}
            className={view === "settings" ? "active" : ""}
          >
            <Settings size={22} />
          </button>
          <div className="avatar">JD</div>
        </aside>
        <aside className="sidebar">
          <div className="sidebar-caption">
            WORKSPACE{" "}
            <button
              aria-label="Create a workspace"
              onClick={() => setModal({ kind: "bootstrap" })}
            >
              <Plus size={15} />
            </button>
          </div>
          <button
            className="project-switch"
            onClick={() => setModal({ kind: "bootstrap" })}
          >
            <div className="project-logo">
              <Orbit size={23} />
            </div>
            <div>
              <strong>{data.project.title}</strong>
              <small>
                {data.project.example ? "Example project" : "Local project"}{" "}
                <ChevronDown size={11} />
              </small>
            </div>
            <MoreHorizontal size={16} />
          </button>
          <div className="sidebar-group-label">WORKBENCH</div>
          <nav>
            {navs.map((n) => (
              <button
                key={n.id}
                className={view === n.id && !section ? "selected" : ""}
                onClick={() => {
                  setView(n.id);
                  setSection("");
                  setSearch("");
                }}
              >
                <n.icon size={16} />
                {n.label}
                {n.id === "review" &&
                  data.inbox.filter((i: Data) => i.status === "open").length +
                    pending.length >
                    0 && (
                    <span className="nav-count">
                      {data.inbox.filter((i: Data) => i.status === "open")
                        .length + pending.length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="sidebar-group-label sections-label">
            PROJECT EXPLORER{" "}
            <button
              title="Add custom type and section"
              aria-label="Add custom type and section"
              onClick={() => setModal({ kind: "schema" })}
            >
              <Plus size={14} />
            </button>
          </div>
          {data.sections.map((s: Data) => (
            <div key={s.id} className="tree-section">
              <button
                className={
                  section === s.id ? "tree-heading chosen" : "tree-heading"
                }
                onClick={() => {
                  setSection(section === s.id ? "" : s.id);
                  setView("explorer");
                }}
              >
                <ChevronDown size={12} />
                <Folder size={15} />
                {s.title}
                <small>
                  {records.filter((r) => r.section === s.id).length}
                </small>
              </button>
              {records
                .filter((r) => r.section === s.id && r.type !== "task")
                .slice(0, 3)
                .map((r) => (
                  <button
                    key={r.id}
                    className="tree-record"
                    onClick={() => open(r.id)}
                  >
                    <span
                      className={
                        "tree-dot " + (r.type === "asset" ? "amber" : "")
                      }
                    />
                    {r.title}
                  </button>
                ))}
            </div>
          ))}
          <div className="sidebar-bottom">
            <div className="mini-kicker">
              <span className="local-dot" /> WORKSPACE HEALTH
            </div>
            <strong>
              {tasks.length ? Math.round((verified / tasks.length) * 100) : 0}%
              technically verified
            </strong>
            <div className="mini-progress">
              <i
                style={{
                  width: `${tasks.length ? (verified / tasks.length) * 100 : 0}%`,
                }}
              />
            </div>
            <small>
              {tasks.length - verified} work items · {pending.length} to review
            </small>
            <button onClick={() => setView("settings")}>
              <ShieldCheck size={13} /> Stored on this machine{" "}
              <ChevronRight size={13} />
            </button>
          </div>
        </aside>
        <main className="editor">
          <div className="tabbar">
            <div className="editor-tab">
              <span className="tab-dot" />
              {activeNav?.label || "Settings"}
            </div>
            <span className="tab-context">
              {data.project.title.toLowerCase().replaceAll(" ", "-")} /
              workspace
            </span>
            <button
              aria-label="Toggle activity panel"
              onClick={() => setBottom(!bottom)}
            >
              <Terminal size={15} />
            </button>
          </div>
          <div className="breadcrumbs">
            <Folder size={12} />
            {data.project.title}
            <ChevronRight size={12} />
            {section
              ? data.sections.find((s: Data) => s.id === section)?.title
              : activeNav?.label || "Settings"}
            <div className="breadcrumb-end">
              <span className="local-dot" />
              {busy ? "Saving…" : "All changes saved"}
            </div>
          </div>
          <div className="editor-scroll">
            {view === "home" && (
              <>
                <Heading
                  eyebrow="YOUR DEVELOPMENT WORKSPACE"
                  title="Let’s build something worth playing."
                  description="A clear next step. A little less chaos. Your game, moving forward."
                >
                  <button
                    className="button subtle"
                    onClick={() => setView("work")}
                  >
                    <GitBranch size={14} /> View work board
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal({ kind: "create" })}
                  >
                    <Plus size={15} /> New work item
                  </button>
                </Heading>
                <div className="project-banner">
                  <div className="banner-copy">
                    <Badge tone="amber">FIRST PLAYABLE</Badge>
                    <h2>{data.project.milestone}</h2>
                    <p>{data.project.premise}</p>
                    <div className="banner-foot">
                      <span>
                        <Target size={14} />
                        {verified} / {tasks.length} tasks verified
                      </span>
                      <span>
                        <GitBranch size={13} /> Local-first
                      </span>
                      <button
                        onClick={() => {
                          setView("explorer");
                          setSection("");
                        }}
                      >
                        Explore project <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="colony-art"
                    aria-label="Illustration of an orbital colony"
                  >
                    <div className="planet" />
                    <div className="orbit-line" />
                    <div className="station">
                      <div className="station-core" />
                      <div className="station-arm left" />
                      <div className="station-arm right" />
                      <div className="station-tower" />
                      <div className="station-window" />
                    </div>
                    <span className="coordinate">
                      SECTOR 07 // SIGNAL FOUND
                    </span>
                  </div>
                </div>
                <div className="health-strip">
                  <div>
                    <span className="health-icon blue">
                      <Layers size={17} />
                    </span>
                    <div>
                      <strong>
                        {records.filter((r) => r.design === "approved").length}
                        <small> / {records.length}</small>
                      </strong>
                      <span>Design approved</span>
                    </div>
                  </div>
                  <div>
                    <span className="health-icon green">
                      <CheckCircle2 size={17} />
                    </span>
                    <div>
                      <strong>
                        {records.filter((r) => r.build === "verified").length}
                      </strong>
                      <span>Technically verified</span>
                    </div>
                  </div>
                  <div>
                    <span className="health-icon amber">
                      <Beaker size={17} />
                    </span>
                    <div>
                      <strong>{data.playtests.length}</strong>
                      <span>Human playtests</span>
                    </div>
                  </div>
                  <div>
                    <span className="health-icon purple">
                      <Inbox size={17} />
                    </span>
                    <div>
                      <strong>{pending.length}</strong>
                      <span>Awaiting review</span>
                    </div>
                  </div>
                </div>
                <div className="dashboard-grid">
                  <section className="next-panel">
                    <div className="section-title">
                      <h2>
                        <span className="orange-square">
                          <Play size={12} />
                        </span>{" "}
                        Pick up where you left off
                      </h2>
                      <select
                        aria-label="Session focus"
                        value={focus}
                        onChange={(e) => setFocus(e.target.value)}
                      >
                        <option value="all">Any session</option>
                        <option value="short">Quick wins</option>
                      </select>
                    </div>
                    {data.recommendations.length ? (
                      data.recommendations.map((r: Data, i: number) =>
                        i === 0 ? (
                          <div className="recommended" key={r.id}>
                            <div className="recommend-top">
                              <span>
                                <span className="local-dot" /> RECOMMENDED NEXT
                              </span>
                              <small>
                                <Clock size={12} />{" "}
                                {r.estimate || "Scope needed"}
                              </small>
                            </div>
                            <h3>{r.title}</h3>
                            <p>{r.why_now}</p>
                            <div className="recommend-tags">
                              <Badge tone="blue">
                                {r.blocked_by.length
                                  ? "Blocked"
                                  : "Ready to start"}
                              </Badge>
                              <span>
                                {r.source_links.length} linked sources ·{" "}
                                {r.confidence}
                              </span>
                            </div>
                            <div className="recommend-actions">
                              <button
                                className="button primary"
                                onClick={() => plan(r)}
                              >
                                <Terminal size={14} /> Prepare Codex plan{" "}
                                <ArrowRight size={14} />
                              </button>
                              <button
                                className="text-button"
                                onClick={() => open(r.id)}
                              >
                                Inspect task <ArrowUpRight size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="next-row"
                            key={r.id}
                            onClick={() => open(r.id)}
                          >
                            <span className="next-number">0{i + 1}</span>
                            <div>
                              <strong>{r.title}</strong>
                              <small>
                                {r.blocked_by.length
                                  ? "Prerequisites unmet"
                                  : r.why_now}
                              </small>
                            </div>
                            <span className="next-time">
                              {r.estimate || "TBD"}
                            </span>
                            <ChevronRight size={14} />
                          </button>
                        ),
                      )
                    ) : (
                      <div className="empty">
                        No open tasks in this focus. Create a work item to
                        choose your next step.
                      </div>
                    )}
                    <button
                      className="panel-footer-button"
                      onClick={() => setView("work")}
                    >
                      All work items <ArrowRight size={13} />
                    </button>
                  </section>
                  <section className="asset-preview-panel">
                    <div className="section-title">
                      <h2>
                        <Box size={16} /> On the workbench
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setView("assets")}
                      >
                        Asset studio <ArrowUpRight size={13} />
                      </button>
                    </div>
                    <Viewer
                      source={
                        currentAsset?.revisions?.[0]?.format === "glb"
                          ? currentAsset.revisions[0].source_path
                          : undefined
                      }
                    />
                    <div className="asset-preview-caption">
                      <div>
                        <strong>
                          {currentAsset?.title || "Example backpack"}
                        </strong>
                        <small>
                          {currentAsset?.revisions?.length || 0} uploaded
                          revisions · Visual review pending
                        </small>
                      </div>
                      <Badge tone="amber">
                        {pretty(currentAsset?.art || "blockout")}
                      </Badge>
                    </div>
                    <div className="asset-axis">
                      <span>Engine integration</span>
                      <span className="muted">Not validated</span>
                    </div>
                    <button
                      className="panel-footer-button"
                      onClick={() => {
                        setView("assets");
                        setAsset(currentAsset?.id);
                      }}
                    >
                      Inspect asset & revisions <ArrowRight size={13} />
                    </button>
                  </section>
                  <section className="activity-panel">
                    <div className="section-title">
                      <h2>
                        <Activity size={16} /> Workspace activity
                      </h2>
                      <Badge>LOCAL HISTORY</Badge>
                    </div>
                    {data.events.slice(0, 4).map((e: Data, i: number) => (
                      <div key={e.id} className="timeline-row">
                        <span
                          className={
                            "timeline-dot " + (i === 0 ? "orange" : "")
                          }
                        />
                        <div>
                          <p>{e.message}</p>
                          <small>{new Date(e.at).toLocaleString()}</small>
                        </div>
                      </div>
                    ))}
                  </section>
                  <section className="attention-panel">
                    <div className="section-title">
                      <h2>
                        <AlertCircle size={16} /> Keep an eye on
                      </h2>
                    </div>
                    <button
                      onClick={() =>
                        open(
                          records.find((r) => r.build === "blocked")?.id ||
                            records[0]?.id,
                        )
                      }
                    >
                      <span className="attention-icon">
                        <GitBranch size={16} />
                      </span>
                      <div>
                        <strong>
                          {records.filter((r) => r.build === "blocked").length}{" "}
                          blocked systems
                        </strong>
                        <small>Resolve open decisions to unblock work</small>
                      </div>
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => setView("playtests")}>
                      <span className="attention-icon amber">
                        <Beaker size={16} />
                      </span>
                      <div>
                        <strong>Is the loop fun yet?</strong>
                        <small>
                          Technical progress needs human playtesting
                        </small>
                      </div>
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => setView("settings")}>
                      <span className="attention-icon blue">
                        <Link size={16} />
                      </span>
                      <div>
                        <strong>
                          {integrations?.unity.found
                            ? "Unity project discovered"
                            : "Connect your Unity project"}
                        </strong>
                        <small>
                          {integrations?.unity.locked
                            ? "Editor lock present"
                            : "Keep engine validation traceable"}
                        </small>
                      </div>
                      <ChevronRight size={14} />
                    </button>
                  </section>
                </div>
              </>
            )}
            {view === "explorer" && (
              <>
                <Heading
                  eyebrow="CANONICAL PROJECT KNOWLEDGE"
                  title={
                    section
                      ? data.sections.find((s: Data) => s.id === section)?.title
                      : "Project explorer"
                  }
                  description="One specification. Linked everywhere. Configured for your game."
                >
                  <button
                    className="button subtle"
                    onClick={() => analysis("overlaps")}
                  >
                    <Layers size={14} /> Find overlapping designs
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal({ kind: "create" })}
                  >
                    <Plus size={14} /> New record
                  </button>
                </Heading>
                <div className="filterbar">
                  <Search size={16} />
                  <input
                    aria-label="Filter records"
                    placeholder="Search records, specifications, and tasks…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Badge>{filtered.length} records</Badge>
                </div>
                <div className="view-toolbar">
                  <div className="view-switch">
                    {["list", "document", "board", "gallery"].map((format) => (
                      <button
                        key={format}
                        className={recordView === format ? "active" : ""}
                        onClick={() => setRecordView(format)}
                      >
                        {pretty(format)}
                      </button>
                    ))}
                  </div>
                  {(data.views || [])
                    .filter((v: Data) => !section || v.section_id === section)
                    .map((v: Data) => (
                      <button
                        className="text-button"
                        key={v.id}
                        onClick={() => {
                          setSection(v.section_id);
                          setRecordView(v.format);
                        }}
                      >
                        {v.title}
                      </button>
                    ))}
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({
                        kind: "view",
                        section_id: section || data.sections[0].id,
                      })
                    }
                  >
                    <Plus size={13} /> Save configured view
                  </button>
                </div>
                {recordView === "list" ? (
                  <div className="records-list">
                    {filtered.map(recordRow)}
                    {!filtered.length && (
                      <div className="empty">
                        No matching records. Create one or change your search.
                      </div>
                    )}
                  </div>
                ) : recordView === "board" ? (
                  <div className="board">
                    {data.workflows.design.map((stage: string) => (
                      <section className="board-column" key={stage}>
                        <h3>{pretty(stage)}</h3>
                        {filtered
                          .filter((r) => r.design === stage)
                          .map((r) => (
                            <button
                              className="task-card"
                              key={r.id}
                              onClick={() => open(r.id)}
                            >
                              <h3>{r.title}</h3>
                              <p>{r.description}</p>
                              <Badge>{r.type}</Badge>
                            </button>
                          ))}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div
                    className={
                      recordView === "gallery"
                        ? "record-gallery"
                        : "record-documents"
                    }
                  >
                    {filtered.map((r) => (
                      <article key={r.id} className="simple-panel">
                        <h3>
                          <FileText size={16} />
                          {r.title}
                        </h3>
                        <p className="muted">{r.description}</p>
                        <Badge>{pretty(r.design)}</Badge>
                        <button
                          className="text-button"
                          onClick={() => open(r.id)}
                        >
                          Inspect record <ArrowUpRight size={13} />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            {view === "work" && (
              <>
                <Heading
                  eyebrow="FROM DESIGN TO PLAYABLE"
                  title="Work board"
                  description="Dependencies guide the order. Evidence defines completion."
                >
                  <button
                    className="button primary"
                    onClick={() => setModal({ kind: "create", type: "task" })}
                  >
                    <Plus size={14} /> New task
                  </button>
                </Heading>
                <div className="board">
                  {["not started", "in progress", "blocked", "verified"].map(
                    (stage) => (
                      <section className="board-column" key={stage}>
                        <h3>
                          <span
                            className={
                              "tree-dot " +
                              (stage === "verified"
                                ? "green"
                                : stage === "blocked"
                                  ? "red"
                                  : "")
                            }
                          />
                          {pretty(stage)}
                          <Badge>
                            {
                              tasks.filter(
                                (r) =>
                                  r.build === stage ||
                                  (stage === "in progress" &&
                                    r.build === "integrated"),
                              ).length
                            }
                          </Badge>
                        </h3>
                        {tasks
                          .filter(
                            (r) =>
                              r.build === stage ||
                              (stage === "in progress" &&
                                r.build === "integrated"),
                          )
                          .map((r) => (
                            <button
                              className="task-card"
                              key={r.id}
                              onClick={() => open(r.id)}
                            >
                              <small className="mono">
                                TASK / {r.id.slice(0, 8)}
                              </small>
                              <h3>{r.title}</h3>
                              <p>{r.description}</p>
                              <div>
                                <Badge tone="blue">{pretty(r.design)}</Badge>
                                <Badge>{pretty(r.gameplay)}</Badge>
                              </div>
                              <footer>
                                <Clock size={12} />
                                {r.estimate || "Unestimated"}
                                <span>
                                  {r.depends_on?.length || 0} prerequisites
                                </span>
                              </footer>
                            </button>
                          ))}
                      </section>
                    ),
                  )}
                </div>
              </>
            )}
            {view === "assets" && (
              <>
                <Heading
                  eyebrow="FROM BLOCKOUT TO BEAUTIFUL"
                  title="Asset studio"
                  description="Review the silhouette. Track the revisions. Verify it in-engine."
                >
                  <button
                    className="button primary"
                    onClick={() => setModal({ kind: "create", type: "asset" })}
                  >
                    <Plus size={14} /> Register asset
                  </button>
                </Heading>
                <div className="asset-layout">
                  <div className="asset-library">
                    <div className="section-title">
                      <h2>Asset library</h2>
                      <Badge>{assets.length}</Badge>
                    </div>
                    {assets.map((a) => (
                      <button
                        className={
                          currentAsset?.id === a.id
                            ? "asset-tile active"
                            : "asset-tile"
                        }
                        key={a.id}
                        onClick={() => setAsset(a.id)}
                      >
                        <Box size={28} />
                        <strong>{a.title}</strong>
                        <small>
                          {pretty(a.art || "reference")} ·{" "}
                          {a.revisions?.length || 0} revisions
                        </small>
                      </button>
                    ))}
                  </div>
                  {currentAsset ? (
                    <div className="asset-workspace">
                      <div className="section-title">
                        <h2>{currentAsset.title}</h2>
                        <button
                          className="text-button"
                          onClick={() => open(currentAsset.id)}
                        >
                          Specification <ArrowUpRight size={14} />
                        </button>
                      </div>
                      {currentAsset.revisions?.[0]?.format &&
                      currentAsset.revisions[0].format !== "glb" ? (
                        <div className="media-view">
                          {["mp3", "wav", "ogg"].includes(
                            currentAsset.revisions[0].format,
                          ) ? (
                            <audio
                              controls
                              src={currentAsset.revisions[0].source_path}
                            />
                          ) : (
                            <a
                              href={currentAsset.revisions[0].source_path}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={currentAsset.revisions[0].source_path}
                              />
                            </a>
                          )}
                        </div>
                      ) : (
                        <Viewer
                          large
                          source={currentAsset.revisions?.[0]?.source_path}
                        />
                      )}
                      <div className="asset-info">
                        <div>
                          <Badge tone="amber">
                            Art: {pretty(currentAsset.art || "reference")}
                          </Badge>
                          <Badge tone="blue">
                            Build: {pretty(currentAsset.build)}
                          </Badge>
                          <Badge>
                            Gameplay: {pretty(currentAsset.gameplay)}
                          </Badge>
                        </div>
                        <label className="button primary">
                          <Upload size={14} /> Upload revision
                          <input
                            type="file"
                            hidden
                            accept=".glb,.png,.jpg,.jpeg,.webp,.wav,.mp3,.ogg"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                const result = await upload(f);
                                await perform("revision", {
                                  entity_id: currentAsset.id,
                                  ...result,
                                  provenance: `Developer upload: ${f.name}; license requires review`,
                                });
                              } catch (err) {
                                setToast((err as Error).message);
                              }
                            }}
                          />
                        </label>
                      </div>
                      <p className="asset-description">
                        {currentAsset.description}
                      </p>
                      <div className="two-cards">
                        <section className="simple-panel">
                          <h3>Revision history</h3>
                          {currentAsset.revisions?.length ? (
                            currentAsset.revisions.map((r: Data) => (
                              <div className="revision-row" key={r.id}>
                                <Box size={16} />
                                <div>
                                  <strong>
                                    Revision {r.version} ·{" "}
                                    {r.format.toUpperCase()}
                                  </strong>
                                  <small>{r.provenance}</small>
                                  <small className="mono">
                                    SHA-256 {r.hash.slice(0, 18)}…
                                  </small>
                                </div>
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    setModal({
                                      kind: "compare",
                                      record: currentAsset,
                                      revision: r,
                                    })
                                  }
                                >
                                  Compare
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="muted">
                              The viewport shows an original procedural example.
                              Upload a GLB to save your own revision.
                            </p>
                          )}
                        </section>
                        <section className="simple-panel">
                          <h3>Review & integration</h3>
                          <p className="muted">
                            A good preview doesn’t prove an asset works in
                            Unity.
                          </p>
                          <button
                            className="button subtle"
                            onClick={() =>
                              setModal({
                                kind: "comment",
                                entity_id: currentAsset.id,
                              })
                            }
                          >
                            <MessageSquare size={14} /> Leave review feedback
                          </button>
                          <button
                            className="button subtle"
                            onClick={() =>
                              setModal({
                                kind: "evidence",
                                entity_id: currentAsset.id,
                              })
                            }
                          >
                            <CheckCircle2 size={14} /> Record validation
                          </button>
                        </section>
                      </div>
                    </div>
                  ) : (
                    <div className="empty">
                      Register your first asset to start.
                    </div>
                  )}
                </div>
              </>
            )}
            {view === "graph" && (
              <>
                <Heading
                  eyebrow="CONTEXT & DEPENDENCIES"
                  title="Knowledge graph"
                  description="Follow prerequisites and inspect the blast radius of a change."
                >
                  <button
                    className="button subtle"
                    onClick={() => setModal({ kind: "merge" })}
                  >
                    <Layers size={14} /> Propose consolidation
                  </button>
                </Heading>
                <div className="graph-legend">
                  <span className="tree-dot" /> Canonical record{" "}
                  <span className="tree-dot amber" /> Asset{" "}
                  <span className="tree-dot green" /> Task{" "}
                  <small>
                    Arrows point to prerequisites. Dashed links show task
                    targets.
                  </small>
                </div>
                <div className="graph-canvas">
                  <svg
                    viewBox={`0 0 1000 ${Math.ceil(records.length / 3) * 170 + 80}`}
                    role="img"
                    aria-label="Project dependency graph"
                  >
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#708292" />
                      </marker>
                    </defs>
                    {records.flatMap((r, i) =>
                      [
                        ...(r.depends_on || []).map((id: string) => ({
                          id,
                          kind: "dependency",
                        })),
                        ...(r.target ? [{ id: r.target, kind: "target" }] : []),
                      ].map((dep: Data) => {
                        const j = records.findIndex((x) => x.id === dep.id);
                        if (j < 0) return null;
                        const x1 = 70 + (i % 3) * 320 + 130,
                          y1 = 60 + Math.floor(i / 3) * 170 + 35,
                          x2 = 70 + (j % 3) * 320 + 130,
                          y2 = 60 + Math.floor(j / 3) * 170 + 35;
                        return (
                          <path
                            key={r.id + dep.id}
                            d={`M${x1},${y1} C${x1},${y1 + 90} ${x2},${y2 + 90} ${x2},${y2}`}
                            stroke="#4a596d"
                            fill="none"
                            markerEnd="url(#arrow)"
                            strokeDasharray={
                              dep.kind === "target" ? "6 5" : undefined
                            }
                          />
                        );
                      }),
                    )}
                    {records.map((r, i) => (
                      <g
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        aria-label={r.title}
                        onKeyDown={(e) => e.key === "Enter" && open(r.id)}
                        onClick={() => open(r.id)}
                        className="graph-node"
                        transform={`translate(${70 + (i % 3) * 320},${60 + Math.floor(i / 3) * 170})`}
                      >
                        <rect
                          width="260"
                          height="76"
                          rx="7"
                          fill="#20252e"
                          stroke={
                            r.type === "task"
                              ? "#3d6a59"
                              : r.type === "asset"
                                ? "#8c693b"
                                : "#3f516b"
                          }
                        />
                        <circle
                          cx="18"
                          cy="23"
                          r="4"
                          fill={
                            r.type === "asset"
                              ? "#e3ab65"
                              : r.type === "task"
                                ? "#74ba96"
                                : "#80a8dc"
                          }
                        />
                        <text x="30" y="28" fill="#d8dde7" fontSize="13">
                          {r.title.slice(0, 31)}
                        </text>
                        <text x="18" y="54" fill="#8d99ac" fontSize="11">
                          {r.type.toUpperCase()} · {r.build}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </>
            )}
            {view === "review" && (
              <>
                <Heading
                  eyebrow="YOU KEEP THE CONTROLS"
                  title="Inbox & review"
                  description="Every request stays traceable. Every proposal waits for a decision."
                />
                <div className="review-grid">
                  <section>
                    <div className="section-title">
                      <h2>
                        <Inbox size={16} /> Inbox
                      </h2>
                      <Badge>{data.inbox.length}</Badge>
                    </div>
                    {data.inbox.length ? (
                      data.inbox.map((i: Data) => (
                        <div className="review-card" key={i.id}>
                          <div className="review-card-head">
                            <Badge tone={i.status === "open" ? "amber" : ""}>
                              {i.status}
                            </Badge>
                            <small>{new Date(i.at).toLocaleDateString()}</small>
                          </div>
                          <p>{i.text}</p>
                          <button
                            className="source-link"
                            onClick={() => open(i.entity_id)}
                          >
                            <Link size={12} />
                            {records.find((r) => r.id === i.entity_id)?.title}
                          </button>
                          <div className="card-actions">
                            <button
                              className="button subtle"
                              onClick={() =>
                                plan(
                                  records.find((r) => r.id === i.entity_id),
                                  i.text,
                                  i.id,
                                )
                              }
                            >
                              <Terminal size={13} /> Prepare plan
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                perform("inbox-status", {
                                  id: i.id,
                                  status:
                                    i.status === "closed" ? "open" : "closed",
                                })
                              }
                            >
                              {i.status === "closed"
                                ? "Reopen"
                                : "Close request"}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        <MessageSquare size={24} />
                        <strong>Capture the next idea.</strong>
                        <p>
                          Leave a comment on any record. It becomes a linked
                          request here.
                        </p>
                        <button
                          className="button subtle"
                          onClick={() => setView("explorer")}
                        >
                          Browse records
                        </button>
                      </div>
                    )}
                  </section>
                  <section>
                    <div className="section-title">
                      <h2>
                        <ShieldCheck size={16} /> Proposals
                      </h2>
                      <Badge>{pending.length} pending</Badge>
                    </div>
                    {data.proposals.length ? (
                      data.proposals.map((p: Data) => (
                        <div className="review-card" key={p.id}>
                          <div className="review-card-head">
                            <Badge
                              tone={
                                p.status === "approved"
                                  ? "green"
                                  : p.status === "pending"
                                    ? "amber"
                                    : "red"
                              }
                            >
                              {p.status}
                            </Badge>
                            <small>{p.kind}</small>
                          </div>
                          <h3>{p.title}</h3>
                          <p>
                            {p.kind === "merge"
                              ? p.description
                              : p.kind === "decision"
                                ? p.statement
                                : p.kind === "blueprint"
                                  ? p.premise
                                  : p.kind === "workflow"
                                    ? `${p.axis}: ${p.stages.join(" → ")}`
                                    : p.kind === "view"
                                      ? `View: ${p.format} · Section: ${data.sections.find((s: Data) => s.id === p.section_id)?.title}`
                                      : `New type: ${p.name} · Section: ${p.section} · Fields: ${p.fields?.join(", ")}`}
                          </p>
                          {p.kind === "merge" && (
                            <div className="merge-diff">
                              <div>
                                <small>SOURCE → REDIRECT</small>
                                <p>
                                  {records.find((r) => r.id === p.source_id)
                                    ?.description ||
                                    p.preserved_source?.description}
                                </p>
                              </div>
                              <div>
                                <small>CANONICAL DESTINATION</small>
                                <p>
                                  {
                                    records.find((r) => r.id === p.target_id)
                                      ?.description
                                  }
                                </p>
                              </div>
                            </div>
                          )}
                          <small className="muted">
                            {p.kind === "blueprint"
                              ? "Replaces the active workspace; previous state remains in the checkpoint history."
                              : p.kind === "schema"
                                ? "Adds registry entries; existing records are preserved."
                                : p.kind === "merge"
                                  ? "Preserves source history and redirects inbound links."
                                  : "Changes canonical state after approval. A recovery checkpoint is kept."}
                          </small>
                          {p.status === "pending" && (
                            <div className="card-actions">
                              <button
                                className="button primary"
                                disabled={busy}
                                onClick={() =>
                                  perform("review", { id: p.id, approve: true })
                                }
                              >
                                <Check size={13} /> Approve
                              </button>
                              <button
                                className="button subtle"
                                disabled={busy}
                                onClick={() =>
                                  perform("review", {
                                    id: p.id,
                                    approve: false,
                                  })
                                }
                              >
                                <X size={13} /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        <ShieldCheck size={24} />
                        <strong>No proposals waiting.</strong>
                        <p>
                          Schema, decision, and merge changes appear here before
                          approval.
                        </p>
                      </div>
                    )}
                  </section>
                </div>
                <div className="section-title run-heading">
                  <h2>
                    <Terminal size={16} /> Work sessions
                  </h2>
                  <Badge>{data.runs.length}</Badge>
                </div>
                {data.runs.map((r: Data) => (
                  <div className="run-card" key={r.id}>
                    <div className="run-title">
                      <Terminal size={19} />
                      <div>
                        <h3>{r.title}</h3>
                        <small>
                          {r.context.estimated_tokens} estimated tokens /{" "}
                          {r.context.budget} budget · {r.context.sources.length}{" "}
                          cited sources
                        </small>
                      </div>
                      <Badge
                        tone={
                          r.status === "failed"
                            ? "red"
                            : r.status === "review"
                              ? "green"
                              : "blue"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <div className="run-body">
                      <div>
                        <h4>Proposed local checklist</h4>
                        <ol>
                          {r.steps.map((step: string) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <small className="muted">
                          This checklist is deterministic. AI execution and
                          review status are tracked separately.
                        </small>
                      </div>
                      <div>
                        <h4>Context manifest</h4>
                        {r.context.sources.map((source: Data) => (
                          <button
                            className="source-link"
                            key={source.id}
                            onClick={() => open(source.id)}
                          >
                            <FileText size={12} />
                            {records.find((x) => x.id === source.id)?.title ||
                              source.id}
                            <Badge>r{source.revision}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                    {r.diff && (
                      <pre className="run-output diff-preview">{r.diff}</pre>
                    )}
                    {(r.output || r.live_output || r.error || r.live_error) && (
                      <pre className="run-output">
                        {r.output || r.live_output || r.error || r.live_error}
                      </pre>
                    )}
                    <div className="card-actions">
                      <button
                        className="button subtle"
                        onClick={() =>
                          download("forge-context-" + r.id + ".json", r)
                        }
                      >
                        <Download size={13} /> Export context
                      </button>
                      <button
                        className="button subtle"
                        onClick={() => {
                          navigator.clipboard
                            ?.writeText(r.prompt)
                            .then(() => setToast("Scoped prompt copied"))
                            .catch(() =>
                              setToast(
                                "Clipboard unavailable; use Export context",
                              ),
                            );
                        }}
                      >
                        <Files size={13} /> Copy prompt
                      </button>
                      {r.status === "prepared" && (
                        <button
                          className="button primary"
                          onClick={() => setModal({ kind: "execute", run: r })}
                        >
                          <Play size={13} /> Review & run plan
                        </button>
                      )}
                      {r.mode === "plan" && r.status !== "running" && (
                        <button
                          className="button subtle"
                          onClick={() =>
                            setModal({ kind: "implement", run: r })
                          }
                        >
                          <GitBranch size={13} /> Scope implementation
                        </button>
                      )}
                      {r.status === "changes awaiting review" && (
                        <>
                          <button
                            className="button primary"
                            onClick={() => setModal({ kind: "apply", run: r })}
                          >
                            <Check size={13} /> Review & apply patch
                          </button>
                          <button
                            className="button subtle"
                            onClick={async () => {
                              try {
                                await api("reject-run", { id: r.id });
                                refresh();
                              } catch (e) {
                                setToast((e as Error).message);
                              }
                            }}
                          >
                            <X size={13} /> Reject changes
                          </button>
                        </>
                      )}
                      {r.mode === "bootstrap" && r.status === "review" && (
                        <button
                          className="button primary"
                          onClick={async () => {
                            try {
                              setModal({
                                kind: "bootstrap",
                                preset: await api("blueprint-result", {
                                  id: r.id,
                                }),
                              });
                            } catch (e) {
                              setToast((e as Error).message);
                            }
                          }}
                        >
                          <Layers size={13} /> Review AI blueprint
                        </button>
                      )}
                      {r.status === "running" && (
                        <button
                          className="button subtle"
                          onClick={async () => {
                            await api("cancel", { id: r.id });
                            refresh();
                          }}
                        >
                          <Pause size={13} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!data.runs.length && (
                  <div className="empty compact">
                    Prepare a plan from a task or inbox request to assemble a
                    scoped context pack.
                  </div>
                )}
              </>
            )}
            {view === "playtests" && (
              <>
                <Heading
                  eyebrow="A BUILD ISN’T A FEELING"
                  title="Playtest journal"
                  description="Human observations close the loop between working code and a good game."
                >
                  <button
                    className="button primary"
                    onClick={() =>
                      setModal({ kind: "playtest", entity_id: records[0]?.id })
                    }
                  >
                    <Plus size={14} /> Record playtest
                  </button>
                </Heading>
                <div className="playtest-callout">
                  <Beaker size={26} />
                  <div>
                    <h3>Gameplay validation has its own track.</h3>
                    <p>
                      A feature may be technically verified and still need
                      redesign. Record what players did, where they struggled,
                      and what to try next.
                    </p>
                  </div>
                </div>
                {data.playtests.length ? (
                  data.playtests.map((p: Data) => (
                    <div className="review-card" key={p.id}>
                      <div className="review-card-head">
                        <Badge
                          tone={p.outcome === "accepted" ? "green" : "amber"}
                        >
                          {p.outcome}
                        </Badge>
                        <small>{new Date(p.at).toLocaleString()}</small>
                      </div>
                      <h3>
                        {records.find((r) => r.id === p.entity_id)?.title}
                      </h3>
                      <p>{p.observations}</p>
                      {p.followup && (
                        <p className="muted">Follow-up task: {p.followup}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <Beaker size={30} />
                    <strong>The first real playtest starts here.</strong>
                    <p>No gameplay validation has been recorded.</p>
                  </div>
                )}
              </>
            )}
            {view === "settings" && (
              <>
                <Heading
                  eyebrow="LOCAL FIRST. PROJECT AWARE."
                  title="Workspace settings"
                  description="Connect your tools, evolve your workflows, and keep a recoverable copy."
                />
                <div className="settings-grid">
                  <section className="simple-panel">
                    <h3>
                      <Terminal size={18} /> Codex planning adapter
                    </h3>
                    <Badge
                      tone={
                        integrations?.codex.authenticated ? "green" : "amber"
                      }
                    >
                      {integrations?.codex.authenticated
                        ? "Authenticated"
                        : integrations?.codex.available
                          ? "CLI detected · authentication required"
                          : "CLI unavailable"}
                    </Badge>
                    <p>{integrations?.codex.version || "Not detected"}</p>
                    <p className="muted">
                      Approved planning and scoped implementation via Codex CLI.
                      Implementation runs in a detached Git worktree. Previewed
                      patches require a second approval; validation stays
                      separate.
                    </p>
                    <button
                      className="button subtle"
                      onClick={async () => {
                        setIntegrations(await api("integrations"));
                        setToast("Integration discovery refreshed");
                      }}
                    >
                      <RefreshCw size={13} /> Refresh connection
                    </button>
                    <button
                      className="button subtle"
                      onClick={async () => {
                        try {
                          const result = await api("probe-app-server", {});
                          setToast(
                            result.connected
                              ? "App Server initialized over JSON-RPC; no provider turn created"
                              : result.error,
                          );
                        } catch (e) {
                          setToast((e as Error).message);
                        }
                      }}
                    >
                      <Link size={13} /> Check App Server compatibility
                    </button>
                  </section>
                  <section className="simple-panel">
                    <h3>
                      <Box size={18} /> Unity discovery
                    </h3>
                    <Badge
                      tone={
                        integrations?.unity.locked
                          ? "red"
                          : integrations?.unity.found
                            ? "green"
                            : ""
                      }
                    >
                      {integrations?.unity.status || "Checking…"}
                    </Badge>
                    <p className="muted">
                      Read-only discovery preserves engine files. No batch
                      process is launched. The editor lock prevents a
                      conflicting run.
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        if (
                          await perform("settings", {
                            unityRoot: form.get("unityRoot"),
                          })
                        )
                          setIntegrations(await api("integrations"));
                      }}
                    >
                      <label>
                        Unity project path
                        <input
                          name="unityRoot"
                          defaultValue={data.project.unityRoot}
                          placeholder="/path/to/your/UnityProject"
                        />
                      </label>
                      <button className="button subtle" type="submit">
                        Discover project
                      </button>
                    </form>
                    <label className="button subtle">
                      <Upload size={14} /> Import Unity test report
                      <input
                        type="file"
                        hidden
                        accept=".xml"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            try {
                              const xml = await file.text();
                              setModal({
                                kind: "unity-report",
                                name: file.name,
                                xml,
                                report: await api("report-preview", { xml }),
                              });
                            } catch (err) {
                              setToast((err as Error).message);
                            }
                        }}
                      />
                    </label>
                    {(data.project.testReports || [])
                      .slice(0, 3)
                      .map((r: Data) => (
                        <div className="workflow-row" key={r.id}>
                          <strong>
                            {r.name} · {r.result}
                          </strong>
                          <small>
                            {r.passed}/{r.total} passed · {r.failed} failed ·{" "}
                            {r.skipped} skipped
                          </small>
                        </div>
                      ))}
                    {integrations?.unity.version && (
                      <p className="mono">{integrations.unity.version}</p>
                    )}
                  </section>
                  <section className="simple-panel">
                    <h3>
                      <ShieldCheck size={18} /> Backup & recovery
                    </h3>
                    <p className="muted">
                      Complete bundles include state, checkpoint history, media,
                      and saved patches with checksums. State-only JSON exports
                      remain available.
                    </p>
                    <button
                      className="button subtle"
                      onClick={async () =>
                        download(
                          "forge-workspace-backup.json",
                          await api("export"),
                        )
                      }
                    >
                      <Download size={14} /> Export workspace
                    </button>
                    <button
                      className="button primary"
                      onClick={async () => {
                        try {
                          download(
                            "forge-complete-backup.json",
                            await api("bundle"),
                          );
                          setToast("Complete backup exported");
                        } catch (e) {
                          setToast((e as Error).message);
                        }
                      }}
                    >
                      <Download size={14} /> Export complete backup
                    </button>
                    <label className="button subtle">
                      <Upload size={14} /> Restore backup
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            try {
                              setModal({
                                kind: "restore",
                                backup: JSON.parse(await file.text()),
                              });
                            } catch {
                              setToast("Invalid JSON backup");
                            }
                        }}
                      />
                    </label>
                    <button
                      className="button subtle"
                      onClick={() => setModal({ kind: "undo" })}
                    >
                      <Undo2 size={14} /> Undo last mutation
                    </button>
                  </section>
                  <section className="simple-panel">
                    <h3>
                      <SlidersHorizontal size={18} /> Adaptive registry
                    </h3>
                    <p className="muted">
                      {data.types.length} entity types · {data.sections.length}{" "}
                      sections · {Object.keys(data.workflows).length} maturity
                      axes. Changes are declarative and require review.
                    </p>
                    <button
                      className="button subtle"
                      onClick={() => setModal({ kind: "schema" })}
                    >
                      <Plus size={14} /> Propose type & section
                    </button>
                    <button
                      className="button subtle"
                      onClick={() => setModal({ kind: "workflow" })}
                    >
                      <Plus size={14} /> Propose workflow axis
                    </button>
                    {Object.entries(data.workflows).map(([axis, stages]) => (
                      <div className="workflow-row" key={axis}>
                        <strong>{pretty(axis)}</strong>
                        <small>{(stages as string[]).join(" → ")}</small>
                      </div>
                    ))}
                  </section>
                  <section className="simple-panel">
                    <h3>
                      <Target size={18} /> Loot balancing sandbox
                    </h3>
                    <p className="muted">
                      An optional local design tool. Values are a scratchpad,
                      separate from approved game specifications.
                    </p>
                    <LootTool />
                  </section>
                  <section className="simple-panel">
                    <h3>
                      <Folder size={18} /> Read-only Unity file inventory
                    </h3>
                    <label className="button subtle">
                      <Upload size={14} /> Import Unity asset manifest
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f)
                            try {
                              await perform(
                                "unity-manifest",
                                JSON.parse(await f.text()),
                              );
                            } catch {
                              setToast("Invalid manifest JSON");
                            }
                        }}
                      />
                    </label>
                    {data.project.unityManifest && (
                      <p className="muted">
                        {data.project.unityManifest.assets.length} GUID-backed
                        assets indexed · Unity{" "}
                        {data.project.unityManifest.unityVersion}
                      </p>
                    )}
                    {integrations?.unity.files?.length ? (
                      <pre className="file-inventory">
                        {integrations.unity.files.join("\n")}
                      </pre>
                    ) : (
                      <p className="muted">
                        Connect an existing Unity project to discover assets,
                        packages, and project settings.
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
          {bottom && (
            <div className="bottom-panel">
              <div className="bottom-panel-tabs">
                <span className="active">WORKSPACE LOG</span>
                <button onClick={() => setView("review")}>
                  REVIEW <Badge>{pending.length}</Badge>
                </button>
                <button onClick={() => setView("settings")}>
                  INTEGRATIONS
                </button>
                <button
                  onClick={() => setBottom(false)}
                  aria-label="Close activity panel"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="log-line">
                <span>{new Date(data.events[0]?.at).toLocaleTimeString()}</span>
                <Badge tone="green">LOCAL</Badge>
                <code>{data.events[0]?.message}</code>
              </div>
            </div>
          )}
        </main>
        {inspector && current && (
          <aside className="inspector">
            <div className="inspector-header">
              ITEM INSPECTOR
              <button
                aria-label="Close inspector"
                onClick={() => setInspector(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="inspector-scroll">
              <small className="mono">
                {data.types
                  .find((t: Data) => t.id === current.type)
                  ?.title.toUpperCase()}{" "}
                / r{current.revision}
              </small>
              <h2>{current.title}</h2>
              <div className="inspector-actions">
                <button
                  className="button primary"
                  onClick={() => plan(current)}
                >
                  <Terminal size={13} /> Prepare plan
                </button>
                <button
                  className="button subtle"
                  onClick={() => setModal({ kind: "edit", record: current })}
                >
                  Edit
                </button>
              </div>
              <button
                className="text-button"
                onClick={() => analysis("impact", current.id)}
              >
                <Network size={13} /> Analyze change impact
              </button>
              {current.type === "task" && (
                <div className="inspector-actions">
                  <button
                    className="button subtle"
                    onClick={() =>
                      perform("recommendation", {
                        id: current.id,
                        mode:
                          data.recommendation_preferences?.[current.id]
                            ?.mode === "pin"
                            ? "reset"
                            : "pin",
                      })
                    }
                  >
                    {data.recommendation_preferences?.[current.id]?.mode ===
                    "pin"
                      ? "Unpin next action"
                      : "Pin next action"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({ kind: "dismiss", entity_id: current.id })
                    }
                  >
                    Dismiss suggestion
                  </button>
                  {data.recommendation_preferences?.[current.id]?.mode ===
                    "dismiss" && (
                    <button
                      className="text-button"
                      onClick={() =>
                        perform("recommendation", {
                          id: current.id,
                          mode: "reset",
                        })
                      }
                    >
                      Restore suggestion
                    </button>
                  )}
                </div>
              )}
              <h4>KNOWLEDGE STATE</h4>
              <label className="axis-row">
                <span>Confidence</span>
                <select
                  aria-label="Knowledge state"
                  value={current.knowledge_state || "assumed"}
                  onChange={(e) =>
                    perform("update", {
                      id: current.id,
                      knowledge_state: e.target.value,
                    })
                  }
                >
                  {[
                    "known",
                    "assumed",
                    "needs decision",
                    "verified in build",
                  ].map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </label>
              <h4>MATURITY</h4>
              {Object.entries(data.workflows).map(([axis, stages]) => (
                <label className="axis-row" key={axis}>
                  <span>{pretty(axis)}</span>
                  <select
                    aria-label={pretty(axis) + " status"}
                    value={current[axis] || (stages as string[])[0]}
                    onChange={(e) =>
                      perform("update", {
                        id: current.id,
                        [axis]: e.target.value,
                      })
                    }
                  >
                    {(stages as string[]).map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              ))}
              <h4>CANONICAL SPECIFICATION</h4>
              <p className="spec-text">{current.description}</p>
              {data.types
                .find((t: Data) => t.id === current.type)
                ?.fields.map((field: string) => (
                  <div className="custom-field" key={field}>
                    <small>{field}</small>
                    <p>{current.fields?.[field] || "Not specified"}</p>
                  </div>
                ))}
              {current.acceptance_criteria && (
                <>
                  <h4>DEFINITION OF DONE</h4>
                  <p className="spec-text">{current.acceptance_criteria}</p>
                </>
              )}
              <h4>PREREQUISITES & BACKLINKS</h4>
              {records
                .filter(
                  (r) =>
                    (current.depends_on || []).includes(r.id) ||
                    (r.depends_on || []).includes(current.id) ||
                    r.target === current.id ||
                    r.id === current.target,
                )
                .map((r) => (
                  <button
                    className="inspector-link"
                    key={r.id}
                    onClick={() => open(r.id)}
                  >
                    <Link size={12} />
                    {r.title}
                    <ChevronRight size={12} />
                  </button>
                ))}
              <h4>DECISIONS</h4>
              {data.decisions
                .filter((d: Data) => d.scope_ids.includes(current.id))
                .map((d: Data) => (
                  <div className="decision-note" key={d.id}>
                    <Badge tone={d.status === "approved" ? "green" : ""}>
                      {d.status}
                    </Badge>
                    <p>{d.statement}</p>
                    <small>{d.rationale}</small>
                  </div>
                ))}
              <button
                className="text-button"
                onClick={() =>
                  setModal({ kind: "decision", entity_id: current.id })
                }
              >
                <Plus size={13} /> Propose decision
              </button>
              <h4>EVIDENCE</h4>
              {data.evidence
                .filter((e: Data) => e.entity_id === current.id)
                .map((e: Data) => (
                  <div className="evidence-note" key={e.id}>
                    <Badge tone={e.result === "passed" ? "green" : "red"}>
                      {e.kind} · {e.result}
                    </Badge>
                    <p>{e.summary}</p>
                    <small>{e.reference}</small>
                  </div>
                ))}
              <button
                className="text-button"
                onClick={() =>
                  setModal({ kind: "evidence", entity_id: current.id })
                }
              >
                <Plus size={13} /> Record evidence
              </button>
              <h4>DISCUSSION & REQUESTS</h4>
              {data.inbox
                .filter((i: Data) => i.entity_id === current.id)
                .map((i: Data) => (
                  <div className="comment-note" key={i.id}>
                    <small>Developer · {i.status}</small>
                    <p>{i.text}</p>
                  </div>
                ))}
              <button
                className="button subtle"
                onClick={() =>
                  setModal({ kind: "comment", entity_id: current.id })
                }
              >
                <MessageSquare size={13} /> Add comment
              </button>
            </div>
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <div>
          <Flame size={12} />
          <GitBranch size={12} /> local workspace{" "}
          <span>SQLite · checkpointed</span>
        </div>
        <div>
          <span className="status-ai">
            <span className="local-dot" />
            {integrations?.codex.authenticated
              ? "Codex authenticated"
              : "Manual mode available"}
          </span>
          <ShieldCheck size={12} /> Engine files protected{" "}
          <button onClick={() => setView("settings")}>
            <Settings size={12} />
          </button>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {palette && (
        <div className="modal-backdrop" onClick={() => setPalette(false)}>
          <div className="command-palette" onClick={(e) => e.stopPropagation()}>
            <div className="filterbar">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Search records or jump to a view…"
                aria-label="Command palette search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>ESC</kbd>
            </div>
            {navs
              .filter((n) =>
                n.label.toLowerCase().includes(search.toLowerCase()),
              )
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setView(n.id);
                    setSection("");
                    setPalette(false);
                    setSearch("");
                  }}
                >
                  <n.icon size={17} />
                  {n.label}
                  <ArrowRight size={13} />
                </button>
              ))}
            {records
              .filter((r) =>
                r.title.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, 8)
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    open(r.id);
                    setPalette(false);
                    setSearch("");
                  }}
                >
                  <FileText size={16} />
                  {r.title}
                  <Badge>{r.type}</Badge>
                </button>
              ))}
          </div>
        </div>
      )}
      {modal && ["impact", "overlaps"].includes(modal.kind) && (
        <AnalysisDialog
          modal={modal}
          data={data}
          close={() => setModal(null)}
          onOpen={(id: string) => {
            setModal(null);
            open(id);
          }}
          onMerge={(a: string, b: string) =>
            setModal({
              kind: "merge",
              source_id: a,
              target_id: b,
              description: [
                records.find((r) => r.id === a)?.description,
                records.find((r) => r.id === b)?.description,
              ].join("\n\n"),
            })
          }
        />
      )}
      {modal && !["impact", "overlaps"].includes(modal.kind) && (
        <Modal
          modal={modal}
          data={data}
          busy={busy}
          close={() => setModal(null)}
          perform={perform}
          refresh={refresh}
          setToast={setToast}
          setView={setView}
        />
      )}
    </div>
  );
}
function LootTool() {
  const [count, setCount] = useState(8),
    [value, setValue] = useState(25),
    [chance, setChance] = useState(40);
  return (
    <div className="loot-tool">
      {[
        ["Rooms", count, setCount],
        ["Loot value", value, setValue],
        ["Drop chance %", chance, setChance],
      ].map(([label, v, set]: any) => (
        <label key={label}>
          {label}
          <input
            type="number"
            min="0"
            max={label === "Drop chance %" ? 100 : 10000}
            value={v}
            onChange={(e) =>
              set(
                Math.max(
                  0,
                  Math.min(
                    label === "Drop chance %" ? 100 : 10000,
                    Number(e.target.value),
                  ),
                ),
              )
            }
          />
        </label>
      ))}
      <div className="loot-result">
        <span>Expected run yield</span>
        <strong>{((count * value * chance) / 100).toFixed(1)} credits</strong>
      </div>
    </div>
  );
}
function Modal({
  modal: m,
  data,
  busy,
  close,
  perform,
  refresh,
  setToast,
  setView,
}: Data) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState(false);
  const [formType, setFormType] = useState(m.record?.type || m.type || "task");
  const records = data.records as Data[];
  const title: Data = {
    bootstrap: "Bootstrap a new game",
    schema: "Propose a custom type & section",
    create: "Create a record",
    edit: "Edit canonical record",
    comment: "Capture a linked request",
    evidence: "Record validation evidence",
    decision: "Propose a design decision",
    merge: "Propose record consolidation",
    workflow: "Propose a workflow axis",
    view: "Save a declarative view",
    playtest: "Record a human playtest",
    execute: "Approve read-only Codex planning",
    implement: "Review implementation scope",
    apply: "Review changes before application",
    restore: "Review backup restoration",
    undo: "Restore the previous checkpoint",
    compare: "Compare asset revisions",
    dismiss: "Dismiss next-action suggestion",
    "unity-report": "Review imported Unity test report",
  };
  const options = () =>
    records.map((r: Data) => (
      <option key={r.id} value={r.id}>
        {r.title}
      </option>
    ));
  const field = (
    label: string,
    name: string,
    value = "",
    required = false,
    area = false,
  ) => (
    <label>
      {label}
      {area ? (
        <textarea name={name} defaultValue={value} required={required} />
      ) : (
        <input name={name} defaultValue={value} required={required} />
      )}
    </label>
  );
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const p = Object.fromEntries(f.entries());
    let ok = false;
    try {
      if (m.kind === "create" || m.kind === "edit") {
        const fields = Object.fromEntries(
          [...f.entries()]
            .filter(([key]) => key.startsWith("field:"))
            .map(([key, val]) => [key.slice(6), val]),
        );
        ok = await perform(m.kind === "create" ? "create" : "update", {
          ...p,
          fields,
          ...(m.kind === "edit" ? { id: m.record.id } : {}),
          depends_on: f.getAll("depends_on").filter(Boolean),
          priority: Number(p.priority || 3),
          ...(p.type === "asset" ? { art: "reference" } : {}),
        });
      }
      if (m.kind === "comment")
        ok = await perform("comment", { entity_id: m.entity_id, text: p.text });
      if (m.kind === "evidence")
        ok = await perform("evidence", { ...p, entity_id: m.entity_id });
      if (m.kind === "decision")
        ok = await perform("proposal", {
          kind: "decision",
          title:
            "Decision: " + records.find((r) => r.id === m.entity_id)?.title,
          ...p,
          entity_id: m.entity_id,
        });
      if (m.kind === "schema")
        ok = await perform("proposal", {
          kind: "schema",
          title: "Add type: " + p.name,
          ...p,
          fields: String(p.fields || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      if (m.kind === "view")
        ok = await perform("proposal", { kind: "view", ...p });
      if (m.kind === "workflow")
        ok = await perform("proposal", {
          kind: "workflow",
          title: "Add workflow: " + p.axis,
          ...p,
          stages: String(p.stages)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      if (m.kind === "merge")
        ok = await perform("proposal", {
          kind: "merge",
          title: "Consolidate overlapping specifications",
          ...p,
        });
      if (m.kind === "bootstrap")
        ok = await perform("proposal", {
          kind: "blueprint",
          source_run_id: m.preset?.source_run_id,
          questions: m.preset?.questions || [],
          title: "New workspace: " + p.name,
          ...p,
          sections: String(p.sections)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      if (m.kind === "playtest") ok = await perform("playtest", p);
      if (m.kind === "implement") {
        await api("implement", {
          id: m.run.id,
          approve: true,
          scope: String(p.scope)
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        });
        await refresh();
        ok = true;
      }
      if (m.kind === "apply") {
        await api("apply", { id: m.run.id, approve: true });
        await refresh();
        ok = true;
      }
      if (m.kind === "execute") {
        await api("execute", { id: m.run.id, approve: true });
        await refresh();
        ok = true;
      }
      if (m.kind === "dismiss")
        ok = await perform("recommendation", {
          id: m.entity_id,
          mode: "dismiss",
          reason: p.reason,
        });
      if (m.kind === "unity-report")
        ok = await perform("unity-report", {
          xml: m.xml,
          name: m.name,
          entity_id: p.entity_id,
        });
      if (m.kind === "restore") {
        if (m.backup.format === "forge-bundle")
          await api("restore-bundle", { bundle: m.backup, confirm: true });
        else await api("restore", { data: m.backup, confirm: true });
        await refresh();
        ok = true;
        setToast("Backup restored; prior state checkpointed");
      }
      if (m.kind === "undo") {
        await api("undo", {});
        await refresh();
        ok = true;
        setToast("Previous checkpoint restored");
      }
      if (ok) {
        close();
        if (
          [
            "schema",
            "workflow",
            "view",
            "merge",
            "decision",
            "bootstrap",
            "comment",
          ].includes(m.kind)
        )
          setView("review");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div
        className={"modal " + (m.kind === "compare" ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title[m.kind]}
      >
        <div className="modal-header">
          <div>
            <small className="eyebrow">FORGE WORKSPACE</small>
            <h2>{title[m.kind]}</h2>
          </div>
          <button aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-content">
            {m.kind === "dismiss" && (
              <>
                {field(
                  "Reason to dismiss this suggestion",
                  "reason",
                  "",
                  true,
                  true,
                )}
                <p className="muted">
                  The task remains on the work board. Restore the suggestion
                  from its inspector.
                </p>
              </>
            )}
            {m.kind === "unity-report" && (
              <>
                <p>
                  {m.name}: <strong>{m.report.result}</strong>
                </p>
                <div className="callout">
                  <Beaker size={18} />
                  <span>
                    {m.report.passed}/{m.report.total} passed ·{" "}
                    {m.report.failed} failed · {m.report.skipped} skipped. This
                    report is user supplied; no Unity process was launched.
                  </span>
                </div>
                <label>
                  Tested entity<select name="entity_id">{options()}</select>
                </label>
                <pre className="prompt-preview">
                  {m.report.cases
                    .map((c: Data) => `${c.result}: ${c.name}`)
                    .join("\n")}
                </pre>
              </>
            )}
            {m.kind === "bootstrap" && (
              <>
                <p className="muted">
                  Describe your game, then review an editable blueprint. The
                  manual scaffold leaves design questions unresolved. You can
                  also prepare an AI blueprint request, approve provider
                  execution, and review its returned structure before
                  installation.
                </p>
                {field("Game name", "name", m.preset?.name || "", true)}
                {field(
                  "Premise, primary loop, genre, constraints & uncertainties",
                  "premise",
                  m.preset?.premise || "",
                  true,
                  true,
                )}
                <div className="two-fields">
                  {field(
                    "First playable milestone",
                    "milestone",
                    m.preset?.milestone || "First playable loop",
                    true,
                  )}
                  {field(
                    "Project-specific sections (comma separated)",
                    "sections",
                    m.preset?.sections?.join(", ") ||
                      "Core loop, World, Art direction, Production",
                    true,
                  )}
                </div>
                <button
                  type="button"
                  className="button subtle"
                  onClick={async (e) => {
                    const form = e.currentTarget.closest("form");
                    if (!form?.reportValidity()) return;
                    const input = Object.fromEntries(
                      new FormData(form).entries(),
                    );
                    if (await perform("bootstrap-plan", input)) {
                      close();
                      setView("review");
                    }
                  }}
                >
                  <Terminal size={14} /> Prepare AI blueprint plan
                </button>
                {m.preset?.questions?.length > 0 && (
                  <div className="blueprint-preview">
                    <strong>Unresolved questions</strong>
                    {m.preset.questions.map((q: string) => (
                      <p key={q}>{q}</p>
                    ))}
                  </div>
                )}
                <div className="callout">
                  <AlertCircle size={18} />
                  <span>
                    Approval replaces the active workspace. Its prior state
                    remains recoverable in checkpoint history. Edit the proposed
                    sections to match this game.
                  </span>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setBlueprint(!blueprint)}
                >
                  <Layers size={14} />{" "}
                  {blueprint
                    ? "Hide blueprint preview"
                    : "Preview blueprint behavior"}
                </button>
                {blueprint && (
                  <div className="blueprint-preview">
                    <strong>After approval</strong>
                    <p>
                      Your named sections become a dynamic explorer. Each
                      receives an unresolved specification; three initial
                      planning tasks seed the next-action list. Existing history
                      is checkpointed.
                    </p>
                  </div>
                )}
              </>
            )}
            {["create", "edit"].includes(m.kind) && (
              <>
                {field("Title", "title", m.record?.title || "", true)}
                <div className="two-fields">
                  <label>
                    Entity type
                    <select
                      aria-label="Entity type"
                      name="type"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                    >
                      {data.types.map((t: Data) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Project section
                    <select
                      aria-label="Project section"
                      name="section"
                      defaultValue={m.record?.section || data.sections[0]?.id}
                    >
                      {data.sections.map((s: Data) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {field(
                  "Canonical specification",
                  "description",
                  m.record?.description || "",
                  false,
                  true,
                )}
                {field(
                  "Acceptance criteria",
                  "acceptance_criteria",
                  m.record?.acceptance_criteria || "",
                  false,
                  true,
                )}
                <div className="two-fields">
                  {field(
                    "Estimate range",
                    "estimate",
                    m.record?.estimate || "15–30 min",
                  )}
                  <label>
                    Priority
                    <select
                      name="priority"
                      defaultValue={m.record?.priority || 3}
                    >
                      <option value="1">1 · Highest</option>
                      <option value="2">2 · High</option>
                      <option value="3">3 · Normal</option>
                      <option value="4">4 · Low</option>
                    </select>
                  </label>
                </div>
                <label>
                  Prerequisites (Ctrl / ⌘ to select multiple)
                  <select
                    name="depends_on"
                    multiple
                    defaultValue={m.record?.depends_on || []}
                  >
                    {records
                      .filter((r) => r.id !== m.record?.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                  </select>
                </label>
                {(
                  data.types.find((t: Data) => t.id === formType)?.fields || []
                ).map((v: string) => (
                  <React.Fragment key={v}>
                    {field(v, "field:" + v, m.record?.fields?.[v] || "")}
                  </React.Fragment>
                ))}
              </>
            )}
            {m.kind === "schema" && (
              <>
                <p className="muted">
                  Adds a declarative type and explorer section. Existing records
                  remain intact; no executable code is installed.
                </p>
                {field("Entity type name", "name", "", true)}
                {field("Explorer section", "section", "", true)}
                {field(
                  "Form fields (comma separated)",
                  "fields",
                  "Description, Constraints, Open questions",
                )}
                <div className="callout">
                  <Layers size={18} />
                  <span>
                    Migration: append registry entries. Existing records:
                    unchanged. Recovery: previous SQLite checkpoint.
                  </span>
                </div>
              </>
            )}
            {m.kind === "view" && (
              <>
                {field("View name", "title", "", true)}
                <label>
                  Section
                  <select name="section_id" defaultValue={m.section_id}>
                    {data.sections.map((s: Data) => (
                      <option value={s.id} key={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Safe renderer
                  <select name="format">
                    <option>list</option>
                    <option>document</option>
                    <option>board</option>
                    <option>gallery</option>
                  </select>
                </label>
                <p className="muted">
                  This view reads canonical records from its section. Approval
                  adds configuration; no arbitrary code is executed.
                </p>
              </>
            )}
            {m.kind === "workflow" && (
              <>
                <p className="muted">
                  Add an independent maturity axis. Existing records begin at
                  its first stage.
                </p>
                {field(
                  "Axis identifier (lowercase letters and underscores)",
                  "axis",
                  "",
                  true,
                )}
                {field(
                  "Stages (comma separated)",
                  "stages",
                  "unreviewed, exploring, accepted",
                  true,
                )}
              </>
            )}
            {m.kind === "comment" && (
              <>
                <p className="muted">
                  Anchored to {records.find((r) => r.id === m.entity_id)?.title}
                  . It remains in your inbox until explicitly closed.
                </p>
                {field(
                  "Request, question, or feedback",
                  "text",
                  "",
                  true,
                  true,
                )}
              </>
            )}
            {m.kind === "evidence" && (
              <>
                <div className="two-fields">
                  <label>
                    Validation axis
                    <select name="kind">
                      <option value="technical">Technical</option>
                      <option value="visual">Visual</option>
                      <option value="integration">Unity integration</option>
                    </select>
                  </label>
                  <label>
                    Result
                    <select name="result">
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </label>
                </div>
                {field("What was verified?", "summary", "", true, true)}
                {field(
                  "Traceable log, test report, file, or screenshot reference",
                  "reference",
                  "",
                  true,
                )}
                <p className="muted">
                  Evidence is labeled developer supplied. Recording it does not
                  automatically mark the record complete.
                </p>
              </>
            )}
            {m.kind === "decision" && (
              <>
                {field(
                  "Proposed canonical statement",
                  "statement",
                  "",
                  true,
                  true,
                )}
                {field(
                  "Rationale & impact on linked systems",
                  "rationale",
                  "",
                  true,
                  true,
                )}
                <p className="muted">
                  Approval updates this specification, supersedes its previous
                  approved decision, and retains history.
                </p>
              </>
            )}
            {m.kind === "merge" && (
              <>
                <div className="two-fields">
                  <label>
                    Source record (will redirect)
                    <select name="source_id" defaultValue={m.source_id}>
                      {options()}
                    </select>
                  </label>
                  <label>
                    Canonical destination
                    <select
                      name="target_id"
                      defaultValue={m.target_id || records[1]?.id}
                    >
                      {options()}
                    </select>
                  </label>
                </div>
                {field(
                  "Surviving specification — resolve conflicts explicitly",
                  "description",
                  m.description || "",
                  true,
                  true,
                )}
                <p className="muted">
                  Review shows source and destination side by side. Approval
                  preserves the source, redirects links, and records a
                  checkpoint. A changed revision invalidates this proposal.
                </p>
              </>
            )}
            {m.kind === "playtest" && (
              <>
                <label>
                  Feature or task tested
                  <select name="entity_id" defaultValue={m.entity_id}>
                    {options()}
                  </select>
                </label>
                {field(
                  "Player observations & test conditions",
                  "observations",
                  "",
                  true,
                  true,
                )}
                <label>
                  Human outcome
                  <select name="outcome">
                    <option value="needs test">Needs more testing</option>
                    <option value="accepted">Accepted</option>
                    <option value="needs redesign">Needs redesign</option>
                  </select>
                </label>
                {field("Follow-up task (optional)", "followup")}
                <p className="muted">
                  This changes gameplay maturity only. Technical validation
                  stays independent.
                </p>
              </>
            )}
            {m.kind === "execute" && (
              <>
                <p>
                  Run <strong>{m.run.title}</strong> through the local Codex CLI
                  in a read-only sandbox.
                </p>
                <div className="callout">
                  <ShieldCheck size={20} />
                  <span>
                    The project name, request, and cited excerpts below will be
                    sent to your configured Codex provider. The adapter requests
                    planning only. No implementation or completion is claimed.
                  </span>
                </div>
                <pre className="prompt-preview">{m.run.prompt}</pre>
              </>
            )}
            {m.kind === "implement" && (
              <>
                <p className="muted">
                  Codex will work in a detached Git worktree for your connected
                  project. The project must have a clean working tree. Changes
                  outside the exact file scope are blocked from application.
                </p>
                {field(
                  "Allowed relative file paths (one per line)",
                  "scope",
                  "",
                  true,
                  true,
                )}
                <div className="callout">
                  <ShieldCheck size={18} />
                  <span>
                    The scoped prompt goes to your configured provider. Files
                    stay isolated until you review and approve a patch. Tests
                    and human validation still gate completion.
                  </span>
                </div>
                <pre className="prompt-preview">{m.run.prompt}</pre>
              </>
            )}
            {m.kind === "apply" && (
              <>
                <p>Apply this reviewed patch to the connected project?</p>
                <p className="muted">
                  The original HEAD and clean working tree are checked again.
                  Approval does not mark the task complete.
                </p>
                <pre className="prompt-preview">{m.run.diff}</pre>
              </>
            )}
            {m.kind === "restore" && (
              <>
                <p>
                  Restore{" "}
                  <strong>
                    {m.backup.state?.project?.title ||
                      m.backup.project?.title ||
                      "Unknown project"}
                  </strong>{" "}
                  with{" "}
                  {(m.backup.state?.records || m.backup.records)?.length || 0}{" "}
                  records?
                </p>
                <p className="muted">
                  This replaces current operational state after validation. A
                  checkpoint preserves the current state. Exported asset
                  references require the matching asset files. Complete bundles
                  include their media and checkpoint history.
                </p>
              </>
            )}
            {m.kind === "undo" && (
              <p>
                Restore the state before the last workspace mutation? This
                affects records, requests, and review history. Asset source
                files are retained.
              </p>
            )}
            {m.kind === "compare" && (
              <>
                <div className="comparison">
                  {[m.record.revisions?.[0], m.revision].map(
                    (r: Data, i: number) => (
                      <div key={i}>
                        <h3>
                          {i === 0 ? "Latest" : "Selected"} · revision{" "}
                          {r.version}
                        </h3>
                        {r.format === "glb" ? (
                          <Viewer source={r.source_path} />
                        ) : ["wav", "mp3", "ogg"].includes(r.format) ? (
                          <audio src={r.source_path} controls />
                        ) : (
                          <img src={r.source_path} />
                        )}
                        <small className="muted">{r.provenance}</small>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="button subtle" onClick={close}>
              {m.kind === "compare" ? "Close" : "Cancel"}
            </button>
            {m.kind !== "compare" && (
              <button
                disabled={busy || saving}
                className="button primary"
                type="submit"
              >
                {saving
                  ? "Saving…"
                  : [
                        "schema",
                        "workflow",
                        "view",
                        "decision",
                        "merge",
                        "bootstrap",
                      ].includes(m.kind)
                    ? "Submit for review"
                    : m.kind === "execute"
                      ? "Approve & run plan"
                      : m.kind === "implement"
                        ? "Approve isolated implementation"
                        : m.kind === "apply"
                          ? "Approve & apply patch"
                          : m.kind === "restore"
                            ? "Approve restoration"
                            : m.kind === "undo"
                              ? "Restore checkpoint"
                              : "Save to workspace"}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
function AnalysisDialog({ modal: m, data, close, onMerge, onOpen }: Data) {
  const impact = m.kind === "impact";
  const title = impact ? "Review change impact" : "Review overlapping designs";
  const record = (id: string) => data.records.find((r: Data) => r.id === id);
  return (
    <div className="modal-backdrop">
      <div
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div>
            <small className="eyebrow">PROJECT KNOWLEDGE</small>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          {impact ? (
            <>
              <p className="muted">{m.analysis.limitations}</p>
              <div className="impact-stats">
                <Badge tone="amber">
                  {m.analysis.records.length} affected records
                </Badge>
                <Badge>{m.analysis.decisions.length} linked decisions</Badge>
                <Badge>{m.analysis.evidence.length} evidence records</Badge>
                <Badge>{m.analysis.files.length} indexed files</Badge>
              </div>
              <div className="records-list">
                {m.analysis.records.map((r: Data) => (
                  <button
                    className="record-row"
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                  >
                    <Network size={16} />
                    <div>
                      <strong>{r.title}</strong>
                      <small>
                        {r.type} · r{r.revision}
                      </small>
                    </div>
                    <Badge>{r.build}</Badge>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <h3 className="analysis-heading">Suggested validation</h3>
              {m.analysis.checks.map((check: string) => (
                <p className="analysis-check" key={check}>
                  <CheckCircle2 size={14} />
                  {check}
                </p>
              ))}
              {m.analysis.files.length > 0 && (
                <pre className="prompt-preview">
                  {m.analysis.files.join("\n")}
                </pre>
              )}
            </>
          ) : (
            <>
              <p className="muted">
                Local vocabulary similarity flags possible overlap, including
                common game-design synonyms. These scores are advisory. Resolve
                differences explicitly; a merge still requires approval.
              </p>
              {m.analysis.length ? (
                m.analysis.map((candidate: Data) => (
                  <section
                    className="review-card"
                    key={candidate.source_id + candidate.target_id}
                  >
                    <div className="review-card-head">
                      <Badge tone="amber">
                        {candidate.score}% vocabulary similarity
                      </Badge>
                      <small>{candidate.common_terms.join(" · ")}</small>
                    </div>
                    <div className="merge-diff">
                      {[candidate.source_id, candidate.target_id].map((id) => (
                        <div key={id}>
                          <h3>{record(id)?.title}</h3>
                          <p>{record(id)?.description}</p>
                        </div>
                      ))}
                    </div>
                    {candidate.conflicts.length > 0 && (
                      <p className="muted">
                        Different numeric claims to resolve:{" "}
                        {candidate.conflicts.join(", ")}
                      </p>
                    )}
                    <button
                      className="button primary"
                      onClick={() =>
                        onMerge(candidate.source_id, candidate.target_id)
                      }
                    >
                      <Layers size={14} /> Draft merge for review
                    </button>
                  </section>
                ))
              ) : (
                <div className="empty">
                  No strong vocabulary overlap found. You can still consolidate
                  any two records manually.
                </div>
              )}
              <button
                className="button subtle"
                onClick={() =>
                  onMerge(data.records[0]?.id, data.records[1]?.id)
                }
              >
                Choose records manually
              </button>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="button subtle" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
