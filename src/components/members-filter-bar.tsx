'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface FilterState {
  sortBy: string;
  sortOrder: string;
  inDiscord: boolean;
  archived: boolean;
  hideSuperusers: boolean;
  search: string;
}

interface SearchSuggestion {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
  isArchived: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('inDiscord', String(overrides.inDiscord ?? filters.inDiscord));
  params.set('archived', String(overrides.archived ?? filters.archived));
  params.set('hideSuperusers', String(overrides.hideSuperusers ?? filters.hideSuperusers));
  params.set('page', '1');
  const searchVal = overrides.search ?? filters.search;
  if (searchVal) {
    params.set('search', searchVal);
  }
  return `/members?${params.toString()}`;
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

export function MembersFilterBar({ filters }: { filters: FilterState }) {
  const router = useRouter();
  const [isSearchExpanded, setIsSearchExpanded] = useState(!!filters.search);
  const [query, setQuery] = useState(filters.search);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  // Update URL
  const updateSearch = useCallback((newQuery: string) => {
    router.push(buildUrl(filters, { search: newQuery }));
    setShowSuggestions(false);
  }, [router, filters]);

  // Handle input change with debounced URL update
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    setShowSuggestions(true);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateSearch(value), 300);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      if (!query) {
        setIsSearchExpanded(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') updateSearch(query);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => prev < suggestions.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          router.push(`/member/${suggestions[selectedIndex].id}`);
          setShowSuggestions(false);
        } else {
          updateSearch(query);
        }
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        if (!query) setIsSearchExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query]);

  // Expand and focus
  const expandSearch = () => {
    setIsSearchExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Clear search
  const clearOrClose = () => {
    if (query) {
      setQuery('');
      setSuggestions([]);
      updateSearch('');
      inputRef.current?.focus();
    } else {
      setIsSearchExpanded(false);
    }
  };

  // Mobile: when search is expanded, show full-width search bar only
  if (isSearchExpanded) {
    return (
      <div ref={containerRef} className="sm:hidden relative w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search by name, username, or GitHub..."
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => query.length >= 2 && setShowSuggestions(true)}
              className="pl-10 pr-10 h-10 w-full text-base"
            />
          <button
            onClick={clearOrClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile suggestions dropdown - full width */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 z-50 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <Link
                key={suggestion.id}
                href={`/member/${suggestion.id}`}
                onClick={() => setShowSuggestions(false)}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors ${
                  index === selectedIndex ? 'bg-muted' : ''
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={suggestion.picture?.url} alt={suggestion.username} />
                  <AvatarFallback className="text-xs">
                    {getInitials(suggestion.first_name, suggestion.last_name, suggestion.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {suggestion.first_name} {suggestion.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    @{suggestion.username}
                  </div>
                </div>
                {suggestion.isArchived && (
                  <Badge variant="outline" className="text-xs border-red-300 text-red-400 shrink-0">
                    Archived
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}

        {showSuggestions && query.length >= 2 && !isLoading && suggestions.length === 0 && (
          <div className="absolute left-0 right-0 z-50 mt-1 bg-popover border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
            No members found matching &quot;{query}&quot;
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-6">
      <div className="flex items-center gap-2">
        <Switch
          id="in-discord"
          checked={filters.inDiscord}
          onCheckedChange={(checked) => {
            router.push(buildUrl(filters, { inDiscord: checked }));
          }}
        />
        <Label htmlFor="in-discord" className="text-sm font-medium cursor-pointer">
          In Discord
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="archived"
          checked={filters.archived}
          onCheckedChange={(checked) => {
            router.push(buildUrl(filters, { archived: checked }));
          }}
        />
        <Label htmlFor="archived" className="text-sm font-medium cursor-pointer">
          Archived
        </Label>
      </div>

      {/* Mobile search icon - after Archived toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden h-8 w-8"
        onClick={expandSearch}
        aria-label="Search members"
      >
        <Search className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5">
        <Checkbox
          id="hide-superusers"
          checked={filters.hideSuperusers}
          onCheckedChange={(checked) => {
            router.push(buildUrl(filters, { hideSuperusers: checked === true }));
          }}
        />
        <Label htmlFor="hide-superusers" className="text-sm font-medium cursor-pointer whitespace-nowrap">
          Hide Superusers
        </Label>
      </div>
    </div>
  );
}
