import { BODY_COMPONENT_SOURCES } from './bodyComponentSources';

export const COMPONENT_SOURCES = [
  ...BODY_COMPONENT_SOURCES,
  ...[
    '1999-2007-gm-lm7-l59', '2007-2009-ly5', '2010-2014-lc9', '2010-2014-lmg',
    'chevy-5-3l-v8-lc83-remanufactured-engine-2014-2019',
    '2019-2023-chevy-gmc-silverado-sierra-tahoe-yukon-suburban-direct-injection-l84',
    '1997-2009-gm', '1997-2007-gm-sc', '1979-1984-gm',
    '1997-1999-2', '2004-2008', '2008-2014', '2011-2016', '1987-1991', '1987-1996-2',
    '2004-2008-hemi', '2005-2008-hemi-2', '2013-2015-ezh-2', '2014-2018-erb',
    'chrysler-3-6l-2018-2022-wrangler-grand-cherokee-ram-1500-v6-remanufactured-engine',
    '2010-2016-2arfe', '8-94-9-04-5vzf-e', '8-84-10-95-22rec', '2012-2017-3urfe-fbe-i-force',
    '2001-2005-d17a1', '2012-2015-k24z7-vtec', '2011-2013-fb25b', '10-6-2013-qr25de',
  ].map((slug) => ({ id: `ppi-engine-${slug}`, partName: 'Engine', provider: 'powertrain' as const, url: `https://www.powertrainproducts.net/product/${slug}/` })),
  ...['10261t', '12142t', '10263t', '12424t'].map((slug) => ({ id: `ppi-trans-${slug}`, partName: 'Transmission', provider: 'powertrain' as const, url: `https://www.powertrainproducts.net/product/${slug}/` })),
  ...[
    ['410-12257', 'new-starter-4-8-5-3-escalade-avalanche-chevy-pickup-suburban-tahoe-yukon-03-08'],
    ['410-12175', 'bonneville-starter-3-8-95-96-97-98-99-00-01-02-03-04-05'],
    ['410-12443', 'starter-for-cadillac-chevy-gmc-sierra-silverado-many-models-410-12443'],
    ['410-54127', 'new-starter-for-acura-04-06-tl-3-2l-honda-03-2007-accord-v6-3-0l-manual-trans'],
    ['410-48116', 'new-starter-3-5-3-5l-honda-pilot-ridgeline-2006-2007-2008-06-07-08'],
    ['410-54027', 'starter-for-honda-accord-1998-2007-odyssey-pilot-acura-cl-mdx-tl'],
  ].map(([partNumber, slug]) => ({ id: `dbe-starter-${partNumber}`, partNumber, partName: 'Starter', provider: 'electrical' as const, url: `https://www.dbelectrical.com/products/${slug}.html` })),
];

export type ComponentSource = typeof COMPONENT_SOURCES[number];
