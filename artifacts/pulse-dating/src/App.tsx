import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp, Compass, Eye, Globe2, Heart, ImagePlus, LockKeyhole, LogOut, Menu, Mic2, MoreHorizontal, PenLine, Radio, Save, Settings2, ShieldCheck, Sparkles, UserRound, Users, X, XCircle, Zap } from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  getGetMyPreferencesQueryKey,
  getGetMyProfileQueryKey,
  getGetMySettingsQueryKey,
  getGetMySummaryQueryKey,
  getGetMyVibeDnaQueryKey,
  getHealthCheckQueryKey,
  useGetMyPreferences,
  useGetMyProfile,
  useGetMySettings,
  useGetMySummary,
  useGetMyVibeDna,
  useHealthCheck,
  useRequestUploadUrl,
  useUpdateMyPreferences,
  useUpdateMyProfile,
  useUpdateMySettings,
  useUpdateMyVibeDna,
  useUpdateOnboardingProgress,
} from '@workspace/api-client-react';
import type { FutureGoals, Profile, ProfileInput, ProfileMedia, SettingsInput, VibeDnaInput } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import DiscoveryPage from '@/pages/discovery';
import LikesPage from '@/pages/likes';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#F4D35E',
    colorForeground: '#F5F1E7',
    colorMutedForeground: '#9A99A9',
    colorDanger: '#F47B72',
    colorBackground: '#171725',
    colorInput: '#222235',
    colorInputForeground: '#F5F1E7',
    colorNeutral: '#3A3A52',
    fontFamily: 'DM Sans',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#171725] border border-[#3A3A52] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#F5F1E7] font-semibold',
    headerSubtitle: 'text-[#9A99A9]',
    socialButtonsBlockButtonText: 'text-[#F5F1E7]',
    formFieldLabel: 'text-[#F5F1E7]',
    footerActionLink: 'text-[#F4D35E]',
    footerActionText: 'text-[#9A99A9]',
    dividerText: 'text-[#9A99A9]',
    identityPreviewEditButton: 'text-[#F4D35E]',
    formFieldSuccessText: 'text-[#78D7AE]',
    alertText: 'text-[#F47B72]',
    logoBox: 'mb-3',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#3A3A52] bg-[#222235] hover:bg-[#2C2C42]',
    formButtonPrimary: 'bg-[#F4D35E] text-[#171725] hover:bg-[#FFE58A]',
    formFieldInput: 'bg-[#222235] border-[#3A3A52] text-[#F5F1E7]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#3A3A52]',
    alert: 'bg-[#351F27] border-[#73323A]',
    otpCodeFieldInput: 'bg-[#222235] border-[#3A3A52] text-[#F5F1E7]',
    formFieldRow: 'mb-4',
    main: 'bg-transparent',
  },
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="focus-ring inline-flex items-center gap-3" data-testid="link-logo">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_rgba(244,211,94,.2)]">
        <Zap size={19} strokeWidth={2.7} />
      </span>
      {!compact && <span className="font-display text-xl font-semibold tracking-[-.04em]">PULSE<span className="text-primary">.</span></span>}
    </Link>
  );
}

type TestIdProps = { 'data-testid'?: string };

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & TestIdProps & { variant?: 'primary' | 'ghost' | 'outline' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-[#FFE58A] shadow-[0_8px_24px_rgba(244,211,94,.12)]',
    ghost: 'bg-transparent text-foreground hover:bg-white/[.06]',
    outline: 'border border-border bg-transparent text-foreground hover:border-primary/70 hover:bg-primary/[.06]',
    danger: 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20',
  };
  return <button {...props} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 ${styles[variant]} ${className}`} data-testid={props['data-testid'] ?? 'button-action'}>{children}</button>;
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & TestIdProps & { label: string; hint?: string }) {
  return <label className="grid gap-2 text-sm font-medium text-foreground">
    <span>{label}</span>
    <input {...props} className={`focus-ring h-12 rounded-xl border border-input bg-input px-4 text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary ${props.className ?? ''}`} data-testid={props['data-testid'] ?? `input-${props.name ?? 'field'}`} />
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </label>;
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & TestIdProps & { label: string }) {
  return <label className="grid gap-2 text-sm font-medium text-foreground">
    <span>{label}</span>
    <textarea {...props} className={`focus-ring min-h-32 resize-y rounded-xl border border-input bg-input p-4 text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary ${props.className ?? ''}`} data-testid={props['data-testid'] ?? `textarea-${props.name ?? 'field'}`} />
  </label>;
}

function Chip({ children, selected, onClick, testId }: { children: ReactNode; selected: boolean; onClick: () => void; testId: string }) {
  return <button type="button" onClick={onClick} className={`focus-ring rounded-full border px-4 py-2.5 text-sm transition-all duration-200 ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/70 hover:text-foreground'}`} data-testid={testId}>{selected && <Check size={14} className="mr-1.5 inline" />}{children}</button>;
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />; }

