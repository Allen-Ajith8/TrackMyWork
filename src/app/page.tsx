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
  Sparkles, 
  Code2,
  Sun,
  Moon,
  ArrowRight
} from 'lucide-react';
import Galaxy from '@/components/ui/galaxy';
import CurvedLoop from '@/components/ui/curved-loop';

const features = [
  {
    icon: Code2,
    title: 'CodeTrack AI — DSA & LeetCode Tracker',
    description: 'Interactive curriculum across 22 concepts, genuine LeetCode problems, verified attempt tracking, and personal AI mentor guidance',
    color: 'from-red-600 to-rose-600',
  },
  {
    icon: Brain,
    title: 'NVIDIA NIM AI Engine',
    description: 'Llama 3.3 70B for jury alignment & summaries, DeepSeek-R1 for debugging, Qwen Coder for PR reviews',
    color: 'from-neutral-900 to-red-700',
  },
  {
    icon: GitBranch,
    title: 'GitHub Automation',
    description: 'Auto-task progression from commits, PR merging detection, non-technical translations for Pitch team',
    color: 'from-red-600 to-rose-500',
  },
  {
    icon: Users,
    title: 'Discord-Style RBAC',
    description: 'Global Admins, Team Leaders, Custom roles with toggleable permissions (edit repo, trigger NIM, assign tasks, etc.)',
    color: 'from-rose-700 to-red-600',
  },
  {
    icon: Smartphone,
    title: 'Native Android (Capacitor)',
    description: 'Compile to APK with FCM push notifications, offline support, native feel',
    color: 'from-red-600 to-neutral-900',
  },
  {
    icon: Layers,
    title: 'Hardware BOM & Budget',
    description: 'Track components, prototype vs mass-production costs via AI, buyer assignment, status tracking',
    color: 'from-neutral-950 to-red-600',
  },
  {
    icon: Shield,
    title: 'Vibe Coding Telemetry (MCP)',
    description: 'Live heartbeat telemetry, file lock conflict shield, .env vault pull, Vibe Rollback points',
    color: 'from-red-700 to-rose-600',
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
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('trackmywork_theme') as 'dark' | 'light' | null;
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('trackmywork_theme', nextTheme);
  };

  const isLight = mounted ? theme === 'light' : true;

  return (
    <div className={`min-h-screen relative transition-colors duration-500 ${
      isLight 
        ? 'bg-[#ffffff] text-neutral-950' 
        : 'bg-[#08080a] text-white'
    }`}>
      
      {/* Dynamic Galaxy Canvas Background */}
      <div className="fixed inset-0 z-0 pointer-events-auto overflow-hidden">
        <Galaxy
          key={isLight ? 'light' : 'dark'}
          lightMode={isLight}
          transparent={true}
          starColors={
            isLight
              ? ['#991b1b', '#7f1d1d', '#450a0a', '#18181b'] // dark red, burgundy & rich black ink sprinkles
              : ['#ef4444', '#f87171', '#fb7185', '#ffffff'] // glowing crimson, ruby rose, coral & white stars
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

      {/* Subtle Ambient Red Glow */}
      <div 
        aria-hidden="true" 
        className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 ${
          isLight 
            ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(239,68,68,0.08),transparent_70%)]' 
            : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(220,38,38,0.18),transparent_70%)]'
        }`} 
      />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        isLight 
          ? 'bg-white/85 border-b border-neutral-200 shadow-sm backdrop-blur-xl' 
          : 'bg-[#08080a]/85 border-b border-neutral-800 shadow-lg backdrop-blur-xl'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center shadow-md shadow-red-500/25">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className={`font-extrabold text-xl tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
                TrackMyWork<span className="text-red-600">.</span>
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              <div className="hidden md:flex items-center gap-6">
                <Link 
                  href="#features" 
                  className={`text-sm font-semibold transition-colors ${
                    isLight ? 'text-neutral-800 hover:text-red-600' : 'text-neutral-300 hover:text-red-400'
                  }`}
                >
                  Features
                </Link>
                <Link 
                  href="/dashboard/codetrack" 
                  className={`text-sm font-bold transition-colors flex items-center gap-1.5 ${
                    isLight ? 'text-red-600 hover:text-red-700' : 'text-red-400 hover:text-red-300'
                  }`}
                >
                  <Code2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  CodeTrack AI
                </Link>
                <Link 
                  href="/auth/login?redirect=/dashboard" 
                  className={`text-sm font-semibold transition-colors ${
                    isLight ? 'text-neutral-800 hover:text-red-600' : 'text-neutral-300 hover:text-red-400'
                  }`}
                >
                  Dashboard
                </Link>
              </div>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
                className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all duration-200 ${
                  isLight 
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 shadow-sm' 
                    : 'border-neutral-800 bg-neutral-900 text-red-400 hover:bg-neutral-800 shadow-md'
                }`}
              >
                {isLight ? (
                  <>
                    <Moon className="w-4 h-4 text-red-600 fill-red-600/20" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-red-400 fill-red-400/20" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                )}
              </button>

              <Link 
                href="/dashboard/codetrack" 
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-lg flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Open</span> CodeTrack AI
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center pointer-events-auto">
          {/* Badge Pill */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold mb-6 animate-in backdrop-blur-md border ${
            isLight 
              ? 'bg-red-50/90 border-red-200 text-red-700 shadow-sm' 
              : 'bg-red-950/60 border-red-500/40 text-red-300 shadow-lg shadow-red-950/30'
          }`}>
            <Sparkles className={`w-4 h-4 ${isLight ? 'text-red-600' : 'text-red-400'} animate-pulse`} />
            <span>Zero-Cost • Instant Demo Developer Mode Enabled • <span className={isLight ? 'text-black' : 'text-white'}>CodeTrack AI</span></span>
          </div>

          {/* Heading */}
          <h1 className={`text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 animate-in leading-[1.1] ${
            isLight ? 'text-black' : 'text-white'
          }`}>
            Hackathon Management &amp;
            <br />
            <span className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 dark:from-red-500 dark:via-rose-400 dark:to-red-400 bg-clip-text text-transparent drop-shadow-sm">
              CodeTrack AI Ecosystem
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`text-lg sm:text-xl max-w-3xl mx-auto mb-10 animate-in leading-relaxed font-medium ${
            isLight ? 'text-neutral-800' : 'text-neutral-300'
          }`}>
            Supercharge hackathons, team rooms, real-time tasks, hardware BOM budgeting, and master Data Structures &amp; Algorithms with our brand new <strong className={isLight ? 'text-black' : 'text-white'}>CodeTrack AI</strong> personal mentor.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in">
            <Link 
              href="/dashboard/codetrack" 
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white w-full sm:w-auto px-8 py-3.5 text-base rounded-lg flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/30 font-bold hover:scale-[1.02] transition-transform"
            >
              <Code2 className="w-5 h-5" />
              Launch CodeTrack AI
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/auth/login?redirect=/dashboard" 
              className={`w-full sm:w-auto px-8 py-3.5 text-base rounded-lg flex items-center justify-center gap-2 border font-bold transition-all backdrop-blur-md ${
                isLight 
                  ? 'border-neutral-300 bg-white/90 text-black hover:bg-neutral-100 hover:border-red-300 hover:text-red-600 shadow-sm' 
                  : 'border-neutral-800 bg-neutral-900/80 text-white hover:bg-neutral-800 hover:border-red-500/40 hover:text-red-400 shadow-lg'
              }`}
            >
              <Rocket className="w-5 h-5 text-red-600 dark:text-red-400" />
              Enter Dashboard
            </Link>
          </div>
          
          {/* Trust indicators */}
          <div className={`mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm ${
            isLight ? 'text-neutral-800' : 'text-neutral-300'
          }`}>
            {integrations.map((int) => (
              <div 
                key={int.name} 
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border backdrop-blur-sm transition-transform hover:scale-105 ${
                  isLight 
                    ? 'border-neutral-200/90 bg-white/80 hover:border-red-300 shadow-sm' 
                    : 'border-neutral-800/90 bg-neutral-900/60 hover:border-red-500/40'
                }`} 
                title={int.desc}
              >
                <span className="text-base">{int.icon}</span>
                <span className={`font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{int.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curved Loop Marquee Section */}
      <section className="relative z-10 w-full overflow-hidden py-4 sm:py-8 pointer-events-auto">
        <CurvedLoop
          marqueeText="TRACKMYWORK"
          speed={2.2}
          curveAmount={340}
          direction="left"
          interactive={true}
          color={isLight ? '#000000' : '#ffffff'}
          separator="✦"
          separatorColor={isLight ? '#dc2626' : '#ef4444'}
          fontSize={82}
          fontWeight={900}
          letterSpacing={3}
          edgeFade={0.25}
          scrollBoost={0.6}
        />
      </section>

      {/* Features Section */}
      <section id="features" className={`relative z-10 py-24 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-neutral-200 bg-white/80 backdrop-blur-md' : 'border-neutral-800 bg-[#0a0a0d]/80 backdrop-blur-md'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={`text-3xl sm:text-5xl font-black mb-4 tracking-tight ${
              isLight ? 'text-black' : 'text-white'
            }`}>
              Built for Fast-Paced <span className="text-red-600 dark:text-red-500">Hackathon Teams</span>
            </h2>
            <p className={`text-lg max-w-2xl mx-auto font-medium ${
              isLight ? 'text-neutral-800' : 'text-neutral-300'
            }`}>
              Every feature designed for the velocity, chaos, and collaboration of winning teams. Set up in seconds, automate the rest.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title} 
                className={`p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] group ${
                  isLight 
                    ? 'border-neutral-200 bg-white/90 shadow-sm hover:shadow-lg hover:border-red-300' 
                    : 'border-neutral-800 bg-neutral-900/70 shadow-md hover:shadow-red-950/20 hover:border-red-500/40'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-md`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className={`text-xl font-bold mb-2 transition-colors ${
                  isLight ? 'text-black group-hover:text-red-600' : 'text-white group-hover:text-red-400'
                }`}>
                  {feature.title}
                </h3>
                <p className={`text-sm leading-relaxed font-medium ${
                  isLight ? 'text-neutral-700' : 'text-neutral-300'
                }`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className={`relative z-10 py-24 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-neutral-200 bg-red-50/20' : 'border-neutral-800 bg-[#07070a]/90'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className={`text-3xl sm:text-4xl font-black mb-6 ${
                isLight ? 'text-black' : 'text-white'
              }`}>
                Two-Layer Permission <span className="text-red-600 dark:text-red-500">Architecture</span>
              </h2>
              <div className="space-y-4">
                <div className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm ${
                  isLight ? 'border-neutral-200 bg-white/90 shadow-sm' : 'border-neutral-800 bg-neutral-900/70 shadow-md'
                }`}>
                  <Shield className="w-6 h-6 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className={`font-bold ${isLight ? 'text-black' : 'text-white'}`}>Global Super-Admin</h3>
                    <p className={`text-sm mt-1 leading-relaxed font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                      View/edit all rooms, manage master integrations (NIM keys, Google Sheets), and Ghost Mode observation.
                    </p>
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm ${
                  isLight ? 'border-neutral-200 bg-white/90 shadow-sm' : 'border-neutral-800 bg-neutral-900/70 shadow-md'
                }`}>
                  <Users className="w-6 h-6 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className={`font-bold ${isLight ? 'text-black' : 'text-white'}`}>Room Team Leader</h3>
                    <p className={`text-sm mt-1 leading-relaxed font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                      Scoped admin: edit room settings, approve invites, and coordinate custom role permissions.
                    </p>
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm ${
                  isLight ? 'border-neutral-200 bg-white/90 shadow-sm' : 'border-neutral-800 bg-neutral-900/70 shadow-md'
                }`}>
                  <Layers className="w-6 h-6 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className={`font-bold ${isLight ? 'text-black' : 'text-white'}`}>Custom Roles (Discord-Style)</h3>
                    <p className={`text-sm mt-1 leading-relaxed font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                      Frontend, Backend, AI/ML, Pitch/Media, Video Editor + 8 toggleable permissions per teammate.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-8 rounded-2xl border backdrop-blur-md relative overflow-hidden ${
              isLight ? 'border-red-200 bg-white/95 shadow-lg' : 'border-red-900/40 bg-neutral-900/80 shadow-2xl'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-rose-500/10 pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-red-500/20">
                  <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-red-700' : 'text-red-400'}`}>Live Telemetry Status</span>
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                  </span>
                </div>
                <div className={`flex items-center gap-3 text-sm font-semibold ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span>Real-Time Vibe Coding Heartbeats</span>
                </div>
                <div className={`flex items-center gap-3 text-sm font-semibold ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Multi-User File Lock Conflict Shield</span>
                </div>
                <div className={`flex items-center gap-3 text-sm font-semibold ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span>Auto-Synced .env Secure Vault Pull</span>
                </div>
                <div className={`flex items-center gap-3 text-sm font-semibold ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Instant Vibe Rollback Points</span>
                </div>
                <div className={`flex items-center gap-3 text-sm font-semibold ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span>1-Tap SOS Debugger with DeepSeek-R1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`relative z-10 py-24 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-neutral-200 bg-white/90' : 'border-neutral-800 bg-[#060608]/90'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className={`text-3xl sm:text-5xl font-black mb-4 tracking-tight ${
            isLight ? 'text-black' : 'text-white'
          }`}>
            Ready to Dominate Your Next <span className="text-red-600 dark:text-red-500">Hackathon?</span>
          </h2>
          <p className={`text-lg mb-8 max-w-2xl mx-auto font-medium ${
            isLight ? 'text-neutral-700' : 'text-neutral-300'
          }`}>
            Deploy in minutes. Zero cost. Full AI automation. Practice 22 DSA modules on CodeTrack AI right away.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/auth/signup" 
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold w-full sm:w-auto px-8 py-3.5 text-base rounded-lg flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 transition-all hover:scale-[1.02]"
            >
              <Rocket className="w-5 h-5 text-white" />
              Create Your First Room
            </Link>
            <Link 
              href="https://github.com/huznafariha14/TrackMyWork" 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`w-full sm:w-auto px-8 py-3.5 text-base rounded-lg flex items-center justify-center gap-2 border font-bold transition-all ${
                isLight 
                  ? 'border-neutral-300 bg-white text-black hover:bg-neutral-100 hover:text-red-600 hover:border-red-300' 
                  : 'border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-red-400'
              }`}
            >
              <GitBranch className="w-5 h-5 text-red-600 dark:text-red-400" />
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`relative z-10 py-12 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
        isLight ? 'border-neutral-200 bg-white/95 text-neutral-800' : 'border-neutral-800 bg-[#050507] text-neutral-300'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className={`font-black text-lg ${isLight ? 'text-black' : 'text-white'}`}>
                TrackMyWork<span className="text-red-600">.</span>
              </span>
            </div>
            <p className="text-sm font-medium">
              © {new Date().getFullYear()} TrackMyWork. Built for hackathons &amp; developers.
            </p>
            <div className="flex items-center gap-4 text-sm font-semibold">
              <Link href="/auth/login?redirect=/dashboard" className="hover:text-red-600 transition-colors">Dashboard</Link>
              <Link href="/dashboard/codetrack" className="hover:text-red-600 transition-colors">CodeTrack AI</Link>
              <Link href="/auth/login" className="hover:text-red-600 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
