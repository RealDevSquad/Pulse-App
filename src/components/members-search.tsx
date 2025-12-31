'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface SearchSuggestion {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
  isArchived: boolean;
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

/**
 * Desktop-only search component. Mobile search is handled in MembersFilterBar.
 */
export function MembersSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');
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

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  // Update URL
  const updateSearch = useCallback((newQuery: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newQuery) {
      params.set('search', newQuery);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/members?${params.toString()}`);
    setShowSuggestions(false);
  }, [router, searchParams]);

  // Handle input change
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

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear search
  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    updateSearch('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-96">
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
          className="pl-10 pr-10 h-10 text-sm"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <Link
              key={suggestion.id}
              href={`/member/${suggestion.id}`}
              onClick={() => setShowSuggestions(false)}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors ${
                index === selectedIndex ? 'bg-muted' : ''
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={suggestion.picture?.url} alt={suggestion.username} />
                <AvatarFallback className="text-xs">
                  {getInitials(suggestion.first_name, suggestion.last_name, suggestion.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">
                  {suggestion.first_name} {suggestion.last_name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
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

      {/* No results */}
      {showSuggestions && query.length >= 2 && !isLoading && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg p-4 text-center text-muted-foreground text-sm">
          No members found matching &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
