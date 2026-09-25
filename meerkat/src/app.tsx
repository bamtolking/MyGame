import { useEffect } from 'preact/hooks';
import { BarChart3, Dumbbell, Home as HomeIcon, ScanLine, UserRound } from 'lucide-preact';
import { tr } from './i18n';
import { nav, navDir, replace, route } from './lib/router';
import { profile } from './state/store';
import { ToastHost } from './components/ui';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { ScanHub } from './screens/ScanHub';
import { Capture } from './screens/Capture';
import { Result } from './screens/Result';
import { ShareCard } from './screens/ShareCard';
import { Compare } from './screens/Compare';
import { Progress } from './screens/Progress';
import { Me } from './screens/Me';
import { Onboarding } from './screens/Onboarding';
import { RoutinePreview } from './screens/RoutinePreview';
import { Player } from './screens/Player';
import { PainCheck } from './screens/PainCheck';
import { Safety } from './screens/Safety';
import { Desk } from './screens/Desk';
import { About } from './screens/About';

const TABS = [
  { path: '/', icon: HomeIcon, label: () => tr('홈', 'Home') },
  { path: '/exercises', icon: Dumbbell, label: () => tr('운동', 'Exercises') },
  { path: '/scan', icon: ScanLine, label: () => tr('AI 스캔', 'AI Scan'), center: true },
  { path: '/progress', icon: BarChart3, label: () => tr('기록', 'Progress') },
  { path: '/me', icon: UserRound, label: () => tr('마이', 'Me') },
];

function TabBar({ path }: { path: string }) {
  return (
    <nav class="tabbar" aria-label={tr('주요 메뉴', 'Main')}>
      <div class="tabbar-inner">
        {TABS.map((t) => {
          const on = path === t.path;
          const Icon = t.icon;
          return (
            <button
              key={t.path}
              class={`tab${on ? ' on' : ''}${t.center ? ' scan' : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={() => (on ? window.scrollTo({ top: 0, behavior: 'smooth' }) : replace(t.path))}
            >
              {t.center ? (
                <span class="fab">
                  <Icon size={26} strokeWidth={2.4} />
                </span>
              ) : (
                <Icon size={24} strokeWidth={on ? 2.4 : 2} />
              )}
              <span>{t.label()}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Screen() {
  const { path, parts } = route.value;
  if (!profile.value.onboarded && !path.startsWith('/onboarding') && !path.startsWith('/scan') && !path.startsWith('/about')) {
    return <Onboarding />;
  }
  switch (parts[0]) {
    case undefined:
      return <Home />;
    case 'exercises':
      return <Library />;
    case 'exercise':
      return <ExerciseDetail id={parts[1]} />;
    case 'scan':
      if (parts[1] === 'capture') return <Capture />;
      if (parts[1] === 'result') return <Result id={parts[2]} />;
      if (parts[1] === 'share') return <ShareCard id={parts[2]} />;
      if (parts[1] === 'compare') return <Compare />;
      return <ScanHub />;
    case 'progress':
      return <Progress />;
    case 'me':
      return <Me />;
    case 'onboarding':
      return <Onboarding />;
    case 'routine':
      return <RoutinePreview />;
    case 'player':
      return <Player />;
    case 'pain':
      return <PainCheck />;
    case 'safety':
      return <Safety />;
    case 'desk':
      return <Desk />;
    case 'about':
      return <About />;
    default:
      return <Home />;
  }
}

export function App() {
  const { path } = route.value;
  const showTabs = profile.value.onboarded && TABS.some((t) => t.path === path);
  useEffect(() => {
    // 알 수 없는 해시로 들어오면 홈으로
    if (!location.hash) history.replaceState(history.state, '', '#/');
  }, []);
  return (
    <div class={`nav-${navDir.value}`} key={path}>
      <Screen />
      {showTabs && <TabBar path={path} />}
      <ToastHost />
    </div>
  );
}

export { nav };
