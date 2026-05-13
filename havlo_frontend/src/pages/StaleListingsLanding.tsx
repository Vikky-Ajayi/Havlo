import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PURPLE = '#A409D2';

/* ─── SVG ICONS ─── */
const StaleListingsLogo = () => (
  <svg width="165" height="28" viewBox="0 0 165 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M8.63887 21.9613C5.91631 21.9613 3.79349 21.3187 2.27038 20.0336C0.756793 18.7485 0 16.9493 0 14.6361H4.2409C4.26946 15.807 4.67403 16.7208 5.45462 17.3777C6.23521 18.025 7.30615 18.3487 8.66742 18.3487C9.88591 18.3487 10.8664 18.1012 11.6089 17.6062C12.3514 17.1111 12.7227 16.4495 12.7227 15.6214C12.7227 14.936 12.4228 14.3791 11.8231 13.9507C11.2329 13.5223 10.2619 13.1606 8.91017 12.8655L6.66835 12.38C2.49885 11.4756 0.414094 9.50513 0.414094 6.46844C0.414094 5.1738 0.752033 4.04575 1.42791 3.08429C2.10379 2.11331 3.04621 1.35652 4.25518 0.81391C5.46414 0.271303 6.87777 0 8.49607 0C10.9426 0 12.8798 0.609242 14.3077 1.82773C15.7451 3.04621 16.4971 4.72639 16.5638 6.86826H12.4514C12.3752 5.8592 11.9849 5.06433 11.2805 4.48364C10.5761 3.90296 9.65268 3.61262 8.51035 3.61262C7.42514 3.61262 6.53508 3.86012 5.84016 4.35513C5.15476 4.85014 4.81206 5.48318 4.81206 6.25425C4.81206 6.91109 5.09764 7.43942 5.66881 7.83924C6.23997 8.23905 7.17764 8.58175 8.4818 8.86733L10.5237 9.30998C12.7893 9.79547 14.4457 10.5237 15.4928 11.4947C16.5495 12.4562 17.0778 13.7365 17.0778 15.3358C17.0778 17.3824 16.3258 19.0007 14.8217 20.1907C13.3177 21.3711 11.2567 21.9613 8.63887 21.9613Z" fill="#313131"/>
    <path d="M27.3525 6.53984V9.83831H24.2682V16.9636C24.2682 17.4776 24.3682 17.8346 24.5681 18.0345C24.7775 18.2249 25.1678 18.3201 25.739 18.3201H27.3525V21.6186H24.8965C23.2401 21.6186 22.0169 21.2949 21.2268 20.6476C20.4462 20.0003 20.0559 18.9912 20.0559 17.6204V9.83831H17.4571V6.53984H20.0559V2.42745H24.2682V6.53984H27.3525Z" fill="#313131"/>
    <path d="M33.5005 21.8756C31.9965 21.8756 30.7542 21.4996 29.7737 20.7476C28.8027 19.9955 28.3172 18.8675 28.3172 17.3634C28.3172 16.2306 28.5885 15.3453 29.1311 14.7075C29.6737 14.0602 30.3924 13.589 31.2873 13.2939C32.1821 12.9988 33.1531 12.8036 34.2002 12.7084C35.5805 12.5656 36.5467 12.4228 37.0989 12.28C37.651 12.1372 37.927 11.8231 37.927 11.3376V11.2377C37.927 10.6855 37.7081 10.2334 37.2702 9.88115C36.8323 9.52893 36.2278 9.35282 35.4568 9.35282C34.6762 9.35282 34.0431 9.53369 33.5576 9.89543C33.0721 10.2572 32.8056 10.7284 32.758 11.3091H28.8027C28.8979 9.7574 29.5357 8.52463 30.7161 7.61077C31.8965 6.68739 33.5196 6.2257 35.5853 6.2257C37.651 6.2257 39.2502 6.68739 40.3831 7.61077C41.5159 8.52463 42.0823 9.78595 42.0823 11.3947V21.6186H37.9699V19.491H37.9128C37.513 20.224 36.9656 20.8047 36.2707 21.233C35.5758 21.6614 34.6524 21.8756 33.5005 21.8756ZM34.6714 18.9484C35.6805 18.9484 36.4801 18.6818 37.0703 18.1488C37.6605 17.6062 37.9556 16.9255 37.9556 16.1068V14.5933C37.7176 14.7265 37.3226 14.8503 36.7704 14.9645C36.2183 15.0692 35.6043 15.1739 34.9284 15.2787C34.205 15.3929 33.591 15.6023 33.0864 15.9069C32.5914 16.202 32.3439 16.6495 32.3439 17.2492C32.3439 17.7823 32.5533 18.2011 32.9722 18.5057C33.4006 18.8008 33.967 18.9484 34.6714 18.9484Z" fill="#313131"/>
    <path d="M48.3874 0.342699V21.6186H44.175V0.342699H48.3874Z" fill="#313131"/>
    <path d="M57.3769 21.9613C55.8538 21.9613 54.5259 21.6233 53.393 20.9475C52.2698 20.2716 51.394 19.3434 50.7657 18.163C50.1469 16.9731 49.8375 15.6166 49.8375 14.0935C49.8375 12.5609 50.1517 11.1996 50.78 10.0097C51.4178 8.81973 52.2935 7.88683 53.4073 7.21095C54.5211 6.53508 55.7967 6.19714 57.2341 6.19714C58.7192 6.19714 60.0138 6.53032 61.118 7.19667C62.2318 7.85351 63.0981 8.77214 63.7168 9.95254C64.3451 11.1234 64.6593 12.4752 64.6593 14.0078V15.1359H53.9356C53.9737 16.2496 54.3021 17.1397 54.9209 17.8061C55.5397 18.4724 56.4012 18.8056 57.5054 18.8056C58.3241 18.8056 59.0047 18.6295 59.5473 18.2773C60.0995 17.9251 60.4707 17.4586 60.6611 16.8779H64.5022C64.3213 17.8775 63.8977 18.758 63.2314 19.5196C62.565 20.2811 61.7273 20.8808 60.7182 21.3187C59.7092 21.7471 58.5954 21.9613 57.3769 21.9613ZM53.9642 12.4514H60.6897C60.585 11.509 60.2327 10.7665 59.633 10.2238C59.0428 9.67172 58.2717 9.39566 57.3198 9.39566C56.3774 9.39566 55.6111 9.67172 55.0209 10.2238C54.4307 10.7665 54.0784 11.509 53.9642 12.4514Z" fill="#313131"/>
    <path d="M66.138 21.6186V0.342699H70.536V17.8489H80.2029V21.6186H66.138Z" fill="#313131"/>
    <path d="M81.4389 21.6186V6.53984H85.6513V21.6186H81.4389ZM83.538 4.64071C82.843 4.64071 82.2671 4.43129 81.8102 4.01243C81.3533 3.58406 81.1248 3.04621 81.1248 2.39889C81.1248 1.75157 81.3533 1.21848 81.8102 0.799631C82.2671 0.371257 82.843 0.15707 83.538 0.15707C84.2234 0.15707 84.7945 0.371257 85.2515 0.799631C85.7084 1.21848 85.9369 1.75157 85.9369 2.39889C85.9369 3.04621 85.7084 3.58406 85.2515 4.01243C84.7945 4.43129 84.2234 4.64071 83.538 4.64071Z" fill="#313131"/>
    <path d="M94.0268 21.9898C92.0658 21.9898 90.4428 21.5424 89.1577 20.6476C87.8821 19.7528 87.1776 18.4962 87.0443 16.8779H91.1853C91.2614 17.5348 91.5375 18.0488 92.0135 18.4201C92.4894 18.7913 93.1368 18.9769 93.9554 18.9769C94.736 18.9769 95.35 18.8294 95.7974 18.5343C96.2449 18.2392 96.4686 17.8584 96.4686 17.392C96.4686 16.9921 96.2925 16.6732 95.9402 16.4353C95.5975 16.1878 95.1216 16.0021 94.5123 15.8784L91.8707 15.3643C88.8816 14.7932 87.387 13.3272 87.387 10.9664C87.387 9.53845 87.963 8.39136 89.1148 7.52509C90.2667 6.65883 91.8231 6.2257 93.7841 6.2257C95.7356 6.2257 97.3063 6.68263 98.4962 7.59649C99.6861 8.51035 100.3 9.75264 100.338 11.3233H96.44C96.4305 10.7236 96.1877 10.2238 95.7118 9.82403C95.2453 9.4147 94.6408 9.21003 93.8983 9.21003C93.1749 9.21003 92.6084 9.3671 92.1991 9.68124C91.7898 9.98586 91.5851 10.3619 91.5851 10.8093C91.5851 11.1996 91.7422 11.5185 92.0563 11.766C92.38 12.0135 92.8321 12.1991 93.4128 12.3229L96.2687 12.8798C97.7918 13.1749 98.9103 13.6604 99.6242 14.3362C100.348 15.0026 100.709 15.8927 100.709 17.0064C100.709 18.006 100.424 18.8818 99.8527 19.6338C99.2911 20.3763 98.5057 20.957 97.4967 21.3758C96.4971 21.7852 95.3405 21.9898 94.0268 21.9898Z" fill="#313131"/>
    <path d="M111.056 6.53984V9.83831H107.971V16.9636C107.971 17.4776 108.071 17.8346 108.271 18.0345C108.481 18.2249 108.871 18.3201 109.442 18.3201H111.056V21.6186H108.6C106.943 21.6186 105.72 21.2949 104.93 20.6476C104.149 20.0003 103.759 18.9912 103.759 17.6204V9.83831H101.16V6.53984H103.759V2.42745H107.971V6.53984H111.056Z" fill="#313131"/>
    <path d="M112.306 21.6186V6.53984H116.518V21.6186H112.306ZM114.405 4.64071C113.71 4.64071 113.134 4.43129 112.677 4.01243C112.22 3.58406 111.992 3.04621 111.992 2.39889C111.992 1.75157 112.22 1.21848 112.677 0.799631C113.134 0.371257 113.71 0.15707 114.405 0.15707C115.09 0.15707 115.661 0.371257 116.118 0.799631C116.575 1.21848 116.804 1.75157 116.804 2.39889C116.804 3.04621 116.575 3.58406 116.118 4.01243C115.661 4.43129 115.09 4.64071 114.405 4.64071Z" fill="#313131"/>
    <path d="M122.838 13.2367V21.6186H118.625V6.53984H122.766V8.91017C123.28 8.05342 123.923 7.39182 124.694 6.92537C125.465 6.45892 126.393 6.2257 127.478 6.2257C129.077 6.2257 130.358 6.7445 131.319 7.78212C132.281 8.81021 132.762 10.2762 132.762 12.1801V21.6186H128.563V12.9512C128.563 11.9421 128.321 11.1758 127.835 10.6522C127.35 10.1191 126.669 9.85259 125.793 9.85259C124.927 9.85259 124.218 10.1239 123.666 10.6665C123.114 11.2091 122.838 12.0659 122.838 13.2367Z" fill="#313131"/>
    <path d="M142.008 27.7872C139.866 27.7872 138.21 27.3397 137.039 26.4449C135.868 25.5501 135.178 24.3697 134.968 22.9037H139.024C139.176 23.4749 139.514 23.9128 140.038 24.2174C140.561 24.5315 141.218 24.6886 142.008 24.6886C143.036 24.6886 143.826 24.4078 144.378 23.8461C144.94 23.2845 145.221 22.4611 145.221 21.3758V19.0626H145.207C144.759 19.9479 144.15 20.6 143.379 21.0189C142.617 21.4282 141.742 21.6329 140.752 21.6329C139.438 21.6329 138.291 21.3044 137.31 20.6476C136.33 19.9908 135.568 19.0912 135.026 17.9489C134.493 16.797 134.226 15.469 134.226 13.965C134.226 12.4514 134.497 11.1139 135.04 9.95254C135.592 8.79118 136.354 7.88207 137.325 7.22523C138.305 6.55887 139.438 6.2257 140.723 6.2257C141.694 6.2257 142.56 6.43512 143.322 6.85398C144.093 7.26331 144.721 7.88683 145.207 8.72454H145.221V6.53984H149.376V21.0331C149.376 22.6229 149.062 23.9128 148.434 24.9028C147.815 25.9023 146.953 26.6306 145.849 27.0875C144.745 27.5539 143.465 27.7872 142.008 27.7872ZM141.837 18.263C142.903 18.263 143.76 17.8679 144.407 17.0778C145.054 16.2877 145.378 15.2311 145.378 13.9079C145.378 12.5942 145.054 11.5423 144.407 10.7522C143.76 9.96206 142.903 9.56701 141.837 9.56701C140.818 9.56701 139.999 9.94778 139.381 10.7093C138.771 11.4614 138.467 12.5275 138.467 13.9079C138.467 15.2977 138.771 16.3734 139.381 17.1349C139.999 17.887 140.818 18.263 141.837 18.263Z" fill="#313131"/>
    <path d="M157.752 21.9898C155.791 21.9898 154.168 21.5424 152.882 20.6476C151.607 19.7528 150.902 18.4962 150.769 16.8779H154.91C154.986 17.5348 155.262 18.0488 155.738 18.4201C156.214 18.7913 156.862 18.9769 157.68 18.9769C158.461 18.9769 159.075 18.8294 159.522 18.5343C159.97 18.2392 160.193 17.8584 160.193 17.392C160.193 16.9921 160.017 16.6732 159.665 16.4353C159.322 16.1878 158.846 16.0021 158.237 15.8784L155.596 15.3643C152.606 14.7932 151.112 13.3272 151.112 10.9664C151.112 9.53845 151.688 8.39136 152.84 7.52509C153.991 6.65883 155.548 6.2257 157.509 6.2257C159.46 6.2257 161.031 6.68263 162.221 7.59649C163.411 8.51035 164.025 9.75264 164.063 11.3233H160.165C160.155 10.7236 159.913 10.2238 159.437 9.82403C158.97 9.4147 158.366 9.21003 157.623 9.21003C156.9 9.21003 156.333 9.3671 155.924 9.68124C155.515 9.98586 155.31 10.3619 155.31 10.8093C155.31 11.1996 155.467 11.5185 155.781 11.766C156.105 12.0135 156.557 12.1991 157.138 12.3229L159.993 12.8798C161.517 13.1749 162.635 13.6604 163.349 14.3362C164.073 15.0026 164.434 15.8927 164.434 17.0064C164.434 18.006 164.149 18.8818 163.578 19.6338C163.016 20.3763 162.231 20.957 161.221 21.3758C160.222 21.7852 159.065 21.9898 157.752 21.9898Z" fill="#313131"/>
  </svg>
);

