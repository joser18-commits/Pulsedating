import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Globe2,
  Heart,
  Languages,
  LoaderCircle,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Reply,
  Radio,
  Send,
  Sparkles,
  Star,
  ThumbsUp,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import {
  getGetMediaCommentsQueryKey,
  useActOnComment,
  useCreateMediaComment,
  useGetDiscovery,
  useGetMediaComments,
  useInteractWithMedia,
  useSendHeart,
} from '@workspace/api-client-react';
import type { DiscoverFilters, DiscoveryProfile, MediaComment } from '@workspace/api-client-react';
import { CommentActionInputAction, DiscoverFiltersMode, HeartInputKind, MediaInteractionInputKind, MediaInteractionInputReaction } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type Mode = 'nearby' | 'global' | 'right-now';
type Criterion = 'required' | 'preferred' | 'doesnt_matter';

const baseFilters: DiscoverFilters = {
  mode: 'nearby',
  gender: null,
  ageMin: 18,
  ageMax: 65,
  distanceMiles: 50,
  city: null,
  country: null,
  worldwide: false,
  relationshipIntention: null,
  language: null,
  children: null,
  smoking: null,
  drinking: null,
  interests: [],
  verified: false,
  newUsers: false,
  onlineOnly: false,
  hasVideo: false,
  hasVoiceVibe: false,
  criteria: {
    relationshipIntention: 'preferred',
    language: 'doesnt_matter',
    children: 'doesnt_matter',
    smoking: 'doesnt_matter',
    drinking: 'doesnt_matter',
  },
};

function mediaUrl(path: string) {
  if (path.startsWith('http') || path.startsWith('/api/')) return path;
  return `/api/storage${path.startsWith('/') ? path : `/${path}`}`;
}

