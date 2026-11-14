import { additionalRail, railInterchanges } from './additional-rail.js';

// Shared IDs identify metro interchanges. Similarly named stops on different
// routes use separate IDs unless an operator documents a connection.
export const stations = new Map();

function stop(id, name, connections = '', shortName = name) {
  stations.set(id, { id, name, connections: connections ? connections.split('|') : [], shortName });
  return id;
}

const trunk = [
  stop('yenikapi', 'Yenikapı', 'Marmaray|T6'),
  stop('aksaray', 'Aksaray', 'T1'),
  stop('emniyet', 'Emniyet–Fatih'),
  stop('topkapi', 'Topkapı–Ulubatlı', 'T4'),
  stop('bayrampasa', 'Bayrampaşa–Maltepe'),
  stop('sagmalcilar', 'Sağmalcılar'),
  stop('kocatepe', 'Kocatepe'),
  stop('otogar', 'Otogar'),
];

const m1a = [...trunk,
  stop('terazidere', 'Terazidere'),
  stop('davutpasa', 'Davutpaşa–YTÜ'),
  stop('merter', 'Merter', 'Metrobüs'),
  stop('zeytinburnu', 'Zeytinburnu', 'T1|Metrobüs'),
  stop('incirli', 'Bakırköy–İncirli', 'Metrobüs', 'İncirli'),
  stop('bahcelievler', 'Bahçelievler', 'Metrobüs'),
  stop('sirinevler', 'Ataköy–Şirinevler', 'Metrobüs', 'Şirinevler'),
  stop('yenibosna', 'Yenibosna', 'Metrobüs'),
  stop('dtm', 'DTM–İstanbul Fuar Merkezi', '', 'İstanbul Fuar Merkezi'),
  stop('ataturk', 'Atatürk Havalimanı', '', 'Atatürk Hvl.'),
];

const m1b = [...trunk,
  stop('esenler', 'Esenler'),
  stop('menderes', 'Menderes'),
  stop('ucyuzlu', 'Üçyüzlü'),
  stop('bagcilar', 'Bağcılar Meydan', 'T1'),
  stop('kirazli', 'Kirazlı–Bağcılar', '', 'Kirazlı'),
];

const m2 = ['yenikapi',
  stop('vezneciler', 'Vezneciler–İstanbul Ü.', 'T1', 'Vezneciler'),
  stop('halic', 'Haliç', 'T5'),
  stop('sishane', 'Şişhane', 'T2|F2'),
  stop('taksim', 'Taksim', 'T2|F1'),
  stop('osmanbey', 'Osmanbey'),
  stop('mecidiyekoy', 'Şişli–Mecidiyeköy', 'Metrobüs', 'Mecidiyeköy'),
  stop('gayrettepe', 'Gayrettepe', 'Metrobüs'),
  stop('levent', 'Levent'),
  stop('dorduncu-levent', '4. Levent'),
  stop('sanayi', 'Sanayi Mahallesi', '', 'Sanayi Mah.'),
  stop('itu', 'İTÜ–Ayazağa'),
  stop('oto-sanayi', 'Atatürk Oto Sanayi'),
  stop('darussafaka', 'Darüşşafaka'),
  stop('haciosman', 'Hacıosman'),
];
const m2Shuttle = ['sanayi', stop('seyrantepe', 'Seyrantepe')];

const m3 = [
  stop('bakirkoy', 'Bakırköy Sahil'),
  stop('ozgurluk', 'Özgürlük Meydanı', 'Marmaray|YHT'),
  'incirli',
  stop('haznedar', 'Haznedar'),
  stop('ilkyuva', 'İlkyuva'),
  stop('yildiztepe', 'Yıldıztepe'),
  stop('molla-gurani', 'Molla Gürani'),
  'kirazli',
  stop('yenimahalle-m3', 'Yenimahalle'),
  stop('mahmutbey', 'Mahmutbey'),
  stop('istoc', 'İSTOÇ'),
  stop('ikitelli', 'İkitelli Sanayi'),
  stop('turgut-ozal', 'Turgut Özal'),
  stop('siteler', 'Siteler'),
  stop('basak-konutlari', 'Başak Konutları'),
  stop('metrokent', 'Başakşehir–Metrokent', '', 'Metrokent'),
  stop('onurkent', 'Onurkent'),
  stop('cam-sakura', 'Şehir Hastanesi'),
  stop('toplu-konutlar', 'Toplu Konutlar'),
  stop('kayasehir-merkez', 'Kayaşehir Merkez'),
];