const HavloLogo = () => (
  <svg width="39" height="10" viewBox="0 0 78 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="14" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight="800" fontSize="14" fill="#313131" letterSpacing="-0.3">HAVLO</text>
  </svg>
);

const HamburgerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M2.4 5.7C2.4 5.4613 2.49472 5.23239 2.66351 5.0636C2.83229 4.89482 3.06121 4.8 3.3 4.8H20.7C20.9387 4.8 21.1676 4.89482 21.3364 5.0636C21.5052 5.23239 21.6 5.4613 21.6 5.7C21.6 5.93869 21.5052 6.16761 21.3364 6.3364C21.1676 6.50518 20.9387 6.6 20.7 6.6H3.3C3.06121 6.6 2.83229 6.50518 2.66351 6.3364C2.49472 6.16761 2.4 5.93869 2.4 5.7ZM2.4 12C2.4 11.7613 2.49472 11.5324 2.66351 11.3636C2.83229 11.1948 3.06121 11.1 3.3 11.1H20.7C20.9387 11.1 21.1676 11.1948 21.3364 11.3636C21.5052 11.5324 21.6 11.7613 21.6 12C21.6 12.2387 21.5052 12.4676 21.3364 12.6364C21.1676 12.8052 20.9387 12.9 20.7 12.9H3.3C3.06121 12.9 2.83229 12.8052 2.66351 12.6364C2.49472 12.4676 2.4 12.2387 2.4 12ZM2.4 18.3C2.4 18.0613 2.49472 17.8324 2.66351 17.6636C2.83229 17.4948 3.06121 17.4 3.3 17.4H20.7C20.9387 17.4 21.1676 17.4948 21.3364 17.6636C21.5052 17.8324 21.6 18.0613 21.6 18.3C21.6 18.5387 21.5052 18.7676 21.3364 18.9364C21.1676 19.1052 20.9387 19.2 20.7 19.2H3.3C3.06121 19.2 2.83229 19.1052 2.66351 18.9364C2.49472 18.7676 2.4 18.5387 2.4 18.3Z" fill="black"/>
  </svg>
);

const HouseIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:'hidden',flexShrink:0}}>
    <path d="M5 19.9825V24.1665C5 29.6662 5 32.416 6.70855 34.1247C8.41708 35.8332 11.1669 35.8332 16.6667 35.8332H23.3333C28.833 35.8332 31.5828 35.8332 33.2915 34.1247C35 32.416 35 29.6662 35 24.1665V19.9825C35 17.1803 35 15.7794 34.4068 14.5666C33.8137 13.3538 32.7078 12.4936 30.496 10.7734L27.1627 8.18075C23.7218 5.50459 22.0015 4.1665 20 4.1665C17.9985 4.1665 16.2782 5.50459 12.8374 8.18075L9.50402 10.7734C7.29222 12.4936 6.18632 13.3538 5.59317 14.5666C5 15.7794 5 17.1803 5 19.9825Z" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28.333 29.1667V22.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const BulbIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:'hidden',flexShrink:0}}>
    <path d="M10.149 24.9986C9.51836 23.5809 9.16675 22.0038 9.16675 20.3418C9.16675 14.1692 14.017 9.16528 20.0001 9.16528C25.9832 9.16528 30.8334 14.1692 30.8334 20.3418C30.8334 22.0038 30.4818 23.5809 29.8511 24.9986" stroke={PURPLE} strokeWidth="3" strokeLinecap="round"/>
    <path d="M20 3.33191V4.99858" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.6667 19.9988H35" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.99992 19.9988H3.33325" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M31.784 8.21313L30.6055 9.39165" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.39458 9.39324L8.21606 8.21472" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24.1951 32.1759C25.8791 31.6313 26.5544 30.0899 26.7444 28.5396C26.8011 28.0764 26.4201 27.6923 25.9534 27.6923L14.1282 27.6926C13.6455 27.6926 13.2579 28.1023 13.3155 28.5814C13.5016 30.1288 13.9713 31.2591 15.7558 32.1759M24.1951 32.1759C24.1951 32.1759 16.0496 32.1759 15.7558 32.1759M24.1951 32.1759C23.9926 35.4176 23.0564 36.7014 20.0114 36.6654C16.7544 36.7256 16.0051 35.1388 15.7558 32.1759" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const HandshakeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:'hidden',flexShrink:0}}>
    <path d="M36.6663 11.2498H32.0182C31.0163 11.2498 30.5153 11.2498 30.043 11.1068C29.5707 10.9638 29.1538 10.6859 28.3202 10.1302C27.0698 9.29655 25.6433 8.34559 24.9347 8.13104C24.2262 7.9165 23.4747 7.9165 21.9718 7.9165C19.9282 7.9165 18.6108 7.9165 17.692 8.2971C16.7732 8.6777 16.0506 9.40029 14.6055 10.8454L13.3337 12.1172C13.008 12.4429 12.8451 12.6058 12.7446 12.7665C12.3719 13.3625 12.4132 14.1283 12.8478 14.6807C12.9651 14.8297 13.1445 14.9741 13.5033 15.2629C14.8296 16.3302 16.7417 16.2237 17.9427 15.0155L19.9997 12.9463H21.6663L31.6663 23.0058C32.5868 23.9318 32.5868 25.433 31.6663 26.359C30.7458 27.285 29.2535 27.285 28.333 26.359L27.4997 25.5206M22.4997 27.1973L24.1663 28.8738C25.0868 29.7998 26.5792 29.7998 27.4997 28.8738C28.4202 27.948 28.4202 26.4466 27.4997 25.5206L22.4997 20.491M19.1663 23.864L22.4997 27.1973C23.4202 28.1231 23.4202 29.6245 22.4997 30.5505C21.5792 31.4763 20.0868 31.4763 19.1663 30.5505L16.6663 28.0355M3.33301 24.5831H3.86457C5.24647 24.5831 5.93744 24.5831 6.55692 24.8435C7.17641 25.104 7.65992 25.5975 8.62696 26.5846L13.333 31.3888C14.2535 32.3146 15.7459 32.3146 16.6663 31.3888C17.5868 30.4628 17.5868 28.9615 16.6663 28.0355L15.833 27.1973" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.6667 24.5835H32.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round"/>
    <path d="M14.1663 11.25H3.33301" stroke={PURPLE} strokeWidth="3" strokeLinecap="round"/>
  </svg>
);
const QuoteIcon = () => (
  <svg width="55.68" height="55.68" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M10.6321 40.1825C8.24261 37.6446 6.95972 34.7981 6.95972 30.1839C6.95972 22.0643 12.6597 14.7868 20.9486 11.1887L23.0202 14.3855C15.2834 18.5706 13.7709 24.0014 13.1677 27.4255C14.4135 26.7806 16.0443 26.5556 17.6427 26.704C21.8278 27.0915 25.1267 30.5272 25.1267 34.7981C25.1267 36.9515 24.2712 39.0168 22.7485 40.5395C21.2258 42.0622 19.1605 42.9177 17.0071 42.9177C15.8162 42.9074 14.6392 42.6603 13.5447 42.1907C12.4503 41.7211 11.4602 41.0385 10.6321 40.1825ZM33.8308 40.1825C31.4414 37.6446 30.1585 34.7981 30.1585 30.1839C30.1585 22.0643 35.8584 14.7868 44.1473 11.1887L46.219 14.3855C38.4822 18.5706 36.9696 24.0014 36.3665 27.4255C37.6122 26.7806 39.2431 26.5556 40.8415 26.704C45.0266 27.0915 48.3254 30.5272 48.3254 34.7981C48.3254 36.9515 47.47 39.0168 45.9473 40.5395C44.4245 42.0622 42.3593 42.9177 40.2059 42.9177C39.0149 42.9074 37.838 42.6603 36.7435 42.1907C35.649 41.7211 34.6589 41.0385 33.8308 40.1825Z" fill={PURPLE}/>
  </svg>
);
const TrustpilotStars = () => (
  <svg width="160" height="30" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <rect width="30" height="30" fill="#00B67A"/>
    <rect x="32.5" width="30" height="30" fill="#00B67A"/>
    <rect x="65" width="30" height="30" fill="#00B67A"/>
    <rect x="97.5" width="30" height="30" fill="#00B67A"/>
    <rect x="130" width="30" height="30" fill="#00B67A"/>
    <path d="M15 20.2183L19.5625 19.062L21.4687 24.937L15 20.2183ZM25.5 12.6245H17.4688L15 5.06201L12.5312 12.6245H4.5L11 17.312L8.53125 24.8745L15.0312 20.187L19.0312 17.312L25.5 12.6245Z" fill="white"/>
    <path d="M47.5 20.2183L52.0625 19.062L53.9687 24.937L47.5 20.2183ZM58 12.6245H49.9687L47.5 5.06201L45.0313 12.6245H37L43.5 17.312L41.0312 24.8745L47.5312 20.187L51.5312 17.312L58 12.6245Z" fill="white"/>
    <path d="M80 20.2183L84.5625 19.062L86.4688 24.937L80 20.2183ZM90.5 12.6245H82.4687L80 5.06201L77.5313 12.6245H69.5L76 17.312L73.5313 24.8745L80.0313 20.187L84.0312 17.312L90.5 12.6245Z" fill="white"/>
    <path d="M112.5 20.2183L117.063 19.062L118.969 24.937L112.5 20.2183ZM123 12.6245H114.969L112.5 5.06201L110.031 12.6245H102L108.5 17.312L106.031 24.8745L112.531 20.187L116.531 17.312L123 12.6245Z" fill="white"/>
    <path d="M145 20.2183L149.563 19.062L151.469 24.937L145 20.2183ZM155.5 12.6245H147.469L145 5.06201L142.531 12.6245H134.5L141 17.312L138.531 24.8745L145.031 20.187L149.031 17.312L155.5 12.6245Z" fill="white"/>
  </svg>
);
const VerifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M14.3733 7.16036L13.4667 6.10703C13.2933 5.90703 13.1533 5.5337 13.1533 5.26703V4.1337C13.1533 3.42703 12.5733 2.84703 11.8667 2.84703H10.7333C10.4733 2.84703 10.0933 2.70703 9.89334 2.5337L8.84 1.62703C8.38 1.2337 7.62667 1.2337 7.16 1.62703L6.11334 2.54036C5.91334 2.70703 5.53334 2.84703 5.27334 2.84703H4.12C3.41334 2.84703 2.83334 3.42703 2.83334 4.1337V5.2737C2.83334 5.5337 2.69334 5.90703 2.52667 6.10703L1.62667 7.16703C1.24 7.62703 1.24 8.3737 1.62667 8.8337L2.52667 9.8937C2.69334 10.0937 2.83334 10.467 2.83334 10.727V11.867C2.83334 12.5737 3.41334 13.1537 4.12 13.1537H5.27334C5.53334 13.1537 5.91334 13.2937 6.11334 13.467L7.16667 14.3737C7.62667 14.767 8.38 14.767 8.84667 14.3737L9.9 13.467C10.1 13.2937 10.4733 13.1537 10.74 13.1537H11.8733C12.58 13.1537 13.16 12.5737 13.16 11.867V10.7337C13.16 10.4737 13.3 10.0937 13.4733 9.8937L14.38 8.84036C14.7667 8.38036 14.7667 7.62036 14.3733 7.16036ZM10.7733 6.74036L7.55334 9.96036C7.46 10.0537 7.33334 10.107 7.2 10.107C7.06667 10.107 6.94 10.0537 6.84667 9.96036L5.23334 8.34703C5.04 8.1537 5.04 7.8337 5.23334 7.64036C5.42667 7.44703 5.74667 7.44703 5.94 7.64036L7.2 8.90036L10.0667 6.0337C10.26 5.84036 10.58 5.84036 10.7733 6.0337C10.9667 6.22703 10.9667 6.54703 10.7733 6.74036Z" fill="#149D4F"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M6 12H18" stroke="#020202" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 18V6" stroke="#020202" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const MinusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M6 12H18" stroke="#020202" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const HomeInputIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.9998 17.5V13.5" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const LinkIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M9.16992 13.8299C9.54992 14.3999 10.0499 14.8899 10.6299 15.2699C11.2099 15.6499 11.8699 15.9099 12.5799 16.0199C13.2899 16.1299 14.0099 16.0799 14.6999 15.8799C15.3899 15.6799 16.0199 15.3199 16.5499 14.8499L19.5499 12.1499C20.5099 11.2699 21.0499 10.0499 21.0499 8.77988C21.0499 7.50988 20.5099 6.28988 19.5499 5.40988C18.5899 4.52988 17.2999 4.02988 15.9499 4.02988C14.5999 4.02988 13.3099 4.52988 12.3499 5.40988L10.9199 6.71988" stroke="#313131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.8301 10.1699C14.4501 9.5999 13.9501 9.1099 13.3701 8.7299C12.7901 8.3499 12.1301 8.0899 11.4201 7.9799C10.7101 7.8699 9.99006 7.9199 9.30006 8.1199C8.61006 8.3199 7.98006 8.6799 7.45006 9.1499L4.45006 11.8499C3.49006 12.7299 2.95006 13.9499 2.95006 15.2199C2.95006 16.4899 3.49006 17.7099 4.45006 18.5899C5.41006 19.4699 6.70006 19.9699 8.05006 19.9699C9.40006 19.9699 10.6901 19.4699 11.6501 18.5899L13.0701 17.2799" stroke="#313131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0,transform:'matrix(0,-1,-1,0,0,0)'}}>
    <path d="M12 16V12M12 12L9 14M12 12L15 14" stroke="#313131" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 20H7C4.79086 20 3 18.2091 3 16V9C3 6.79086 4.79086 5 7 5H17C19.2091 5 21 6.79086 21 9V16C21 18.2091 19.2091 20 17 20H16" stroke="#313131" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PropertyDataIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M8.5 17.5L12 14L15.5 17.5M12 14V21M17.5 20H19C20.6569 20 22 18.6569 22 17C22 15.3431 20.6569 14 19 14C18.9872 14 18.9744 14.0003 18.9617 14.0009L19 14C19 11.2386 16.7614 9 14 9C12.8977 9 11.8734 9.36658 11.0555 10H10.5C8.01472 10 6 12.0147 6 14.5C4.34315 14.5 3 15.8431 3 17.5C3 19.1569 4.34315 20.5 6 20.5H8.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3L14 5H10L12 3Z" fill="#000"/>
  </svg>
);
const BuyerTrendsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M9 10C9 10.5523 8.55228 11 8 11C7.44772 11 7 10.5523 7 10C7 9.44772 7.44772 9 8 9C8.55228 9 9 9.44772 9 10Z" fill="#000" stroke="#000" strokeWidth="1.5"/>
    <path d="M14 10C14 10.5523 13.5523 11 13 11C12.4477 11 12 10.5523 12 10C12 9.44772 12.4477 9 13 9C13.5523 9 14 9.44772 14 10Z" fill="#000" stroke="#000" strokeWidth="1.5"/>
    <path d="M19 10C19 10.5523 18.5523 11 18 11C17.4477 11 17 10.5523 17 10C17 9.44772 17.4477 9 18 9C18.5523 9 19 9.44772 19 10Z" fill="#000" stroke="#000" strokeWidth="1.5"/>
    <path d="M3 9C3 6.79086 4.79086 5 7 5H17C19.2091 5 21 6.79086 21 9V15C21 17.2091 19.2091 19 17 19H8L4 21V15V9Z" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const AgentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="#000" strokeWidth="1.5"/>
    <path d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─── DATA ─── */