function formatRefill(refillAt?: string) {
  if (!refillAt) return 'Refill time unavailable';
  const date = new Date(refillAt);
  return Number.isNaN(date.getTime()) ? 'Refill time unavailable' : `Refills ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function DiscoveryFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/app', label: 'Home', icon: Compass },
    { href: '/discover', label: 'Discover', icon: Radio },
    { href: '/likes', label: 'Who liked me', icon: Heart },
    { href: '/vibe-dna', label: 'Vibe DNA', icon: Sparkles },
    { href: '/profile', label: 'Profile', icon: UserRound },
    { href: '/settings', label: 'Settings', icon: MoreHorizontal },
  ];
  return (
    <div className="noise min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar px-5 py-6 transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <Link href="/" className="focus-ring inline-flex items-center gap-3" data-testid="link-discovery-logo"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Zap size={19} /></span><span className="font-display text-xl font-semibold tracking-[-.04em]">PULSE<span className="text-primary">.</span></span></Link>
          <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-lg p-2 text-muted-foreground md:hidden" aria-label="Close navigation" data-testid="button-close-discovery-menu"><ArrowLeft size={18} /></button>
        </div>
        <nav className="mt-14 flex-1 space-y-1" aria-label="App navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${href === '/discover' ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-white/[.05] hover:text-foreground'}`} data-testid={`link-discovery-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} /><span>{label}</span></Link>)}</nav>
        <div className="border-t border-sidebar-border pt-5"><div className="flex items-center gap-3 rounded-xl bg-white/[.03] p-3"><span className="grid h-9 w-9 place-items-center rounded-full border border-primary/50 bg-primary/10 text-xs font-semibold text-primary">YO</span><div><p className="text-sm font-medium">Your private space</p><p className="text-xs text-muted-foreground">Discovery stays intentional</p></div></div></div>
      </aside>
      <div className="md:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-xl md:px-10">
          <button type="button" className="focus-ring rounded-lg p-2 text-muted-foreground md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" data-testid="button-open-discovery-menu"><MoreHorizontal size={21} /></button>
          <span className="font-display text-lg font-semibold md:hidden">Discover<span className="text-primary">.</span></span>
          <div className="ml-auto flex items-center gap-2"><Link href="/likes" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/60" data-testid="link-discovery-likes"><Heart size={15} className="text-accent" /> Likes</Link><Link href="/profile" className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-sm font-semibold text-primary hover:border-primary" data-testid="link-discovery-profile">YO</Link></div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}

function LoadingDiscovery() {
  return <DiscoveryFrame><div className="mx-auto max-w-5xl animate-rise"><div className="space-y-4"><div className="skeleton h-4 w-28 rounded" /><div className="skeleton h-14 w-3/4 rounded-xl" /><div className="skeleton h-[28rem] rounded-3xl" /></div></div></DiscoveryFrame>;
}

function DiscoveryError({ retry }: { retry: () => void }) {
  return <DiscoveryFrame><div className="grid min-h-80 place-items-center rounded-3xl border border-destructive/30 bg-destructive/[.06] p-8 text-center"><div><CircleHelp className="mx-auto mb-3 text-destructive" size={30} /><h1 className="font-display text-2xl">Discovery could not load</h1><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">The signal dropped before we could bring people into the room.</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:border-primary" data-testid="button-retry-discovery">Try again <ArrowRight size={16} /></button></div></div></DiscoveryFrame>;
}

function FilterPanel({ filters, onChange }: { filters: DiscoverFilters; onChange: (next: DiscoverFilters) => void }) {
  const set = <K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) => onChange({ ...filters, [key]: value });
  const setCriterion = (key: string, value: Criterion) => onChange({ ...filters, criteria: { ...filters.criteria, [key]: value } });
  const selectClass = 'h-11 rounded-xl border border-input bg-input px-3 text-foreground';
  const valueFields = [
    ['relationshipIntention', 'Intention', ['A lasting partnership', 'A meaningful connection', 'Open to seeing where it goes']],
    ['language', 'Language', ['English', 'Spanish', 'French', 'German', 'Portuguese']],
    ['children', 'Family goals', ['I want children', 'I am open to children', 'I do not want children']],
    ['smoking', 'Smoking', ['Never', 'Sometimes', 'Regularly']],
    ['drinking', 'Drinking', ['Never', 'Sometimes', 'Socially', 'Regularly']],
  ] as const;
  return <details className="group rounded-2xl border border-border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="flex items-center gap-2"><MoreHorizontal size={17} className="text-primary" /> Tune discovery</span><ChevronDown size={17} className="transition group-open:rotate-180" /></summary>
    <div className="grid gap-5 border-t border-border p-5 md:grid-cols-2">
      <label className="grid gap-2 text-sm"><span className="text-muted-foreground">Age range</span><div className="grid grid-cols-2 gap-2"><input type="number" min={18} max={120} value={filters.ageMin ?? 18} onChange={(e) => set('ageMin', Number(e.target.value))} className={selectClass} aria-label="Minimum age" data-testid="input-discovery-age-min" /><input type="number" min={18} max={120} value={filters.ageMax ?? 65} onChange={(e) => set('ageMax', Number(e.target.value))} className={selectClass} aria-label="Maximum age" data-testid="input-discovery-age-max" /></div></label>
      <label className="grid gap-2 text-sm"><span className="text-muted-foreground">Distance (miles)</span><input type="number" min={1} value={filters.distanceMiles ?? 50} onChange={(e) => set('distanceMiles', Number(e.target.value))} className={selectClass} data-testid="input-discovery-distance" /></label>
      <label className="grid gap-2 text-sm"><span className="text-muted-foreground">Country</span><input value={filters.country ?? ''} onChange={(e) => set('country', e.target.value || null)} placeholder="Optional" className={`${selectClass} placeholder:text-muted-foreground`} data-testid="input-discovery-country" /></label>
      {valueFields.map(([key, label, options]) => <label key={key} className="grid gap-2 text-sm"><span className="text-muted-foreground">{label}</span><select value={(filters[key] as string | null) ?? ''} onChange={(e) => set(key, e.target.value || null)} className={selectClass} data-testid={`select-discovery-${key}`}><option value="">Any</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}
      <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={filters.verified} onChange={(e) => set('verified', e.target.checked)} className="accent-primary" data-testid="input-discovery-verified" /><span><strong>Verified only</strong><span className="block text-xs text-muted-foreground">Show profiles with a verification badge</span></span></label>
      <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={filters.onlineOnly} onChange={(e) => set('onlineOnly', e.target.checked)} className="accent-primary" data-testid="input-discovery-online" /><span><strong>Online now</strong><span className="block text-xs text-muted-foreground">Keep the room live</span></span></label>
      <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={filters.hasVideo} onChange={(e) => set('hasVideo', e.target.checked)} className="accent-primary" data-testid="input-discovery-video" /><span><strong>Has video</strong><span className="block text-xs text-muted-foreground">Prioritize profiles with video</span></span></label>
      <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={filters.hasVoiceVibe} onChange={(e) => set('hasVoiceVibe', e.target.checked)} className="accent-primary" data-testid="input-discovery-voice" /><span><strong>Has Voice Vibe</strong><span className="block text-xs text-muted-foreground">Prioritize profiles with audio</span></span></label>
      <div className="md:col-span-2"><p className="mb-3 text-sm text-muted-foreground">How much should each detail matter?</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{valueFields.map(([key, label]) => <label key={key} className="grid gap-1 text-xs"><span>{label}</span><select value={filters.criteria[key]} onChange={(e) => setCriterion(key, e.target.value as Criterion)} className="h-10 rounded-lg border border-input bg-input px-2 text-foreground" data-testid={`select-discovery-criterion-${key}`}><option value="required">Required</option><option value="preferred">Preferred</option><option value="doesnt_matter">Doesn't matter</option></select></label>)}</div></div>
    </div>
  </details>;
}

function MatchNotice({ match, onClose }: { match: NonNullable<ReturnType<typeof useSendHeart>['data']>['match']; onClose: () => void }) {
  if (!match) return null;
  return <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-3xl border border-primary/50 bg-card p-6 shadow-2xl shadow-primary/10 animate-rise" role="dialog" aria-labelledby="match-title"><button type="button" onClick={onClose} className="focus-ring absolute right-4 top-4 rounded-lg p-2 text-muted-foreground" aria-label="Close match notice" data-testid="button-close-match"><ArrowLeft className="rotate-180" size={17} /></button><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><Heart fill="currentColor" size={23} /></div><p className="font-mono-pulse text-[11px] uppercase tracking-[.18em] text-primary">Mutual signal</p><h2 id="match-title" className="mt-2 font-display text-3xl">You and {match.firstName} matched.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Messaging arrives in Phase 3. For now, the match is safely recorded.</p><div className="mt-5 flex gap-2"><button type="button" disabled className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-sm font-semibold opacity-60" title="Messaging is planned for Phase 3" data-testid="button-send-message-placeholder"><Send size={16} /> Send message</button><button type="button" disabled className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold opacity-60" title="Icebreakers are planned for Phase 3" data-testid="button-icebreaker-placeholder"><Sparkles size={16} /> Icebreaker</button></div></div>;
}

function CommentPanel({ profile, mediaId, onClose }: { profile: DiscoveryProfile; mediaId: string; onClose: () => void }) {
  const client = useQueryClient();
  const comments = useGetMediaComments(mediaId, { query: { queryKey: getGetMediaCommentsQueryKey(mediaId) } });
  const create = useCreateMediaComment();
  const act = useActOnComment();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<MediaComment | null>(null);
  const list = comments.data?.comments ?? [];
  const refresh = () => client.invalidateQueries({ queryKey: getGetMediaCommentsQueryKey(mediaId) });
  const submit = () => {
    const text = body.trim();
    if (!text) return;
    if (replyTo) {
      act.mutate({ commentId: replyTo.id, data: { action: CommentActionInputAction.reply, body: text } }, { onSuccess: () => { setBody(''); setReplyTo(null); refresh(); } });
    } else {
      create.mutate({ mediaId, data: { body: text, replyToId: null } }, { onSuccess: () => { setBody(''); refresh(); } });
    }
  };
  return <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4" aria-label={`Comments for ${profile.firstName}`}>
    <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><MessageCircle size={16} className="text-secondary" /> Comments</p><button type="button" onClick={onClose} className="focus-ring rounded-lg p-1 text-muted-foreground" aria-label="Close comments" data-testid={`button-close-comments-${mediaId}`}><ArrowLeft className="rotate-180" size={15} /></button></div>
    {comments.isLoading ? <div className="space-y-2"><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /></div> : comments.isError ? <p className="text-sm text-destructive">Comments are unavailable right now.</p> : list.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No comments yet. Say something kind and specific.</p> : <div className="max-h-60 space-y-2 overflow-y-auto">{list.map((comment: MediaComment) => <div key={comment.id} className={`rounded-xl border border-border p-3 ${comment.replyToId ? 'ml-4 border-secondary/20' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold">{comment.authorName}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{comment.body}</p></div><div className="flex shrink-0 items-center gap-1">{comment.canLikeBack && <button type="button" onClick={() => act.mutate({ commentId: comment.id, data: { action: CommentActionInputAction.like_back } }, { onSuccess: refresh })} className="focus-ring rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`Like back ${comment.authorName}`} data-testid={`button-like-back-${comment.id}`}><ThumbsUp size={14} /></button>}{!comment.canLikeBack && <><button type="button" onClick={() => setReplyTo(comment)} className="focus-ring rounded-lg p-2 text-secondary hover:bg-secondary/10" aria-label={`Reply to ${comment.authorName}`} data-testid={`button-reply-comment-${comment.id}`}><Reply size={14} /></button><button type="button" onClick={() => act.mutate({ commentId: comment.id, data: { action: CommentActionInputAction.ignore } }, { onSuccess: refresh })} className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label={`Ignore comment from ${comment.authorName}`} data-testid={`button-ignore-comment-${comment.id}`}><MoreHorizontal size={14} /></button></>}</div></div></div>)}</div>}
    {replyTo && <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/10 px-3 py-2 text-xs text-secondary"><span>Replying to {replyTo.authorName}</span><button type="button" onClick={() => setReplyTo(null)} className="focus-ring rounded px-1 text-muted-foreground" aria-label="Cancel reply">Cancel</button></div>}
    <div className="mt-3 flex gap-2"><input value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder={replyTo ? 'Write a reply' : 'Write a thoughtful comment'} className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground" aria-label={replyTo ? 'Reply' : 'Comment'} data-testid={`input-comment-${mediaId}`} /><button type="button" onClick={submit} disabled={!body.trim() || create.isPending || act.isPending} className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" aria-label={replyTo ? 'Post reply' : 'Post comment'} data-testid={`button-post-comment-${mediaId}`}>{create.isPending || act.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}</button></div>
  </div>;
}

