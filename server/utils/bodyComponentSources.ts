export interface BodyComponentSource {
  id: string;
  partNumber: string;
  partName: string;
  partCategory: 'Body' | 'Lights' | 'Brakes' | 'Cooling' | 'Interior';
  provider: '1aauto';
  url: string;
  qualifications?: string;
}

// Selected public product pages, not a bulk feed or inferred vehicle-family interchange.
export const BODY_COMPONENT_SOURCES: BodyComponentSource[] = [
  ['Body', 'Bumper impact absorber', 'BDA56526', '1abbr01199', 'chevrolet-gmc-buick-olds-isuzu-front-bumper-impact-absorber-trq-bda56526'],
  ['Body', 'Bumper impact absorber', 'BDA19085', '1abbr01023', 'ford-lincoln-mercury-front-bumper-impact-absorber-trq-bda19085'],
  ['Body', 'Inner fender liner set', 'BDA16602', '1abmk03032', 'honda-fit-front-driver-and-passenger-side-2-piece-inner-fender-liner-set-trq-bda16602'],
  ['Body', 'Tailgate molding', 'BDA04665', '1abtg00070', 'chevrolet-gmc-rear-black-tailgate-molding-trq-bda04665'],
  ['Lights', 'Headlight set', 'HLA87242', '1alhp02430', 'dodge-ram-1500-2500-3500-driver-and-passenger-side-2-piece-headlight-set-trq-hla87242', 'Driver and passenger halogen assemblies; black bezel and lower amber bar style. Not evidence of compatibility with factory HID or LED systems.'],
  ['Lights', 'Headlight set', 'HLA95290', '1alhp01842', 'chevrolet-driver-and-passenger-side-2-piece-headlight-set-trq-hla95290'],
  ['Lights', 'Headlight set', 'HLA79109', '1alhp02942', 'ford-f150-driver-and-passenger-side-2-piece-headlight-set-trq-hla79109'],
  ['Lights', 'Headlight assembly', 'HLA88526', '1alhl05479', 'ford-driver-side-headlight-assembly-trq-hla88526'],
  ['Brakes', 'Brake pad and rotor kit', 'BKA11571', '1abfs02273', 'ford-f150-front-and-rear-ceramic-brake-pad-and-rotor-kit-trq-bka11571', '2012–2014 source applications require 6-lug wheels; 2015–2017 applications require manual parking brake. Compare each application row.'],
  ['Brakes', 'Brake pad and rotor kit', 'BKA11241', '1abfs01588', 'chevrolet-gmc-front-ceramic-brake-pad-and-rotor-kit-trq-bka11241'],
  ['Brakes', 'Brake pad and rotor kit', 'BKA11546', '1abfs02222', 'chevrolet-gmc-buick-saturn-front-and-rear-ceramic-brake-pad-and-rotor-kit-trq-bka11546'],
  ['Brakes', 'Brake pad and rotor kit', 'BKA11942', '1abfs03052', 'toyota-lexus-front-and-rear-ceramic-brake-pad-and-rotor-kit-trq-bka11942'],
  ['Cooling', 'Radiator', 'RDA82615', '1arad00049', 'chevrolet-gmc-radiator-trq-rda82615', 'Source specifies internal engine-oil and transmission-oil coolers, with 28.25-inch core width. Some application descriptions state 28 inches; compare actual measurements and source restrictions.'],
  ['Cooling', 'Radiator', 'RDA82806', '1arad00646', 'ford-radiator-trq-rda82806'],
  ['Cooling', 'Radiator', 'RDA82937', '1arad00938', 'toyota-corolla-matrix-pontiac-vibe-radiator-trq-rda82937'],
  ['Cooling', 'Radiator', 'RDA82738', '1arad01002', 'toyota-4runner-fj-cruiser-radiator-trq-rda82738'],
  ['Interior', 'Interior door handle and bezel kit', 'DHA72581', '1adhs00262', 'chevrolet-gmc-interior-door-handle-and-bezel-kit-trq-dha72581', 'Red passenger-side handle and bezel; no power-door-lock switch hole. Position can differ by application: compare the row, not just the vehicle name.'],
  ['Interior', 'Interior door handle', 'DHA49689', '1adhi00942', 'ford-driver-side-black-interior-door-handle-trq-dha49689'],
  ['Interior', 'Interior door handle and bezel kit', 'DHA23289', '1adhs02938', 'dodge-ram-1500-ram-1500-front-and-rear-interior-door-handle-and-bezel-kit-trq-dha23289'],
  ['Interior', 'Interior door handle bezel', 'DHA65267', '1adhi01257', 'toyota-tundra-front-driver-side-interior-door-handle-bezel-trq-dha65267'],
].map(([partCategory, partName, partNumber, listingId, slug, qualifications]) => ({
  id: `1aauto-${listingId}`, partNumber, partName,
  partCategory: partCategory as BodyComponentSource['partCategory'], provider: '1aauto',
  url: `https://www.1aauto.com/${slug}/i/${listingId}`, qualifications,
}));
