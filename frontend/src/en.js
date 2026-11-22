// English for every Turkish UI string (see i18n.js). Keys are the Turkish text, exactly as in the code.
// Wording: koli = parcel, rampa = dock, pano = board, alıcı = to / recipient, ana bilgisayar = host. British spelling.

const pl = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`

export const EN = {
  // header and shell
  'YEREL AĞ': 'LOCAL NETWORK',
  '{n} cihaz çevrimiçi': (v) => `${pl(v.n, 'device', 'devices')} online`,
  '{n} koli · {size}': (v) => `${pl(v.n, 'parcel', 'parcels')} · ${v.size}`,
  'Cihaz adını değiştir': 'Rename this device',
  'Dil': 'Language',
  'Tema: sistem': 'Theme: system',
  'Tema: açık': 'Theme: light',
  'Tema: koyu': 'Theme: dark',
  'Kapat': 'Close',
  'Dosyalar bu ağdan çıkmaz.': 'Your files never leave this network.',
  'Sürükle-bırak ve yapıştır her yerde çalışır.': 'Drag and drop or paste anywhere.',

  // pairing
  'Eşleşme · 1 / 1': 'Pairing · 1 / 1',
  'Bir kez yeter': 'Only once',
  'Etiketteki kodu gir.': 'Enter the code on the label.',
  'Fırlat’ın açık olduğu bilgisayarda “Telefonu bağla” etiketinde 6 haneli bir kod var. Bu cihaz sonra hatırlanır.':
    'On the computer running Fırlat, the “Connect a phone” label shows a 6-digit code. This device is remembered after that.',
  'Eşleşme kodu': 'Pairing code',
  'Bakılıyor…': 'Checking…',
  'Olmadı, tekrar dene.': 'That didn’t work, try again.',
  'Bu cihazın adı': 'This device’s name',
  'QR’ı okuttuysan bu ekranı görmemen gerekirdi; kod yenilenmiş olabilir. Bilgisayardaki etikette güncel kod yazar.':
    'If you scanned the QR code you shouldn’t see this screen; the code may have changed. The label on the computer shows the current one.',
  'Eşleşme tamam. Artık fırlatabilirsin.': 'Paired. You can start sending.',
  '{name} eşleşti ve ağa katıldı.': '{name} paired and joined the network.',

  // host unreachable
  'Ana bilgisayara ulaşılamıyor': 'Can’t reach the host',
  'Fırlat kapatılmış ya da bu cihaz ağdan düşmüş olabilir. Bilgisayarda açık olduğundan emin ol.':
    'Fırlat may have been closed, or this device dropped off the network. Make sure it is running on the computer.',
  'Tekrar dene': 'Try again',

  // device name
  'Cihaz adı': 'Device name',
  'Diğerleri seni bu adla görür; gönderdiklerinin etiketinde de yazar.': 'Others see you by this name, and it is printed on everything you send.',
  'Rastgele ad': 'Random name',
  'Vazgeç': 'Cancel',
  'Kaydet': 'Save',

  // the dock
  'Yükleme rampası': 'Loading dock',
  'Rampa 01 · yükleme': 'Dock 01 · loading',
  'Bırak,': 'Drop it,',
  'fırlasın.': 'watch it fly.',
  'Bırak, fırlasın.': 'Drop it, watch it fly.',
  'Fotoğraf, video, belge ya da metin. Boyut sınırı yok, sıkıştırma yok.': 'Photos, videos, documents or text. No size limit, no compression.',
  'Dosya, klasör ya da metin. Boyut sınırı yok, sıkıştırma yok; yapıştırmak için {keys}.':
    'Files, folders or text. No size limit, no compression; press {keys} to paste.',
  'Dosya ya da fotoğraf': 'File or photo',
  'Dosya seç': 'Choose files',
  'Klasör': 'Folder',
  'Metin': 'Text',
  'Dosya fırlat': 'Send a file',
  'Metin gönder': 'Send text',
  'ALICI: {to}': 'TO: {to}',

  // recipients
  'Alıcı': 'To',
  'Gönderen': 'From',
  'Herkese': 'Everyone',
  'Bir cihaz': 'A device',
  'Bağlı her cihazın panosuna': 'To every connected device’s board',
  '{kind} · yalnızca o görür': '{kind} · only it sees it',
  'Başka cihaz bağlanınca burada rota olarak belirir.': 'Other devices show up here as routes once they connect.',
  'Ana bilgisayar': 'Host',
  'Telefon': 'Phone',
  'Tablet': 'Tablet',
  'Bilgisayar': 'Computer',

  // text dialog
  'Metin fırlat': 'Send text',
  'Link, adres, kod, alışveriş listesi… Alıcı: {to}.': 'A link, an address, a code, a shopping list… To: {to}.',
  'Buraya yaz ya da yapıştır': 'Type or paste here',
  'Gönder': 'Send',
  'Metin gitti.': 'Text sent.',

  // board
  'Pano': 'Board',
  'Süz': 'Filter',
  'Tümü': 'All',
  'Gelen': 'In',
  'Giden': 'Out',
  'Temizle': 'Clear',
  'Hepsi (ZIP)': 'All (ZIP)',
  'Henüz gelen yok': 'Nothing in yet',
  'Henüz bir şey atmadın': 'You haven’t sent anything yet',
  'Pano bomboş': 'The board is empty',
  'İlk fırlatışı sen yap: dosyayı sürükle, seç ya da yapıştır.': 'Make the first throw: drag a file in, choose one or paste it.',
  'Burada görünmesi için birinin bir şey göndermesi lazım.': 'Something shows up here once someone sends it.',
  'Kopyala': 'Copy',
  'Metni kopyala': 'Copy text',
  'Kopyalanamadı; metni seçip kopyala.': 'Couldn’t copy; select the text and copy it.',
  'Aç': 'Open',
  'Linki aç': 'Open link',
  'Klasörde göster': 'Show in folder',
  '{name} klasörde göster': 'Show {name} in folder',
  'İndir': 'Download',
  '{name} indir': 'Download {name}',
  'Sil': 'Delete',
  'Hepsini sil': 'Delete all',
  'Göster': 'Show',
  '{n} karakter': (v) => pl(v.n, 'character', 'characters'),
  'YENİ': 'NEW',
  'DOSYA': 'FILE',
  '{n} dosya': (v) => pl(v.n, 'file', 'files'),
  'Daha az göster': 'Show less',
  '{n} dosya daha': (v) => `${pl(v.n, 'more file', 'more files')}`,
  'Silinsin mi?': 'Delete this?',
  '“{name}” panodan kalkar ve ana bilgisayardaki klasörden de silinir.': '“{name}” leaves the board and is deleted from the host’s folder too.',
  'Metin herkesin panosundan kalkar.': 'The text leaves everyone’s board.',
  '{n} dosya panodan kalkar ve ana bilgisayardaki klasörden de silinir.': (v) =>
    `${pl(v.n, 'file leaves', 'files leave')} the board and ${Number(v.n) === 1 ? 'is' : 'are'} deleted from the host’s folder too.`,
  'Panoyu temizle': 'Clear the board',
  'Pano temizlensin mi?': 'Clear the board?',
  'Liste herkes için boşalır. Dosyaları klasörde bırakabilir ya da onlarla birlikte silebilirsin.':
    'The list empties for everyone. You can keep the files in the folder or delete them too.',
  'Dosyalarla birlikte sil': 'Delete the files too',
  'Yalnızca listeyi temizle': 'Only clear the list',

  // transfers
  'Yolda': 'In transit',
  'YOLDA': 'IN TRANSIT',
  'TESLİM': 'DELIVERED',
  '{a}/{b} dosya': (v) => `${v.a}/${pl(v.b, 'file', 'files')}`,
  'Hepsini durdur': 'Stop all',
  'Gönderim': 'Upload',
  'sırada': 'queued',
  'Durdur': 'Stop',
  '+{n} dosya daha sırada': (v) => `+${pl(v.n, 'more file', 'more files')} queued`,
  'Geliyor': 'Incoming',
  '+{n} dosya daha geliyor': (v) => `+${pl(v.n, 'more file', 'more files')} on the way`,
  'Gönderilemedi': 'Couldn’t send',
  'Bağlantı koptu': 'Connection lost',
  '{n} dosya gitti.': (v) => `${pl(v.n, 'file', 'files')} sent.`,
  'Gitti.': 'Sent.',
  '{bad} dosya gönderilemedi, {ok} tanesi gitti.': (v) => `${pl(v.bad, 'file', 'files')} couldn’t be sent, ${v.ok} went through.`,
  '{bad} dosya gönderilemedi.': (v) => `${pl(v.bad, 'file', 'files')} couldn’t be sent.`,
  'Hata {code}': 'Error {code}',

  // arrival notices
  '{who} sana bir metin gönderdi.': '{who} sent you a text.',
  '{who} bir metin gönderdi.': '{who} sent a text.',
  '{who} sana {what} fırlattı.': '{who} sent you {what}.',
  '{who} {what} fırlattı.': '{who} sent {what}.',
  'Klasörde hazır.': 'It’s in the folder.',

  // connect a phone
  'Telefonu bağla': 'Connect a phone',
  'Telefonu': 'Connect',
  'bağla': 'a phone',
  'Aynı Wi-Fi': 'Same Wi-Fi',
  'Bulut yok': 'No cloud',
  'Bağlantı QR kodu': 'Connection QR code',
  'Telefonun kamerasıyla okut; eşleşme kendiliğinden olur.': 'Scan it with your phone’s camera; pairing happens by itself.',
  'Geçerli': 'Valid',
  'Bu açılış boyunca. Eşleşen cihaz hatırlanır.': 'Until Fırlat restarts. Paired devices are remembered.',
  'Adres': 'Address',
  'Adresi kopyala': 'Copy address',
  'Diğer adresler': 'Other addresses',
  'Telefon sayfayı açamıyorsa: iki cihaz aynı ağda mı bak; Windows Güvenlik Duvarı sorarsa Python’a Özel ağlar için izin ver. Birden çok adres varsa “Diğer adresler”den başkasını dene.':
    'If the phone can’t open the page: check both are on the same network, and if Windows Firewall asks, allow Python on Private networks. If there are several addresses, try another under “Other addresses”.',
  'Ağ bulunamadı': 'No network found',
  'Bu bilgisayar bir Wi-Fi ya da kablolu ağa bağlı görünmüyor. Bağlanınca sayfayı yenile.':
    'This computer doesn’t seem to be on a Wi-Fi or wired network. Refresh the page once it is.',
  'Gelenler': 'Incoming files',
  '{size} boş': '{size} free',

  // devices
  'Ağdakiler': 'On the network',
  '{n} cihaz': (v) => pl(v.n, 'device', 'devices').toUpperCase(),
  'Bu bilgisayar · ana istasyon': 'This computer · host',
  'Bu cihaz': 'This device',
  'SEN': 'YOU',
  'ALICI': 'TO',
  'AÇIK': 'ON',
  'Şimdi yalnızca {name} cihazına gönderiyorsun.': 'You are now sending only to {name}.',
  'Herkese göndermeye dön': 'Send to everyone again',
  'Yalnızca {name} cihazına gönder': 'Send only to {name}',
  'Şimdilik yalnızsın. QR’ı okutan ilk cihaz burada belirir.': 'Just you for now. The first device to scan the QR code shows up here.',
  'Ana bilgisayar şu an görünmüyor; birazdan döner.': 'The host isn’t visible right now; it will be back shortly.',

  // times and sizes (lib.js)
  '/sn': '/s',
  'bitmek üzere': 'almost done',
  '~{n} sn': '~{n} s',
  '~{n} dk': '~{n} min',
  '~{n} sa': '~{n} h',
  'şimdi': 'now',
  '{n} dk önce': '{n} min ago',
  'dün {time}': 'yesterday {time}',

  // server messages (server.py speaks Turkish)
  'Kod tutmadı.': 'That code didn’t match.',
  'Çok fazla deneme. 5 dakika sonra tekrar dene.': 'Too many tries. Try again in 5 minutes.',
  'Bilgisayarda yer kalmadı.': 'The computer is out of disk space.',
  'Metin çok uzun; dosya olarak gönder.': 'That text is too long; send it as a file.',
  'Yalnızca gönderen ya da ana bilgisayar silebilir.': 'Only the sender or the host can delete this.',
  "static/ yok: frontend'i derle (npm run build)": 'No static/ folder: build the frontend (npm run build)',
}