function ProfileCard({ profile, onHeart, onSuperPulse, heartPending, allowance }: { profile: DiscoveryProfile; onHeart: (kind: HeartInputKind) => void; onSuperPulse: () => void; heartPending: boolean; allowance: { remaining: number; limit: number; refillAt: string } }) {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [details, setDetails] = useState(false);
  const [comments, setComments] = useState(false);
  const media = profile.media[mediaIndex];
  const interaction = useInteractWithMedia();
  const image = media?.path ? mediaUrl(media.path) : null;
  const react = (reaction: MediaInteractionInputReaction) => { if (media) interaction.mutate({ mediaId: media.id, data: { kind: MediaInteractionInputKind.reaction, reaction } }); };
  return <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/10" data-testid={`card-discovery-profile-${profile.userId}`}>
    <div className="relative aspect-[4/4.4] overflow-hidden bg-muted">
      {image && media?.kind === 'video' ? <video src={image} controls playsInline className="h-full w-full object-cover" aria-label={`${profile.firstName}'s profile video`} data-testid={`video-discovery-profile-${profile.userId}`} /> : image ? <img src={image} alt={media?.alt ?? `${profile.firstName}'s profile`} className="h-full w-full object-cover" data-testid={`img-discovery-profile-${profile.userId}`} /> : <div className="grid h-full place-items-center text-muted-foreground"><div className="text-center"><UserRound className="mx-auto mb-2" size={42} /><p className="text-sm">No profile media shared</p></div></div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 pt-24 text-white"><div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-display text-3xl font-semibold">{profile.firstName}, {profile.age}</h2>{profile.badges.includes('verified') && <BadgeCheck size={20} className="text-primary" aria-label="Verified" />}</div><p className="mt-1 flex items-center gap-1.5 text-sm text-white/75"><MapPin size={14} /> {[profile.region, profile.country].filter(Boolean).join(', ') || 'Location private'}</p></div><span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">{profile.compatibility}% fit</span></div></div>
      {profile.isOnline && <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Online</span>}
      {profile.isRecentlyActive && !profile.isOnline && <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs text-white backdrop-blur">Recently active</span>}
      {profile.media.length > 1 && <div className="absolute inset-x-4 top-4 flex gap-1">{profile.media.map((item, index) => <button key={item.id} type="button" onClick={() => setMediaIndex(index)} className={`h-1 flex-1 rounded-full ${index === mediaIndex ? 'bg-primary' : 'bg-white/35'}`} aria-label={`Show media ${index + 1}`} data-testid={`button-media-${profile.userId}-${index}`} />)}</div>}
    </div>
    <div className="p-5 md:p-6">
      <div className="flex flex-wrap gap-2">{profile.relationshipIntention && <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{profile.relationshipIntention}</span>}{profile.languages.slice(0, 3).map((language) => <span key={language} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1.5 text-xs text-secondary"><Languages size={12} />{language}</span>)}{profile.badges.filter((badge) => badge !== 'verified').map((badge) => <span key={badge} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">{badge}</span>)}</div>
      {profile.aboutMe && <p className="mt-5 text-[15px] leading-7 text-muted-foreground">{profile.aboutMe}</p>}
      <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.04] p-4"><p className="font-mono-pulse text-[10px] uppercase tracking-[.16em] text-primary">Why this signal</p><ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{profile.compatibilityReasons.length ? profile.compatibilityReasons.map((reason) => <li key={reason} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-secondary" />{reason}</li>) : <li className="text-xs">Compatibility details are still forming.</li>}</ul></div>
      <button type="button" onClick={() => setDetails((value) => !value)} className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary" aria-expanded={details} data-testid={`button-profile-details-${profile.userId}`}>{details ? 'Hide profile details' : 'View profile details'} <ChevronDown size={15} className={details ? 'rotate-180' : ''} /></button>
      {details && <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-2">{profile.hobbies.length > 0 && <p><strong className="text-foreground">Interests</strong><br />{profile.hobbies.join(' · ')}</p>}{profile.lifestyle && <p><strong className="text-foreground">Lifestyle</strong><br />{profile.lifestyle}</p>}{profile.familyGoals && <p><strong className="text-foreground">Family</strong><br />{profile.familyGoals}</p>}<p><strong className="text-foreground">Privacy</strong><br />Exact location is never shown.</p></div>}
       {media && <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4"><button type="button" onClick={() => interaction.mutate({ mediaId: media.id, data: { kind: MediaInteractionInputKind.like } })} className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${profile.mediaLikedByMe.includes(media.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/60'}`} data-testid={`button-like-media-${media.id}`}><ThumbsUp size={14} /> Like</button><button type="button" onClick={() => interaction.mutate({ mediaId: media.id, data: { kind: MediaInteractionInputKind.super_pulse } })} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/60 px-3 text-xs font-semibold text-accent hover:bg-accent/10" data-testid={`button-super-pulse-media-${media.id}`}><Zap size={14} /> Super Pulse</button><button type="button" onClick={() => react(MediaInteractionInputReaction.heart_eyes)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-accent hover:text-accent" data-testid={`button-react-media-${media.id}`}><Heart size={14} /> React</button><button type="button" onClick={() => setComments((value) => !value)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-secondary hover:text-secondary" data-testid={`button-comment-media-${media.id}`}><MessageCircle size={14} /> Comment</button></div>}
      {comments && media && <CommentPanel profile={profile} mediaId={media.id} onClose={() => setComments(false)} />}
      <div className="mt-5 grid grid-cols-[1fr_1fr] gap-2 border-t border-border pt-5"><button type="button" onClick={() => onHeart(HeartInputKind.heart)} disabled={heartPending || allowance.remaining <= 0 || profile.likedByMe} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:bg-[#FFE58A] disabled:opacity-45" data-testid={`button-heart-${profile.userId}`}><Heart size={18} fill="currentColor" />{profile.likedByMe ? 'Heart sent' : 'Send heart'}</button><button type="button" onClick={onSuperPulse} disabled={heartPending || profile.likedByMe} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-accent/60 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-45" data-testid={`button-super-pulse-${profile.userId}`}><Zap size={17} /> Super Pulse</button></div>
    </div>
  </article>;
}

export default function DiscoveryPage() {
  const [mode, setMode] = useState<Mode>('nearby');
  const [filters, setFilters] = useState<DiscoverFilters>(baseFilters);
  const [result, setResult] = useState<ReturnType<typeof useGetDiscovery>['data']>();
  const [match, setMatch] = useState<NonNullable<ReturnType<typeof useSendHeart>['data']>['match']>(null);
  const discovery = useGetDiscovery();
  const heart = useSendHeart();
  const sendDiscoveryRef = useRef(discovery.mutate);
  sendDiscoveryRef.current = discovery.mutate;
  const run = (nextMode: Mode = mode, nextFilters: DiscoverFilters = filters) => {
    const payload: DiscoverFilters = { ...nextFilters, mode: nextMode, worldwide: nextMode === 'global', distanceMiles: nextMode === 'global' ? null : nextFilters.distanceMiles };
    if (nextMode === 'right-now') { setMode(nextMode); setResult(undefined); return; }
    setMode(nextMode);
    sendDiscoveryRef.current({ data: payload }, { onSuccess: setResult });
  };
  useEffect(() => { sendDiscoveryRef.current({ data: baseFilters }, { onSuccess: setResult }); }, []);
  const profiles = useMemo(() => result?.profiles ?? [], [result]);
  const allowance = result?.heartAllowance ?? { remaining: 0, limit: 0, refillAt: '' };
  if (discovery.isPending && !result) return <LoadingDiscovery />;
  if (discovery.isError && !result) return <DiscoveryError retry={() => run()} />;
  return <DiscoveryFrame><div className="animate-rise"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="mb-3 flex items-center gap-2 font-mono-pulse text-[11px] uppercase tracking-[.2em] text-primary"><Radio size={13} /> Discovery / your frequency</p><h1 className="font-display text-4xl font-semibold tracking-[-.06em] md:text-6xl">Find the <span className="text-primary">right signal.</span></h1><p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">Explore real people by intention, not performance. Keep your pace and your boundaries.</p></div><div className="rounded-2xl border border-primary/25 bg-primary/[.06] px-4 py-3"><p className="flex items-center gap-2 font-mono-pulse text-[10px] uppercase tracking-[.14em] text-primary"><Heart size={13} fill="currentColor" /> Heart allowance</p><p className="mt-1 font-display text-2xl">{allowance.remaining} <span className="font-sans text-xs text-muted-foreground">/ {allowance.limit}</span></p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 size={12} /> {formatRefill(allowance.refillAt)}</p></div></div>
    <div className="mt-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Discovery modes">{([['nearby', 'Nearby', MapPin], ['global', 'Global', Globe2], ['right-now', 'Right Now', Radio]] as const).map(([value, label, Icon]) => <button type="button" key={value} role="tab" aria-selected={mode === value} onClick={() => run(value)} className={`focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${mode === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'}`} data-testid={`tab-discovery-${value}`}><Icon size={16} />{label}</button>)}</div>
    <div className="mt-4"><FilterPanel filters={filters} onChange={(next) => { setFilters(next); if (mode !== 'right-now') run(mode, next); }} /></div>
    {mode === 'right-now' ? <div className="mt-5 grid min-h-96 place-items-center rounded-3xl border border-dashed border-secondary/40 bg-secondary/[.04] p-8 text-center"><div className="max-w-md"><Radio className="mx-auto mb-4 text-secondary" size={36} /><p className="font-mono-pulse text-[11px] uppercase tracking-[.2em] text-secondary">Right Now / coming into focus</p><h2 className="mt-3 font-display text-3xl">A live room, not a fake list.</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Right Now is reserved for the live-presence experience. No placeholder profiles are shown here.</p></div></div> : profiles.length === 0 ? <div className="mt-5 grid min-h-80 place-items-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center"><div><Users className="mx-auto mb-4 text-muted-foreground" size={30} /><h2 className="font-display text-2xl">No one in this frequency yet</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try widening your age, distance, or criteria. We will never fill the room with invented profiles.</p><button type="button" onClick={() => { const next = { ...filters, ageMin: 18, ageMax: 80, distanceMiles: 500, criteria: Object.fromEntries(Object.keys(filters.criteria).map((key) => [key, 'doesnt_matter'])) as DiscoverFilters['criteria'] }; setFilters(next); run(mode, next); }} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/10" data-testid="button-widen-discovery">Widen the frequency <ArrowRight size={16} /></button></div></div> : <div className="mt-5 grid gap-5 lg:grid-cols-2">{profiles.map((profile) => <ProfileCard key={profile.userId} profile={profile} allowance={allowance} heartPending={heart.isPending} onHeart={(kind) => heart.mutate({ data: { toUserId: profile.userId, kind } }, { onSuccess: (response) => { if (response.match) setMatch(response.match); setResult((current) => current ? { ...current, heartAllowance: { remaining: response.remaining, limit: response.limit, refillAt: response.refillAt }, profiles: current.profiles.map((item) => item.userId === profile.userId ? { ...item, likedByMe: true } : item) } : current); } })} onSuperPulse={() => heart.mutate({ data: { toUserId: profile.userId, kind: HeartInputKind.super_pulse } }, { onSuccess: (response) => { if (response.match) setMatch(response.match); } })} />)}</div>}
    {discovery.isError && <p className="mt-4 text-sm text-destructive" role="alert">Some filters could not be applied. Try again.</p>}
    {match && <MatchNotice match={match} onClose={() => setMatch(null)} />}
  </div></DiscoveryFrame>;
}