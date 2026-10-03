import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

// Any address the site doesn't have (including pages that were taken down,
// such as /sell-your-property). Marked noindex so search engines drop it.
export const NotFound = () => {
  usePageMeta({ title: 'Page not found | Havlo', description: 'This page does not exist on Havlo.' });
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);
  return (
    <main className="min-h-[70vh] bg-white px-6 py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#a409d2]">404</p>
      <h1 className="mt-4 font-body text-4xl font-bold tracking-[-0.03em] text-black sm:text-5xl">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-7 text-black/60">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been removed.
      </p>
      <Link to="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-black px-7 text-sm font-semibold text-white hover:bg-black/90">
        Go to the homepage
      </Link>
    </main>
  );
};