const ALL_FAQS = [
  { q: '1. What is StaleListings.com?', a: 'StaleListings.com helps homeowners identify what may be slowing down their home sale, with\npersonalized recommendations powered by property data and experienced local agent insights.' },
  { q: '2. Who is this for?', a: 'The platform is designed for:\n• homeowners preparing to sell\n• sellers already on the market\n• homeowners whose listings have gone stale\n• anyone wanting a second opinion on their sale strategy' },
  { q: '3. How does it work?', a: 'Simply enter your property details or upload your listing link. We analyze your home and provide\nactionable recommendations to improve buyer appeal and selling potential.' },
  { q: '4. Do I need to switch estate agents?', a: 'No. Our recommendations are designed to work alongside your current estate agent.' },
  { q: '5. Can I use this before listing my home?', a: 'Yes. Many homeowners use StaleListings.com before going live to avoid common listing mistakes.' },
  { q: '6. How long does the report take?', a: 'Most reports are delivered within 6–12 hours.' },
  { q: '7. What kind of recommendations will I receive?', a: 'Recommendations may include:\n• pricing insights\n• photo improvements\n• presentation tips\n• listing description feedback\n• buyer appeal suggestions\n• market positioning recommendations' },
  { q: '8. Is the analysis automated or reviewed by humans?', a: 'We combine data-driven analysis with experienced local property expertise.' },
  { q: '9. Will you contact my estate agent?', a: 'No, unless you specifically request it.' },
  { q: '10. What if my home is already listed?', a: "That's completely fine. The platform is specifically designed to help improve active listings." },
  { q: '11. Can this help if my home has been on the market for months?', a: 'Yes. Many sellers use StaleListings.com to identify overlooked issues affecting buyer interest.' },
  { q: '12. Do you guarantee my home will sell faster?', a: "No platform can guarantee a sale, but our goal is to help you improve your home's appeal and reduce avoidable listing mistakes." },
  { q: '13. What property websites do you support?', a: 'We currently support listings from major UK property portals including Rightmove and Zoopla.' },
  { q: '14. How detailed is the report?', a: 'Each report is personalized to your property and includes practical, actionable recommendations you can implement immediately.' },
  { q: '15. Is my information kept private?', a: 'Yes. Your property information and report details are kept confidential.' },
  { q: '16. Can I get another report after making changes?', a: 'Yes. You can request an updated analysis after implementing our recommendations.' },
  { q: '17. Do you work across the UK?', a: 'Yes. We support homeowners across the UK.' },
  { q: '18. Is this only for expensive homes?', a: 'No. Our insights are designed for properties across different budgets and markets.' },
  { q: '19. Why shouldn\'t I rely only on my estate agent?', a: 'Estate agents often manage multiple listings at once. StaleListings.com provides an additional layer of focused analysis to help uncover issues that may otherwise be overlooked.' },
  { q: '20. What makes StaleListings.com different?', a: 'We combine property data, buyer behaviour insights, and experienced local expertise to help homeowners make smarter selling decisions — without changing agents.' },
  { q: '21. Can estate agents use StaleListings.com?', a: 'Yes. Estate agents can use StaleListings.com to gain additional insights, strengthen listing performance, and provide more value to their clients. Our recommendations are designed to support agents, not replace them.' },
];

