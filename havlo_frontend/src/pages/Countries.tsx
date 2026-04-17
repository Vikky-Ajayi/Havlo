import React from 'react';
import { cn } from '../lib/utils';

const regions = [
  {
    name: 'Europe',
    countries: [
      { name: 'United Kingdom', description: 'A globally trusted market with strong property rights and a transparent legal system. UK property is often viewed as a safe long-term store of value, particularly during periods of global uncertainty, with consistent rental demand in major cities.', flag: 'gb' },
      { name: 'Spain', description: 'Spain offers an unbeatable mix of sun, lifestyle, and rental demand. Coastal and city properties benefit from strong tourism-led rentals, while attractive pricing compared to other Western European markets continues to draw international buyers.', flag: 'es' },
      { name: 'Portugal', description: 'Portugal combines quality of life, political stability, and investor-friendly policies. Lisbon, Porto, and the Algarve remain popular for both rentals and lifestyle buyers, supported by strong international demand and modern infrastructure.', flag: 'pt' },
      { name: 'France', description: 'France appeals to buyers seeking prestige, stability, and long-term value. From Paris to Provence and the Côte d’Azur, the market offers resilient demand, world-class lifestyle appeal, and a well-established legal framework.', flag: 'fr' },
      { name: 'Italy', description: 'Italy attracts buyers with its historic charm, diverse regions, and attractive pricing in many areas. From Tuscan countryside homes to revitalised villages and southern regions, Italy offers lifestyle value with growing international interest.', flag: 'it' },
      { name: 'Greece', description: 'Greece combines Mediterranean lifestyle, island living, and strong tourism demand. The country’s Golden Visa programme and improving infrastructure continue to make it attractive for both lifestyle buyers and investors.', flag: 'gr' },
      { name: 'Cyprus', description: 'Cyprus is known for its tax-friendly environment, English-speaking legal system, and large expat community. Coastal properties and new developments attract buyers seeking ease of ownership and year-round sunshine.', flag: 'cy' },
      { name: 'Turkey', description: 'Turkey offers attractive entry prices, growing tourism demand, and a citizenship-by-investment route that continues to draw international buyers. Istanbul and coastal regions like Antalya benefit from strong rental activity and long-term lifestyle appeal.', flag: 'tr' },
      { name: 'Croatia', description: 'Croatia’s Adriatic coastline has become a high-demand tourism market, supporting strong seasonal rental yields. Limited coastline supply and rising international visibility continue to support long-term growth potential.', flag: 'hr' },
      { name: 'Montenegro', description: 'An emerging Mediterranean hotspot offering early-stage investment opportunities. Montenegro attracts buyers seeking coastal lifestyle, improving infrastructure, and long-term upside as international demand grows.', flag: 'me' },
      { name: 'Malta', description: 'Malta appeals to buyers seeking EU access, residency options, and a stable English-speaking environment. Strong rental demand and limited land supply support long-term value in a compact, well-regulated market.', flag: 'mt' },
      { name: 'Bulgaria', description: 'Bulgaria offers low entry prices and improving yields, particularly in major cities and emerging resort areas. It appeals to value-driven investors looking for affordability within the EU.', flag: 'bg' },
      { name: 'Hungary', description: 'Hungary, led by Budapest, offers competitive entry prices alongside steady rental demand from a growing expat and student population. EU membership and improving infrastructure continue to attract value-focused international investors.', flag: 'hu' },
      { name: 'Romania', description: 'Romania is one of Eastern Europe’s fastest-growing economies, with Bucharest and Cluj-Napoca emerging as attractive investment markets. Affordable pricing, rising yields, and a young urban population support long-term growth potential.', flag: 'ro' },
      { name: 'Poland', description: 'Poland combines a resilient economy with strong rental markets in cities like Warsaw, Kraków, and Wrocław. Robust demand from professionals and students underpins consistent yields, making it a stable choice for European investors.', flag: 'pl' },
      { name: 'Czech Republic', description: 'The Czech Republic offers a stable, well-regulated property market anchored by Prague’s strong tourism and rental demand. Limited new supply in the capital and steady international interest support long-term capital appreciation.', flag: 'cz' },
      { name: 'Ireland', description: 'Ireland combines a stable legal framework, English-speaking environment, and strong economic ties to the UK and US. Dublin’s persistent housing shortage and steady population growth continue to support resilient rental demand.', flag: 'ie' },
      { name: 'Germany', description: 'Germany is one of Europe’s most stable property markets, favoured by buyers seeking capital preservation and reliable long-term yields. Cities like Berlin, Munich, and Frankfurt offer deep rental demand, strong tenant protections, and a transparent legal system.', flag: 'de' },
      { name: 'Austria', description: 'Austria appeals to lifestyle buyers and long-term investors seeking Alpine homes, world-class infrastructure, and political stability. Vienna’s rental market and the country’s ski regions provide both income potential and lifestyle value.', flag: 'at' },
    ]
  },
  {
    name: 'Middle East',
    countries: [
      { name: 'United Arab Emirates (Dubai)', description: 'Dubai offers high rental yields, freehold ownership zones, and a zero personal income tax environment. Strong population growth, global connectivity, and investor-friendly regulations continue to attract international buyers.', flag: 'ae' },
      { name: 'Saudi Arabia', description: 'Saudi Arabia’s recent reforms allowing foreign ownership are opening a new frontier market. Vision 2030 development projects and rapid urban transformation are attracting early-stage international interest.', flag: 'sa' },
      { name: 'Oman', description: 'Oman offers a more relaxed alternative to other Gulf markets, with Integrated Tourism Complexes (ITCs) allowing expats to buy freehold property. Ideal for lifestyle buyers seeking stability and natural beauty.', flag: 'om' },
    ]
  },
  {
    name: 'Americas',
    countries: [
      { name: 'United States', description: 'The US offers scale, liquidity, and diverse market options. States like Florida, Texas, and California attract international buyers with strong rental demand, population growth, and long-established property laws.', flag: 'us' },
      { name: 'Mexico', description: 'Mexico combines strong lifestyle appeal with affordable coastal and city markets. Proximity to the US, vibrant culture, and consistent rental demand make it popular with both investors and second-home buyers.', flag: 'mx' },
      { name: 'Canada', description: 'Canada attracts buyers seeking stability, lifestyle quality, and long-term security. Popular with families and relocation buyers, supported by strong institutions and global demand in major cities.', flag: 'ca' },
      { name: 'Costa Rica', description: 'Costa Rica is a favourite for eco-lifestyle and wellness-focused buyers. Strong appeal to retirees and remote workers, with consistent demand for beachfront and nature-adjacent homes.', flag: 'cr' },
      { name: 'Panama', description: 'Panama is well known for its retiree-friendly policies, territorial tax system, and expat infrastructure. Property markets benefit from dollarisation, modern banking, and international connectivity.', flag: 'pa' },
      { name: 'Dominican Republic', description: 'The Dominican Republic offers Caribbean lifestyle with strong tourism-driven rental demand. Resort areas and branded developments continue to attract international buyers seeking income-generating properties.', flag: 'do' },
      { name: 'Brazil', description: 'Brazil allows open foreign ownership and offers large, diverse markets. Coastal cities and lifestyle destinations attract buyers seeking value, scale, and long-term demographic growth.', flag: 'br' },
      { name: 'Colombia', description: 'Colombia, particularly Medellín and coastal cities, offers high rental yields and strong urban growth. Improving infrastructure and international interest continue to drive demand.', flag: 'co' },
    ]
  },
  {
    name: 'Asia & Asia-Pacific',
    countries: [
      { name: 'Thailand', description: 'Thailand is a long-standing favourite for condo investors and lifestyle buyers. Strong tourism, affordability, and established foreign ownership structures support rental demand in major cities and resorts.', flag: 'th' },
      { name: 'Indonesia (Bali)', description: 'Bali attracts global buyers through leasehold investment opportunities and strong short-term rental demand. Popular with digital nomads and lifestyle investors seeking high occupancy rates.', flag: 'id' },
      { name: 'Philippines', description: 'The Philippines allows foreign condo ownership and benefits from a young population and urban growth. Metro Manila and resort areas attract buyers seeking affordability and rental potential.', flag: 'ph' },
      { name: 'Malaysia', description: 'Malaysia offers strong value and international appeal, with interest often linked to MM2H residency pathways. Modern cities and resort areas attract long-term lifestyle buyers.', flag: 'my' },
      { name: 'Vietnam', description: 'Vietnam is an emerging market with rapid urbanisation and economic growth. Cities like Ho Chi Minh City and Hanoi are drawing attention from early-stage investors seeking long-term upside.', flag: 'vn' },
      { name: 'Japan', description: 'Japan offers remarkably low property prices outside Tokyo, combined with strong infrastructure and legal certainty. Attractive to buyers seeking value, stability, and unique lifestyle opportunities.', flag: 'jp' },
      { name: 'Sri Lanka', description: 'Sri Lanka is attracting interest for beachfront and resort-focused developments. Ideal for buyers seeking early-entry opportunities in a tourism-led recovery market.', flag: 'lk' },
    ]
  },
  {
    name: 'Africa',
    countries: [
      { name: 'South Africa', description: 'South Africa offers luxury lifestyle properties at competitive prices, particularly in Cape Town and coastal regions. Strong appeal for lifestyle buyers seeking space, scenery, and value.', flag: 'za' },
      { name: 'Morocco', description: 'Morocco combines cultural appeal, proximity to Europe, and strong tourism demand. Marrakech and coastal cities attract buyers seeking lifestyle homes with rental potential.', flag: 'ma' },
      { name: 'Egypt', description: 'Egypt’s Red Sea resorts and new developments attract buyers seeking affordable resort properties and tourism-driven demand, supported by large-scale national development projects.', flag: 'eg' },
    ]
  },
  {
    name: 'Oceania',
    countries: [
      { name: 'Australia', description: 'Australia appeals to buyers focused on lifestyle, education-linked demand, and long-term stability. Popular with families and expatriates seeking strong institutions and global city living.', flag: 'au' },
    ]
  }
];

