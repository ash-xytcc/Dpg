import React from "react";
import {
	HashRouter,
	Routes,
	Route,
	Navigate,
	useLocation,
} from "react-router-dom";

// PAGES
import OrgPublicPreview from "./pages/OrgPublicPreview.jsx";
import PublicPage from "./pages/PublicPage.jsx";
import Overview from "./pages/Overview.jsx";
import OrgDash from "./pages/OrgDash.jsx";
import InnerSanctum from "./pages/InnerSanctum.jsx";
import People from "./pages/People.jsx";
import Inventory from "./pages/Inventory.jsx";
import Meetings from "./pages/Meetings.jsx";
import MeetingDetail from "./pages/MeetingDetail.jsx";
import Needs from "./pages/Needs.jsx";
import Settings from "./pages/Settings.jsx";
import BondfireChat from "./pages/BondfireChat.jsx";
import SignIn from "./pages/SignIn.jsx";
import Security from "./pages/Security.jsx";
import Drive from "./pages/Drive.jsx";
import Studio from "./pages/Studio.jsx";
import Attendees from "./pages/Attendees.jsx";
import DpgSessionsPage from "./pages/dpg/DpgSessionsPage";
import DpgVideosPage from "./pages/dpg/DpgVideosPage.jsx";
import DpgPublicHome from "./pages/DpgPublicHome.jsx";
import PublicBulletinIndex from "./pages/dpg/PublicBulletinIndex.jsx";
import PublicBulletinPost from "./pages/dpg/PublicBulletinPost.jsx";
import PublicContentPage from "./pages/dpg/PublicContentPage.jsx";
import PublicShareDetail from "./pages/dpg/PublicShareDetail.jsx";
import PublicSessionsPage from "./pages/dpg/PublicSessionsPage.jsx";
import SiteEditor from "./pages/SiteEditor.jsx";

// COMPONENTS
import AppHeader from "./components/AppHeader.jsx";
import OrgSecretGuard from "./components/OrgSecretGuard.jsx";
import HelpWidget from "./help/HelpWidget.jsx";
import DemoBanner from "./demo/DemoBanner.jsx";
import DemoSpotlightTour from "./demo/DemoSpotlightTour.jsx";
import DemoBoot from "./pages/DemoBoot.jsx";
import { isDemoMode, disableDemoMode } from "./demo/demoMode.js";
import { getAdminBasePath, getAppVariant, isDpgVariant } from "./lib/appVariant.js";
import PublicHome from "./pages/dpg/PublicHome.jsx";
import AdminHome from "./pages/dpg/AdminHome.jsx";

/* -------------------------------- Error Boundary ------------------------------- */
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, info) {
		console.error("App error boundary:", error);
		console.error("App error boundary stack:", error?.stack);
		console.error("App error boundary component stack:", info?.componentStack);
	}
	render() {
		if (this.state.error) {
			return (
				<div style={{ padding: 16 }}>
					<h2 style={{ color: "crimson" }}>Something broke.</h2>
					<pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
				</div>
			);
		}
		return this.props.children;
	}
}

/* ------------------------------ Auth Context ------------------------------ */
const DPG_ORG_ID = "dpg";

function DpgAppRedirect({ to = "overview" }) {
        return <Navigate to={`/org/${DPG_ORG_ID}/${to}`} replace />;
}

const AuthCtx = React.createContext({
	authed: false,
	loading: true,
	user: null,
	refresh: async () => ({ ok: false }),
	logout: async () => {},
});