const TESTIMONIALS = [
  { text: 'After 3 months with barely any viewings, StaleListings helped us spot issues with our photos and pricing strategy. We updated the listing and received two offers within weeks', name: '— Sarah M.' },
  { text: 'Our estate agent was great, but having an extra layer of analysis made a huge difference. The recommendations were detailed, practical, and easy to implement.', name: '— James & Olivia R.' },
  { text: "We used StaleListings before putting our house on the market and avoided mistakes that probably would've cost us months. The report was incredibly helpful.", name: '— Daniel P.' },
  { text: 'The insights felt like having a second opinion from someone who actually understood buyer behaviour. Small changes made a surprisingly big impact.', name: '— Priya K.' },
  { text: 'Our listing had gone stale after 10 weeks. StaleListings identified presentation and description issues our agent never mentioned. Viewings picked up almost immediately', name: '— Emma L.' },
  { text: "What I liked most was that we didn't need to change agents. We simply used the recommendations alongside our current estate agent and improved the listing.", name: '— Michael T.' },
];

const PLANS = [
  {
    id: 'quick_insight', name: 'Quick Insight', price: '£79.99',
    tagline: 'Vendors wanting a fast professional opinion.',
    turnaround: 'Turnaround: 24–48 hours',
    features: ['Data-driven property market analysis','Human estate agent review','Local comparable sales review','Pricing position check','Online listing performance review','Summary report with key issues slowing the sale','3–5 actionable recommendations'],
    popular: false,
  },
  {
    id: 'professional_review', name: 'Professional Review', price: '£299.99',
    tagline: 'Serious sellers wanting expert guidance to improve saleability.',
    preNote: 'Includes everything in Quick Insight, plus',
    preNoteDetail: 'a detailed review by an estate agent actively selling similar properties in the local area.',
    turnaround: 'Turnaround: 24 hours',
    features: ['Buyer appeal analysis','Listing photography & description review','Local competition benchmarking','"Why buyers may be overlooking this property" section','Recommended pricing strategy','Priority turnaround'],
    popular: true,
  },
  {
    id: 'premium_strategy', name: 'Premium Strategy', price: '£1,499.99',
    tagline: 'High-value homes or properties stuck on the market for months.',
    preNote: 'Includes everything in professional review plus:',
    turnaround: '24 hours + follow-up support',
    features: ['Detailed property positioning strategy','Multi-platform listing audit','Area demand and buyer demographic analysis','Home presentation/staging recommendations','Marketing improvement roadmap','Re-launch strategy','Estate agent strategy review with improvement recommendations','Follow-up review after changes are implemented','Direct access for Q&A support for 14–30 days'],
    popular: false,
  },
];

/* ── HOUSE ILLUSTRATIONS ── */
const HouseBlue = () => (
  <svg width="157" height="122" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#4A90D9"/>
    <polygon points="78.5,8 8,55 149,55" fill="#2D6BB5"/>
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#1A4A80"/>
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#A8D4F5"/>
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#7ABDE8"/>
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#A8D4F5"/>
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#7ABDE8"/>
    <circle cx="77" cy="97" r="3" fill="#A8D4F5"/>
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#F5A623"/>
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#F5A623"/>
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#4A90D9"/>
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#2D6BB5"/>
  </svg>
);
const HouseOrange = () => (
  <svg width="157" height="122" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#F5A623"/>
    <polygon points="78.5,8 8,55 149,55" fill="#D4831A"/>
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#8B5209"/>
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#FDE8BB"/>
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#F5C870"/>
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#FDE8BB"/>
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#F5C870"/>
    <circle cx="77" cy="97" r="3" fill="#FDE8BB"/>
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#E84393"/>
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#E84393"/>
    <circle cx="120" cy="22" r="10" fill="#F5E642" opacity="0.9"/>
    <circle cx="120" cy="22" r="6" fill="#F5E642"/>
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#F5A623"/>
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#D4831A"/>
  </svg>
);
const HouseTeal = () => (
  <svg width="157" height="122" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#2ABFBF"/>
    <polygon points="78.5,8 8,55 149,55" fill="#1A9090"/>
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#0D5A5A"/>
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#AAEAEA"/>
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#5DCFCF"/>
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#AAEAEA"/>
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#5DCFCF"/>
    <circle cx="77" cy="97" r="3" fill="#AAEAEA"/>
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#F5D742"/>
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#F5D742"/>
    <circle cx="120" cy="20" r="8" fill="#F5D742" opacity="0.8"/>
    <line x1="120" y1="10" x2="120" y2="4" stroke="#F5D742" strokeWidth="2"/>
    <line x1="126" y1="13" x2="130" y2="9" stroke="#F5D742" strokeWidth="2"/>
    <line x1="130" y1="20" x2="136" y2="20" stroke="#F5D742" strokeWidth="2"/>
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#2ABFBF"/>
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#1A9090"/>
  </svg>
);
const HOUSE_ICONS = [HouseBlue, HouseOrange, HouseTeal];

