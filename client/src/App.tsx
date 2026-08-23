import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import PlayerDetail from "./pages/PlayerDetail";
import Players from "./pages/Players";
import Sanctions from "./pages/Sanctions";
import Settings from "./pages/Settings";
import Whitelist from "./pages/Whitelist";
import { Route, Switch } from "wouter";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/players" component={Players} /><Route path="/players/:serverId/:playerUuid" component={PlayerDetail} /><Route path="/sanctions" component={Sanctions} /><Route path="/settings" component={Settings} /><Route path="/whitelist" component={Whitelist} /><Route component={NotFound} /></Switch>; }
function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
export default App;
