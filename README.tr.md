# MaRQ: Mikrokanal ve Kopyalama Kalitesi Analizörü

*English: [README.md](README.md)*

MaRQ, optik profilometri nokta bulutlarında mikrokanalları ölçer ve bir kanalın iki
yüzeyini, A ile B'yi, karşılaştırarak B'nin A'ya ne kadar benzediğini derecelendirir. Tamamen
bilgisayarınızda çalışır: analiz çekirdeği, tarayıcı motorunda Pyodide aracılığıyla
çalışan Python'dur (NumPy, SciPy). Bu yüzden hiçbir şey kurulmaz ve hiçbir ölçüm verisi
bilgisayardan çıkmaz. `vendor/` klasöründeki gömülü çalışma ortamıyla internet bağlantısı
olmadan da çalışır. Arayüz İngilizce ya da Türkçedir.

İki iş akışı, ortak bir yükleme ve ön işleme altyapısını paylaşır:

- **Tek yüzey.** Kanalı çevreleyen düz yüzeyi (çevre yüzey) yataylar, kanal eksenini hizalar
  ve şunları verir: taban, orta derinlik ve ağız genişlikleri, derinlik, yan duvar açısı,
  taban ve ağız köşelerinin yuvarlaklığı, uzunluk ve tabanla çevre yüzeyin ISO 25178
  pürüzlülüğü; ayrıca ortalama kesit, kanal boyunca genişlikler ve her dilimin
  derinliği. Kanalın yataylanmış, hizalanmış bir kırpımını dışa aktarır.
- **İki yüzey.** İki kırpımı ortak bir ızgarada çakıştırır ve yükseklik korelasyonu RQ'yu,
  yönlü eğim korelasyonları RQdx ve RQdy'yi, ve iki yüzeyin ortak kanal içi üzerinde tüm
  yüzey eğim büyüklüğü korelasyonu RQd'yi hesaplar; yükseklik farkı ve eğim hatası
  haritalarıyla birlikte. Toplu kip, bir referansı birden çok yüzeyle karşılaştırır.

RQd ve yazılım şu makalede anlatılmaktadır: M. O. Güngör, J. Charmet, E. Yıldırım,
*A 3D measurement workflow for assessing replication quality and tool degradation
in moulded microfluidic channels*, Measurement (gönderildi, 2026). Yazılımı, beklenen
sonuçlarıyla bir örnek kanalı ve çalışmanın nokta bulutlarını içeren eşlik arşivi
Zenodo'dadır: https://doi.org/10.5281/zenodo.22813916 (makale yayımlanana kadar erişimi
kısıtlıdır).

## MaRQ'ı çalıştırma

Python dahil hiçbir şeyin kurulması gerekmez. Zip dosyasını çıkarın, bu klasörü açın ve:

- **Windows 10/11:** `MaRQ.exe` dosyasına çift tıklayın. *Windows bilgisayarınızı korudu*
  iletisi çıkarsa *Ek bilgi*, ardından *Yine de çalıştır* düğmesine tıklayın
  (program kod imzalı değildir).
- **macOS 11 ve sonrası:** `MaRQ.command` dosyasına çift tıklayın. macOS ilk seferde onay
  ister: macOS 15 ve sonrasında *Sistem Ayarları*, *Gizlilik ve Güvenlik*, *Yine de Aç*;
  daha eski sürümlerde dosyaya Control tuşuyla tıklayıp *Aç*'ı seçin. Yine de
  başlamazsa Terminal'e `sh ` yazın, `MaRQ.command` dosyasını pencereye sürükleyin ve
  Return tuşuna basın.
- **Linux:** bu klasörde bir terminalde `sh MaRQ.sh`.

Küçük bir konsol penceresi *MaRQ is running at http://127.0.0.1:8000/* yazar ve MaRQ kendi
penceresinde açılır: Chrome'un ya da Edge'in uygulama kipi, adres çubuğu ve sekmeler
olmadan (Edge her Windows 10 ve 11 ile gelir). Bu iki tarayıcı da yoksa MaRQ varsayılan
tarayıcının bir sekmesinde açılır (güncel bir Firefox ya da Safari de çalışır);
`MaRQ.exe --tab` bilerek sekme ister. MaRQ'ın penceresi kapatılınca MaRQ durur
ve konsol penceresi de birkaç saniye sonra kapanır; konsolu kapatmak da MaRQ'ı durdurur
(`MaRQ.exe --stay`, pencere kapandıktan sonra da çalışmayı sürdürür). Hiçbir şey açılmazsa adresi bir tarayıcıya kendiniz yazın. MaRQ
çalışırken yeniden başlatılırsa aynı MaRQ'a yeni bir pencere açılır; böylece tarayıcının
adrese göre sakladığı ayarlar korunur.

**MaRQ başlamazsa**

- *Windows bilgisayarınızı korudu*: *Ek bilgi*, *Yine de çalıştır*. Çıkarmadan önce zip
  dosyasına sağ tıklayıp *Özellikler*'de *Engellemeyi kaldır* kutusunu işaretleyin: çıkarılan
  dosyalar indirilmiş olarak işaretlenmez ve soru bir daha gelmez.
- MaRQ.exe kaybolursa ya da virüs koruması onu engellerse, veya Akıllı Uygulama Denetimi
  *Yine de çalıştır* seçeneği sunmazsa: Go ile yazılmış programlar bazen zararlı yazılım
  sanılır. Dosyayı geri yükleyip izin verin ya da Python 3'ü kurup `MaRQ.bat` dosyasına çift
  tıklayın; MaRQ bu durumda Python ile başlar.
