'use client';

import Link from 'next/link';
import { 
  Zap, 
  Brain, 
  GitBranch, 
  Shield, 
  Smartphone, 
  Layers,
  Rocket,
  Code,
  Users,
  BarChart,
  Bell,
  Sparkles,
  Code2
} from 'lucide-react';

const features = [
  {
    icon: Code2,
    title: 'CodeTrack AI — DSA & LeetCode Tracker',
    description: 'Interactive curriculum across 22 concepts, genuine LeetCode problems, verified attempt tracking, and personal AI mentor guidance',
    color: 'from-violet-500 to-indigo-500',
  },
  {
    icon: Brain,
    title: 'NVIDIA NIM AI Engine',
    description: 'Llama 3.3 70B for jury alignment & summaries, DeepSeek-R1 for debugging, Qwen Coder for PR reviews',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: GitBranch,
    title: 'GitHub Automation',
    description: 'Auto-task progression from commits, PR merging detection, non-technical translations for Pitch team',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Users,
    title: 'Discord-Style RBAC',
    description: 'Global Admins, Team Leaders, Custom roles with toggleable permissions (edit repo, trigger NIM, assign tasks, etc.)',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Smartphone,
    title: 'Native Android (Capacitor)',
    description: 'Compile to APK with FCM push notifications, offline support, native feel',
    color: 'from-orange-500 to-red-500',
  },
  {
    icon: Layers,
    title: 'Hardware BOM & Budget',
    description: 'Track components, prototype vs mass-production costs via AI, buyer assignment, status tracking',
    color: 'from-amber-500 to-yellow-500',
  },
  {
    icon: Shield,
    title: 'Vibe Coding Telemetry (MCP)',
    description: 'Live heartbeat purple dots, file lock warnings, .env vault pull, Vibe Rollback points',
    color: 'from-indigo-500 to-purple-500',
  },
];

