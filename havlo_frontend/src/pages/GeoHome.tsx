import { Link, useNavigate } from 'react-router-dom';

const overrideKey = 'havlo-home-experience';

export const GeoHome = () => {
  const navigate = useNavigate();

  const choose = (experience: 'uk' | 'global') => {
    window.localStorage.setItem(overrideKey, experience);
    navigate(experience === 'uk' ? '/stale-listings' : '/buyabroad/uk', { replace: true });
  };

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-center">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-3xl place-items-center">
        <section className="w-full rounded-[32px] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#a900d8]">Choose your Havlo experience</p>
          <h1 className="mt-4 font-body text-4xl font-light tracking-[-0.05em] text-black sm:text-6xl">
            Are you currently in the UK?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-black/65">
            We will show the right starting point based on where you are. You can change this later.
          </p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => choose('uk')}
              className="rounded-2xl bg-black px-5 py-5 text-base font-black text-white"
            >
              Yes, I am in the UK
            </button>
            <button
              onClick={() => choose('global')}
              className="rounded-2xl border border-black/15 px-5 py-5 text-base font-black text-black"
            >
              No, I am outside the UK
            </button>
          </div>
          <Link className="mt-7 inline-block text-sm font-bold text-[#a900d8]" to="/home">
            Open the original Havlo home page
          </Link>
        </section>
      </div>
    </main>
  );
};
