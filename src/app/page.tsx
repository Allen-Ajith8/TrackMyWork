'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Zap, 
  Brain, 
  GitBranch, 
  Shield, 
  Smartphone, 
  Layers, 
  Rocket, 
  Users, 
  BarChart, 
  Sparkles, 
  Code2,
  Sun,
  Moon,
  ArrowRight
} from 'lucide-react';
import Galaxy from '@/components/ui/galaxy';

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('trackmywork_theme') as 'dark' | 'light' | null;
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('trackmywork_theme', nextTheme);
  };

  const isLight = mounted && theme === 'light';

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${isLight ? 'bg-gradient-to-b from-[#f8f9ff] via-[#f5f6ff] to-[#fbfaff] text-slate-900' : 'bg-[#060814] text-slate-100'}`}>
      
      {/* Dynamic Galaxy Canvas Background */}
      <div className="fixed inset-0 z-0 pointer-events-auto overflow-hidden">
        <Galaxy
          key={isLight ? 'light' : 'dark'}
          lightMode={isLight}
          transparent={true}
          starColors={
            isLight
              ? ['#312e81', '#581c87', '#1e40af', '#4c1d95'] // dark sprinkles in rich blue & purple ink
              : ['#c084fc', '#818cf8', '#38bdf8', '#ffffff'] // glowing cosmos in neon purple, violet, cyan & white
          }
          density={isLight ? 1.25 : 1.05}
          glowIntensity={isLight ? 0.45 : 0.55}
          flareIntensity={isLight ? 0.75 : 1.0}
          starSpeed={0.45}
          speed={0.85}
          twinkleIntensity={0.35}
          rotationSpeed={0.06}
          mouseInteraction={true}
          mouseRepulsion={true}
          repulsionStrength={2.2}
          clickWarp={true}
          className="w-full h-full opacity-90"
        />
      </div>

      {/* Subtle Ambient Gradients */}
      <div 
        aria-hidden="true" 
        className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 ${isLight ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(168,85,247,0.12),transparent_70%)]' : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(168,85,247,0.18),transparent_70%)]'}`} 
      />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${isLight ? 'bg-white/80 border-b border-slate-200/70 shadow-sm backdrop-blur-xl' : 'bg-[#060814]/80 border-b border-slate-800/80 shadow-lg backdrop-blur-xl'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-md shadow-purple-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className={`font-bold text-xl tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                TrackMyWork
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              <div className="hidden md:flex items-center gap-6">
                <Link 
                  href="#features" 
                  className={`text-sm font-medium transition-colors ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  Features
                </Link>
                <Link 
                  href="/dashboard/codetrack" 
                  className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition-colors flex items-center gap-1.5"
                >
                  <Code2 className="w-4 h-4" />
                  CodeTrack AI
                </Link>
                <Link 
                  href="/dashboard" 
                  className={`text-sm font-medium transition-colors ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                >
                  Dashboard
                </Link>
              </div>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
                className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 ${
                  isLight 
                    ? 'border-purple-200 bg-purple-50/80 text-purple-800 hover:bg-purple-100 shadow-sm' 
                    : 'border-slate-700 bg-slate-900/80 text-amber-300 hover:bg-slate-800 hover:text-amber-200 shadow-md'
                }`}
              >
                {isLight ? (
                  <>
                    <Moon className="w-4 h-4 text-purple-700 fill-purple-700/20" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                )}
              </button>

              <Link href="/dashboard/codetrack" className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-1.5 shadow-md shadow-purple-600/30">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Open</span> CodeTrack AI
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center pointer-events-auto">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium mb-6 animate-in backdrop-blur-md border ${
            isLight 
              ? 'bg-purple-50/90 border-purple-200 text-purple-800 shadow-sm' 
              : 'bg-purple-950/60 border-purple-500/30 text-purple-300 shadow-lg shadow-purple-900/20'
          }`}>
            <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
            <span>Zero-Cost • Instant Demo Developer Mode Enabled • CodeTrack AI</span>
          </div>

          <h1 className={`text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-in leading-[1.1] ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Hackathon Management &amp;
            <br />
            <span className="gradient-text drop-shadow-sm">CodeTrack AI Ecosystem</span>
          </h1>

          <p className={`text-lg sm:text-xl max-w-3xl mx-auto mb-10 animate-in leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Supercharge hackathons, team rooms, real-time tasks, hardware BOM budgeting, and master Data Structures &amp; Algorithms with our brand new CodeTrack AI personal mentor.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in">
            <Link 
              href="/dashboard/codetrack" 
              className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/30 font-semibold hover:scale-[1.02] transition-transform"
            >
              <Code2 className="w-5 h-5" />
              Launch CodeTrack AI
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/dashboard" 
              className={`w-full sm:w-auto px-8 py-3.5 text-base rounded-lg flex items-center justify-center gap-2 border font-medium transition-all backdrop-blur-md ${
                isLight 
                  ? 'border-slate-300 bg-white/80 text-slate-800 hover:bg-slate-100 hover:border-slate-400 shadow-sm' 
                  : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:border-slate-600 shadow-lg'
              }`}
            >
              <Rocket className="w-5 h-5" />
              Enter Dashboard
            </Link>
          </div>
          
          {/* Trust indicators */}
          <div className={`mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {integrations.map((int) => (
              <div 
                key={int.name} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-transform hover:scale-105 ${
                  isLight ? 'border-slate-200/60 bg-white/60' : 'border-slate-800/80 bg-slate-900/50'
                }`} 
                title={int.desc}
              >
                <span className="text-base">{int.icon}</span>
                <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{int.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={`relative z-10 py-24 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-slate-200/70 bg-white/70 backdrop-blur-md' : 'border-slate-800/70 bg-[#070a18]/75 backdrop-blur-md'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={`text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Built for Fast-Paced Hackathon Teams
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Every feature designed for the velocity, chaos, and collaboration of winning teams. Set up in seconds, automate the rest.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title} 
                className={`p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
                  isLight 
                    ? 'border-slate-200/80 bg-white/80 shadow-sm hover:shadow-lg hover:border-purple-300' 
                    : 'border-slate-800/90 bg-slate-900/65 shadow-md hover:shadow-purple-900/20 hover:border-purple-500/40'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-md`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className={`relative z-10 py-24 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-slate-200/70 bg-purple-50/30' : 'border-slate-800/70 bg-[#050711]/80'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className={`text-3xl sm:text-4xl font-extrabold mb-6 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Two-Layer Permission Architecture
              </h2>
              <div className="space-y-4">
                <div className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm ${
                  isLight ? 'border-slate-200 bg-white/80 shadow-sm' : 'border-slate-800 bg-slate-900/60 shadow-md'
                }`}>
                  <Shield className="w-6 h-6 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Global Super-Admin</h3>
                    <p className={`text-sm mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      View/edit all rooms, manage master integrations (NIM keys, Google Sheets), and Ghost Mode observation.
                    </p>
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm ${
                  isLight ? 'border-slate-200 bg-white/80 shadow-sm' : 'border-slate-800 bg-slate-900/60 shadow-md'
                }`}>
                  <Users className="w-6 h-6 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Room Team Leader</h3>
                    <p className={`text-sm mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Scoped admin: edit room settings, approve invites, and coordinate custom role permissions.
                    </p>
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm ${
                  isLight ? 'border-slate-200 bg-white/80 shadow-sm' : 'border-slate-800 bg-slate-900/60 shadow-md'
                }`}>
                  <Layers className="w-6 h-6 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Custom Roles (Discord-Style)</h3>
                    <p className={`text-sm mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Frontend, Backend, AI/ML, Pitch/Media, Video Editor + 8 toggleable permissions per teammate.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-8 rounded-2xl border backdrop-blur-md relative overflow-hidden ${
              isLight ? 'border-purple-200/80 bg-white/85 shadow-lg' : 'border-purple-900/40 bg-slate-900/70 shadow-2xl'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>Live Telemetry Status</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-Time Vibe Coding Heartbeats</span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Multi-User File Lock Conflict Shield</span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Auto-Synced .env Secure Vault Pull</span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Instant Vibe Rollback Points</span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>1-Tap SOS Debugger with DeepSeek-R1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`relative z-10 py-24 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-slate-200/70 bg-white/80' : 'border-slate-800/80 bg-[#050814]/90'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className={`text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Ready to Dominate Your Next Hackathon?
          </h2>
          <p className={`text-lg mb-8 max-w-2xl mx-auto ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Deploy in minutes. Zero cost. Full AI automation. Practice 22 DSA modules on CodeTrack AI right away.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/auth/signup" 
              className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30"
            >
              <Rocket className="w-5 h-5" />
              Create Your First Room
            </Link>
            <Link 
              href="https://github.com/huznafariha14/TrackMyWork" 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`w-full sm:w-auto px-8 py-3.5 text-base rounded-lg flex items-center justify-center gap-2 border font-medium transition-all ${
                isLight 
                  ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100' 
                  : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <GitBranch className="w-5 h-5" />
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`relative z-10 py-12 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-slate-200/80 bg-slate-50/80 text-slate-600' : 'border-slate-800/80 bg-[#04060f]/90 text-slate-400'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className={`font-bold text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>TrackMyWork</span>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} TrackMyWork. Built for hackathons &amp; developers.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="hover:text-purple-600 transition-colors">Dashboard</Link>
              <Link href="/dashboard/codetrack" className="hover:text-purple-600 transition-colors">CodeTrack AI</Link>
              <Link href="/auth/login" className="hover:text-purple-600 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
