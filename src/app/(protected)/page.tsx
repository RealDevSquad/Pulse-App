import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect root to /me (logged-in user's profile)
  redirect('/me');
}
