import React, { useEffect } from 'react';
import { 
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { usePaymentReturnPoller } from '../lib/paymentReturn';
import { useConfig } from '../hooks/useConfig';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const config = useConfig();
  const calendlyLink = config.calendly_link || 'https://calendly.com/hello-heyhavlo/havlo-enquiry-call';

  usePaymentReturnPoller({
    kind: 'session',
    token,
    fetchStatus: (id) => api.getSessionPaymentStatus(token!, id),
    onPaid: (res) => {
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
      }
    },
  });

  useEffect(() => {
    if (!user) return;
    if (user.is_admin) return;
    if (user.role === 'agent') {
      navigate('/dashboard/buyer-network', { replace: true });
    } else if (user.role === 'seller') {
      navigate('/dashboard/sell-faster', { replace: true });
    }
  }, [user, navigate]);

  return (
    <DashboardLayout title="Buy Property Abroad">
      <div className="max-w-[1162px] mx-auto space-y-6 lg:space-y-10 px-4 sm:px-6 lg:px-0 py-6 lg:py-10">
        {/* Hero Section */}
        <section className="relative rounded-[20px] bg-black p-6 sm:p-8 lg:p-10 overflow-hidden lg:min-h-[240px] flex flex-col justify-center gap-6 py-10 my-0">
          <div className="relative z-10 max-w-[739px] space-y-6">
            <h2 className="font-display text-[40px] font-black leading-[1] tracking-[-0.4px] text-white">
              Buy residential and commercial property worldwide
            </h2>
            <p className="font-body text-base font-medium leading-[1.2] tracking-[-0.32px] text-white">
              Your complete end-to-end international property purchase and advisory guiding you to purchase residential and commercial properties anywhere in the world.
            </p>
          </div>
          
          {/* Abstract Background Shapes */}
          <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-20">
              <path d="M400 0C400 0 300 50 200 120C100 190 0 240 0 240H400V0Z" fill="white" />
              <circle cx="350" cy="50" r="80" stroke="white" strokeWidth="1" />
              <circle cx="350" cy="50" r="40" stroke="white" strokeWidth="1" />
            </svg>
          </div>
        </section>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Property Needs Card */}
          <div className="flex flex-col p-6 sm:p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white lg:min-h-[502px]">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#1F1F1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12H15V22" stroke="#1F1F1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Tell Us Your Property Needs
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Share your preferences, budget, and location, and we’ll match you with the right property—fast and stress-free.
                </p>
              </div>
            </div>
            <div className="mt-auto pt-6">
              <Button 
                variant="primary" 
                className="h-[72px] w-full lg:w-fit rounded-full bg-black text-white px-8 flex items-center justify-center gap-3 group border border-black/5"
                onClick={() => navigate('/get-started')}
              >
                <span className="font-body text-xl font-semibold tracking-[-0.4px]">GET STARTED</span>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:translate-x-1">
                  <path d="M24.666 16.0039H6.66602" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17.3341 24.004C17.3341 24.004 25.334 18.112 25.334 16.0038C25.334 13.8957 17.3339 8.00391 17.3339 8.00391" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Button>
            </div>
          </div>

          {/* Advisory Team Card */}
          <div className="flex flex-col p-6 sm:p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white lg:min-h-[502px]">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 3V6M19 5L17 7M21 10H18" stroke="#1F1F1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.15825 5.71223L8.7556 4.80625C8.49232 4.21388 8.36068 3.91768 8.1638 3.69101C7.91707 3.40694 7.59547 3.19794 7.23567 3.08785C6.94858 3 6.62446 3 5.97621 3C5.02791 3 4.55375 3 4.15573 3.18229C3.68687 3.39702 3.26343 3.86328 3.09473 4.3506C2.95151 4.76429 2.99253 5.18943 3.07458 6.0397C3.94791 15.0902 8.90981 20.0521 17.9603 20.9254C18.8106 21.0075 19.2357 21.0485 19.6494 20.9053C20.1367 20.7366 20.603 20.3131 20.8177 19.8443C21 19.4462 21 18.9721 21 18.0238C21 17.3755 21 17.0514 20.9122 16.7643C20.8021 16.4045 20.5931 16.0829 20.309 15.8362C20.0823 15.6393 19.7861 15.5077 19.1937 15.2444L18.2878 14.8417C17.6462 14.5566 17.3255 14.4141 16.9995 14.3831C16.6876 14.3534 16.3731 14.3972 16.0811 14.5109C15.776 14.6297 15.5063 14.8544 14.967 15.3038C14.4301 15.7512 14.1617 15.9749 13.8337 16.0947C13.543 16.2009 13.1586 16.2403 12.8523 16.1951C12.5069 16.1442 12.2423 16.0029 11.7133 15.7201C10.0672 14.8405 9.15953 13.9328 8.27986 12.2867C7.99714 11.7577 7.85578 11.4931 7.80487 11.1477C7.75974 10.8414 7.79908 10.457 7.9053 10.1663C8.02512 9.83828 8.24881 9.56986 8.69619 9.033C9.14562 8.49368 9.37034 8.22402 9.48915 7.91891C9.60285 7.62694 9.64661 7.3124 9.61694 7.00048C9.58594 6.67452 9.44338 6.35376 9.15825 5.71223Z" stroke="#1F1F1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Speak to Our Advisory Team
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Get expert guidance tailored to your needs. Our team is ready to help you make the right property decisions with clarity and confidence.
                </p>
              </div>
            </div>
            <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-4 flex-wrap">
              <Button 
                variant="primary" 
                className="h-[72px] flex-1 min-w-[180px] rounded-full bg-[#006AFE] text-white px-5 flex items-center justify-center gap-3 border border-black/5"
                onClick={() => window.open(calendlyLink, '_blank', 'noopener,noreferrer')}
              >
                <div className="h-10 w-10 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M27.119 25.6959C25.8758 26.7791 24.3286 28.1279 21.5094 28.1279H19.8294C17.7926 28.1279 15.9446 27.4031 14.615 26.0847C13.3222 24.8015 12.607 23.0383 12.607 21.1247V18.8687C12.607 16.9535 13.3222 15.1983 14.615 13.9087C15.9366 12.5887 17.7926 11.8655 19.8294 11.8655H21.5094C24.3286 11.8655 25.8774 13.2127 27.1174 14.2943C28.4102 15.4143 29.5206 16.3871 32.4854 16.3871C32.9462 16.3514 33.3964 16.3514 33.8358 16.2799C33.8337 16.2746 33.8316 16.265 33.8294 16.2511C33.6491 15.8183 33.4418 15.3972 33.2086 14.9903L31.2214 11.6223C29.4038 8.52634 26.0374 6.61914 22.4006 6.61914H18.4342C14.7974 6.61914 11.431 8.52634 9.61345 11.6223L7.62625 14.9903C6.7329 16.5049 6.26172 18.2312 6.26172 19.9895C6.26172 21.7479 6.7329 23.4742 7.62625 24.9887L9.61345 28.3567C11.431 31.4527 14.7974 33.3583 18.4342 33.3583H22.4006C26.0374 33.3583 29.4038 31.4527 31.2214 28.3567L33.2086 24.9887C33.4476 24.577 33.6545 24.1589 33.8294 23.7343C33.8294 23.7263 33.8358 23.7183 33.8358 23.7055C33.3896 23.6312 32.9378 23.5948 32.4854 23.5967C29.5206 23.6047 28.4102 24.5727 27.1174 25.6975" fill="white"/>
                    <path d="M21.5159 13.916H19.8359C16.7399 13.916 14.7031 16.0872 14.7031 18.868V21.1256C14.7031 23.9064 16.7399 26.0792 19.8359 26.0792H21.5159C26.0279 26.0792 25.6791 21.564 32.4919 21.564C33.1415 21.564 33.7927 21.62 34.4199 21.7352C34.6244 20.5858 34.6244 19.4094 34.4199 18.26C33.7837 18.3751 33.7837 18.3751 34.4199 18.26C33.7837 18.3751 33.1384 18.4324 32.4919 18.4312C25.6711 18.4312 26.0279 13.916 21.5159 13.916Z" fill="white"/>
                    <path d="M38.3304 23.3832C37.1664 22.5455 35.8279 21.9821 34.4152 21.7352C34.4152 21.7496 34.4088 21.756 34.4088 21.7704C34.283 22.4375 34.0923 23.0908 33.8392 23.7208C35.0049 23.8959 36.1131 24.3426 37.0744 25.0248C37.0744 25.0328 37.0664 25.0456 37.0664 25.0536C36.5256 26.7816 35.708 28.4136 34.6344 29.8984C33.5752 31.3608 32.2984 32.6504 30.8376 33.732C27.8048 35.967 24.1329 37.1659 20.3656 37.1512C15.7467 37.1644 11.308 35.3598 8.00878 32.1272C6.41687 30.5701 5.14403 28.7173 4.26158 26.6728C3.35318 24.5659 2.88598 22.2952 2.88878 20.0008C2.88878 17.6856 3.34958 15.436 4.26158 13.3288C5.14385 11.2837 6.4167 9.43038 8.00878 7.87278C11.3093 4.64223 15.7471 2.83793 20.3656 2.84878C24.1768 2.84878 27.7992 4.03278 30.8376 6.26798C32.2961 7.33916 33.5773 8.63279 34.6344 10.1016C35.708 11.5848 36.5256 13.212 37.0664 14.9464C37.0664 14.9624 37.0744 14.9688 37.0744 14.9752C36.1131 15.6574 35.0049 16.1041 33.8392 16.2792C34.0982 16.917 34.2912 17.5796 34.4152 18.2568C35.8269 18.0067 37.1647 17.4436 38.3304 16.6088C39.4472 15.7992 39.228 14.8808 39.06 14.3368C36.5992 6.49838 29.156 0.800781 20.3656 0.800781C9.56558 0.800781 0.800781 9.39278 0.800781 20.0008C0.800781 30.6088 9.55758 39.2008 20.3656 39.2008C29.1656 39.2008 36.6056 33.5032 39.06 25.6632C39.236 25.1112 39.4472 24.1928 38.3304 23.3832Z" fill="white"/>
                  </svg>
                </div>
                <span className="font-body text-xl font-semibold tracking-[-0.4px]">BOOK A CALL</span>
              </Button>
              <Button 
                variant="primary" 
                className="h-[72px] flex-1 min-w-[180px] rounded-full bg-[#60D769] text-white px-5 flex items-center justify-center gap-3 border border-black/5"
                onClick={() => window.open('https://wa.me/message/PPPAWIAXBS7YK1', '_blank', 'noopener,noreferrer')}
              >
                <svg width="40" height="41" viewBox="0 0 40 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_5770_1992)">
                    <path d="M0.858162 19.9098C0.857225 23.296 1.742 26.6023 3.42439 29.5166L0.697266 39.4738L10.8872 36.8019C13.7056 38.3362 16.8634 39.1402 20.0723 39.1404H20.0808C30.6742 39.1404 39.2975 30.5202 39.302 19.925C39.304 14.7908 37.3064 9.96296 33.677 6.33076C30.0483 2.69887 25.2221 0.697656 20.08 0.695312C9.48535 0.695312 0.862692 9.315 0.858319 19.9098" fill="url(#paint0_linear_5770_1992)"/>
                    <path d="M0.171051 19.9037C0.169958 23.4117 1.08644 26.8363 2.82881 29.8549L0.00390625 40.169L10.5592 37.4014C13.4675 38.9871 16.742 39.8232 20.074 39.8244H20.0826C31.056 39.8244 39.9891 30.8942 39.9938 19.9196C39.9956 14.601 37.9262 9.59959 34.1671 5.83727C30.4076 2.07541 25.4089 0.00218694 20.0826 0C9.10722 0 0.175425 8.92898 0.171051 19.9037ZM6.45711 29.3351L6.06299 28.7094C4.40623 26.0751 3.53176 23.0309 3.53301 19.9049C3.53645 10.783 10.9602 3.36165 20.0888 3.36165C24.5096 3.36352 28.6641 5.08683 31.789 8.21354C34.9136 11.3406 36.633 15.4973 36.632 19.9184C36.6279 29.0403 29.204 36.4626 20.0826 36.4626H20.076C17.106 36.4611 14.1931 35.6634 11.6528 34.1562L11.0483 33.7977L4.78457 35.4399L6.45711 29.3351Z" fill="url(#paint1_linear_5770_1992)"/>
                    <path d="M15.1077 11.5821C14.735 10.7538 14.3427 10.737 13.9883 10.7225C13.698 10.71 13.3662 10.711 13.0348 10.711C12.703 10.711 12.1639 10.8358 11.7082 11.3333C11.2521 11.8313 9.9668 13.0347 9.9668 15.4824C9.9668 17.9301 11.7496 20.2957 11.9982 20.628C12.247 20.9596 15.4399 26.1433 20.4968 28.1375C24.6995 29.7947 25.5547 29.4651 26.4668 29.382C27.3791 29.2992 29.4105 28.1789 29.8249 27.0171C30.2396 25.8555 30.2396 24.8599 30.1153 24.6518C29.9909 24.4445 29.6591 24.32 29.1616 24.0713C28.6641 23.8226 26.218 22.6189 25.762 22.4528C25.3059 22.2869 24.9742 22.2041 24.6424 22.7023C24.3107 23.1997 23.3579 24.32 23.0675 24.6518C22.7774 24.9844 22.4871 25.0258 21.9897 24.7769C21.4918 24.5273 19.8896 24.0026 17.9887 22.3079C16.5097 20.9891 15.5112 19.3606 15.2209 18.8625C14.9307 18.3651 15.1898 18.0955 15.4393 17.8476C15.6629 17.6247 15.937 17.2666 16.186 16.9762C16.4341 16.6857 16.5169 16.4784 16.6827 16.1466C16.8488 15.8145 16.7657 15.524 16.6415 15.2751C16.5169 15.0263 15.5501 12.5658 15.1077 11.5821Z" fill="white"/>
                  </g>
                  <defs>
                    <linearGradient id="paint0_linear_5770_1992" x1="1930.93" y1="3878.54" x2="1930.93" y2="0.695312" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#1FAF38"/>
                      <stop offset="1" stopColor="#60D669"/>
                    </linearGradient>
                    <linearGradient id="paint1_linear_5770_1992" x1="1999.5" y1="4016.9" x2="1999.5" y2="0" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#F9F9F9"/>
                      <stop offset="1" stopColor="white"/>
                    </linearGradient>
                    <clipPath id="clip0_5770_1992">
                      <rect width="40" height="40.3023" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
                <span className="font-body text-xl font-semibold tracking-[-0.4px]">WHATSAPP</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-center gap-4 sm:gap-6 px-5 py-6 sm:px-6 sm:py-10 rounded-lg border-l-2 border-[#0052B4] bg-[#D6E9FF] overflow-hidden">
          <div className="h-6 w-6 rounded-full bg-[#0052B4] flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#0052B4"/>
              <path d="M12 16V12" stroke="#FEFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z" stroke="#FEFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="font-inter text-base font-medium tracking-[-0.32px] text-black">
            Learn more about our <span className="font-bold underline cursor-pointer">complete home buying experience</span>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