- *The MaRQ files are not next to this program*: zip açılmış ama çıkarılmamış, ya da
  MaRQ.exe başka bir yere kopyalanmış. Programı çıkarılan klasörde başlatın; masaüstünde
  bir simge için kısayol oluşturun (MaRQ.exe'ye sağ tıklayıp *Gönder*, *Masaüstü*; macOS'te
  *Takma Ad Oluştur*).
- macOS, Terminal'in İndirilenler klasörüne erişip erişemeyeceğini sorarsa *Tamam* deyin ve
  MaRQ'ı yeniden başlatın. MaRQ'ı İndirilenler dışında bir klasöre çıkarmak bu soruyu
  önler.
- OneDrive, iCloud ya da Dropbox ile eşitlenen bir klasörde dosyaların yalnızca yer
  tutucuları bulunabilir: MaRQ'ı bilgisayardaki yerel bir klasöre çıkarın.
- MaRQ'ın üstündeki kırmızı uyarı neyin eksik olduğunu söyler: doğrudan açılmış bir
  `index.html` (başlatıcıyı kullanın), eksik bir `vendor/` klasörü (zip dosyasının tamamını
  yeniden çıkarın) ya da kapatılmış bir konsol penceresi (MaRQ'ı yeniden başlatın).
- MaRQ'ı güncellemeden önce konsol penceresini kapatın: Windows çalışan bir `MaRQ.exe`
  dosyasının üzerine yazamaz.

Sayfanın bir HTTP sunucusundan gelmesi gerekir (bir `file://` sayfası analiz motorunu
başlatamaz; `index.html` dosyasına çift tıklamak bunu söyleyen kırmızı bir uyarı
gösterir). Başlatıcılar, `launcher/` klasöründeki Go kaynaklarından `tools/build_launchers.py` ile
derlenen küçük programlardır (bağımlılık yok): bu klasörü yalnızca 127.0.0.1
üzerinde, sabit içerik türleriyle sunar ve pencereyi açarlar. `MaRQ.exe` Windows
sürümüdür; `MaRQ.command` ve `MaRQ.sh`, `launchers/` içinden macOS (Apple silicon ya da
Intel) veya Linux (x86-64 ya da Arm) için doğru olanı başlatır ve o çalışmazsa Python 3'e
geçer. `MaRQ.bat` Windows'ta aynısını yapar; `python run_marq.py` ise Python 3 kurulu her
yerde çalışır. Herhangi bir statik sunucu da olur (`npx serve`, VS Code'un Live Server
eklentisi). Arşivdeki `HOW_TO_RUN.txt`, ilk başlatmada çıkabilecek iletileri ve her biri
için ne yapılacağını listeler. `tests/e2e_check.py`, çalışan bir MaRQ'ı Chromium, Firefox
ya da WebKit'te çalıştırır ve arşivin örnek verileriyle denetler.

**Çevrimdışı.** `vendor/` klasörü Plotly.js, three.js ve NumPy ile SciPy içeren Pyodide
çalışma ortamını barındırır (37 MB; sürümler ve lisanslar `vendor/README.md` içinde).
Bu yüzden ilk başlatma hiçbir şey indirmez ve durum çubuğunda "Hazır (çevrimdışı paket)"
yazar. `vendor/` yoksa, örneğin yalnızca kaynak kod indirildiyse, Plotly ve Pyodide içerik
dağıtım ağlarından (CDN) gelir, bu yüzden ilk başlatmada internet gerekir, ve 3B görünümler
three.js yerine Plotly ile çizilir; `python tools/fetch_vendor.py` paketi geri getirir.

## Pencere

- **Şerit** (üstte): komutlar, gruplar hâlinde: *Yüzey* (Aç, Analiz et, A olarak ata,
  B olarak ata, Kırpımı kaydet), *Karşılaştırma* (A'yı aç, B'yi aç, Karşılaştır, Yorumla,
  toplu işlem), *Dışa aktar*, *Görünüm* ve *Genel* (Ayarlar, Günlük). İlk kez kullanan birinin
  büyük olasılıkla sıradaki komutu kırmızı çerçeveyle gösterilir.
- **Model ağacı** (solda): girdiler (analiz edilecek tarama, A yüzeyi, B yüzeyi; bir dosya
  açmak için satıra tıklayın ya da dosyayı üzerine bırakın) ve her sonucun bütün
  görünümleri. Analiz edilen her nokta bulutunun bütün görünümleriyle kendi düğümü vardır;
  böylece önceki bir analiz (örneğin B analiz edilip karşılaştırıldıktan sonra A yüzeyininki)
  her zaman yeniden açılabilir. Ekrandaki analiz (adı kırmızı) *A olarak ata*, *B olarak
  ata*, *Kırpımı kaydet*, dışa aktarmalar ve raporun kullandığı analizdir; bir adın yanındaki
  A ve B, kırpımları yuvaları dolduran analizleri gösterir. Analiz motoru en yeni altı
  analizi tutar (daha eskisi yine görüntülenebilir); bir düğümün × düğmesi analizini
  oturumdan çıkarır. Her karşılaştırmanın ve her toplu karşılaştırmanın da aynı biçimde
  kendi düğümü vardır (B adıyla, yanında A); motor en yeni dördünü tutar. *Oturumun özeti*
  bütün analizleri ve karşılaştırmaları, toplu satırlar ve artık tutulmayan sonuçlar dahil,
  iki tabloda listeler; model ağacındakiler bir düğmeyle açılır. Bir sonucun yanındaki nokta, onun *Ayarlar*'daki şimdiki değerlerden
  farklı ayarlarla yapıldığını gösterir; Özellikler hangilerinin değiştiğini söyler.
- **Özellikler** (sağda): ekrandaki sonucun ölçülen değerleri; fareyle üzerine
  gelindiğinde her birinin açıklaması çıkar. Uzunluklar 0,1 µm, açılar 0,1° ve
  korelasyonlar üç ondalıkla verilir, şekillerde ve raporda olduğu gibi; iki yan duvar ve
  iki çevre yüzey şeridi kanalın tarafıyla, −Y ve +Y, adlandırılır. Başlığındaki kopyalama
  düğmesi değerleri bir hesap tablosuna yapıştırmak üzere tablo olarak kopyalar.
- **Görünüm alanı** (ortada): model ağacında seçilen görünüm; üstünde başlığı ve ayrıntıları,
  altında gezinme çubuğu. Pencerenin herhangi bir yerine bırakılan dosya, analiz edilecek
  tarama olarak açılır.
- **Durum çubuğu** (altta): bir çalıştırmanın ilerleyişi (her adımı ve kalite denetim
  değerini gösteren canlı analiz günlüğü için tıklayın; günlük kopyalanabilir ya da metin
  dosyası olarak kaydedilebilir), imlecin altındaki koordinatlar,
  ayarların makaledeki değerler olup olmadığı ve, çevrimdışı paket değilse, çalışma
  ortamının nereden geldiği. Bir analiz ya da karşılaştırma sürerken görünümün üstündeki bir
  kart adımlarını listeler, bitenleri ve sürmekte olanı işaretler, saniyeleri sayar ve *İptal*
  düğmesini taşır; toplu karşılaştırmada çifti ve bir ilerleme çubuğunu gösterir.
- **Başlık çubuğu**: *Dosya* menüsü (nokta bulutu ya da oturum açma, oturumu kaydetme,
  örnekle deneme, rapor ve dışa aktarmalar), *Seçenekler* menüsü, dil (English, Türkçe), açık ya da
  koyu tema, yardım ve Hakkında. Seçim yapılmamışsa MaRQ İngilizce açılır ve sistemin temasını izler.
- **Arayüz boyutu** (*Seçenekler*): *Otomatik* pencereye sığdırır, küçük ya da kısa bir pencerede
  daha küçük; ya da %80 ile %150 arasında tek bir boyut. MaRQ seçilen boyutta kalır ve tarayıcının
  yakınlaştırmasını (Chrome ve Edge'in MaRQ'nun adresi için hatırladığı Ctrl ile artı ya da eksi) geri
  alır; böylece her zaman kendi boyutunda açılır. Şekiller de %100'deki gibi çizilip bütün olarak
  boyuta göre ölçeklenir. Bir yakınlaştırma bulunduğunda bir bildirim bunu ve tarayıcıyı %100'e
  döndüren tuşları (Ctrl ile 0, Mac'te Command ile 0) söyler.

Bölmeler kenarları sürüklenerek boyutlandırılabilir. Model ağacının ve Özellikler'in
başlığındaki düğme, daha geniş bir görünüm için o bölmeyi gizler; görünüm başlığının o
ucundaki düğme bölmeyi geri getirir ve seçim hatırlanır. 1366 pikselin altında bütün boyutlar
pencereyle birlikte küçülür; böylece şerit ve bölmeler küçük bir dizüstü ekranında da
oranlarını korur. Daha geniş bir pencere görünüm alanına daha çok yer bırakır.
Süren bir analiz iptal edilebilir (şeritte *İptal*); motor birkaç saniyede yeniden
başlar.

**Örnek.** Başlangıç sayfasındaki ya da *Dosya* menüsündeki *Örnekle dene*, yapay bir
600 µm kanal ve onun 4 µm daha geniş, 3 µm daha sığ bir kopyasını, ikisi de yaklaşık 2 µm
aynı yüzey dokusuyla, oluşturur; sonra ikisini analiz eder, A ve B olarak atar ve
karşılaştırır, adım adım; böylece kendi taramanız olmadan bütün görünümler görülebilir.

**Gezinme.** 3B görünümlerde yüzeyi imlecin altındaki noktanın çevresinde döndürmek için
sol düğmeyle sürükleyin (Z yukarıda kalır); kaydırmak için sağ ya da orta düğmeyle (veya
Shift ve sol düğmeyle) sürükleyin; imlece doğru yakınlaştırmak için tekerleği kullanın;
çift tıklama yüzeyi görünüme sığdırır. Köşedeki görünüm küpü yönelimi gösterir; bir
yüzüne tıklamak görünümü o tarafa çevirir. Görünümün altındaki gezinme çubuğunda
başlangıç görünümü, sığdırma, yakınlaştırma ve uzaklaştırma, üstten, önden (kanal
boyunca) ve sağdan (kesit) görünümler, ortografik izdüşüm (bir eksen boyunca bakan
görünümlerde ölçek çubuğuyla), araçlar ve PNG anlık görüntüsü vardır. Tuşlar: H başlangıç,
F sığdır, + ve − yakınlaştır ve uzaklaştır, 1 üst, 2 ön, 3 sağ, O ortografik ya da
perspektif, M ölçme, S kesit, C dik kesit, Esc noktaları siler. **Ölç**, yüzeyde tıklanan
iki nokta arasındaki uzaklığı düzlemde ve yükseklikte verir; **Kesit**, tıklanan iki nokta
arasındaki çizgi boyunca yükseklik profilini, **dik kesit** ise tıklanan bir noktadan kanalı
dik kesen profili görünümün altında açar (karşılaştırma görünümlerinde A ve B yüzeyleri ile
yükseklik farkları A − B); her ikisi de CSV olarak kaydedilebilir. 2B grafiklerde kaydırmak için sürükleyin;
yakınlaştırmak için tekerleği ya da + ve − düğmelerini kullanın; kutu aracı çizilen
kutuya yakınlaştırır; çift tıklama görünümü sıfırlar.

Haritalar ve 3B görünümler kare gösterim hücreleri üzerinde çizilir (birkaç mikrometre;
otomatik seçilir ve günlükte bildirilir). Bunlar yalnızca gösterim içindir: sayılar
noktalardan ve karşılaştırmada belirtilen aralıktaki ortak ızgaradan gelir. 3B görünümler
kanalın gerçek oranlarını gösterir; *Derinlik ölçeği* (Görünüm) sığ mikroyapıları
göstermek için yükseklikleri ×2 ile ×10 arasında büyütebilir. **Gerçek oranlar**
(Görünüm, varsayılan olarak açık) iki ekseni de uzunluk olan her 2B grafikte iki eksende
aynı ölçeği kullanır; böylece kanal biçimini korur ve bir değişim kanalın boyutuyla
orantılı gösterilir. Küçük bir değişimin okunması gerektiğinde, her eksenin paneli
doldurması için kapatın. Harita görünümlerinin bağlantı düğmesi (bir zincir) altı
karşılaştırma haritasını birlikte yakınlaştırır ve kaydırır; 3B görünümlerinki A yüzeyi,
B yüzeyi ve eğim hatası için tek bir kamera kullanır. *Renkler* yükseklik haritalarının renk ölçeğini (değiştirilmedikçe Earth), *3B ayrıntı* 3B
görünümlerin ağını belirler (değiştirilmedikçe Yüksek; *Çok yüksek* her hücreyi çizer: analiz
kırpımını voksel boyutunda, karşılaştırma ızgarasını tam aralığında).

## Girdi biçimleri

- Ayraçlı metin nokta bulutları: `.txt`, `.xyz`, `.asc`, `.csv`; x y z olmak üzere üç
  sütun, yaygın herhangi bir ayraç, ondalık virgülle birlikte noktalı virgül de. Dosyanın başındaki metin satırları (sütun adları, cihaz
  bilgileri) kendiliğinden atlanır; *Atlanacak başlık satırları* (Ayarlar) sayılarını elle
  belirler. MaRQ mikrometre ile çalışır. Koordinatları 150 birimden daha dar
  (milimetre ya da metre) ya da 150 000 birimden daha geniş (nanometre) bir alana yayılan
  bir dosya, analiz için açıldığında başka bir birimde sayılır ve MaRQ onu çevirmeyi
  önerir; çarpan analizle birlikte saklanır (dışa aktarmalarda `input_scale`).
- ISO 25178-72 X3P dosyaları (`.x3p`); yüklenirken mikrometreye çevrilir.

X3P yolunu bir cihaz dosyası olmadan denemek için `python tests/make_test_x3p.py`
çalıştırın. Bu, `tests/test_channel.x3p` dosyasını yazar: 10 µm ızgarada, 200 µm genişliğinde
ve 60 µm derinliğinde parabolik bir kanalı olan 1,2 mm × 0,5 mm'lik yapay bir yüzey. Bunu
*Kanal boyunca kırpma payı* 100, *Kanal enine kırpma payı* 50 ve *Kenar payı* 20 ile,
gerisi varsayılan değerlerdeyken analiz edin; günlüğün ilk satırlarında "Format: X3P
(ISO 25178-72)" yazar ve bildirilen derinlik 60 µm'dir.

## Sınırlar

MaRQ, yüzeyin üzerinde yataylandığı düz bir çevre yüzey içindeki tek ve doğrusal bir kanal ya da
sırt için yapılmıştır. Bilinen geometrili yapay kanallarla (`tests/test_cores.py`) makalenin
ayarlarında, 5 µm'lik vokselle sınanmıştır:

- **Derinlik.** Derinlik, sınanan her değerde, 3 µm'den 5 mm'ye kadar, tabanın altındaki optik
  boşluklarla birlikte de doğru okunur. Genişlikler ve duvar açısı, duvarın yana doğru birkaç
  voksel boyunca uzanmasını gerektirir; düşeyden 10° eğik bir duvar bunu yaklaşık 100 µm'den
  derin kanallarda sağlar. Daha sığ bir kanal için, tarama yeterince sık örneklenmişse daha küçük
  bir voksel seçin: 1 µm'de 20 µm derinlikten itibaren kanallar eksiksiz ölçülür. Derinliği
  taban pürüzlülüğünün yalnızca birkaç katı olan bir kanalda, derinliğin %90'ındaki taban
  genişliği bu pürüzlülüğün içinde kalır ve belirli bir değeri yoktur.
- **Genişlik.** Kanal, iki yanında kenar payından (100 µm, Ayarlar) geniş bir düz çevre yüzey
  şeridi kaldığı sürece taramanın çoğunu kaplayabilir. Tarama genişliğinin yaklaşık %0,3'ü kadar
  dar da olabilir (20 mm'lik bir taramada 30 µm'lik bir kanal), tabanı en az dört voksel
  genişliğinde olduğu sürece. Keskin bir taban ya da ağız köşesinin yanında bir genişlik ya da
  uzunluk, yarım vokselden az, yaklaşık 2 µm sapabilir.
- **Çıkıntılar.** Bir sırt, yüksekliği ne olursa olsun bulunur ve kanala çevrilir. Kanalın
  yanındaki kenar kabarıklıkları ya da çapaklar, çevre yüzeyin üstüne kanalın altına indiğinden
  daha az çıktıkları sürece sorun değildir; daha yüksek kabarıklıkları olan bir kanal sırt sayılır
  ve *Ayarlar*'da *Mikroyapı* *Kanal* yapılınca ölçülür. Aynı biçimde, bir sırtın yanında sırtın
  yüksekliğinden derin oluklar onu kanal gibi gösterir ve *Sırt* onu ölçer.
- **Sabit sınırlar.** Çevre yüzeyin 40 µm'den fazla üstündeki malzeme analizden önce cihazın
  sivri noktaları olarak atılır; kanalın yanında daha yükseğe çıkan bir kenar kabarıklığı ya da
  çapak da onunla gider. Kanal tabanının çok altındaki noktalar optik boşluk olarak atılır: 380 µm
  ile taban derinliğinin 1,15 katından büyük olanının altındakiler (günlük her iki sınırı ve kaç
  noktayı attıklarını verir). Karşılaştırma ızgarası her uzunlukta belirtilen aralığını korur,
  8 milyon hücreye kadar (örneğin 5 µm'de 40 mm'ye 5 mm); daha büyük bir ızgara, daha büyük bir
  aralık seçmeyi ya da yüzeyleri kırpmayı söyleyen bir iletiyle durur. Tabanında 1,5 µm'den az
  doku bulunan bir yüzey idealize (CAD) yüzey sayılır: karşılaştırmalarında temel sonuç RQ olur.
  Çevre yüzeyden 10 mm'den uzak yükseklikler, örneğin cihazın dolgu değerleri, hiçbir zaman
  taban düzeyi sayılmaz.
- **Kısa tabanlar ve sığ çiftler.** Taban pürüzlülüğü şeridinden (4000 µm) kısa bir taban şeridi
  kısaltır: şerit, duvarlardan uzak durduğu gibi, ölçülen tabanın içinde taban genişliğinin
  dörtte biri kadar önce biter ve günlük bunu belirtir. İki yüzeyin ortak kanal içinde 10'dan az
  hücre kaldığında korelasyonlar ortak ızgaranın tamamı üzerinden alınır ve Özellikler bunu
  belirtir.

## İş akışı A: tek yüzey

1. Nokta bulutunu **Aç**ın (ya da pencereye bırakın).
2. Ayarları varsayılan değerlerinde bırakın; bunlar makalede kullanılan değerlerdir.
   *Ayarlar* (şerit) bunları listeler: Mikroyapı Otomatik, Voksel boyutu 5, Çevre yüzey bandı 2,5 ortanca mutlak
   sapma, Kanal boyunca kırpma payı 180, Kanal enine kırpma payı 100, derinliğin 0,10'u
   Ağız seviyesi ve 0,90'ı Taban seviyesi, ölçülen taban genişliğinin 0,5'i Taban pürüzlülük
   şeridi genişliği (makaledeki toplu analizler nominal genişliği kullandı, bu yüzden taban
   pürüzlülüğü ikinci ondalıkta farklı olabilir), Taban pürüzlülük şeridi uzunluğu 4000, Çevre yüzey pürüzlülük şeridi
   genişliği 400 ve uzunluğu 4000; *Gelişmiş* altında: Kenar payı 100 ve Derinlik profili
   dilimleri 80; sağ sütunda, yalnızca gösterimi değiştiren Gösterim hücre boyutu 0
   (otomatik) ve Gösterim yumuşatması 0, ve karşılaştırmada da geçerli olan Atlanacak
   başlık satırları 0. Değiştirilen değerler işaretlenir ve durum çubuğu kaçının
   makaledekinden farklı olduğunu söyler; iletişim kutusundakilerden farklı ayarlarla
   yapılmış bir sonuç model ağacında işaretlenir; *Makaledeki değerler*
   bunları geri getirir; *Kaydet* ve *Yükle* bir JSON ayar dosyası yazar ve okur;
   değerler bilgisayarda hatırlanır.
3. **Analiz et**. Özellikler genişlikleri, derinliği, yan duvar açısını, köşe yuvarlaklığını,
   uzunlukları, duvar baskınlığını, pürüzlülüğü ve hizalamayı gösterir; model ağacı görünümleri listeler:
   *Hizalama*, *Kanal tespiti*, *Profiller* (taban genişliği ve ağız seviyeleri, duvar
   konumları ve orta yan duvar çizgileriyle ortalama kesit ve her dilimin derinliği; ızgara
   çizgisi başına genişlik ve uzunluk; merkez çizgileri), *3B görünüm* ve *Pürüzlülük
   alanları*. *Profiller* altındaki *Seçilen konumda kesit*, kanalı boyunca herhangi bir
   noktada dik keser: kanalın bir ucundan (ölçülen taban seviyesi uçları) ötekine giden bir
   kaydırıcı, ya da uzunluğun oranı (0 ile 1 arası) veya baştan mikrometre olarak yazılan
   konum; profil, konuma bir voksel uzaklıktaki noktalardan okunur, karşılaştırma için
   ortalama kesitle birlikte gösterilir ve CSV olarak kaydedilebilir. Eksenleri kanal boyunca
   sabit kalır (tüm genişlik ve en geniş yükseklik aralığı), böylece farklı konumlardaki
   profiller gözle karşılaştırılabilir. Günlük kalan eğikliği, her duvarın açısını, köşe yuvarlaklığını, kullanılan
   ızgara çizgilerini ve varsa kalite denetim uyarılarını listeler.

   Geometrinin nasıl okunduğu: derinlik, kanalın tamamının ortalama kesitinden gelir.
   Genişlikler, yan duvar açısı ve köşe yuvarlaklığı kanal enine ızgara çizgileri üzerinde
   okunur (bir voksellik hücreler, iki voksel arayla çizgiler, kanalın ortadaki %80'i
   üzerinde): her çizgide bir seviyedeki duvar, merkez çizgisinden dışarı doğru
   ilerlerken yükseklik profilinin o seviyenin ilk kez üstüne çıktığı yerdir; çevresindeki
   iki ızgara noktası arasında ara değerlenir ve her değer çizgiler üzerinden ortancadır.
   Genişlikler derinliğin %90, %50 ve %10'unda alınır. Yan duvar açısı, derinliğin %25 ile
   %75'i arasındaki duvar konumlarından geçen bir doğrudur ve düşeyden ölçülür (alttan
   oyuk bir duvarda negatiftir); düşeye 3°'den yakın bir duvar 3°'nin altında olarak
   bildirilir, çünkü o durumda çözümlenemeyecek kadar az hücreye yayılır. Köşe
   yuvarlaklığı, duvarın taban seviyesinde bu doğrunun ne kadar içinde ve ağız
   seviyesinde ne kadar dışında kaldığıdır. Uzunluk kanal boyunca çizgiler üzerinde, her
   uç dışarıdan içeriye doğru okunur; dışa aktarılan kırpım iki ucu ve kırpma payını
   kapsar. Duvar baskınlığı f_y, eğimin karesinde kanala dik eğimin payıdır; kanal içinde
   (derinliğin 0,20'sinden derin hücreler), kırpımın orta %60'ında, voksel boyutunda ve bir
   hücre yumuşatılmış bir ızgarada hesaplanır. 1'e yakınsa eğimler, onlarla birlikte RQd de,
   yan duvarlarca belirlenir.

   Çıkıntı biçimli bir yapıyı, örneğin bir kalıp ana parçasındaki sırtı, MaRQ kendiliğinden
   bulur ve sivri nokta temizliğinden önce kanala çevirir (gerçek bir döndürme; el yönü
   korunur): yüzey çevre yüzeyin altına indiğinden daha yükseğe çıkar. *Ayarlar*'daki
   *Mikroyapı*, varsayılanı Otomatik, bu kuralın yanıldığı bir tarama için, örneğin kenar
   kabarıklıkları derinliğinden yüksek bir kanal için, taramada bir *Kanal* ya da bir *Sırt*
   olduğunu söyleyebilir (ayarın altındaki *Nasıl karar verir* durumları gösterir). Seçim,
   başka bir dosya açıldığında Otomatik'e döner. Seçilen tarafta hiçbir şey olmadığında ya
   da tarama belirgin bir kanal göstermediğinde ileti bunu söyler.
4. **Kırpımı kaydet**, yataylanmış, hizalanmış, voksellerle seyreltilmiş kırpımı kaydeder
   (mikrometre cinsinden x y z, çevre yüzey z = 0'da, kanal x boyunca, ortalanmış). **A olarak
   ata** ve **B olarak ata** aynı kırpımı doğrudan karşılaştırma yuvalarına yerleştirir.
   Bu kırpımlar İş akışı B'nin girdileridir.

## İş akışı B: iki yüzey

1. A yüzeyini (referans) ve B yüzeyini (karşılaştırılan yüzey) kırpımlarla doldurun: ya
   her yüzeyi analiz ettikten sonra *A olarak ata* ve *B olarak ata* ile, ya da kırpım
   dosyaları için *A'yı aç* ve *B'yi aç* ile. MaRQ, tarama yuvasındaki nokta bulutu henüz
   analiz edilmemişse atamadan önce sorar, bir analizi hem A hem B olarak atamayı reddeder ve
   adında "crop" geçmeyen bir dosyayı A, B ya da toplu işlem dosyası olarak almadan önce sorar.
   Ayrıca aynı noktaları içeren iki yüzeyi
   karşılaştırmadan önce (RQ = 1 verir) ve A'nın noktalarını içeren ya da listedeki başka
   bir dosyayı tekrarlayan dosyalarla toplu karşılaştırmadan önce sorar; dosyaları adlarına
   göre değil içeriklerine göre tanır. Aynı kanalın herhangi iki yüzeyi
   karşılaştırılabilir. MaRQ'ın geliştirildiği çalışmada referans iç kalıp, karşılaştırılan
   yüzey kalıplanmış parçaydı; kalıp bozunması için ikisi de iki farklı kalıplamadaki aynı
   iç kalıptı, önceki A oldu.
2. *Ayarlar* içinde, *Karşılaştırma* altında Izgara aralığı 5 µm ve Eğimlerden önce
   yumuşatma 0 değerlerini koruyun; bunlar makaledeki değerlerdir. 0 yumuşatma, RQd
   tanımındaki bir hücrelik Gauss süzgeci anlamına gelir. Kanal içi oranı (0,20) ve
   180 derecelik yön denetimi çekirdekte sabittir.
3. **Karşılaştır**. Özellikler RQd, RQ, RQdx ve RQdy değerlerini, her birinin RMSE'siyle
   gösterir; B için korunan yönü, ızgarayı ve kanal içi maskenin boyutunu belirtir.
   Özellikler ayrıca RQd ile RQ'yu 0 ile 1 arasındaki ölçeklerinde gösterir, iki tarama
   için makaledeki çalışmayı gölgeler ve nasıl okunacaklarını söyler. MaRQ not vermez:
   makale bir kabul eşiği tanımlamaz. Görünümler şunlardır: 3B'de *A yüzeyi* ve *B yüzeyi*, B yüzeyi
   üzerinde 3B çizilmiş *Eğim hatası*, *Yükseklik haritaları* (A, B ve işaretli fark A − B)
   ve *Eğim haritaları* (A ile B'nin eğim büyüklükleri ve işaretsiz eğim hatası), her biri
   kanal içi maskenin sınırıyla (haritaların altındaki bir düğme onu gösterir ya da
   gizler), ve tek yüzeydeki gibi kanal boyunca seçilen bir konumda
   *A ve B kesitleri*, ikinci eksende yükseklik farkı A − B ile; yükseklik ve fark eksenleri
   kanal boyunca en geniş aralıklarında sabittir. İki harita görünümü birlikte yakınlaştırılır ve kaydırılır. Günlük, B'nin hangi yönünün korunduğunu,
   geçerli hücre oranını ve maske boyutunu belirtir; ölçüt tablosu korunan yöne aittir.
4. **Yorumla** (bir karşılaştırmadan sonra; toplu işlemler yorumlanmaz): A ile B'nin ne
   olduğunu seçin: tasarım (CAD), üretildiği gibi kalıp, kullanımdan sonra kalıp, bir parça ya
   da yeniden taranmış aynı yüzey. Kalıp burada bir kalıp, ana kalıp ya da damga olabilir. Çift, makaledeki değerlendirme görevlerinden birini oluşturur (Kalıp üretim
   kalitesi, Kopyalama kalitesi, Kalıbın bozulması, Tüm zincirin kalitesi; kullanılmış kalıba
   karşı tasarım ve yeniden tarama iki ek görevdir). Görev, seçim yapılırken, makaledeki
   görevler tablosunun ve yüzey çizimlerinin yanında adlandırılır (*Hangi değerler okunur*,
   Özellikler'de de). Karşılaştırmanın bir düğümü olan *Yorum* görünümü görev için okunacak
   değerleri, A ile B'nin boyutlarını yan yana ve sonraki eksi önceki yüzey olarak, her birinin
   bir referansla okumasını verir, asla bir hüküm vermez: önceki yüzeyin ikinci bir taraması
   oturumda aynı ayarlarla karşılaştırılıp öyle yorumlandıysa onun yeniden tarama düzeyi, yoksa
   makaledeki çalışma (yeniden taranan değişmemiş bir yüzey 0,92 ile 0,95, kalıp-parça çiftleri
   0,17 ile 0,91, 0,02'den küçük farklar yorumlanmaz). Roller seçildiğinde Özellikler onlara
   uyar: aralarında bir tasarım varsa birincil ölçüler RQ ve boyutlardır. A daha sonraki yüzey
   olarak seçildiğinde MaRQ, A ile B'nin gerçekten bunlar olup olmadığını (öyleyse ikisini
   değiştirip yeniden karşılaştırır; iki yüzey hâlâ yuvalardayken sunulur), rollerin ters
   seçilip seçilmediğini (rolleri değiştirir) ya da olduğu gibi bırakmayı sorar:
   korelasyonlar sıraya neredeyse hiç bağlı değildir (B 180° döndürüldüğünde yaklaşık 0,001) ve
   farklar her durumda sonraki eksi önceki olarak yazılır. Yorum oturumla kaydedilir, Sonuçlar
   (JSON)'a yazılır ve raporda karşılaştırmanın sayfasına basılır.
5. **Toplu işlem**: *Toplu dosyalar…* ile birden çok dosya seçin ve **Toplu karşılaştır**'a
   tıklayın. *Toplu sonuçlar* görünümü her dosya için RQ, RQdx, RQdy ve RQd değerlerini
   listeler; *Göster* bir çifti şekilleri için yeniden çalıştırır. Toplu karşılaştırmanın
   kendi düğümü vardır; A yüzeyi bütün liste için bir kez okunur, sayılar her çiftin tek
   başına karşılaştırıldığındakilerdir.

Yeni bir tema, renk ölçeği, 3B ayrıntı ya da dil, ekrandaki şekli hemen, her sonucun diğer
şekillerini görünümleri açıldığında yeniden çizer.

RQd belirtilen bir ızgara hücre boyutunda tanımlıdır. Farklı hücre boyutlarında
hesaplanan değerler karşılaştırılamaz; makale RQd'yi, cihazın yanal çözünürlüğüne göre
seçilen 5 µm'de bildirir.

## Dışa aktarma

- **Şekil**: herhangi bir şekil, SVG ya da PNG (2× veya 3×) olarak; belgeler için açık
  temada ya da geçerli temada; metni arayüz dilinde, İngilizce ya da Türkçe; seçilen
  boyutta. Şekil o boyutta eksenler ve renk çubuğuyla yeniden oluşturulur; böylece
  etiketler ve çizgi kalınlıkları okunaklı kalır; altı karşılaştırma haritası tek bir şekil
  olarak da dışa aktarılabilir. İki dergi boyutu, tek sütun (90 mm genişlik) ve iki sütun
  (190 mm), şekli basılacağı boyutta, yazıları 7 ile 9 punto arasında ve görünümün başlığı
  olmadan çizer: inç başına 300 ya da 600 noktalık bir PNG (dosya çözünürlüğünü belirtir)
  ya da bir SVG; genişlik ve yükseklik milimetre olarak değiştirilebilir. Bir görünümün
  altındaki kamera düğmesi onu ekranda göründüğü gibi PNG olarak kaydeder. Karşılaştırma
  haritalarının altındaki düğmeler yakınlaştırmalarını bağlar ve kanal içinin dış çizgisini
  gösterir; karşılaştırmanın 3B görünümlerinin altındaki düğme kameralarını bağlar.
- **Sonuçlar (JSON)**: oturumun bütün sayıları, bütün ayarları ve çizgi ile dilim başına
  serileri; yazılım ve çalışma ortamı sürümleriyle.
- **Sonuçlar (CSV)**: analiz edilen her yüzey için bir satır ve her karşılaştırma için bir
  satır.
- **Rapor** (Dışa aktar ya da Dosya menüsü): her sonuç için yazdırılabilir bir sayfa:
  Özellikler bölmesindeki sayılar, ayarlar (makaledekinden farklı olanlar kalın) ve açık
  temada, A4'te etiketleri okunur kalsın diye basıldıkları boyuta yakın çizilen ana
  şekiller. İletişim kutusundan yazdırılabilir ya da PDF olarak kaydedilebilir,
  veya bir HTML dosyası olarak kaydedilebilir.
- **Oturum** (Dosya, *Oturumu kaydet*, Ctrl+S): yeniden açılan bir oturumun gerek
  duymadığı şeyler (gösterim ızgaralarının ardındaki nokta listeleri ve eğim bileşenleri;
  bir sonucun yaklaşık %40'ı) dışında, analiz motorunun tuttuğu bütün sonuçları (analizler
  ve karşılaştırmalar),
  oturum kaydını, ayarları ve A ile B yüzeylerini içeren bir `.marq` dosyası. *Oturum aç*
  ya da dosyayı pencereye bırakmak, sonuçları yeni bir analiz olmadan geri getirir:
  görüntülenebilir, dışa aktarılabilir, yeniden karşılaştırılabilir ve başka bir temada ya
  da dilde yeniden oluşturulabilirler. Dosya yalnızca veri içerir (JSON ve NumPy dizileri);
  çalıştırılan hiçbir şey içermez.

Kaydederken yer sorulur: Chrome ve Edge, son kaydın klasöründe sistemin kaydetme penceresini
açar; Firefox ve Safari dosyayı indirme klasörlerine kaydeder ve durum çubuğu dosyanın adını
söyler. Bazı sonuçlar ne oturum ne de JSON ya da CSV olarak kaydedilmişken MaRQ kapatılırsa
önce sorulur.

JSON ve CSV dosyaları, arayüz dili ne olursa olsun İngilizce ve ondalık noktalıdır; böylece
her tabloda ve betikte aynı biçimde okunurlar.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html`, `style.css`, `app.js` | Arayüz ve ana iş parçacığı mantığı |
| `viewer3d.js` | 3B görünüm alanı (three.js) |
| `i18n.js` | Arayüz dilleri (Türkçe metinler) |
| `worker.js` | Pyodide'i başlatan ve analizleri çalıştıran web worker |
| `pvisual_core.py` | Tek yüzey modülü: yataylama, hizalama, geometri, pürüzlülük, kırpım dışa aktarma |
| `rq_gradient_core.py` | Çift modülü: çakıştırma, RQ, RQdx, RQdy, RQd, hata haritaları |
| `x3p_loader.py` | ISO 25178-72 X3P okuyucu |
| `plots.py` | Plotly şekil oluşturucuları ve çevirileri |
| `MaRQ.exe`, `MaRQ.command`, `MaRQ.sh`, `launchers/` | Hiçbir kurulum gerektirmeyen başlatıcılar (Windows; macOS; Linux); `launcher/` klasöründeki Go kaynaklarından `tools/build_launchers.py` ile derlenir |
| `MaRQ.bat`, `run_marq.py` | Python 3 üzerinden yedek başlatıcılar |
| `tests/e2e_check.py`, `tests/e2e_synthetic.py`, `tests/e2e_features.py` | Çalışan bir MaRQ'ın tarayıcı testleri: sayılar örnek verilere ya da yapay bir kanala karşı, arayüz yapay bir iç kalıp ve parça üzerinde |
| `tests/test_cores.py` | Analiz modüllerinin tarayıcısız testleri: biçimi bilinen yapay kanallar ve test kanalı ile kopyasının kayıtlı sayıları (`tests/test_cores_expected.json`); GitHub denetimi bunları MaRQ çalışma ortamının NumPy ve SciPy sürümleriyle çalıştırır |
| `tests/launcher_check.py` | Bir başlatıcının tarayıcısız testi: sunduğu dosyalar, klasör başına tek MaRQ, son pencere kapanınca durma |
| `vendor/` | Çevrimdışı kullanım için gömülü Plotly.js, three.js ve NumPy ile SciPy içeren Pyodide çalışma ortamı |
| `tools/fetch_vendor.py` | Paketi sabitlenmiş sürümlerde yeniden indirir ve doğrular |
| `tools/make_icons.py` | Simgeyi (`logo.svg`) başlatıcıların ve sayfanın kullandığı her boyutta çizer |
| `tests/make_test_x3p.py` | Yükleyiciyi denemek için yapay X3P üreteci |

## Atıf

Lütfen yukarıdaki makaleye ve yazılıma atıf yapın. `CITATION.cff` ikisini de makinece
okunabilir biçimde içerir; GitHub'ın "Cite this repository" düğmesi bunu kullanır.

## Lisans

Telif hakkı (C) 2026 Mehmet Oğulcan Güngör. MaRQ, GNU Genel Kamu Lisansı sürüm 3 ile
yayımlanan özgür bir yazılımdır (`LICENSE`). Gömülü üçüncü taraf bileşenler kendi
lisanslarını korur: Plotly.js ve three.js (MIT), Pyodide (MPL-2.0), NumPy, SciPy ve
OpenBLAS (BSD-3-Clause); bkz. `vendor/README.md`.

## Destek

Orta Doğu Teknik Üniversitesi'nde, TÜBİTAK 22AG008 (MAESTRO) projesi ve Avrupa Birliği
Ufuk Avrupa (Horizon Europe) programının 101079473 sayılı hibe sözleşmesi (OrChESTRA)
desteğiyle geliştirilmiştir.