const m4 = [
  stop('kadikoy', 'Kadıköy', 'T3'),
  stop('ayrilik', 'Ayrılık Çeşmesi', 'Marmaray'),
  stop('acibadem', 'Acıbadem'),
  stop('unalan', 'Ünalan', 'Metrobüs'),
  stop('goztepe', 'Göztepe'),
  stop('yenisahra', 'Yenisahra'),
  stop('kozyatagi', 'Kozyatağı'),
  stop('bostanci-m4', 'Bostancı'),
  stop('kucukyali', 'Küçükyalı'),
  stop('maltepe', 'Maltepe'),
  stop('huzurevi', 'Huzurevi'),
  stop('gulsuyu', 'Gülsuyu'),
  stop('esenkent', 'Esenkent'),
  stop('hastane-adliye', 'Hastane–Adliye'),
  stop('soganlik', 'Soğanlık'),
  stop('kartal', 'Kartal'),
  stop('yakacik', 'Yakacık–Adnan Kahveci', '', 'Yakacık'),
  stop('pendik', 'Pendik'),
  stop('tavsantepe', 'Tavşantepe'),
  stop('fevzi-cakmak', 'Fevzi Çakmak–Hastane', '', 'Fevzi Çakmak'),
  stop('yayalar', 'Yayalar–Şeyhli'),
  stop('kurtkoy', 'Kurtköy'),
  stop('sabiha', 'Sabiha Gökçen Havalimanı', '', 'Sabiha Gökçen'),
];

const m5 = [
  stop('uskudar', 'Üsküdar', 'Marmaray'),
  stop('fistikagaci', 'Fıstıkağacı'),
  stop('baglarbasi', 'Bağlarbaşı'),
  stop('altunizade', 'Altunizade', 'Metrobüs'),
  stop('kisikli', 'Kısıklı'),
  stop('bulgurlu', 'Bulgurlu'),
  stop('umraniye', 'Ümraniye'),
  stop('carsi', 'Çarşı'),
  stop('yamanevler', 'Yamanevler'),
  stop('cakmak', 'Çakmak'),
  stop('ihlamurkuyu', 'Ihlamurkuyu'),
  stop('altinsehir', 'Altınşehir'),
  stop('imam-hatip', 'İmam Hatip Lisesi'),
  stop('dudullu', 'Dudullu'),
  stop('necip-fazil', 'Necip Fazıl'),
  stop('cekmekoy', 'Çekmeköy'),
  stop('meclis', 'Meclis'),
  stop('sarigazi', 'Sarıgazi'),
  stop('sancaktepe-hospital', 'Sancaktepe Şehir Hastanesi', '', 'Şehir Hastanesi'),
  stop('sancaktepe', 'Sancaktepe'),
  stop('samandira', 'Samandıra Merkez'),
  stop('veysel-karani', 'Veysel Karani'),
  stop('hasanpasa', 'Hasanpaşa'),
  stop('sultanbeyli', 'Sultanbeyli'),
];

const m6 = ['levent',
  stop('nispetiye', 'Nispetiye'),
  stop('etiler', 'Etiler'),
  stop('hisarustu', 'Boğaziçi Ü.–Hisarüstü', 'F4', 'Hisarüstü'),
];

const m7 = [
  stop('yildiz', 'Yıldız'),
  stop('fulya', 'Fulya'),
  'mecidiyekoy',
  stop('caglayan', 'Çağlayan'),
  stop('kagithane', 'Kağıthane'),
  stop('nurtepe', 'Nurtepe'),
  stop('alibeykoy', 'Alibeyköy', 'T5'),
  stop('circir', 'Çırçır Mahallesi', '', 'Çırçır'),
  stop('aksemsettin', 'Veysel Karani–Akşemsettin', '', 'Akşemsettin'),
  stop('yesilpinar', 'Yeşilpınar'),
  stop('kazim-karabekir', 'Kazım Karabekir'),
  stop('yenimahalle-m7', 'Yenimahalle'),
  stop('karadeniz', 'Karadeniz Mahallesi', 'T4', 'Karadeniz'),
  stop('giyimkent', 'Giyimkent–Tekstilkent', '', 'Giyimkent'),
  stop('oruc-reis', 'Oruç Reis'),
  stop('goztepe-mahallesi', 'Göztepe Mahallesi', '', 'Göztepe Mah.'),
  'mahmutbey',
];

const m8 = [
  stop('bostanci-m8', 'Bostancı', 'Marmaray|YHT'),
  stop('emin-ali-pasa', 'Emin Ali Paşa'),
  stop('aysekadin', 'Ayşekadın'),
  'kozyatagi',
  stop('kucukbakkalkoy', 'Küçükbakkalköy'),
  stop('icerenkoy', 'İçerenköy'),
  stop('kayisdagi', 'Kayışdağı'),
  stop('mevlana', 'Mevlana'),
  stop('imes', 'İMES'),
  stop('modoko', 'MODOKO–KEYAP'),
  'dudullu',
  stop('huzur', 'Huzur'),
  stop('parseller', 'Parseller'),
];