async function fetchMe() {
	if (isDemoMode()) {
		return { ok: true, user: { id: "demo", name: "Demo User", email: "demo@bondfire.local", demo: true } };
	}
	// Try /me first. If access cookie expired but refresh cookie is still valid,
	// attempt a silent refresh and retry once before declaring the session dead.
	const doMe = async () => {
		const res = await fetch("/api/auth/me", {
			method: "GET",
			credentials: "include",
			headers: { Accept: "application/json" },
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data?.ok) return { ok: false, status: res.status, data };
		return { ok: true, user: data.user };
	};

	let me = await doMe();
	if (me.ok) return me;

	// Only retry on auth-ish failures.
	if (me.status === 401 || me.status === 403) {
		try {
			const rr = await fetch("/api/auth/refresh", {
				method: "POST",
				credentials: "include",
				headers: { Accept: "application/json" },
			});
			// ignore body, just see if it worked
			if (rr.ok) {
				me = await doMe();
				if (me.ok) return me;
			}
		} catch {
			// ignore
		}
	}

	return me;
}

function RequireAuth({ children }) {
        const { authed, loading } = React.useContext(AuthCtx);
        const loc = useLocation();

        if (loading) {
                return <div style={{ padding: 16 }}>Loading…</div>;
        }

        return authed
                ? children
                : (
                        <Navigate
                                to="/signin"
                                replace
                                state={{ from: `${loc.pathname}${loc.search}${loc.hash}` }}
                        />
                );
}

function getDpgDefaultOrgPath() {
	try {
		const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
		const first = Array.isArray(orgs) ? orgs.find((o) => o?.id) : null;
		return first?.id ? `/org/${encodeURIComponent(first.id)}/overview` : null;
	} catch {
		return null;
	}
}

function DpgOrgsRedirect() {
	const target = getDpgDefaultOrgPath();
	return target ? <Navigate to={target} replace /> : <OrgDash />;
}

function Shell() {
	const loc = useLocation();
	const path = loc.pathname || "/";

	const [state, setState] = React.useState({
		authed: false,
		loading: true,
		user: null,
	});

	const refresh = React.useCallback(async (options = {}) => {
		const { background = false } = options;

		if (!background) {
			setState((s) => ({ ...s, loading: true }));
		}

		try {
			const me = await fetchMe();
			if (!me.ok) {
				setState({ authed: false, loading: false, user: null });
				return { ok: false };
			}
			setState({ authed: true, loading: false, user: me.user });
			return { ok: true, user: me.user };
		} catch (e) {
			console.error("auth/me check failed", e);
			setState({ authed: false, loading: false, user: null });
			return { ok: false };
		}
	}, []);

	const logout = React.useCallback(async () => {
		try {
			await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
		} catch {}
		try {
			localStorage.removeItem("demo_user");
			localStorage.removeItem("bf-demo-user");
			disableDemoMode();
		} catch {}
		setState({ authed: false, loading: false, user: null });
		window.location.hash = "#/signin";
		window.location.reload();
	}, []);

	React.useEffect(() => {
		refresh();
		const onAuthChanged = () => refresh();
		window.addEventListener("bf-auth-changed", onAuthChanged);
		return () => window.removeEventListener("bf-auth-changed", onAuthChanged);
	}, [refresh]);

	// Keep the session alive while the app is open without flashing auth UI.
	React.useEffect(() => {
		if (!state.authed) return;

		const ping = async () => {
			if (document.visibilityState !== "visible") return;
			try {
				await refresh({ background: true });
			} catch {
				// ignore
			}
		};

		const t0 = setTimeout(ping, 30_000);
		const iv = setInterval(ping, 5 * 60_000);
		return () => {
			clearTimeout(t0);
			clearInterval(iv);
		};
	}, [state.authed, refresh]);

	const ctxValue = React.useMemo(() => ({
		authed: state.authed,
		loading: state.loading,
		user: state.user,
		refresh,
		logout,
	}), [state, refresh, logout]);

	const HomeRoute = () => isDpgVariant() ? <DpgPublicHome /> : <PublicHome />;

	// Hide the header on public routes
	const hideHeader = path === "/" || path.startsWith("/p/") || path === "/signin" || path === "/demo";

	return (
		<AuthCtx.Provider value={ctxValue}>
			{!hideHeader && (
				<AppHeader
					showLogout={state.authed}
					onLogout={logout}
				/>
			)}

			<Routes>
				{/* PUBLIC */}
				<Route path="/p/:slug" element={<PublicPage />} />
				<Route path="/p/*" element={<PublicPage />} />
				<Route path="/signin" element={<SignIn />} />
				<Route path="/demo" element={<DemoBoot />} />

				{/* Landing */}
				<Route path="/" element={<HomeRoute />} />

                {/* DPG PUBLIC BULLETIN */}
                <Route path="/bulletin" element={<PublicBulletinIndex />} />
                <Route path="/bulletin/:slug" element={<PublicBulletinPost />} />

                                <Route path="/dpg" element={<PublicHome />} />
                                <Route path="/dpg/app" element={<DpgAppRedirect to="overview" />} />
                                <Route path="/dpg/app/overview" element={<DpgAppRedirect to="overview" />} />
                                <Route path="/dpg/app/attendees" element={<DpgAppRedirect to="attendees" />} />
                                <Route path="/dpg/app/inventory" element={<DpgAppRedirect to="inventory" />} />
                                <Route path="/dpg/app/needs" element={<DpgAppRedirect to="needs" />} />
                                <Route path="/dpg/app/meetings" element={<DpgAppRedirect to="meetings" />} />
                                <Route path="/dpg/app/settings" element={<DpgAppRedirect to="settings" />} />
                                <Route path="/dpg/app/drive" element={<DpgAppRedirect to="drive" />} />
                                <Route path="/dpg/app/studio" element={<DpgAppRedirect to="studio" />} />
                                <Route path="/dpg/app/sessions" element={<DpgAppRedirect to="sessions" />} />
                                <Route path="/dpg/app/videos" element={<DpgAppRedirect to="videos" />} />

				{/* Orgs list */}
				<Route
					path="/orgs"
					element={
						<RequireAuth>
							{isDpgVariant() ? <DpgOrgsRedirect /> : <OrgDash />}
						</RequireAuth>
					}
				/>

				{/* User security */}
				<Route
					path="/security"
					element={
						<RequireAuth>
							<Security />
						</RequireAuth>
					}
				/>

				{/* ORG SPACE */}
				<Route
					path="/org/:orgId/*"
					element={
						<RequireAuth>
							<InnerSanctum />
						</RequireAuth>
					}
				>
					<Route index element={<Overview />} />
					<Route path="overview" element={<Overview />} />
					<Route path="attendees" element={<Attendees />} />
					<Route path="people" element={<People />} />
					<Route path="inventory" element={<Inventory />} />
					<Route path="needs" element={<Needs />} />
					<Route path="meetings" element={<Meetings />} />
					<Route path="meetings/:meetingId" element={<MeetingDetail />} />
					<Route path="settings" element={<Settings />} />
					<Route path="site-editor" element={<SiteEditor />} />
					<Route path="drive" element={<Drive />} />
					<Route path="studio" element={<Studio />} />
					<Route path="sessions" element={<DpgSessionsPage />} />
					<Route path="videos" element={<DpgVideosPage key="dpg-videos-hard-reset" />} />
					<Route path="public" element={<OrgPublicPreview />} />
					<Route path="chat" element={isDpgVariant() ? <Navigate to="../overview" replace /> : <BondfireChat />} />
					<Route path="guard/*" element={<OrgSecretGuard />} />
				</Route>

				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
			<HelpWidget />
			<DemoBanner />
			<DemoSpotlightTour />
		</AuthCtx.Provider>
	);
}

/* ---------------------------------- App ---------------------------------- */
function AdminApp() {
	const basename = getAdminBasePath();

	return (
		<HashRouter basename={basename || undefined}>
			<ErrorBoundary>
				<Shell />
			</ErrorBoundary>
		</HashRouter>
	);
}

export default function App() {
  const browserPath = typeof window !== "undefined" ? (window.location.pathname || "/") : "/";
  const adminHash = typeof window !== "undefined" ? (window.location.hash || "") : "";
  const isAdminPath = browserPath === "/admin" || browserPath.startsWith("/admin/");
  const isSignInHash = adminHash === "#/signin" || adminHash.startsWith("#/signin?");
  const isAnyHashAppRoute = adminHash.startsWith("#/");

  if (browserPath === "/bulletin" || browserPath === "/bulletin/") {
    return <PublicBulletinIndex key="bulletin-index" />;
  }

  if (/^\/bulletin\/.+/.test(browserPath)) {
    return <PublicBulletinPost key={browserPath} />;
  }

  if (browserPath === "/" && !isAnyHashAppRoute) {
    return <DpgPublicHome key="public-home" />;
  }

  if (/^\/dpg-shares\/.+/.test(browserPath)) {
    const slug = browserPath.split("/").filter(Boolean)[1] || "";
    return <PublicShareDetail key={browserPath} slug={slug} />;
  }

  if (browserPath === "/sessions") {
    return <PublicSessionsPage key="public-sessions" />;
  }

  const publicSlugMap = {
    "/about": "about",
    "/faq": "faq",
    "/volunteer": "volunteer",
    "/donate": "donate",
    "/press": "press",
    "/rsvp": "rsvp",
    "/dpg-shares": "dpg-shares",
  };

  if (publicSlugMap[browserPath]) {
    return <PublicContentPage key={publicSlugMap[browserPath]} slug={publicSlugMap[browserPath]} />;
  }

  if (isSignInHash || isAdminPath || isAnyHashAppRoute) {
    return <AdminApp />;
  }

  return <AdminApp />;
}
