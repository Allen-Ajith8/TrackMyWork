import { LoadingScreen } from '@/components/loading-screen';

export default function CodeTrackLoading() {
  return (
    <LoadingScreen
      variant="page"
      label="Loading CodeTrack AI"
      sublabel="Preparing your DSA curriculum & progress…"
    />
  );
}
