'use client';

import { usePhantomStore } from '@/store/phantom-store';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Ghost,
  Search,
  UserPlus,
  Link2,
  ChevronDown,
  LogOut,
  User,
  Keyboard,
  FolderOpen,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearAccessToken } from '@/lib/api-client';

interface TopBarProps {
  onAddEntity: () => void;
  onAddRelationship: () => void;
}

/**
 * Compact Action Bar — replaced the old full-width top nav bar.
 *
 * Navigation now lives entirely in the right-side RadialMenu. This bar keeps
 * only the essential in-session actions that don't fit a radial layout:
 *   • PHANTOM logo + LIVE indicator (left)
 *   • Case selector (center-left)
 *   • Search / Add Entity / Add Relationship / Shortcuts / User menu (right)
 *
 * It is intentionally a single thin strip (~h-12) so the radial menu is the
 * dominant navigation surface.
 */
export default function TopBar({ onAddEntity, onAddRelationship }: TopBarProps) {
  const currentCase = usePhantomStore((s) => s.currentCase);
  const setCaseManagerOpen = usePhantomStore((s) => s.setCaseManagerOpen);
  const setSidePanelOpen = usePhantomStore((s) => s.setSidePanelOpen);
  const setSidePanelContent = usePhantomStore((s) => s.setSidePanelContent);
  const user = usePhantomStore((s) => s.user);
  const setUser = usePhantomStore((s) => s.setUser);
  const unreadAlerts = usePhantomStore((s) => s.unreadAlerts);
  const router = useRouter();

  const handleSearch = () => {
    setSidePanelContent('search');
    setSidePanelOpen(true);
  };

  const handleLogout = () => {
    clearAccessToken();
    document.cookie = 'access_token=; path=/; max-age=0';
    setUser(null);
    router.push('/login');
  };

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex items-center h-12 px-3 border-b border-cyan-500/15 bg-card/50 backdrop-blur-md shrink-0 gap-2 scan-line">
        {/* Left: Logo + LIVE */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center size-7 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]">
            <Ghost className="size-4" />
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <span className="font-bold text-sm neon-cyan tracking-wider">PHANTOM</span>
            <span className="text-[9px] text-muted-foreground tracking-[0.2em]">OSINT</span>
          </div>
          <div className="hidden md:flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30">
            <div className="size-1.5 rounded-full bg-green-400 pulse-dot" />
            <span className="text-[9px] text-green-400 tracking-wide">LIVE</span>
          </div>
        </div>

        {/* Center: Case selector (kept — radial menu can't comfortably host 50+ cases) */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          <button
            className="flex items-center gap-1.5 px-3 py-1 rounded-md hover:bg-cyan-500/10 transition-colors max-w-[280px] group"
            onClick={() => setCaseManagerOpen(true)}
          >
            <FolderOpen className="size-3.5 text-cyan-400/70" />
            <span className={`text-sm font-medium truncate ${currentCase ? 'text-cyan-50' : 'text-muted-foreground'}`}>
              {currentCase ? currentCase.name : 'Select Case'}
            </span>
            <ChevronDown className="size-3.5 text-cyan-400/60 group-hover:text-cyan-400 shrink-0 transition-colors" />
          </button>
        </div>

        {/* Right: Action buttons (no nav tabs — radial menu handles navigation) */}
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10"
                onClick={handleSearch}
              >
                <Search className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Live Search (/)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10"
                onClick={onAddEntity}
                disabled={!currentCase}
              >
                <UserPlus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Entity (Ctrl+N)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10"
                onClick={onAddRelationship}
                disabled={!currentCase}
              >
                <Link2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Relationship</TooltipContent>
          </Tooltip>

          {unreadAlerts > 0 && (
            <Badge className="bg-red-500 text-white text-[9px] h-5 px-1.5 animate-pulse">
              {unreadAlerts > 9 ? '9+' : unreadAlerts}
            </Badge>
          )}

          <div className="w-px h-5 bg-cyan-500/15 mx-1" />

          {/* Keyboard Shortcuts */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10">
                    <Keyboard className="size-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Keyboard Shortcuts</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-64 p-3 bg-card/95 border-cyan-500/20">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm neon-cyan">Shortcuts</h4>
                <div className="space-y-1.5 text-xs">
                  {[
                    { keys: ['/'], label: 'Live Search' },
                    { keys: ['Ctrl', 'K'], label: 'Search' },
                    { keys: ['Ctrl', 'N'], label: 'New Entity' },
                    { keys: ['1–9', '0'], label: 'Switch Views' },
                    { keys: ['F'], label: 'Fit Graph' },
                    { keys: ['C'], label: 'Case Manager' },
                    { keys: ['Esc'], label: 'Deselect' },
                  ].map((shortcut) => (
                    <div key={shortcut.keys.join('+')} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{shortcut.label}</span>
                      <div className="flex items-center gap-0.5">
                        {shortcut.keys.map((key, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-muted-foreground/50 mx-0.5">+</span>}
                            <kbd className="px-1.5 py-0.5 rounded bg-cyan-500/10 font-mono text-[10px] border border-cyan-500/20 text-cyan-400">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-cyan-500/15 mx-1" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10">
                <User className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card/95 border-cyan-500/20">
              {user && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-cyan-50 truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="px-2 py-1 text-[10px] text-cyan-400/60 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-cyan-400" />
                    {user.role} · {user.clearance}
                  </div>
                  <DropdownMenuSeparator className="bg-cyan-500/15" />
                </>
              )}
              <DropdownMenuItem
                className="text-cyan-400/70 hover:text-cyan-400 focus:text-cyan-400 cursor-pointer"
                onClick={() => setCaseManagerOpen(true)}
              >
                <FolderOpen className="size-3.5 mr-2" />
                Open Case Manager
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-cyan-500/15" />
              <DropdownMenuItem
                className="text-red-400/80 hover:text-red-400 focus:text-red-400 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="size-3.5 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