const m9 = [
  stop('atakoy', 'Ataköy', 'Marmaray'),
  'yenibosna',
  stop('cobancesme', 'Çobançeşme'),
  stop('cumhuriyet', '29 Ekim Cumhuriyet', '', '29 Ekim'),
  stop('dogu-sanayi', 'Doğu Sanayi'),
  stop('mimar-sinan', 'Mimar Sinan'),
  stop('onbes-temmuz', '15 Temmuz'),
  stop('halkali-caddesi', 'Halkalı Caddesi'),
  stop('ataturk-mah', 'Atatürk Mahallesi', '', 'Atatürk Mah.'),
  stop('bahariye', 'Bahariye'),
  stop('masko', 'MASKO'),
  'ikitelli',
  stop('ziya-gokalp', 'Ziya Gökalp Mahallesi', '', 'Ziya Gökalp'),
  stop('olimpiyat', 'Olimpiyat'),
];

const m11 = [
  'gayrettepe', 'kagithane',
  stop('hasdal', 'Hasdal'),
  stop('kemerburgaz', 'Kemerburgaz'),
  stop('gokturk', 'Göktürk'),
  stop('ihsaniye', 'İhsaniye'),
  stop('istanbul-airport', 'İstanbul Havalimanı'),
  stop('kargo', 'Kargo Terminali'),
  stop('tasoluk', 'Taşoluk'),
  stop('arnavutkoy', 'Arnavutköy Hastane'),
  stop('ibn-haldun', 'İbn Haldun Üniversitesi'),
  stop('kayasehir', 'Kayaşehir'),
  stop('olimpiyatkoy', 'Olimpiyatköy'),
  stop('halkali-stadi', 'Halkalı Stadı'),
  stop('halkali', 'Halkalı', 'Marmaray|YHT'),
];

function line(id, color, ink, name, stops, extra = {}) {
  const source = id === 'M11'
    ? 'https://www.uab.gov.tr/haberler/rekorlar-pes-pese-geldi/'
    : 'https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=' + id;
  return { id, color, ink, name, stops, source, mode: 'metro', ...extra };
}

export const lines = [
  line('M1A', '#ff596d', '#963e36', 'Yenikapı – Atatürk Havalimanı', m1a),
  line('M1B', '#ff996b', '#a4501e', 'Yenikapı – Kirazlı', m1b),
  line('M2', '#8be386', '#416438', 'Yenikapı – Hacıosman', m2, { branch: m2Shuttle }),
  line('M3', '#65baff', '#385e88', 'Bakırköy – Kayaşehir', m3, { stopNames: { incirli: 'İncirli' } }),
  line('M4', '#ff94be', '#9a3c65', 'Kadıköy – Sabiha Gökçen', m4),
  line('M5', '#c3a6ff', '#654d83', 'Üsküdar – Sultanbeyli', m5),
  line('M6', '#ead870', '#796321', 'Levent – Hisarüstü', m6),
  line('M7', '#ff7edf', '#803b6a', 'Yıldız – Mahmutbey', m7),
  line('M8', '#8ee4ea', '#286c77', 'Bostancı – Parseller', m8),
  line('M9', '#edb36c', '#856039', 'Ataköy – Olimpiyat', m9),
  line('M11', '#49d9ad', '#1d6755', 'Gayrettepe – İstanbul Havalimanı – Halkalı', m11),
  ...additionalRail(stop, line),
];

export const sharedTrunk = trunk;
export const linkedInterchanges = [
  ['kayasehir', 'kayasehir-merkez'],
  ['olimpiyatkoy', 'olimpiyat'],
  ...railInterchanges,
];
export const lineById = new Map(lines.map(route => [route.id, route]));
export const stationRoutes = new Map([...stations.keys()].map(id => [
  id, lines.filter(route => route.stops.includes(id) || route.branch?.includes(id)),
]));
export const linkedStations = new Map([...stations.keys()].map(id => [
  id, linkedInterchanges.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : []),
]));
export const terminusIds = new Set(lines.flatMap(route => [
  ...(route.loop ? [] : [route.stops[0], route.stops.at(-1)]), ...(route.branch ? [route.branch.at(-1)] : []),
]));

export const transportModes = [
  ['metro', 'Metro'],
  ['marmaray', 'Marmaray'],
  ['tram', 'Tram'],
  ['funicular', 'Funicular & Tünel'],
  ['local', 'Sirkeci local rail'],
];
export const metroLines = lines.filter(route => route.mode === 'metro');