const integrations = [
  { name: 'Supabase', icon: '🟢', desc: 'PostgreSQL + Realtime + Auth' },
  { name: 'Vercel', icon: '▲', desc: 'Hobby Tier Deployment' },
  { name: 'NVIDIA NIM', icon: '🟢', desc: 'AI Models API' },
  { name: 'Upstash QStash', icon: '🟡', desc: 'Background Jobs' },
  { name: 'Firebase FCM', icon: '🟠', desc: 'Push Notifications' },
  { name: 'Discord', icon: '🟣', desc: 'Webhooks + Slash Commands' },
  { name: 'Canva', icon: '🔵', desc: 'Presentation Sync' },
  { name: 'Google Sheets', icon: '🟢', desc: 'Hackathon Tracker' },
  { name: 'GitHub', icon: '⚫', desc: 'Webhooks + App' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-surface-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-surface-900">TrackMyWork</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">
                Features
              </Link>
              <Link href="/dashboard/codetrack" className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1.5">
                <Code2 className="w-4 h-4" />
                CodeTrack AI
              </Link>
              <Link href="/dashboard" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard/codetrack" className="btn-primary text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Open CodeTrack AI
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6 animate-in">
            <Sparkles className="w-4 h-4" />
            <span>Zero-cost • Instant Demo Developer Mode Enabled • CodeTrack AI</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 tracking-tight mb-6 animate-in">
            Hackathon Management &amp;
            <br />
            <span className="gradient-text">CodeTrack AI Ecosystem</span>
          </h1>
          <p className="text-lg sm:text-xl text-surface-600 max-w-3xl mx-auto mb-10 animate-in">
            Track hackathons, rooms, tasks, BOM hardware, and master Data Structures &amp; Algorithms with our brand new CodeTrack AI personal mentor — no sign-in required!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in">
            <Link href="/dashboard/codetrack" className="btn-primary px-8 py-3 text-base flex items-center gap-2">
              <Code2 className="w-5 h-5" />
              Launch CodeTrack AI
            </Link>
            <Link href="/dashboard" className="btn-outline px-8 py-3 text-base flex items-center gap-2">
              <Rocket className="w-5 h-5" />
              Enter Dashboard
            </Link>
          </div>
          
          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-surface-400 text-sm">
            {integrations.map((int) => (
              <div key={int.name} className="flex items-center gap-2" title={int.desc}>
                <span className="text-lg">{int.icon}</span>
                <span className="font-medium text-surface-500">{int.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-4">
              Built for Hackathon Teams
            </h2>
            <p className="text-lg text-surface-600 max-w-2xl mx-auto">
              Every feature designed for the chaos and speed of hackathons. 
              Set up in minutes, automate the rest.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title} 
                className="card-hover p-6 group animate-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-surface-900 mb-2">{feature.title}</h3>
                <p className="text-surface-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-6">
                Two-Layer Permission Architecture
              </h2>
              <div className="space-y-4 text-surface-600">
                <div className="flex items-start gap-3 p-4 card">
                  <Shield className="w-6 h-6 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-surface-900">Global Super-Admin</h3>
                    <p className="text-sm mt-1">View/edit all rooms, manage master integrations (NIM keys, Google Sheets), Ghost Mode observation</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 card">
                  <Users className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-surface-900">Room Team Leader</h3>
                    <p className="text-sm mt-1">Scoped admin: edit room settings, approve invites, bypass custom role restrictions within room</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 card">
                  <Layers className="w-6 h-6 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-surface-900">Custom Roles (Discord-Style)</h3>
                    <p className="text-sm mt-1">Frontend, Backend, AI/ML, Pitch/Media, Video Editor + 8 toggleable permissions per member</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="card p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-accent-500/10" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-surface-600">Live Vibe Coding Heartbeats</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-surface-600">File Lock Conflict Detection</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-surface-600">.env Vault Auto-pull</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-surface-600">Vibe Rollback Points</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-surface-600">1-tap SOS Debug (Logcat/Rust)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-4">
              Deep Integrations
            </h2>
            <p className="text-lg text-surface-600 max-w-2xl mx-auto">
              Native connections to the tools hackathon teams actually use.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((int) => (
              <div key={int.name} className="card p-5 flex items-center gap-4 group hover:border-primary-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-surface-100 flex items-center justify-center text-2xl">
                  {int.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900">{int.name}</h3>
                  <p className="text-sm text-surface-500">{int.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to dominate your next hackathon?
          </h2>
          <p className="text-surface-300 mb-8 text-lg">
            Deploy in minutes. Zero cost. Full AI automation. Native Android APK.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="btn-primary px-8 py-3 text-base bg-white text-primary-700 hover:bg-surface-100">
              <Rocket className="w-5 h-5" />
              Create Your First Room
            </Link>
            <Link href="https://github.com/Allen-Ajith8/TrackMyWork" target="_blank" rel="noopener noreferrer" className="btn-outline px-8 py-3 text-base border-surface-700 text-surface-300 hover:bg-surface-800 hover:text-white">
              <GitBranch className="w-5 h-5" />
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-surface-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-surface-900">TrackMyWork</span>
              </div>
              <p className="text-surface-600 text-sm">
                Zero-cost hackathon management ecosystem with AI automation, 
                native Android support, and vibe coding telemetry.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-surface-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-surface-600">
                <li><Link href="#" className="hover:text-primary-600">Features</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Pricing</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Changelog</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Roadmap</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-surface-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-surface-600">
                <li><Link href="#" className="hover:text-primary-600">Documentation</Link></li>
                <li><Link href="#" className="hover:text-primary-600">API Reference</Link></li>
                <li><Link href="#" className="hover:text-primary-600">MCP Server</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Discord Community</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-surface-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-surface-600">
                <li><Link href="#" className="hover:text-primary-600">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-surface-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-surface-500">
              © 2024 TrackMyWork. Built for hackathons, by hackathon veterans.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-surface-500 hover:text-primary-600" aria-label="GitHub">
                <GitBranch className="w-5 h-5" />
              </a>
              <a href="#" className="text-surface-500 hover:text-primary-600" aria-label="Discord">
                <Layers className="w-5 h-5" />
              </a>
              <a href="#" className="text-surface-500 hover:text-primary-600" aria-label="Twitter">
                <BarChart className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}