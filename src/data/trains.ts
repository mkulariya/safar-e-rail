export interface TrainRoute {
  id: string;
  number: string;
  name: string;
  nameHi: string;
  from: string;
  fromHi: string;
  to: string;
  toHi: string;
  via: string[];
  accent: string;
  /** Matches /textures/biome-XX.jpg plates */
  biomeHint: string;
  description: string;
}

/** Ten iconic trains — major cities only on the card. */
export const TRAINS: TrainRoute[] = [
  {
    id: 'rajdhani-ndls-bct',
    number: '12952',
    name: 'Mumbai Rajdhani',
    nameHi: 'मुंबई राजधानी',
    from: 'New Delhi',
    fromHi: 'नई दिल्ली',
    to: 'Mumbai Central',
    toHi: 'मुंबई सेंट्रल',
    via: ['Kota', 'Vadodara', 'Surat'],
    accent: '#c45c26',
    biomeHint: 'biome-07',
    description: 'Overnight flagship through Rajasthan & Gujarat plains',
  },
  {
    id: 'howrah-rajdhani',
    number: '12302',
    name: 'Howrah Rajdhani',
    nameHi: 'हावड़ा राजधानी',
    from: 'New Delhi',
    fromHi: 'नई दिल्ली',
    to: 'Howrah',
    toHi: 'हावड़ा',
    via: ['Kanpur', 'Patna', 'Asansol'],
    accent: '#1a5f4a',
    biomeHint: 'biome-05',
    description: 'Eastbound through the Gangetic heartland',
  },
  {
    id: 'kerala-express',
    number: '12626',
    name: 'Kerala Express',
    nameHi: 'केरल एक्सप्रेस',
    from: 'New Delhi',
    fromHi: 'नई दिल्ली',
    to: 'Thiruvananthapuram',
    toHi: 'तिरुवनंतपुरम',
    via: ['Nagpur', 'Chennai', 'Ernakulam'],
    accent: '#2d6a4f',
    biomeHint: 'biome-01',
    description: 'North–South spine into deep green Kerala',
  },
  {
    id: 'konkan-kanya',
    number: '10111',
    name: 'Konkan Kanya',
    nameHi: 'कोंकण कन्या',
    from: 'Mumbai CSMT',
    fromHi: 'मुंबई छत्रपति शिवाजी',
    to: 'Madgaon',
    toHi: 'मडगाँव',
    via: ['Ratnagiri', 'Kudal'],
    accent: '#0e7490',
    biomeHint: 'biome-11',
    description: 'Konkan coast — tunnels, cliffs & sea glimpses',
  },
  {
    id: 'darjeeling-mail',
    number: '12343',
    name: 'Darjeeling Mail',
    nameHi: 'दार्जिलिंग मेल',
    from: 'Sealdah',
    fromHi: 'सियालदह',
    to: 'New Jalpaiguri',
    toHi: 'न्यू जलपाईगुड़ी',
    via: ['Malda', 'Kishanganj'],
    accent: '#4c6ef5',
    biomeHint: 'biome-13',
    description: 'Toward the foothills of tea country',
  },
  {
    id: 'nilgiri-express',
    number: '12671',
    name: 'Nilgiri Express',
    nameHi: 'नीलगिरी एक्सप्रेस',
    from: 'Chennai Central',
    fromHi: 'चेन्नई सेंट्रल',
    to: 'Mettupalayam',
    toHi: 'मेट्टुपलायम',
    via: ['Salem', 'Coimbatore'],
    accent: '#5c7c3a',
    biomeHint: 'biome-03',
    description: 'Gateway to the Blue Mountains',
  },
  {
    id: 'golden-temple',
    number: '12903',
    name: 'Golden Temple Mail',
    nameHi: 'स्वर्ण मंदिर मेल',
    from: 'Mumbai Central',
    fromHi: 'मुंबई सेंट्रल',
    to: 'Amritsar',
    toHi: 'अमृतसर',
    via: ['Vadodara', 'Jaipur', 'New Delhi'],
    accent: '#b8860b',
    biomeHint: 'biome-07',
    description: 'West to North across golden fields',
  },
  {
    id: 'vande-bharat-bsb',
    number: '22436',
    name: 'Vande Bharat',
    nameHi: 'वंदे भारत',
    from: 'New Delhi',
    fromHi: 'नई दिल्ली',
    to: 'Varanasi',
    toHi: 'वाराणसी',
    via: ['Kanpur', 'Prayagraj'],
    accent: '#e85d04',
    biomeHint: 'biome-05',
    description: 'Day journey along the holy river plains',
  },
  {
    id: 'deccan-queen',
    number: '12123',
    name: 'Deccan Queen',
    nameHi: 'दक्कन क्वीन',
    from: 'Mumbai CSMT',
    fromHi: 'मुंबई छत्रपति शिवाजी',
    to: 'Pune',
    toHi: 'पुणे',
    via: ['Karjat', 'Lonavala'],
    accent: '#9b2226',
    biomeHint: 'biome-09',
    description: 'Ghats, viaducts & monsoon waterfalls',
  },
  {
    id: 'vivek-express',
    number: '15905',
    name: 'Vivek Express',
    nameHi: 'विवेक एक्सप्रेस',
    from: 'Dibrugarh',
    fromHi: 'डिब्रूगढ़',
    to: 'Kanyakumari',
    toHi: 'कन्याकुमारी',
    via: ['Guwahati', 'Howrah', 'Chennai'],
    accent: '#40916c',
    biomeHint: 'biome-01',
    description: 'Longest run — Northeast forests to the tip',
  },
];

export function getTrainById(id: string): TrainRoute | undefined {
  return TRAINS.find((t) => t.id === id);
}
