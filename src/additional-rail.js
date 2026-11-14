// Schematic coordinates follow the operator's stop order. IDs reused from
// the metro map are shared stations. Other interchanges retain separate stops.
export function additionalRail(stop, line) {
  const seq = rows => rows.map(row => Array.isArray(row) ? stop(...row) : row);
  const service = (id, name, mode, color, ink, stops, extra = {}) =>
    line(id, color, ink, name, seq(stops), { mode, ...extra });
  const tram = (id, name, stops, extra) =>
    service(id, name, 'tram', '#ffbd71', '#966036', stops, extra);
  const funicular = (id, name, stops, extra) =>
    service(id, name, 'funicular', '#ff9a88', '#9b554f', stops, extra);
  return [
    service('B1', 'Halkalı – Gebze', 'marmaray', '#7ce5f7', '#217889', [
      'halkali', ['b-mustafa-kemal', 'Mustafa Kemal'], ['b-kucukcekmece', 'Küçükçekmece'],
      ['b-florya', 'Florya'], ['b-florya-akvaryum', 'Florya Akvaryum'],
      ['b-yesilkoy', 'Yeşilköy'], ['b-yesilyurt', 'Yeşilyurt'],
      'atakoy', ['b-bakirkoy', 'Bakırköy'], ['b-yenimahalle', 'Yenimahalle'],
      ['b-zeytinburnu', 'Zeytinburnu'], ['b-kazlicesme', 'Kazlıçeşme'],
      'yenikapi', ['b-sirkeci', 'Sirkeci'], 'uskudar', 'ayrilik',
      ['b-sogutlucesme', 'Söğütlüçeşme'], ['b-feneryolu', 'Feneryolu'],
      ['b-goztepe', 'Göztepe'], ['b-erenkoy', 'Erenköy'], ['b-suadiye', 'Suadiye'],
      'bostanci-m8', ['b-kucukyali', 'Küçükyalı'], ['b-idealtepe', 'İdealtepe'],
      ['b-sureyya-plaji', 'Süreyya Plajı'], ['b-maltepe', 'Maltepe'],
      ['b-cevizli', 'Cevizli'], ['b-atalar', 'Atalar'], ['b-basak', 'Başak'],
      ['b-kartal', 'Kartal'], ['b-yunus', 'Yunus'], ['b-pendik', 'Pendik', 'YHT'],
      ['b-kaynarca', 'Kaynarca'], ['b-tersane', 'Tersane'],
      ['b-guzelyali', 'Güzelyalı'], ['b-aydintepe', 'Aydıntepe'],
      ['b-icmeler', 'İçmeler'], ['b-tuzla', 'Tuzla'],
      ['b-cayirova', 'Çayırova'], ['b-fatih', 'Fatih'],
      ['b-osmangazi', 'Osmangazi'], ['b-darica', 'Darıca'], ['b-gebze', 'Gebze', 'YHT'],
    ], { source: 'https://www.tcddtasimacilik.gov.tr/marmaray/tr/neredennereye', badge: ['b-gebze', 33, -12] }),
    tram('T1', 'Kabataş – Bağcılar', [
      ['t-kabatas', 'Kabataş'], ['t-findikli', 'Fındıklı–Mimar Sinan Ü.'],
      ['t-tophane', 'Tophane'], ['t-karakoy', 'Karaköy'],
      ['t-eminonu', 'Eminönü'], ['t-sirkeci', 'Sirkeci'], ['t-gulhane', 'Gülhane'],
      ['t-sultanahmet', 'Sultanahmet'], ['t-cemberlitas', 'Çemberlitaş'],
      ['t-beyazit', 'Beyazıt–Kapalıçarşı'], ['t-laleli', 'Laleli–İstanbul Ü.'],
      ['t-aksaray', 'Aksaray'], ['t-yusufpasa', 'Yusufpaşa'], ['t-haseki', 'Haseki'],
      ['t-findikzade', 'Fındıkzade'], ['t-capa', 'Çapa–Şehremini'],
      ['t-pazartekke', 'Pazartekke'], ['t-topkapi', 'Topkapı'],
      ['t-cevizlibag', 'Cevizlibağ–AÖY'], ['t-merkezefendi', 'Merkezefendi'],
      ['t-seyitnizam', 'Seyitnizam–Akşemsettin'], ['t-mithatpasa', 'Mithatpaşa'],
      'zeytinburnu', ['t-mehmet-akif', 'Mehmet Akif'], ['t-merter-tekstil', 'Merter Tekstil Merkezi'], ['t-gungoren', 'Güngören'],
      ['t-akinci', 'Akıncılar'], ['t-soganli', 'Soğanlı'], ['t-yavuzselim', 'Yavuzselim'],
      ['t-gunestepe', 'Güneştepe'], ['t-bagcilar', 'Bağcılar'],
    ], { badge: ['t-kabatas', 29, 19] }),
    tram('T2', 'Taksim – Tünel', [
      'taksim', ['t-aga', 'Hüseyin Ağa Camii'], ['t-galatasaray', 'Galatasaray Lisesi'],
      ['t-odakule', 'Odakule'], ['t-tunel', 'Beyoğlu Tünel'],
    ], { source: 'https://iett.istanbul/RouteDetail?hkod=T2&routename=taksim-tunel', badge: ['t-odakule', -20, -16] }),
    tram('T3', 'Kadıköy – Moda', [
      ['t-kadikoy-ido', 'Kadıköy İDO'], ['t-iskele-camii', 'İskele Camii'],
      ['t-kadikoy-carsi', 'Çarşı'], ['t-altiyol', 'Altıyol'],
      ['t-bahariye', 'Bahariye'], ['t-kilise', 'Kilise'],
      ['t-moda-ilkokulu', 'Moda İlkokulu'], ['t-moda', 'Moda'],
      ['t-rizapasa', 'Rızapaşa'], ['t-muhurdar', 'Mühürdar'],
      ['t-damga', 'Damga Sokak'],
    ], { loop: true, badge: ['t-moda', -17, 19] }),
    tram('T4', 'Topkapı – Mescid-i Selam', [
      't-topkapi', ['t-fetihkapi', 'Fetihkapı'], ['t-vatan', 'Vatan'],
      ['t-edirnekapi', 'Edirnekapı'], ['t-sehitlik', 'Şehitlik'], ['t-demirkapi', 'Demirkapı'],
      ['t-topcular', 'Topçular'], ['t-rami', 'Rami'], ['t-berec', 'Uluyol Bereç'],
      ['t-sagmalcilar', 'Sağmalcılar'], ['t-bosna', 'Bosna Çukurçeşme'],
      ['t-ali-fuat', 'Ali Fuat Başgil'], ['t-taskopru', 'Taşköprü'],
      ['t-karadeniz', 'Karadeniz'], ['t-venezia', 'Kiptaş–Venezia'],
      ['t-cumhuriyet', 'Cumhuriyet Mahallesi'], ['t-bastabya', '50. Yıl–Baştabya'],
      ['t-haci-sukru', 'Hacı Şükrü'], ['t-yenimahalle', 'Yenimahalle'],
      ['t-sultanciftligi', 'Sultançiftliği'], ['t-cebeci', 'Cebeci'], ['t-mescid', 'Mescid-i Selam'],
    ], { badge: ['t-mescid', 20, -20] }),
    tram('T5', 'Eminönü – Alibeyköy', [
      't-eminonu', ['t-kucukpazar', 'Küçükpazar'], ['t-cibali', 'Cibali'],
      ['t-fener', 'Fener'], ['t-balat', 'Balat'], ['t-ayvansaray', 'Ayvansaray'],
      ['t-feshane', 'Feshane'], ['t-eyup-teleferik', 'Eyüpsultan Teleferik'],
      ['t-eyup-hastane', 'Eyüpsultan Devlet Hastanesi'], ['t-silahtaraga', 'Silahtarağa Mahallesi'],
      ['t-universite', 'Üniversite'], ['t-alibeykoy-merkez', 'Alibeyköy Merkez'],
      'alibeykoy', ['t-alibeykoy-cep', 'Alibeyköy Cep Otogarı'],
    ], { badge: ['t-alibeykoy-cep', 10, -23] }),
    funicular('F1', 'Taksim – Kabataş', ['taksim', 't-kabatas'], { badge: ['t-kabatas', -17, -19] }),
    funicular('F2', 'Karaköy – Beyoğlu Tünel', ['t-karakoy', 't-tunel'], {
      source: 'https://iett.istanbul/icerik/tunel', badge: ['t-tunel', 14, -17],
    }),
    funicular('F3', 'Seyrantepe – Vadistanbul', [
      'seyrantepe', ['f-vadistanbul', 'Vadistanbul'],
    ], { source: 'https://www.vadistanbul.com/havaray', badge: ['f-vadistanbul', -16, -20] }),
    funicular('F4', 'Hisarüstü – Aşiyan', ['hisarustu', ['f-asiyan', 'Aşiyan']],
      { badge: ['f-asiyan', 15, 20] }),
    service('U3', 'Sirkeci – Kazlıçeşme', 'local', '#cbb6fb', '#705a92', [
      'b-sirkeci', ['u-cankurtaran', 'Cankurtaran'], ['u-kumkapi', 'Kumkapı'],
      ['u-yenikapi', 'Yenikapı'], ['u-cerrahpasa', 'Cerrahpaşa'],
      ['u-kocamustafapasa', 'Kocamustafapaşa'], ['u-yedikule', 'Yedikule'], 'b-kazlicesme',
    ], { source: 'https://www.uab.gov.tr/haberler/sirkeci-kazlicesme-hatti-2-yasinda/', badge: ['u-yedikule', 5, 27] }),
  ];
}

export const railInterchanges = [
  ['t-vatan', 'topkapi'], ['t-yusufpasa', 'aksaray'], ['t-laleli', 'vezneciler'],
  ['t-bagcilar', 'bagcilar'], ['t-karadeniz', 'karadeniz'], ['t-kucukpazar', 'halic'],
  ['t-tunel', 'sishane'], ['t-iskele-camii', 'kadikoy'], ['b-bakirkoy', 'ozgurluk'],
  ['b-sirkeci', 't-sirkeci'], ['u-yenikapi', 'yenikapi'],
];
