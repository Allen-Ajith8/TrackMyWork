import Link from 'next/link';
import {
  BookOpen,
  Bug,
  ClipboardList,
  FileImage,
  FolderKanban,
  HelpCircle,
  LifeBuoy,
  Package,
  Rocket,
  Users,
} from 'lucide-react';

const guides = [
  {
    title: 'Create your first room',
    description: 'Set up a project, invite teammates and pick a project type.',
    href: '/dashboard/rooms/new',
    icon: Rocket,
  },
  {
    title: 'Track tasks',
    description: 'Add tasks, assign owners and move them across the kanban board.',
    href: '/dashboard/tasks',
    icon: ClipboardList,
  },
  {
    title: 'Manage hardware BOM',
    description: 'Estimate component costs and follow items from planned to installed.',
    href: '/dashboard/bom',
    icon: Package,
  },
  {
    title: 'Publish artifacts',
    description: 'Upload builds, videos, designs and tag final versions.',
    href: '/dashboard/artifacts',
    icon: FileImage,
  },
];

const faqs = [
  {
    question: 'How do I invite teammates?',
    answer:
      'Open a room and go to the Team tab. You can share the 6-digit invite code shown in the room header or invite members by email from room settings.',
  },
  {
    question: 'Why do I not see my rooms?',
    answer:
      'Rooms are only listed after your membership is active. If you just accepted an invite, refresh the page. If the problem persists, make sure the room owner approved your request.',
  },
  {
    question: 'Who can edit rooms, tasks or rules?',
    answer:
      'Permissions are per room. Team Leaders can edit everything; members receive Discord-style toggles such as assigning tasks, managing BOM, uploading assets or editing rules.',
  },
  {
    question: 'How do I change my name or avatar?',
    answer:
      'Open your profile from the sidebar. You can set a display name, username, headline and avatar. Your email stays private and is never shown to teammates.',
  },
  {
    question: 'Where do notifications come from?',
    answer:
      'TrackMyWork creates notifications for invites, task assignments and updates, deadlines, GitHub webhook events, NIM alerts and SOS requests. Open Notifications from the top bar.',
  },
  {
    question: 'Can I use TrackMyWork on my phone?',
    answer:
      'The interface is responsive and works in a mobile browser. A native Android build via Capacitor is planned; installation is not available yet.',
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Help & docs</h1>
        <p className="text-surface-600 mt-1">
          Quick guides and answers for getting the most out of TrackMyWork.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {guides.map((guide) => (
          <Link key={guide.title} href={guide.href} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <guide.icon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900">{guide.title}</h2>
                <p className="text-sm text-surface-500 mt-1">{guide.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 border-b border-surface-200 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-surface-900">Frequently asked questions</h2>
        </div>
        <div className="divide-y divide-surface-200">
          {faqs.map((faq) => (
            <details key={faq.question} className="group p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium text-surface-900">
                {faq.question}
                <span className="text-surface-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="text-sm text-surface-600 mt-3 leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <FolderKanban className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-surface-900 mt-3">Room guides</h3>
          <p className="text-sm text-surface-500 mt-1">
            Each room has its own dashboard, tasks, BOM, artifacts, team and settings tabs.
          </p>
          <Link href="/dashboard/rooms" className="text-sm text-primary-600 hover:underline mt-3 inline-block">
            Browse rooms
          </Link>
        </div>
        <div className="card p-5">
          <Users className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-surface-900 mt-3">Team & roles</h3>
          <p className="text-sm text-surface-500 mt-1">
            Learn how team leader and per-member permissions work in the Team tab.
          </p>
          <Link href="/dashboard/team" className="text-sm text-primary-600 hover:underline mt-3 inline-block">
            View team
          </Link>
        </div>
        <div className="card p-5">
          <Bug className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-surface-900 mt-3">Report a bug</h3>
          <p className="text-sm text-surface-500 mt-1">
            Found something broken? Open an issue with the steps to reproduce.
          </p>
          <a
            href="https://github.com/Allen-Ajith8/TrackMyWork/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:underline mt-3 inline-block"
          >
            Open GitHub issues
          </a>
        </div>
      </div>

      <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <LifeBuoy className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-surface-900">Still stuck?</h3>
          <p className="text-sm text-surface-500 mt-1">
            Reach out to the team and include your room name plus what you expected to happen.
          </p>
        </div>
        <a href="mailto:allenajith@gmail.com" className="btn-outline">
          Contact support
        </a>
      </div>

      <div className="text-xs text-surface-400 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        TrackMyWork documentation · updated for the current build
      </div>
    </div>
  );
}