function ErrorState({ onRetry, message = 'That signal dropped before we got a response.' }: { onRetry?: () => void; message?: string }) {
  return <div className="grid min-h-64 place-items-center rounded-2xl border border-destructive/30 bg-destructive/[.06] p-8 text-center">
    <div><XCircle className="mx-auto mb-3 text-destructive" size={28} /><p className="font-medium">{message}</p>{onRetry && <Button onClick={onRetry} variant="outline" className="mt-5" data-testid="button-retry">Try again</Button>}</div>
  </div>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return <div className="mb-8 max-w-2xl"><p className="mb-3 font-mono-pulse text-[11px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 className="font-display text-4xl font-semibold tracking-[-.055em] text-balance md:text-5xl">{title}</h1>{copy && <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">{copy}</p>}</div>;
}

function HomePage() {
  const { isSignedIn } = useUser();
  if (isSignedIn) return <Redirect to="/app" />;
  return <div className="noise min-h-[100dvh] overflow-hidden bg-background">
    <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8"><Logo /><div className="flex items-center gap-2"><Link href="/sign-in" className="focus-ring rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="focus-ring rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-[#FFE58A]" data-testid="link-sign-up">Join PULSE</Link></div></nav>
    <main>
      <section className="pulse-grid relative mx-auto max-w-6xl px-5 pb-24 pt-16 md:px-8 md:pb-36 md:pt-28">
        <div className="pointer-events-none absolute -right-28 top-5 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-drift" />
        <div className="relative max-w-4xl animate-rise"><p className="mb-7 flex items-center gap-3 font-mono-pulse text-xs uppercase tracking-[.24em] text-primary"><span className="pulse-line h-px w-10 bg-primary" />Dating with a direction</p><h1 className="font-display text-[clamp(3.5rem,11vw,8.6rem)] font-semibold leading-[.87] tracking-[-.075em]">Find the<br /><span className="text-primary">real signal.</span></h1><p className="mt-9 max-w-lg text-lg leading-8 text-muted-foreground md:text-xl">A worldwide space for adults who are ready to be honest about what comes next.</p><div className="mt-10 flex flex-col gap-3 sm:flex-row"><Link href="/sign-up" className="focus-ring inline-flex h-13 items-center justify-center gap-3 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-[#FFE58A]" data-testid="link-start-vibe">Start your Vibe DNA <ArrowRight size={18} /></Link><a href="#why" className="focus-ring inline-flex h-13 items-center justify-center rounded-xl border border-border px-6 text-sm font-semibold transition hover:border-primary/70 hover:bg-primary/[.05]" data-testid="link-learn-more">Why PULSE <ChevronRight size={16} /></a></div></div>
        <div className="mt-20 grid max-w-3xl gap-3 sm:grid-cols-3 animate-rise animate-rise-delay-2"><div className="border-l border-primary pl-4"><p className="font-display text-3xl">47</p><p className="mt-1 text-xs text-muted-foreground">countries in the room</p></div><div className="border-l border-secondary pl-4"><p className="font-display text-3xl">1</p><p className="mt-1 text-xs text-muted-foreground">clear intention required</p></div><div className="border-l border-accent pl-4"><p className="font-display text-3xl">∞</p><p className="mt-1 text-xs text-muted-foreground">ways to be yourself</p></div></div>
      </section>
         <section id="why" className="mx-auto grid max-w-6xl gap-10 px-5 py-24 md:grid-cols-[.75fr_1.25fr] md:px-8 md:py-36"><div><p className="font-mono-pulse text-xs uppercase tracking-[.2em] text-secondary">The premise</p><h2 className="mt-4 font-display text-4xl font-semibold tracking-[-.05em] md:text-6xl">Slow down.<br />Get specific.</h2></div><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-border bg-card p-6 sm:translate-y-8"><Radio className="mb-12 text-primary" size={24} /><h3 className="font-display text-xl">Intent before intrigue</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Say what you are here for. PULSE makes room for serious relationships, casual dating, friendship, travel connections, networking, and meeting new people.</p></article><article className="rounded-2xl border border-border bg-card p-6"><Globe2 className="mb-12 text-secondary" size={24} /><h3 className="font-display text-xl">Worldwide, not random</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Explore people and perspectives beyond your postcode, without losing your own center.</p></article><article className="rounded-2xl border border-border bg-card p-6 sm:col-span-2"><ShieldCheck className="mb-12 text-accent" size={24} /><h3 className="font-display text-xl">Privacy is part of chemistry</h3><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Your details, visibility, and pace stay in your hands. No performance, no pressure, no public profile until you choose.</p></article></div></section>
      <section className="border-y border-border bg-card/50"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 md:flex-row md:items-center md:px-8"><div><p className="font-mono-pulse text-xs uppercase tracking-[.2em] text-primary">One honest beginning</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] md:text-5xl">The best conversation<br />starts before hello.</h2></div><Link href="/sign-up" className="focus-ring inline-flex items-center gap-3 rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground" data-testid="link-create-account">Create your profile <ArrowRight size={17} /></Link></div></section>
    </main>
    <footer className="mx-auto flex max-w-6xl items-center justify-between px-5 py-8 text-xs text-muted-foreground md:px-8"><Logo compact /><span>For adults 18+ · Built for something real</span></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <div className="noise flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><div className="absolute left-5 top-6 md:left-8"><Logo /></div><div className="clerk-wrap w-full max-w-[440px]"><div className="mb-5 text-center"><p className="font-mono-pulse text-[11px] uppercase tracking-[.2em] text-primary">{mode === 'sign-in' ? 'Your signal is here' : 'Make the first move'}</p><p className="mt-2 text-sm text-muted-foreground">{mode === 'sign-up' ? 'PULSE is for adults 18+ finding the kind of connection they want.' : 'Welcome back to a more intentional kind of connection.'}</p></div>{mode === 'sign-in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></div>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const links = [{ href: '/app', label: 'Home', icon: Compass }, { href: '/discover', label: 'Discover', icon: Radio }, { href: '/likes', label: 'Who liked me', icon: Heart }, { href: '/vibe-dna', label: 'Vibe DNA', icon: Sparkles }, { href: '/profile', label: 'Profile', icon: UserRound }, { href: '/settings', label: 'Settings', icon: Settings2 }];
  return <div className="noise min-h-[100dvh] bg-background"><aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar px-5 py-6 transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)} className="focus-ring rounded-lg p-2 text-muted-foreground md:hidden" data-testid="button-close-menu"><X size={19} /></button></div><div className="mt-14 flex-1 space-y-1">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-white/[.05] hover:text-foreground" data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}><Icon size={18} /><span>{label}</span>{href === '/vibe-dna' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}</Link>)}</div><div className="border-t border-sidebar-border pt-5"><div className="mb-4 flex items-center gap-3 rounded-xl bg-white/[.03] p-3"><span className="grid h-9 w-9 place-items-center rounded-full border border-primary/50 bg-primary/10 text-xs font-semibold text-primary">YO</span><div><p className="text-sm font-medium">Your private space</p><p className="text-xs text-muted-foreground">{health?.status === 'ok' ? 'Signal is clear' : 'Checking signal'}</p></div></div><button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-white/[.05] hover:text-foreground" data-testid="button-logout"><LogOut size={18} /> Log out</button></div></aside><div className="md:pl-72"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-xl md:px-10"><button className="focus-ring rounded-lg p-2 text-muted-foreground md:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button><div className="md:hidden"><Logo compact /></div><div className="ml-auto flex items-center gap-2"><Link href="/profile" className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-sm font-semibold text-primary hover:border-primary" data-testid="link-header-profile">YO</Link></div></header><main className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">{children}</main></div></div>;
}

