export const KRAJE = [
  { slug: 'bratislavsky-kraj',     name: 'Bratislavský kraj',     short: 'BA' },
  { slug: 'trnavsky-kraj',         name: 'Trnavský kraj',         short: 'TT' },
  { slug: 'trenciansky-kraj',      name: 'Trenčiansky kraj',      short: 'TN' },
  { slug: 'nitriansky-kraj',       name: 'Nitriansky kraj',       short: 'NR' },
  { slug: 'zilinsky-kraj',         name: 'Žilinský kraj',         short: 'ZA' },
  { slug: 'banskobystricky-kraj',  name: 'Banskobystrický kraj',  short: 'BB' },
  { slug: 'presovsky-kraj',        name: 'Prešovský kraj',        short: 'PO' },
  { slug: 'kosicky-kraj',          name: 'Košický kraj',          short: 'KE' },
]

// Simplified SVG paths for Slovak regions (viewBox 0 0 800 360)
// Approximate but recognizable geography
export const KRAJ_SVG_PATHS: Record<string, string> = {
  'bratislavsky-kraj':    'M 2,245 L 2,312 L 88,360 L 150,332 L 126,248 L 74,220 Z',
  'trnavsky-kraj':        'M 126,248 L 150,332 L 88,360 L 268,360 L 280,282 L 244,236 Z',
  'trenciansky-kraj':     'M 2,98 L 2,245 L 74,220 L 126,248 L 244,236 L 268,174 L 236,102 L 164,72 L 88,76 Z',
  'nitriansky-kraj':      'M 244,236 L 280,282 L 268,360 L 438,360 L 458,292 L 416,236 L 340,216 Z',
  'zilinsky-kraj':        'M 236,102 L 268,174 L 340,216 L 416,226 L 452,182 L 484,90 L 422,42 L 326,32 L 260,56 Z',
  'banskobystricky-kraj': 'M 416,236 L 458,292 L 438,360 L 592,356 L 624,282 L 582,206 L 512,180 L 452,182 L 416,226 Z',
  'presovsky-kraj':       'M 484,90 L 512,180 L 582,206 L 646,192 L 798,100 L 798,10 L 680,2 L 572,8 L 484,24 L 422,42 Z',
  'kosicky-kraj':         'M 582,206 L 624,282 L 592,356 L 798,356 L 798,100 L 646,192 Z',
}

export const KRAJE_CENTROIDS: Record<string, { x: number; y: number }> = {
  'bratislavsky-kraj':    { x: 58,  y: 288 },
  'trnavsky-kraj':        { x: 192, y: 305 },
  'trenciansky-kraj':     { x: 142, y: 190 },
  'nitriansky-kraj':      { x: 352, y: 296 },
  'zilinsky-kraj':        { x: 360, y: 142 },
  'banskobystricky-kraj': { x: 504, y: 272 },
  'presovsky-kraj':       { x: 600, y: 100 },
  'kosicky-kraj':         { x: 694, y: 270 },
}
