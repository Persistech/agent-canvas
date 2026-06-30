import { createElement, type ReactNode } from "react";
import {
  BookOpen,
  Bot,
  Brain,
  Clock,
  Database,
  Flame,
  Folder,
  GitBranch,
  Globe,
  ListTree,
  MousePointerClick,
  Search,
  Sparkles,
  Telescope,
  TestTube,
} from "lucide-react";
import {
  SiAirtable,
  SiAtlassian,
  SiBrave,
  SiClickhouse,
  SiCloudflare,
  SiElevenlabs,
  SiFigma,
  SiGithub,
  SiHuggingface,
  SiKagi,
  SiLinear,
  SiMongodb,
  SiNotion,
  SiObsidian,
  SiPaypal,
  SiRedis,
  SiResend,
  SiSentry,
  SiSlack,
  SiStripe,
  SiSupabase,
} from "react-icons/si";

// Integration logos used to ship from `@openhands/extensions/integrations/logos`,
// but that subpath was dropped in @openhands/extensions 0.6.0. Logos are pure
// presentation, so the app owns this id -> icon registry locally. Entries not
// listed here fall back to INTEGRATION_FALLBACK_LOGO.

const LOGO = "h-5 w-5";

const simpleIcon = (
  Icon: React.ComponentType<{ className?: string }>,
): ReactNode => createElement(Icon, { className: LOGO });

const lucideIcon = (
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>,
): ReactNode => createElement(Icon, { className: LOGO, strokeWidth: 2.25 });

export const INTEGRATION_FALLBACK_LOGO: ReactNode = lucideIcon(Bot);

export const INTEGRATION_LOGOS: Record<string, ReactNode> = {
  github: simpleIcon(SiGithub),
  slack: simpleIcon(SiSlack),
  tavily: createElement(Search, { className: LOGO, strokeWidth: 2.5 }),
  linear: simpleIcon(SiLinear),
  notion: simpleIcon(SiNotion),
  atlassian: simpleIcon(SiAtlassian),
  sentry: simpleIcon(SiSentry),
  stripe: simpleIcon(SiStripe),
  paypal: simpleIcon(SiPaypal),
  "cloudflare-docs": simpleIcon(SiCloudflare),
  "cloudflare-bindings": simpleIcon(SiCloudflare),
  "cloudflare-observability": simpleIcon(SiCloudflare),
  huggingface: simpleIcon(SiHuggingface),
  deepwiki: simpleIcon(BookOpen),
  git: lucideIcon(GitBranch),
  "brave-search": simpleIcon(SiBrave),
  exa: lucideIcon(Telescope),
  firecrawl: lucideIcon(Flame),
  apify: lucideIcon(Bot),
  fetch: lucideIcon(Globe),
  "browser-mcp": lucideIcon(MousePointerClick),
  playwright: lucideIcon(TestTube),
  supabase: simpleIcon(SiSupabase),
  neon: lucideIcon(Database),
  mongodb: simpleIcon(SiMongodb),
  redis: simpleIcon(SiRedis),
  filesystem: lucideIcon(Folder),
  memory: lucideIcon(Brain),
  "sequential-thinking": lucideIcon(ListTree),
  time: lucideIcon(Clock),
  everything: lucideIcon(Sparkles),
  figma: simpleIcon(SiFigma),
  airtable: simpleIcon(SiAirtable),
  obsidian: simpleIcon(SiObsidian),
  elevenlabs: simpleIcon(SiElevenlabs),
  resend: simpleIcon(SiResend),
  "cloudflare-builds": simpleIcon(SiCloudflare),
  "cloudflare-browser-rendering": simpleIcon(SiCloudflare),
  kagi: simpleIcon(SiKagi),
  clickhouse: simpleIcon(SiClickhouse),
};

export const INTEGRATION_LOGO_IDS: Set<string> = new Set(
  Object.keys(INTEGRATION_LOGOS),
);