function UserPortal() {
  const { data, isLoading, isError, refetch } = useGetMySummary({ query: { queryKey: getGetMySummaryQueryKey() } });
  if (isLoading) return <AppShell><div className="space-y-7"><Skeleton className="h-5 w-32" /><Skeleton className="h-20 w-3/4" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div></div></AppShell>;
  if (isError) return <AppShell><ErrorState onRetry={() => refetch()} /></AppShell>;
  const profile = data?.profile;
  const completion = data?.profileCompletion ?? 0;
  return <AppShell><div className="animate-rise"><div className="flex flex-col justify-between gap-7 md:flex-row md:items-end"><div><p className="mb-3 font-mono-pulse text-xs uppercase tracking-[.2em] text-primary">Your PULSE / {data?.locationLabel ?? 'Worldwide'}</p><h1 className="font-display text-4xl font-semibold tracking-[-.06em] md:text-6xl">Good to have<br /><span className="text-primary">{profile?.firstName ?? 'you'}.</span></h1><p className="mt-4 max-w-lg text-muted-foreground">Your profile is a signal, not a sales pitch. Keep it honest and let the right people find the frequency.</p></div><Link href={data?.onboardingComplete ? '/profile' : '/vibe-dna'} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5" data-testid="link-resume-profile">{data?.onboardingComplete ? 'Tune your profile' : 'Continue Vibe DNA'} <ArrowRight size={17} /></Link></div><div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/[.07] p-6 md:p-8"><div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl" /><div className="relative"><div className="flex items-center justify-between"><p className="font-mono-pulse text-xs uppercase tracking-[.16em] text-primary">Profile pulse</p><span className="text-sm font-medium text-primary">{completion}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${completion}%` }} /></div><h2 className="mt-7 font-display text-2xl font-medium">{completion >= 80 ? 'Your signal is getting clear.' : 'A little more of you, then.'}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{completion >= 80 ? 'You have given people something real to respond to.' : 'Complete your Vibe DNA and profile so your connections meet the whole picture.'}</p></div></section><section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><p className="font-mono-pulse text-xs uppercase tracking-[.16em] text-secondary">Your north star</p><Heart size={18} className="text-secondary" /></div><p className="mt-8 font-display text-2xl leading-tight">{profile?.relationshipIntention ? `Here for ${profile.relationshipIntention.toLowerCase()}.` : 'What are you building toward?'}</p><Link href="/vibe-dna" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-foreground" data-testid="link-edit-intention">Set your intention <ArrowRight size={16} /></Link></section></div><div className="mt-5 grid gap-5 md:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-6"><LockKeyhole className="text-accent" size={20} /><h3 className="mt-8 font-display text-xl">Private by design</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">You choose what is visible and when. Quiet confidence over public performance.</p></div><div className="rounded-2xl border border-border bg-card p-6"><Users className="text-primary" size={20} /><h3 className="mt-8 font-display text-xl">People, not metrics</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">No popularity contests. We care more about alignment than attention.</p></div><div className="rounded-2xl border border-border bg-card p-6"><Mic2 className="text-secondary" size={20} /><h3 className="mt-8 font-display text-xl">Let your voice in</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Your written voice and your real voice can both tell the story.</p></div></div></div></AppShell>;
}

