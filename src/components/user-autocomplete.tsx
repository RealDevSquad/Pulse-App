'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserSuggestion {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  picture?: { url: string };
  isArchived?: boolean;
}

interface UserAutocompleteProps {
  /** Currently selected user ID */
  value?: string;
  /** Callback when user is selected (null to clear) */
  onSelect: (user: UserSuggestion | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names for the container */
  className?: string;
  /** Disable the input */
  disabled?: boolean;
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

export function UserAutocomplete({
  value,
  onSelect,
  placeholder = 'Search user...',
  className = '',
  disabled = false,
}: UserAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user by ID when value prop changes
  useEffect(() => {
    if (value && !selectedUser) {
      fetch(`/api/users/${value}`)
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setSelectedUser(data.user);
          }
        })
        .catch(console.error);
    } else if (!value) {
      setSelectedUser(null);
    }
  }, [value, selectedUser]);

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
    if (query) {
      debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setSelectedIndex(-1);
    setShowSuggestions(true);
  };

  // Handle selection
  const handleSelect = (user: UserSuggestion) => {
    setSelectedUser(user);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onSelect(user);
  };

  // Clear selection
  const handleClear = () => {
    setSelectedUser(null);
    setQuery('');
    setSuggestions([]);
    onSelect(null);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }

    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
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

  // Show selected user as a badge
  if (selectedUser) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-background">
          <Avatar className="h-6 w-6">
            <AvatarImage src={selectedUser.picture?.url} alt={selectedUser.username} />
            <AvatarFallback className="text-xs">
              {getInitials(selectedUser.first_name, selectedUser.last_name, selectedUser.username)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm truncate flex-1">
            {selectedUser.first_name} {selectedUser.last_name}
          </span>
          <button
            onClick={handleClear}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          disabled={disabled}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelect(suggestion)}
              className={`flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-muted transition-colors ${
                index === selectedIndex ? 'bg-muted' : ''
              }`}
              type="button"
            >
              <Avatar className="h-7 w-7">
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
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showSuggestions && query.length >= 2 && !isLoading && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg p-3 text-center text-muted-foreground text-sm">
          No users found
        </div>
      )}
    </div>
  );
}
