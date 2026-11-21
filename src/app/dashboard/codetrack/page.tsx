import { Metadata } from 'next';
import { CodeTrackWorkspace } from '@/components/codetrack/codetrack-workspace';

export const metadata: Metadata = {
  title: 'CodeTrack AI - Personal DSA & LeetCode Tracker | TrackMyWork',
  description: 'Master Data Structures and Algorithms with curated LeetCode problems and an interactive AI DSA mentor.',
};

export default function CodeTrackPage() {
  return <CodeTrackWorkspace />;
}