const vibeSteps = [
  { key: 'datingIntention', eyebrow: '01 / intention', title: 'What brings you here?', copy: 'There is no right answer. There is only the honest one.', options: ['A lasting partnership', 'A meaningful connection', 'Open to seeing where it goes', 'A new chapter'] },
  { key: 'personality', eyebrow: '02 / personality', title: 'How do people experience you?', copy: 'Choose the words that feel familiar, not aspirational.', options: ['Curious', 'Grounded', 'Playful', 'Thoughtful', 'Ambitious', 'Warm', 'Independent', 'Adventurous'] },
  { key: 'communicationStyle', eyebrow: '03 / communication', title: 'How do you like to connect?', copy: 'Chemistry has a cadence. What is yours?', options: ['Deep conversations', 'Light and frequent', 'A thoughtful voice note', 'Direct and clear', 'In-person first'] },
  { key: 'relationshipGoals', eyebrow: '04 / relationship', title: 'What are you building toward?', copy: 'Name the future you would be proud to share.', options: ['A committed partnership', 'Marriage', 'A life companion', 'A family', 'A creative partnership'] },
  { key: 'lifestyle', eyebrow: '05 / lifestyle', title: 'What keeps your days feeling good?', copy: 'The details of a life are where compatibility lives.', options: ['Slow mornings', 'City energy', 'The outdoors', 'Cooking for people', 'Movement', 'Creative projects'] },
  { key: 'interests', eyebrow: '06 / interests', title: 'What makes you lose track of time?', copy: 'Give someone an opening line worth sending.', options: ['Books & ideas', 'Music', 'Food & culture', 'Travel', 'Art & design', 'Learning something new', 'Games'] },
  { key: 'familyGoals', eyebrow: '07 / family', title: 'How do you imagine family?', copy: 'This stays yours. Sharing it can save both people time.', options: ['I want children', 'I am open to children', 'I do not want children', 'I am still figuring it out', 'Family looks different to me'] },
  { key: 'lookingFor', eyebrow: '08 / looking for', title: 'Who do you want to meet?', copy: 'Describe the energy you hope finds you back.', options: ['Someone intentional', 'A steady teammate', 'A curious mind', 'A soft place to land', 'A joyful co-conspirator', 'Someone ready for depth'] },
] as const;