export const Countries: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-[#F8F7F7]">
      {/* 1. Hero Section */}
      <section className="flex flex-col items-center gap-8 px-4 py-20 text-center sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6">
          <h1 className="font-display text-[56px] font-black leading-[1.1] text-[#040504] sm:text-[64px] tracking-tight">
            Where We Operate
          </h1>
          <p className="max-w-[652px] font-body text-[22px] font-normal leading-[1.2] text-black/80">
            We specialize in helping you purchase property across select international markets, with expert local knowledge and dedicated support.
          </p>
        </div>
      </section>

      {/* 2. Regions and Countries */}
      <div className="flex flex-col gap-20 px-4 pb-32 sm:px-10 lg:px-[100px]">
        {regions.map((region) => (
          <div key={region.name} className="flex flex-col gap-8">
            {/* Region Header */}
            <div className="flex items-center gap-4">
              <h2 className="font-display text-[32px] font-medium leading-[1.1] text-[#040504] whitespace-nowrap">
                {region.name}
              </h2>
              <div className="h-[1px] w-full bg-black/50" />
            </div>

            {/* Country Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {region.countries.map((country) => (
                <div 
                  key={country.name} 
                  className="flex flex-col gap-6 rounded-[16px] border border-white/10 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 overflow-hidden rounded-full shadow-sm border border-black/5">
                      <img 
                        src={`https://flagcdn.com/w80/${country.flag}.png`} 
                        alt={`${country.name} flag`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h3 className="font-display text-2xl font-black leading-[1.1] text-[#040504]">
                      {country.name}
                    </h3>
                    <p className="font-body text-base font-normal leading-[1.4] text-black/70">
                      {country.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