/* ─── FAQ ITEM ─── */
function FAQItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="sl-faq-item">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', alignSelf:'stretch', gap:8 }}>
          <div className="sl-faq-q">{q}</div>
          <button onClick={() => setOpen(!open)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', flexShrink:0 }}>
            {open ? <MinusIcon /> : <PlusIcon />}
          </button>
        </div>
        {open && (
          <div className="sl-faq-a">{a}</div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export function StaleListingsLanding() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [showAllFaq, setShowAllFaq] = useState(false);

  const handleStart = () => {
    const params = new URLSearchParams();
    const v = input.trim();
    if (v) {
      if (v.startsWith('http') || v.includes('rightmove') || v.includes('zoopla') || v.includes('onthemarket')) {
        params.set('url', v);
      } else {
        params.set('address', v);
      }
    }
    navigate(`/stale-listings/questions${params.toString() ? '?' + params.toString() : ''}`);
  };

  const faqsToShow = showAllFaq ? ALL_FAQS : ALL_FAQS.slice(0, 5);

  return (
    <div style={{ fontFamily:'Inter, sans-serif', background:'#fff', minHeight:'100vh', overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap');

        /* ── DESKTOP-ONLY ELEMENTS ── */
        .sl-nav-links { display:flex; }
        .sl-nav-cta-desktop { display:flex; }
        .sl-hero-right { display:flex !important; }
        .sl-features-cols { display:flex; flex-direction:row; }
        .sl-testimonial-row { display:flex; flex-direction:row; }
        .sl-hamburger { display:none !important; }

        /* ── FAQ ITEM SHARED ── */
        .sl-faq-item {
          display:flex;
          padding:24px 0;
          justify-content:center;
          align-items:center;
          gap:8px;
          align-self:stretch;
          border-bottom:1px solid rgba(0,0,0,0.10);
        }
        .sl-faq-q {
          color:#000;
          font-family:'Plus Jakarta Sans', sans-serif;
          font-size:20px;
          font-weight:700;
          line-height:150%;
          letter-spacing:-0.02em;
        }
        .sl-faq-a {
          align-self:stretch;
          color:#000;
          font-family:Inter, sans-serif;
          font-size:18px;
          font-weight:400;
          line-height:150%;
          letter-spacing:-0.003em;
          white-space:pre-line;
        }

        /* ── TABLET ── */
        @media(max-width:1024px) {
          .sl-hero-right { display:none !important; }
          .sl-hero-inner { padding:60px 40px !important; }
          .sl-features-cols { flex-direction:column !important; }
          .sl-testimonial-row { flex-direction:column !important; gap:16px !important; }
          .sl-testimonial-card { flex:0 0 auto !important; width:100% !important; box-sizing:border-box !important; }
          .sl-hero-heading { font-size:38px !important; }
          .sl-features-section { padding:60px 40px !important; }
          .sl-how-section { padding:40px 40px !important; }
          .sl-testimonials-section { padding:60px 40px !important; }
          .sl-faq-section { padding:60px 40px !important; }
          .sl-pricing-section { padding:60px 40px !important; }
          .sl-nav-links { display:none !important; }
          .sl-step-card { padding:32px !important; }
          .sl-step-float { display:none !important; }
          .sl-input-bar { max-width:100% !important; width:100% !important; }
          .sl-hamburger { display:flex !important; }
          .sl-nav-cta-desktop { display:none !important; }
        }

        /* ── MOBILE ── */
        @media(max-width:640px) {
          /* Inner containers — remove 100px side padding */
          .sl-inner-container {
            padding-left:16px !important;
            padding-right:16px !important;
          }

          /* Navbar */
          .sl-navbar {
            height:80px !important;
            padding:0 !important;
          }

          /* Hero */
          .sl-hero-inner {
            flex-direction:column !important;
            padding:32px 16px 40px !important;
            gap:0 !important;
          }
          .sl-hero-left {
            width:100% !important;
            max-width:100% !important;
            flex-shrink:1 !important;
            gap:28px !important;
          }
          .sl-hero-right {
            display:none !important;
          }
          .sl-hero-img-mobile {
            display:block !important;
          }
          .sl-hero-heading {
            font-size:40px !important;
            letter-spacing:-0.03em !important;
            line-height:120% !important;
          }
          .sl-hero-desc {
            font-size:14px !important;
            letter-spacing:-0.02em !important;
          }
          .sl-hero-head-group {
            gap:20px !important;
          }
          .sl-input-bar {
            width:100% !important;
            max-width:100% !important;
            height:56px !important;
            padding:4px 4px 4px 12px !important;
          }
          .sl-input-btn {
            width:auto !important;
            font-size:14px !important;
            padding:12px 14px !important;
            border-radius:10px !important;
          }
          .sl-trustpilot-row {
            flex-direction:column !important;
            align-items:flex-start !important;
            gap:8px !important;
          }
          .sl-trustpilot-inner {
            flex-direction:row !important;
            align-items:center !important;
            gap:8px !important;
          }
          .sl-trustpilot-excellent {
            font-size:16px !important;
          }
          .sl-trustpilot-label {
            font-size:14px !important;
          }
          .sl-stats-row {
            gap:12px !important;
          }
          .sl-stat-item {
            gap:20px !important;
          }
          .sl-stat-val {
            font-size:24px !important;
            letter-spacing:-0.03em !important;
          }
          .sl-stat-label {
            font-size:12px !important;
            width:76px !important;
          }

          /* Features */
          .sl-features-section {
            padding:40px 16px !important;
          }
          .sl-features-heading {
            font-size:28px !important;
            letter-spacing:-0.02em !important;
            line-height:130% !important;
          }
          .sl-features-cols {
            flex-direction:column !important;
          }
          .sl-features-inner {
            gap:48px !important;
          }
          .sl-feature-item {
            gap:24px !important;
          }
          .sl-feature-title-large {
            font-size:24px !important;
          }
          .sl-feature-title-small {
            font-size:20px !important;
          }
          .sl-feature-desc {
            font-size:16px !important;
          }

          /* How it works */
          .sl-how-section {
            padding:24px 16px !important;
          }
          .sl-step-card {
            padding:24px 20px !important;
            border-radius:24px !important;
            gap:20px !important;
          }
          .sl-step-badge {
            height:40px !important;
            padding:10px 16px !important;
            font-size:14px !important;
          }
          .sl-step-title {
            font-size:28px !important;
            letter-spacing:-0.02em !important;
          }
          .sl-step-desc {
            font-size:16px !important;
          }
          .sl-step-float { display:none !important; }

          /* Testimonials */
          .sl-testimonials-section {
            padding:40px 16px !important;
          }
          .sl-testimonials-heading {
            font-size:28px !important;
            letter-spacing:-0.03em !important;
          }
          .sl-testimonial-row {
            display: none !important;
          }
          .sl-testimonial-scroll-wrap {
            display: block !important;
          }
          .sl-testimonial-card {
            flex: 0 0 auto !important;
            width: 100% !important;
            min-height: unset !important;
            box-sizing: border-box !important;
            gap: 16px !important;
          }
          .sl-testimonial-text {
            font-size: 14px !important;
            letter-spacing: -0.01em !important;
          }
          .sl-testimonial-name {
            font-size: 14px !important;
          }
          @keyframes sl-scroll-up {
            0%   { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }

          /* FAQ */
          .sl-faq-section {
            padding:40px 16px !important;
          }
          .sl-faq-heading {
            font-size:44px !important;
            line-height:110% !important;
          }

          /* Pricing */
          .sl-pricing-section {
            padding:40px 16px !important;
          }
          .sl-pricing-heading {
            font-size:28px !important;
            letter-spacing:-0.02em !important;
          }
          .sl-pricing-desc {
            font-size:16px !important;
          }
          .sl-pricing-cols {
            flex-direction:column !important;
            gap:24px !important;
          }
          .sl-plan-card {
            border-radius:32px !important;
          }

          /* Footer */
          .sl-footer {
            padding:24px 16px !important;
            flex-direction:column !important;
            gap:12px !important;
            align-items:flex-start !important;
          }
          .sl-footer-links {
            gap:16px !important;
          }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header
        className="sl-navbar"
        style={{
          background:'#FFF',
          borderBottom:'1px solid #F4F4F4',
          backdropFilter:'blur(5px)',
          position:'sticky',
          top:0,
          zIndex:50,
          height:80,
          display:'flex',
          alignItems:'center',
          boxSizing:'border-box',
          padding:'0 100px',
        }}
      >
        <div className="sl-inner-container" style={{ width:'100%', maxWidth:1440, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Logo */}
          <div className="sl-nav-logo-wrap" style={{ display:'flex', alignItems:'center' }}>
            <img src="/stale-logo.png" alt="StaleListings" style={{ height:40, width:'auto', flexShrink:0, display:'block' }} />
          </div>

          {/* Nav + CTA (desktop) */}
          <div style={{ display:'flex', alignItems:'center', gap:32 }}>
            <nav className="sl-nav-links" style={{ display:'flex', alignItems:'center', gap:40 }}>
              {[['How it works','#how-it-works'],['Faq','#faq'],['Pricing','#pricing']].map(([label, href], i) => (
                <a key={i} href={href} style={{ color:'#000', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:600, letterSpacing:'-0.02em', opacity:0.8, textDecoration:'none' }}>{label}</a>
              ))}
            </nav>
            <button
              className="sl-nav-cta-desktop"
              onClick={handleStart}
              style={{ display:'flex', height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000', color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}
            >
              Start Assessment
            </button>
          </div>

          {/* Hamburger (mobile/tablet) */}
          <button
            className="sl-hamburger"
            style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'none', alignItems:'center' }}
          >
            <HamburgerIcon />
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="sl-hero-section" style={{ background:'#FEFEFE', overflow:'hidden', position:'relative' }}>
        {/* Pink blob */}
        <div style={{ position:'absolute', left:-67, top:-99, width:524, height:736, borderRadius:'50%', background:'#FFB0E6', filter:'blur(213.468px)', pointerEvents:'none', zIndex:0 }} />

        <div
          className="sl-hero-inner"
          style={{ maxWidth:1440, margin:'0 auto', padding:'92px 100px 73px', position:'relative', zIndex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between', boxSizing:'border-box' }}
        >
          {/* Left column */}
          <div className="sl-hero-left" style={{ width:657, flexShrink:0, display:'flex', flexDirection:'column', gap:43 }}>

            {/* Heading + description */}
            <div className="sl-hero-head-group" style={{ display:'flex', flexDirection:'column', gap:48 }}>
              <h1
                className="sl-hero-heading"
                style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:800, fontSize:56, lineHeight:'110%', letterSpacing:'-0.03em', margin:0 }}
              >
                <span style={{ color:'#1F1F1E' }}>Don't Let Your Home Sit </span>
                <span style={{ color:PURPLE }}>on the Market</span>
              </h1>
              <p className="sl-hero-desc" style={{ fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:400, color:'#000000', lineHeight:'150%', letterSpacing:'-0.02em', margin:0 }}>
                Whether you're preparing to sell or already on the market, get personalised insights combining data-driven analysis with experienced local agent expertise to help your home sell faster — all while working with your current agent, no switching required.
              </p>
            </div>

            {/* Input + trust */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div
                className="sl-input-bar"
                style={{ display:'flex', flexDirection:'row', alignItems:'center', width:570, height:56, padding:'4px 4px 4px 16px', boxSizing:'border-box', background:'#EEF0F2', borderBottom:'1px solid rgba(0,0,0,0.05)', borderRadius:12, gap:8 }}
              >
                <HomeInputIcon />
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStart()}
                  placeholder="Enter property address or Rightmove/Zoopla URL…"
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:14, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'17px', minWidth:0 }}
                />
                <button
                  className="sl-input-btn"
                  onClick={handleStart}
                  style={{ display:'flex', width:169, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, background:'#000000', color:'#FFFFFF', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:16, letterSpacing:'-0.02em', borderRadius:12, border:'none', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
                >
                  Assess my home
                </button>
              </div>

              {/* Trustpilot row */}
              <div className="sl-trustpilot-row" style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div className="sl-trustpilot-inner" style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <TrustpilotStars />
                  <span className="sl-trustpilot-excellent" style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:20, color:'#040504', letterSpacing:'-0.02em', lineHeight:'100%', whiteSpace:'nowrap' }}>Excellent</span>
                </div>
                <span className="sl-trustpilot-label" style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:16, color:'#000000', letterSpacing:'-0.02em', lineHeight:'150%' }}>Based on verified customer feedback</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="sl-stats-row" style={{ display:'flex', alignItems:'flex-start', gap:23 }}>
              {[
                ['10K+','Listings Analyzed'],
                ['91K+','Seller Recommendations'],
                ['250K+','Market Signals Analyzed'],
              ].map(([val, label], i) => (
                <div key={i} className="sl-stat-item" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4, flex:1 }}>
                  <div className="sl-stat-val" style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:32, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>{val}</div>
                  <div className="sl-stat-label" style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:14, color:'#000000', letterSpacing:'-0.02em', lineHeight:'150%' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Hero image — mobile only, below stats */}
            <div className="sl-hero-img-mobile" style={{ display:'none', width:'100%', height:350, borderRadius:30.45, overflow:'hidden', flexShrink:0 }}>
              <img src="/stale-hero-house.png" alt="Property" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
          </div>

          {/* Right column — hero image (desktop only) */}
          <div
            className="sl-hero-right"
            style={{ width:582, height:568, borderRadius:30.45, overflow:'hidden', flexShrink:0, marginLeft:40 }}
          >
            <img
              src="/stale-hero-house.png"
              alt="Property"
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="sl-features-section" style={{ padding:'80px 100px', background:'#FFFFFF' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', gap:48, alignItems:'flex-start' }}>
          <h2
            className="sl-features-heading"
            style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:48, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%', margin:0, maxWidth:713 }}
          >
            Homes that sit too long lose buyer attention. Yours doesn't have to.
          </h2>
          <div
            className="sl-features-cols sl-features-inner"
            style={{ display:'flex', flexDirection:'row', gap:24, alignSelf:'stretch', width:'100%' }}
          >
            {[
              { Icon: HouseIcon, title:'Spot What Buyers Notice', titleClass:'sl-feature-title-large', desc:'Uncover the small issues that can reduce buyer interest and slow down your sale.' },
              { Icon: BulbIcon, title:'Expert-Backed Selling Insights', titleClass:'sl-feature-title-small', desc:'Combine data-driven analysis with experienced local property expertise.' },
              { Icon: HandshakeIcon, title:'Works With Your Current Agent', titleClass:'sl-feature-title-small', desc:'Use our recommendations alongside your existing estate agent, no switching required.' },
            ].map(({ Icon, title, titleClass, desc }, i) => (
              <div key={i} className="sl-feature-item" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:50, flex:'1 0 0' }}>
                <Icon />
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16, alignSelf:'stretch' }}>
                  <div className={titleClass} style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize: i===0 ? 32 : 28, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>{title}</div>
                  <div className="sl-feature-desc" style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="sl-how-section" style={{ padding:'40px 100px', background:'#FFFFFF' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', gap:24 }}>

          {/* Step 1 */}
          <div className="sl-step-card" style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden', position:'relative', isolation:'isolate', boxSizing:'border-box' }}>
            <div className="sl-step-badge" style={{ display:'flex', height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', borderRadius:48, background:'#000', zIndex:1, boxSizing:'border-box' }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Step 1</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16, flex:'1 0 0', zIndex:1 }}>
              <div className="sl-step-title" style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>Tell Us About Your Home</div>
              <div className="sl-step-desc" style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%', maxWidth:514 }}>Enter your property details, upload your listing, or share your Rightmove/Zoopla link to start your analysis.</div>
            </div>
            <div className="sl-step-float" style={{ position:'absolute', right:-144, top:40, width:679, padding:32, display:'flex', flexDirection:'column', gap:32, borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', zIndex:3, boxSizing:'border-box' }}>
              {[
                { Icon: HomeInputIcon, label:'Enter property address…' },
                { Icon: LinkIcon, label:'Paste Rightmove / Zoopla URL…' },
                { Icon: UploadIcon, label:'Upload listing document' },
              ].map(({ Icon, label }, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'row', alignItems:'center', padding:'13px 16px', gap:12, height:56, background:'#EEF0F2', borderBottom:'1px solid rgba(0,0,0,0.02)', borderRadius:8, boxSizing:'border-box' }}>
                  <Icon />
                  <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:14, color:'#666666', letterSpacing:'-0.03em' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div className="sl-step-card" style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden', position:'relative', isolation:'isolate', boxSizing:'border-box' }}>
            <div className="sl-step-badge" style={{ display:'flex', height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', borderRadius:48, background:'#000', zIndex:1, boxSizing:'border-box' }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Step 2</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16, flex:'1 0 0', zIndex:1 }}>
              <div className="sl-step-title" style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>Get personalized selling insights</div>
              <div className="sl-step-desc" style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%', maxWidth:580 }}>We analyse your home using property data, buyer trends, and experienced local agent expertise to uncover what could improve your sale.</div>
            </div>
            <div className="sl-step-float" style={{ position:'absolute', right:-144, top:40, width:679, padding:32, display:'flex', flexDirection:'column', gap:32, borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', zIndex:3, boxSizing:'border-box' }}>
              {[
                { Icon: PropertyDataIcon, title:'Property data', sub:'Pricing trends & comparables' },
                { Icon: BuyerTrendsIcon, title:'Buyer trends', sub:'What buyers are searching for' },
                { Icon: AgentIcon, title:'Local agent expertise', sub:'Human insight, not just algorithms' },
              ].map(({ Icon, title, sub }, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'row', alignItems:'center', padding:16, gap:12, height:73, background:'#EEF0F2', borderBottom:'1px solid rgba(0,0,0,0.02)', borderRadius:8, boxSizing:'border-box' }}>
                  <Icon />
                  <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1 }}>
                    <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:600, fontSize:16, color:'#000000', letterSpacing:'-0.03em', lineHeight:'19px' }}>{title}</span>
                    <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:14, color:'#666666', letterSpacing:'-0.03em', lineHeight:'17px' }}>{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="sl-step-card" style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden', position:'relative', isolation:'isolate', boxSizing:'border-box' }}>
            <div className="sl-step-badge" style={{ display:'flex', height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', borderRadius:48, background:'#000', zIndex:1, boxSizing:'border-box' }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Step 3</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16, flex:'1 0 0', zIndex:1 }}>
              <div className="sl-step-title" style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>Improve your chances of a faster sale</div>
              <div className="sl-step-desc" style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%', maxWidth:661 }}>Receive your expert report within 6–12 hours, with actionable recommendations you can implement alongside your current estate agent.</div>
            </div>
            <div className="sl-step-float" style={{ position:'absolute', right:-192, top:46, width:679, padding:32, display:'flex', flexDirection:'column', gap:37, borderRadius:'32px 32px 0px 0px', border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', zIndex:3, boxSizing:'border-box' }}>
              <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'24px', textTransform:'uppercase' }}>Your report includes</span>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {['Pricing insights','Photo improvements','Listing description feedback','Buyer appeal suggestions','Market positioning recommendations'].map((item, i) => (
                  <div key={i} style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:18, color:'#000000', letterSpacing:'-0.03em', lineHeight:'200%' }}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="sl-testimonials-section" style={{ padding:'80px 100px', background:'#EEF0F2' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', gap:24 }}>
          <h2 className="sl-testimonials-heading" style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:48, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%', margin:0, maxWidth:713 }}>
            See why sellers trust our insights
          </h2>
          {/* Row 1 */}
          <div className="sl-testimonial-row" style={{ display:'flex', flexDirection:'row', alignItems:'stretch', gap:16 }}>
            {TESTIMONIALS.slice(0, 3).map((t, i) => (
              <div key={i} className="sl-testimonial-card" style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'1 0 0', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFFFFF', overflow:'hidden', boxSizing:'border-box' }}>
                <QuoteIcon />
                <div className="sl-testimonial-text" style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>"{t.text}"</div>
                <div className="sl-testimonial-name" style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>{t.name}</div>
              </div>
            ))}
          </div>
          {/* Row 2 */}
          <div className="sl-testimonial-row" style={{ display:'flex', flexDirection:'row', alignItems:'stretch', gap:16 }}>
            {TESTIMONIALS.slice(3).map((t, i) => (
              <div key={i} className="sl-testimonial-card" style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'1 0 0', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFFFFF', overflow:'hidden', boxSizing:'border-box' }}>
                <QuoteIcon />
                <div className="sl-testimonial-text" style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>"{t.text}"</div>
                <div className="sl-testimonial-name" style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>{t.name}</div>
              </div>
            ))}
          </div>

          {/* Mobile vertical auto-scroll — hidden on desktop, shown on mobile via CSS */}
          <div className="sl-testimonial-scroll-wrap" style={{ display:'none', height:460, overflow:'hidden', position:'relative' }}>
            <div style={{ animation:'sl-scroll-up 28s linear infinite', display:'flex', flexDirection:'column', gap:16 }}>
              {/* Cards rendered twice for seamless loop */}
              {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                <div key={i} className="sl-testimonial-card" style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:16, borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFFFFF', overflow:'hidden', boxSizing:'border-box', width:'100%' }}>
                  <QuoteIcon />
                  <div className="sl-testimonial-text" style={{ fontFamily:'Inter, sans-serif', fontSize:14, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.01em' }}>"{t.text}"</div>
                  <div className="sl-testimonial-name" style={{ fontFamily:'Inter, sans-serif', fontSize:14, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em' }}>{t.name}</div>
                </div>
              ))}
            </div>
            {/* Fade-in gradient overlay at top */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:120, background:'linear-gradient(to top, rgba(238,240,242,0) 0%, #EEF0F2 100%)', pointerEvents:'none' }} />
            {/* Fade-out gradient overlay at bottom */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:120, background:'linear-gradient(to bottom, rgba(238,240,242,0) 0%, #EEF0F2 100%)', pointerEvents:'none' }} />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="sl-faq-section" style={{ padding:'80px 200px', background:'#FEFFFF' }}>
        <div style={{ maxWidth:1440, margin:'0 auto' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:40, maxWidth:'100%' }}>
            <h2 className="sl-faq-heading" style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:900, fontSize:44, color:'#050405', lineHeight:'110%', margin:0, textAlign:'center' }}>Everything you need to know</h2>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'stretch', gap:0, alignSelf:'stretch' }}>
              {faqsToShow.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} defaultOpen={i < 2} />
              ))}
            </div>
            <button
              onClick={() => setShowAllFaq(!showAllFaq)}
              style={{ display:'flex', height:44, padding:'8px 32px', justifyContent:'center', alignItems:'center', gap:8, background:'#000', border:'none', cursor:'pointer' }}
            >
              <span style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:16, color:'#FEFFFF', letterSpacing:'-0.02em' }}>
                {showAllFaq ? 'See Less' : 'Load more'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="sl-pricing-section" style={{ padding:'80px 100px', background:'#FFB0E6' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
          <h2
            className="sl-pricing-heading"
            style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%', margin:0, maxWidth:858, textAlign:'center' }}
          >
            Find out why your property isn't selling and what you can do to improve it.
          </h2>
          <p
            className="sl-pricing-desc"
            style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:16, color:'#000000', letterSpacing:'-0.02em', lineHeight:'150%', margin:0, maxWidth:734, textAlign:'center' }}
          >
            Get expert insights, market analysis, and professional recommendations designed to help position your property more effectively and attract the right buyers faster.
          </p>
          {/* Plan cards */}
          <div className="sl-pricing-cols" style={{ display:'flex', flexDirection:'row', gap:16, alignSelf:'stretch', alignItems:'stretch', width:'100%' }}>
            {PLANS.map((plan, i) => {
              const PlanHouseIcon = HOUSE_ICONS[i];
              const isPopular = plan.popular;
              return (
                <div
                  key={i}
                  className="sl-plan-card"
                  style={{ position:'relative', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:24, gap:32, flex:'1 0 0', background:'#FFFFFF', border: isPopular ? '2px solid #1A6B6B' : '1px solid rgba(0,0,0,0.05)', borderRadius:32, boxSizing:'border-box' }}
                >
                  {isPopular && (
                    <div style={{ position:'absolute', top:20, right:20, background:'#E53935', color:'#fff', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.5px', padding:'4px 10px', borderRadius:20, textTransform:'uppercase' }}>
                      BEST VALUE
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:32 }}>
                    <PlanHouseIcon />
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, alignSelf:'stretch' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:20, alignSelf:'stretch' }}>
                        <div style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:24, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%' }}>{plan.name}</div>
                        <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:16, color:'#000000', letterSpacing:'-0.03em', lineHeight:'120%' }}>{plan.tagline}</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:16, paddingTop:16, borderTop:'1px solid rgba(0,0,0,0.1)', alignSelf:'stretch' }}>
                        {(plan as any).preNote && (
                          <div style={{ fontFamily:'Inter, sans-serif', fontSize:14, letterSpacing:'-0.03em', lineHeight:'130%' }}>
                            <span style={{ fontWeight:700, color:'#050405' }}>{(plan as any).preNote}:</span>
                            {(plan as any).preNoteDetail && (
                              <span style={{ fontWeight:400, color:'#050405' }}> {(plan as any).preNoteDetail}</span>
                            )}
                          </div>
                        )}
                        {plan.features.map((feat, j) => (
                          <div key={j} style={{ display:'flex', flexDirection:'row', alignItems:'flex-start', gap:8 }}>
                            <VerifyIcon />
                            <span style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:14, color:'#050405', letterSpacing:'-0.03em', lineHeight:'120%', flex:1 }}>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                    <div style={{ display:'flex', justifyContent:'center', padding:'10px 12px', borderRadius:10, background:'#FAEBFE', alignSelf:'stretch' }}>
                      <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:14, color:'#602ED3', letterSpacing:'-0.02em', lineHeight:'130%' }}>{(plan as any).turnaround}</span>
                    </div>
                    <div style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:24, color:'#000000', letterSpacing:'-0.03em', lineHeight:'120%', alignSelf:'stretch', textAlign:'center' }}>
                      {plan.price} per report
                    </div>
                    <button
                      onClick={handleStart}
                      style={{ display:'flex', height:44, padding:'8px', justifyContent:'center', alignItems:'center', gap:8, borderRadius:10, background: isPopular ? '#F5A623' : '#000000', color: isPopular ? '#000' : '#FFFFFF', fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:16, letterSpacing:'-0.02em', border:'none', cursor:'pointer', alignSelf:'stretch' }}
                    >
                      Start Assessment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div
          className="sl-footer sl-inner-container"
          style={{ maxWidth:1440, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, padding:'28px 100px', borderTop:'1px solid #EFEFEF', background:'#fff' }}
        >
          <span style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:800, fontSize:20, color:'#1F1F1E', letterSpacing:'-0.5px', flexShrink:0 }}>StaleListings</span>
          <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:14, color:'#1F1F1E', textAlign:'center' }}>© 2025 StaleListings. All rights reserved.</span>
          <div className="sl-footer-links" style={{ display:'flex', gap:24, flexShrink:0 }}>
            <a href="/privacy-policy" style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:14, color:'#1F1F1E', textDecoration:'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:14, color:'#1F1F1E', textDecoration:'none' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