function VibeDnaPage() {
  const { data, isLoading, isError, refetch } = useGetMyVibeDna({ query: { queryKey: getGetMyVibeDnaQueryKey() } });
  const progressMutation = useUpdateOnboardingProgress();
  const saveMutation = useUpdateMyVibeDna();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string[]>>({});
  useEffect(() => { if (data) setValues({ datingIntention: data.datingIntention ? [data.datingIntention] : [], personality: data.personality ?? [], communicationStyle: data.communicationStyle ? [data.communicationStyle] : [], relationshipGoals: data.relationshipGoals ?? [], lifestyle: data.lifestyle ?? [], interests: data.interests ?? [], familyGoals: data.familyGoals ? [data.familyGoals] : [], lookingFor: data.lookingFor ?? [] }); }, [data]);
  if (isLoading) return <AppShell><div className="mx-auto max-w-3xl space-y-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-14 w-2/3" /><Skeleton className="h-72" /></div></AppShell>;
  if (isError) return <AppShell><ErrorState onRetry={() => refetch()} /></AppShell>;
  const current = vibeSteps[step];
  const selected = values[current.key] ?? [];
  const toggle = (option: string) => setValues((prev) => { const currentValues = prev[current.key] ?? []; const single = ['datingIntention', 'communicationStyle', 'familyGoals'].includes(current.key); return { ...prev, [current.key]: single ? [option] : currentValues.includes(option) ? currentValues.filter((item) => item !== option) : [...currentValues, option] }; });
  const next = () => { if (step < vibeSteps.length - 1) { progressMutation.mutate({ data: { currentStep: step + 1, completedSteps: vibeSteps.slice(0, step + 1).map((item) => item.key), complete: false } }); setStep((value) => value + 1); } else { const payload: VibeDnaInput = { datingIntention: values.datingIntention?.[0] ?? null, personality: values.personality ?? [], communicationStyle: values.communicationStyle?.[0] ?? null, relationshipGoals: values.relationshipGoals ?? [], lifestyle: values.lifestyle ?? [], interests: values.interests ?? [], familyGoals: values.familyGoals?.[0] ?? null, lookingFor: values.lookingFor ?? [] }; saveMutation.mutate({ data: payload }, { onSuccess: () => progressMutation.mutate({ data: { currentStep: 8, completedSteps: vibeSteps.map((item) => item.key), complete: true } }) }); } };
  return <AppShell><div className="mx-auto max-w-3xl animate-rise"><div className="mb-10 flex items-center justify-between gap-5"><div><p className="font-mono-pulse text-xs uppercase tracking-[.18em] text-primary">Vibe DNA / in progress</p><p className="mt-2 text-sm text-muted-foreground">This is the part that makes a profile feel like a person.</p></div><span className="font-mono-pulse text-xs text-muted-foreground">{String(step + 1).padStart(2, '0')} / 08</span></div><div className="mb-12 flex gap-1.5">{vibeSteps.map((item, index) => <button key={item.key} onClick={() => index <= step && setStep(index)} className={`h-1.5 flex-1 rounded-full transition ${index <= step ? 'bg-primary' : 'bg-muted'}`} aria-label={`Go to step ${index + 1}`} data-testid={`button-step-${index + 1}`} />)}</div><SectionHeading eyebrow={current.eyebrow} title={current.title} copy={current.copy} /><div className="grid gap-3 sm:grid-cols-2">{current.options.map((option) => <Chip key={option} selected={selected.includes(option)} onClick={() => toggle(option)} testId={`chip-${current.key}-${option.toLowerCase().replaceAll(' ', '-')}`}>{option}</Chip>)}</div><div className="mt-12 flex items-center justify-between border-t border-border pt-6"><Button variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} data-testid="button-vibe-back"><ChevronLeft size={17} /> Back</Button><Button onClick={next} disabled={selected.length === 0 || saveMutation.isPending} data-testid="button-vibe-next">{step === vibeSteps.length - 1 ? (saveMutation.isPending ? 'Saving...' : 'Finish Vibe DNA') : 'Keep going'} <ChevronRight size={17} /></Button></div></div></AppShell>;
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const update = useUpdateMyProfile();
  const upload = useRequestUploadUrl();
  const form = useForm<ProfileInput>({ values: data ? { ...data, age: data.age, futureGoals: data.futureGoals ?? {} } : undefined, defaultValues: { firstName: '', age: 18, gender: '', country: '', region: '', languages: [], relationshipIntention: '', aboutMe: '', hobbies: [], lifestyle: '', familyGoals: '', futureGoals: {}, media: [], voiceVibePath: null } });
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [media, setMedia] = useState<ProfileMedia[]>([]);
  useEffect(() => { if (data) { setHobbies(data.hobbies ?? []); setLanguages(data.languages ?? []); setMedia(data.media ?? []); } }, [data]);
  if (isLoading) return <AppShell><div className="space-y-5"><Skeleton className="h-6 w-24" /><Skeleton className="h-12 w-1/2" /><Skeleton className="h-96" /></div></AppShell>;
  if (isError) return <AppShell><ErrorState onRetry={() => refetch()} /></AppShell>;
  const onSubmit = (values: ProfileInput) => update.mutate({ data: { ...values, hobbies, languages, media } }, { onSuccess: (profile) => { queryClient.setQueryData(getGetMyProfileQueryKey(), profile); queryClient.invalidateQueries({ queryKey: getGetMySummaryQueryKey() }); } });
  const handleMedia = (file: File) => upload.mutate({ data: { name: file.name, size: file.size, contentType: file.type, mediaKind: file.type.startsWith('video') ? 'video' : 'photo' } }, { onSuccess: async (result) => { await fetch(result.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file }); setMedia((items) => [...items, { id: `${Date.now()}`, kind: file.type.startsWith('video') ? 'video' : 'photo', path: result.objectPath, alt: file.name, sortOrder: items.length }] ); } });
  const futureFields: (keyof FutureGoals)[] = ['fiveYearVision', 'marriage', 'children', 'homeOwnership', 'career', 'business', 'financialFreedom', 'travel', 'education', 'relocation', 'wouldRelocate'];
  return <AppShell><div className="animate-rise"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionHeading eyebrow="Public profile / edit" title="Make room for the real you." copy="Your profile is an invitation, not an audition. Share what helps someone understand your life." /><span className="mb-8 flex items-center gap-2 text-xs text-muted-foreground"><Eye size={14} /> Preview stays private until you choose</span></div><form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_.62fr]"><section className="space-y-5"><div className="rounded-2xl border border-border bg-card p-6 md:p-8"><div className="mb-7 flex items-center justify-between"><div><h2 className="font-display text-2xl">About me</h2><p className="mt-1 text-sm text-muted-foreground">The facts and the texture.</p></div><UserRound className="text-primary" size={21} /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" {...form.register('firstName', { required: true })} /><Field label="Age" type="number" min={18} {...form.register('age', { valueAsNumber: true, min: 18 })} /><Field label="Country" {...form.register('country')} /><Field label="Region / city" {...form.register('region')} /><Field label="Gender" placeholder="Optional" {...form.register('gender')} /><Field label="Height (cm)" type="number" placeholder="Optional" {...form.register('heightCm', { valueAsNumber: true })} /></div><div className="mt-4 grid gap-4"><Textarea label="About you" placeholder="What would you want someone to know after one good conversation?" {...form.register('aboutMe')} /><Field label="Relationship intention" placeholder="e.g. A lasting partnership" {...form.register('relationshipIntention')} /><Field label="Lifestyle" placeholder="e.g. Slow mornings, active weekends" {...form.register('lifestyle')} /><Field label="Family goals" placeholder="Optional, in your own words" {...form.register('familyGoals')} /></div></div><div className="rounded-2xl border border-border bg-card p-6 md:p-8"><div className="mb-7 flex items-center justify-between"><div><h2 className="font-display text-2xl">Future goals</h2><p className="mt-1 text-sm text-muted-foreground">The horizon you are moving toward.</p></div><Compass className="text-secondary" size={21} /></div><div className="grid gap-4 sm:grid-cols-2">{futureFields.map((field) => <Field key={field} label={field === 'fiveYearVision' ? 'Five-year vision' : field.replace(/([A-Z])/g, ' $1')} placeholder="Optional" {...form.register(`futureGoals.${field}`)} />)}</div></div></section><aside className="space-y-5"><div className="rounded-2xl border border-border bg-card p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-display text-2xl">Voice Vibe</h2><p className="mt-1 text-sm text-muted-foreground">Let your voice carry the feeling.</p></div><Mic2 className="text-accent" size={21} /></div><div className="grid place-items-center rounded-xl border border-dashed border-border bg-background p-7 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent"><Mic2 size={23} /></div><p className="text-sm font-medium">Add a voice note</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A 30 second hello can say what a bio cannot.</p><label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:border-accent"><ImagePlus size={14} /> Choose audio<input type="file" className="sr-only" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate({ data: { name: file.name, size: file.size, contentType: file.type, mediaKind: 'voice' } }); }} data-testid="input-voice-vibe" /></label></div></div><div className="rounded-2xl border border-border bg-card p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-display text-2xl">Profile media</h2><p className="mt-1 text-sm text-muted-foreground">{media.length} of 7 added</p></div><ImagePlus className="text-primary" size={21} /></div><div className="grid grid-cols-3 gap-2">{media.map((item) => <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background p-2"><div className="grid h-full place-items-center rounded-lg bg-primary/10 text-primary">{item.kind === 'video' ? <Radio size={21} /> : <ImagePlus size={21} />}</div><button type="button" onClick={() => setMedia((items) => items.filter((entry) => entry.id !== item.id))} className="focus-ring absolute right-1 top-1 hidden rounded-full bg-background/90 p-1 text-destructive group-hover:block" data-testid={`button-remove-media-${item.id}`}><X size={13} /></button></div>)}{media.length < 7 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary"><ImagePlus size={20} /><span className="text-[10px] font-medium">Add media</span><input type="file" className="sr-only" accept="image/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleMedia(file); }} data-testid="input-profile-media" /></label>}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">Your media is stored privately and shown only according to your discovery settings.</p></div><div className="sticky bottom-5 rounded-2xl border border-primary/25 bg-card/95 p-4 backdrop-blur-xl"><Button type="submit" className="w-full" disabled={update.isPending} data-testid="button-save-profile">{update.isPending ? 'Saving your signal...' : <><Save size={17} /> Save profile</>}</Button></div></aside></form></div></AppShell>;
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetMySettings({ query: { queryKey: getGetMySettingsQueryKey() } });
  const preferences = useGetMyPreferences({ query: { queryKey: getGetMyPreferencesQueryKey() } });
  const update = useUpdateMySettings();
  const updatePreferences = useUpdateMyPreferences();
  const { signOut } = useClerk();
  const form = useForm<SettingsInput & { ageMin?: number; ageMax?: number; maxDistanceMiles?: number }>({ values: { ...data, ageMin: preferences.data?.ageMin, ageMax: preferences.data?.ageMax, maxDistanceMiles: preferences.data?.maxDistanceMiles }, defaultValues: { discoverable: true, showAge: true, showRegion: true, notificationsEnabled: true, commentPermission: 'eligible', deleteRequested: false, ageMin: 25, ageMax: 42, maxDistanceMiles: 50 } });
  const [saved, setSaved] = useState(false);
  if (isLoading || preferences.isLoading) return <AppShell><div className="space-y-5"><Skeleton className="h-5 w-24" /><Skeleton className="h-14 w-2/3" /><Skeleton className="h-72" /></div></AppShell>;
  if (isError || preferences.isError) return <AppShell><ErrorState onRetry={() => refetch()} /></AppShell>;
  const submit = (values: SettingsInput & { ageMin?: number; ageMax?: number; maxDistanceMiles?: number }) => { const { ageMin, ageMax, maxDistanceMiles, ...settings } = values; update.mutate({ data: settings }, { onSuccess: (nextSettings) => { queryClient.setQueryData(getGetMySettingsQueryKey(), nextSettings); setSaved(true); setTimeout(() => setSaved(false), 2200); } }); updatePreferences.mutate({ data: { ageMin, ageMax, maxDistanceMiles } }, { onSuccess: (nextPreferences) => queryClient.setQueryData(getGetMyPreferencesQueryKey(), nextPreferences) }); };
  return <AppShell><div className="mx-auto max-w-3xl animate-rise"><SectionHeading eyebrow="Settings / your boundaries" title="Keep what matters close." copy="PULSE should feel good to use. Adjust your visibility, preferences, and pace at any time." /><form onSubmit={form.handleSubmit(submit)} className="space-y-4"><SettingsToggle title="Discoverable" copy="Allow your profile to appear to people who match your preferences." field="discoverable" register={form.register} /><SettingsToggle title="Show my age" copy="Your age is visible on your public profile." field="showAge" register={form.register} /><SettingsToggle title="Show my region" copy="Share your region, never your exact location." field="showRegion" register={form.register} /><SettingsToggle title="Notifications" copy="Notification preferences are coming soon. Your current choice is saved." field="notificationsEnabled" register={form.register} /><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary"><CircleHelp size={19} /></div><div className="flex-1"><h2 className="font-display text-xl">Who can comment?</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Set the permission that protects your profile media conversations.</p><select {...form.register('commentPermission')} className="focus-ring mt-4 h-12 w-full rounded-xl border border-input bg-input px-4 text-sm text-foreground" data-testid="select-comment-permission"><option value="eligible">Eligible people</option><option value="verified">Verified people</option><option value="liked">People you have liked</option><option value="matches">Matches only</option><option value="nobody">Nobody</option></select></div></div></div><div className="rounded-2xl border border-border bg-card p-6"><div className="flex items-start gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary"><Compass size={19} /></div><div className="flex-1"><h2 className="font-display text-xl">Discovery preferences</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Set a range that feels spacious, not endless.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Age from" type="number" min={18} {...form.register('ageMin', { valueAsNumber: true })} /><Field label="Age to" type="number" min={18} {...form.register('ageMax', { valueAsNumber: true })} /><Field label="Distance (mi)" type="number" min={1} {...form.register('maxDistanceMiles', { valueAsNumber: true })} /></div><Link href="/vibe-dna" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-secondary" data-testid="link-edit-preferences">Fine-tune your Vibe DNA <ArrowRight size={15} /></Link></div></div></div><div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3">{saved ? <Check className="text-secondary" size={18} /> : <ShieldCheck className="text-primary" size={18} />}<span className="text-sm text-muted-foreground">{saved ? 'Your boundaries are saved.' : 'Only you can see these settings.'}</span></div><Button type="submit" disabled={update.isPending || updatePreferences.isPending} data-testid="button-save-settings">{update.isPending || updatePreferences.isPending ? 'Saving...' : 'Save settings'}</Button></div></form><div className="mt-14 border-t border-border pt-8"><p className="mb-4 font-mono-pulse text-[11px] uppercase tracking-[.18em] text-muted-foreground">Account controls</p><div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-settings-logout"><LogOut size={17} /> Log out</Button><Button variant="danger" onClick={() => update.mutate({ data: { deleteRequested: true } })} data-testid="button-delete-account"><XCircle size={17} /> Request account deletion</Button></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Account deletion requests are reviewed for safety. This action does not immediately remove your account.</p></div></div></AppShell>;
}

function SettingsToggle({ title, copy, field, register }: { title: string; copy: string; field: keyof SettingsInput; register: ReturnType<typeof useForm<SettingsInput>>['register'] }) {
  return <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"><div className="flex-1"><h2 className="font-display text-xl">{title}</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">{copy}</p></div><span className="relative"><input type="checkbox" className="peer sr-only" {...register(field)} data-testid={`input-setting-${field}`} /><span className="block h-7 w-12 rounded-full bg-muted transition peer-checked:bg-primary" /><span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-foreground transition peer-checked:translate-x-5 peer-checked:bg-primary-foreground" /></span></label>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => { const id = user?.id ?? null; if (previous.current !== undefined && previous.current !== id) client.clear(); previous.current = id; }), [addListener, client]);
  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }

function RouterContent() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={HomePage} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route path="/app" component={() => <AuthGate><UserPortal /></AuthGate>} /><Route path="/discover" component={() => <AuthGate><DiscoveryPage /></AuthGate>} /><Route path="/likes" component={() => <AuthGate><LikesPage /></AuthGate>} /><Route path="/vibe-dna" component={() => <AuthGate><VibeDnaPage /></AuthGate>} /><Route path="/profile" component={() => <AuthGate><ProfilePage /></AuthGate>} /><Route path="/settings" component={() => <AuthGate><SettingsPage /></AuthGate>} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="grid min-h-[100dvh] place-items-center bg-background"><Skeleton className="h-12 w-40" /></div>;
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in" />;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Return to a more intentional kind of connection' } }, signUp: { start: { title: 'Create your PULSE', subtitle: 'For adults 18+ choosing their kind of connection' } } }} routerPush={(to: string) => setLocation(stripBase(to))} routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkCacheInvalidator /><RouterContent /></QueryClientProvider></ClerkProvider>;
}

function App() { return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>; }

export default App;