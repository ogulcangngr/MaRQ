# MaRQ: Mikrokanal ve Kopyalama Kalitesi Analizörü

*English: [README.md](README.md)*

MaRQ, optik profilometri nokta bulutlarında mikrokanalları ölçer ve bir kanalın iç
kalıptan kalıplanmış parçaya ne kadar doğru kopyalandığını derecelendirir. Tamamen
bilgisayarınızda çalışır: analiz çekirdeği, tarayıcı motorunda Pyodide aracılığıyla
çalışan Python'dur (NumPy, SciPy). Bu yüzden hiçbir şey kurulmaz ve hiçbir ölçüm verisi
bilgisayardan çıkmaz. `vendor/` klasöründeki gömülü çalışma ortamıyla internet bağlantısı
olmadan da çalışır. Arayüz İngilizce ya da Türkçedir.

İki iş akışı, ortak bir yükleme ve ön işleme altyapısını paylaşır:

- **Tek yüzey.** Kanalı çevreleyen düz yüzeyi (düzlem) yataylar, kanal eksenini hizalar
  ve şunları verir: taban, orta derinlik ve ağız genişlikleri, derinlik, duvar açısı,
  taban ve ağız köşelerinin yuvarlaklığı, uzunluk ve tabanla düzlemin ISO 25178
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

## MaRQ'yu çalıştırma

Python dahil hiçbir şeyin kurulması gerekmez. Zip dosyasını çıkarın, bu klasörü açın ve:

- **Windows 10/11:** `MaRQ.exe` dosyasına çift tıklayın. *Windows bilgisayarınızı korudu*
  iletisi çıkarsa *Ek bilgi*, ardından *Yine de çalıştır* düğmesine tıklayın
  (program kod imzalı değildir).
- **macOS 12 ve sonrası:** `MaRQ.command` dosyasına çift tıklayın. macOS ilk seferde onay
  ister: macOS 15 ve sonrasında *Sistem Ayarları*, *Gizlilik ve Güvenlik*, *Yine de Aç*;
  daha eski sürümlerde dosyaya Control tuşuyla tıklayıp *Aç*'ı seçin. Yine de
  başlamazsa Terminal'e `sh ` yazın, `MaRQ.command` dosyasını pencereye sürükleyin ve
  Return tuşuna basın.
- **Linux:** bu klasörde bir terminalde `sh MaRQ.sh`.

Küçük bir konsol penceresi *MaRQ is running at http://127.0.0.1:8000/* yazar ve MaRQ kendi
penceresinde açılır: Chrome'un ya da Edge'in uygulama kipi, adres çubuğu ve sekmeler
olmadan (Edge her Windows 10 ve 11 ile gelir). Bu iki tarayıcı da yoksa MaRQ varsayılan
tarayıcının bir sekmesinde açılır (güncel bir Firefox ya da Safari de çalışır);
`MaRQ.exe --tab` bilerek sekme ister. Çalışırken konsol penceresini açık tutun; MaRQ'yu
durdurmak için kapatın. Hiçbir şey açılmazsa adresi bir tarayıcıya kendiniz yazın.

Sayfanın bir HTTP sunucusundan gelmesi gerekir (bir `file://` sayfası analiz motorunu
başlatamaz; `index.html` dosyasına çift tıklamak bunu söyleyen kırmızı bir uyarı
gösterir). Başlatıcılar, `launcher/main.go` dosyasından `tools/build_launchers.py` ile
derlenen küçük programlardır (Go, bağımlılık yok): bu klasörü yalnızca 127.0.0.1
üzerinde, sabit içerik türleriyle sunar ve pencereyi açarlar. `MaRQ.exe` Windows
sürümüdür; `MaRQ.command` ve `MaRQ.sh`, `launchers/` içinden macOS (Apple silicon ya da
Intel) veya Linux (x86-64 ya da Arm) için doğru olanı başlatır ve o çalışmazsa Python 3'e
geçer. `MaRQ.bat` Windows'ta aynısını yapar; `python run_marq.py` ise Python 3 kurulu her
yerde çalışır. Herhangi bir statik sunucu da olur (`npx serve`, VS Code'un Live Server
eklentisi). Arşivdeki `HOW_TO_RUN.txt`, ilk başlatmada çıkabilecek iletileri ve her biri
için ne yapılacağını listeler. `tests/e2e_check.py`, çalışan bir MaRQ'yu Chromium, Firefox
ya da WebKit'te çalıştırır ve arşivin örnek verileriyle denetler.

**Çevrimdışı.** `vendor/` klasörü Plotly.js, three.js ve NumPy ile SciPy içeren Pyodide
çalışma ortamını barındırır (84 MB; sürümler ve lisanslar `vendor/README.md` içinde).
Bu yüzden ilk başlatma hiçbir şey indirmez ve durum çubuğunda "Hazır (çevrimdışı paket)"
yazar. `vendor/` yoksa, örneğin yalnızca kaynak kod indirildiyse, sayfa içerik dağıtım
ağlarına (CDN) döner ve ilk başlatmada internet gerekir; `python tools/fetch_vendor.py`
paketi geri getirir.

## Pencere

- **Şerit** (üstte): komutlar, gruplar hâlinde: *Yüzey* (Aç, Analiz et, A olarak ata,
  B olarak ata, Kırpımı kaydet), *Karşılaştırma* (A'yı aç, B'yi aç, Karşılaştır, toplu
  işlem), *Dışa aktar*, *Görünüm* ve *Genel* (Ayarlar, Günlük). İlk kez kullanan birinin
  büyük olasılıkla sıradaki komutu kırmızı çerçeveyle gösterilir.
- **Tarayıcı** (solda): girdiler (analiz edilecek tarama, A yüzeyi, B yüzeyi; bir dosya
  açmak için satıra tıklayın ya da dosyayı üzerine bırakın) ve her sonucun bütün
  görünümleri. Göstermek için bir görünüme tıklayın.
- **Özellikler** (solda, altta): ekrandaki sonucun ölçülen değerleri; fareyle üzerine
  gelindiğinde her birinin açıklaması çıkar.
- **Görünüm alanı** (ortada): tarayıcıda seçilen görünüm; üstünde başlığı ve ayrıntıları,
  altında gezinme çubuğu. Pencerenin herhangi bir yerine bırakılan dosya, analiz edilecek
  tarama olarak açılır.
- **Durum çubuğu** (altta): bir çalıştırmanın ilerleyişi (her adımı ve kalite denetim
  değerini gösteren canlı analiz günlüğü için tıklayın), imlecin altındaki koordinatlar,
  ayarların makaledeki değerler olup olmadığı ve çalışma ortamının çevrimdışı paket olup
  olmadığı.
- **Başlık çubuğu**: dil (English, Türkçe), açık ya da koyu tema, yardım ve Hakkında.
  Seçim yapılmamışsa MaRQ sistemin dilini ve temasını izler.

Bölmeler kenarları sürüklenerek boyutlandırılabilir ve bütün boyutlar pencereyi izler;
böylece yerleşim dizüstü bir bilgisayarda da büyük bir ekranda da oranlarını korur.
Süren bir analiz iptal edilebilir (şeritte *İptal*); motor birkaç saniyede yeniden
başlar.

**Gezinme.** 3B görünümlerde yüzeyi imlecin altındaki noktanın çevresinde döndürmek için
sol düğmeyle sürükleyin (Z yukarıda kalır); kaydırmak için sağ ya da orta düğmeyle (veya
Shift ve sol düğmeyle) sürükleyin; imlece doğru yakınlaştırmak için tekerleği kullanın;
çift tıklama yüzeyi görünüme sığdırır. Köşedeki görünüm küpü yönelimi gösterir; bir
yüzüne tıklamak görünümü o tarafa çevirir. Görünümün altındaki gezinme çubuğunda
başlangıç görünümü, sığdırma, yakınlaştırma ve uzaklaştırma, üstten, önden (kanal
boyunca) ve sağdan (kesit) görünümler, ölçek çubuklu ortografik izdüşüm ve PNG anlık
görüntüsü vardır. Tuşlar: H başlangıç, F sığdır, + ve − yakınlaştır ve uzaklaştır, 1 üst,
2 ön, 3 sağ, O ortografik ya da perspektif. 2B grafiklerde kaydırmak için sürükleyin;
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
doldurması için kapatın. **Haritaları bağla** altı karşılaştırma haritasını birlikte
yakınlaştırır ve kaydırır; **3B görünümleri bağla** A yüzeyi, B yüzeyi ve eğim hatası için
tek bir kamera kullanır. *Renkler* yükseklik haritalarının renk ölçeğini, *3B ayrıntı* 3B
görünümlerin ağını belirler.

## Girdi biçimleri

- Ayraçlı metin nokta bulutları: `.txt`, `.xyz`, `.asc`, `.csv`; x y z olmak üzere üç
  sütun, yaygın herhangi bir ayraç; başlık satırları *Atlanacak başlık satırları*
  (Ayarlar) ile atlanır. Birimler dosyanınkilerdir; makalenin verileri mikrometredir.
- ISO 25178-72 X3P dosyaları (`.x3p`); yüklenirken mikrometreye çevrilir.

X3P yolunu bir cihaz dosyası olmadan denemek için `python tests/make_test_x3p.py`
çalıştırın. Bu, `tests/test_channel.x3p` dosyasını yazar: 10 µm ızgarada, 200 µm genişliğinde
ve 60 µm derinliğinde parabolik bir kanalı olan 1,2 mm × 0,5 mm'lik yapay bir yüzey. Bunu
*Kanal boyunca kırpma payı* 100, *Kanal enine kırpma payı* 50 ve *Kenar payı* 20 ile,
gerisi varsayılan değerlerdeyken analiz edin; günlüğün ilk satırlarında "Format: X3P
(ISO 25178-72)" yazar ve bildirilen derinlik 60 µm'dir.

## İş akışı A: tek yüzey

1. Nokta bulutunu **Aç**ın (ya da pencereye bırakın).
2. Ayarları varsayılan değerlerinde bırakın; bunlar makalede kullanılan değerlerdir.
   *Ayarlar* (şerit) bunları listeler: Voksel boyutu 5, Düzlem bandı 2,5 ortanca mutlak
   sapma, Kanal boyunca kırpma payı 180, Kanal enine kırpma payı 100, derinliğin 0,10'u
   Ağız seviyesi ve 0,90'ı Taban seviyesi, kanal genişliğinin 0,5'i Taban pürüzlülük
   şeridi genişliği, Taban pürüzlülük şeridi uzunluğu 4000, Düzlem pürüzlülük şeridi
   genişliği 400 ve uzunluğu 4000; *Gelişmiş* altında: Kenar payı 100, Gösterim hücre
   boyutu 0 (otomatik), Gösterim yumuşatma 0, Derinlik profili dilimleri 80, Atlanacak
   başlık satırları 0. Birimler dosyanınkilerdir. Değiştirilen değerler işaretlenir ve
   durum çubuğu kaçının makaledekinden farklı olduğunu söyler; *Makaledeki değerler*
   bunları geri getirir; *Kaydet* ve *Yükle* bir JSON ayar dosyası yazar ve okur;
   değerler bilgisayarda hatırlanır.
3. **Analiz et**. Özellikler genişlikleri, derinliği, duvar açısını, köşe yuvarlaklığını,
   uzunlukları, pürüzlülüğü ve hizalamayı gösterir; tarayıcı görünümleri listeler:
   *Hizalama*, *Kanal tespiti*, *Profiller* (taban genişliği ve ağız seviyeleri, duvar
   konumları ve orta duvar çizgileriyle ortalama kesit ve her dilimin derinliği; ızgara
   çizgisi başına genişlik ve uzunluk; merkez çizgileri), *3B görünüm* ve *Pürüzlülük
   alanları*. Günlük kalan eğikliği, her duvarın açısını, köşe yuvarlaklığını, kullanılan
   ızgara çizgilerini ve varsa kalite denetim uyarılarını listeler.

   Geometrinin nasıl okunduğu: derinlik, kanalın tamamının ortalama kesitinden gelir.
   Genişlikler, duvar açısı ve köşe yuvarlaklığı kanal enine ızgara çizgileri üzerinde
   okunur (bir voksellik hücreler, iki voksel arayla çizgiler, kanalın ortadaki %80'i
   üzerinde): her çizgide bir seviyedeki duvar, merkez çizgisinden dışarı doğru
   ilerlerken yükseklik profilinin o seviyenin ilk kez üstüne çıktığı yerdir; çevresindeki
   iki ızgara noktası arasında ara değerlenir ve her değer çizgiler üzerinden ortancadır.
   Genişlikler derinliğin %90, %50 ve %10'unda alınır. Duvar açısı, derinliğin %25 ile
   %75'i arasındaki duvar konumlarından geçen bir doğrudur ve düşeyden ölçülür (alttan
   oyuk bir duvarda negatiftir); düşeye 3°'den yakın bir duvar 3°'nin altında olarak
   bildirilir, çünkü o durumda çözümlenemeyecek kadar az hücreye yayılır. Köşe
   yuvarlaklığı, duvarın taban seviyesinde bu doğrunun ne kadar içinde ve ağız
   seviyesinde ne kadar dışında kaldığıdır. Uzunluk kanal boyunca çizgiler üzerinde, her
   uç dışarıdan içeriye doğru okunur; dışa aktarılan kırpım iki ucu ve kırpma payını
   kapsar.
4. **Kırpımı kaydet**, yataylanmış, hizalanmış, voksellerle seyreltilmiş kırpımı kaydeder
   (mikrometre cinsinden x y z, düzlem z = 0'da, kanal x boyunca, ortalanmış). **A olarak
   ata** ve **B olarak ata** aynı kırpımı doğrudan karşılaştırma yuvalarına yerleştirir.
   Bu kırpımlar İş akışı B'nin girdileridir.

## İş akışı B: iki yüzey

1. A yüzeyini (referans) ve B yüzeyini (karşılaştırılan yüzey) kırpımlarla doldurun: ya
   her yüzeyi analiz ettikten sonra *A olarak ata* ve *B olarak ata* ile, ya da kırpım
   dosyaları için *A'yı aç* ve *B'yi aç* ile. Kopyalama kalitesi için referans iç kalıp,
   karşılaştırılan yüzey parçadır; kalıp bozunması için ikisi de iki farklı kalıplamadaki
   aynı iç kalıptır, önceki A olur.
2. *Ayarlar* içinde, *Karşılaştırma* altında Izgara aralığı 5 µm ve Eğimlerden önce
   yumuşatma 0 değerlerini koruyun; bunlar makaledeki değerlerdir. 0 yumuşatma, RQd
   tanımındaki bir hücrelik Gauss süzgeci anlamına gelir. Kanal içi oranı (0,20) ve
   180 derecelik yön denetimi çekirdekte sabittir.
3. **Karşılaştır**. Özellikler RQd, RQ, RQdx ve RQdy değerlerini, her birinin RMSE'siyle
   gösterir; B için korunan yönü, ızgarayı ve kanal içi maskenin boyutunu belirtir.
   Araç sayıları ve haritaları verir, yorumlamayı kullanıcıya bırakır; makale bir kabul
   eşiği tanımlamaz. Görünümler şunlardır: 3B'de *A yüzeyi* ve *B yüzeyi*, B yüzeyi
   üzerinde 3B çizilmiş *Eğim hatası*, ve *Yükseklik ve eğim haritaları*: iki yüzeyin
   yükseklik ve eğim büyüklüğü haritaları, işaretli yükseklik farkı B − A ve işaretsiz eğim
   hatası, kanal içi maskenin sınırıyla birlikte. Günlük, B'nin hangi yönünün korunduğunu,
   geçerli hücre oranını ve maske boyutunu belirtir; ölçüt tablosu korunan yöne aittir.
4. **Toplu işlem**: *Toplu dosyalar…* ile birden çok dosya seçin ve **Topluyu çalıştır**'a
   tıklayın. *Toplu sonuçlar* görünümü her dosya için RQ, RQdx, RQdy ve RQd değerlerini
   listeler; *Göster* bir çifti şekilleri için yeniden çalıştırır.

RQd belirtilen bir ızgara hücre boyutunda tanımlıdır. Farklı hücre boyutlarında
hesaplanan değerler karşılaştırılamaz; makale RQd'yi, cihazın yanal çözünürlüğüne göre
seçilen 5 µm'de bildirir.

## Dışa aktarma

- **Şekil**: herhangi bir şekil, SVG ya da PNG (2× veya 3×) olarak; belgeler için açık
  temada ya da geçerli temada; metni arayüz dilinde, İngilizce ya da Türkçe; seçilen
  boyutta. Şekil o boyutta eksenler ve renk çubuğuyla yeniden oluşturulur; böylece
  etiketler ve çizgi kalınlıkları okunaklı kalır. Bir görünümün altındaki kamera düğmesi
  onu ekranda göründüğü gibi PNG olarak kaydeder.
- **Sonuçlar (JSON)**: oturumun bütün sayıları, bütün ayarları ve çizgi ile dilim başına
  serileri; yazılım ve çalışma ortamı sürümleriyle.
- **Sonuçlar (CSV)**: analiz edilen her yüzey için bir satır ve her karşılaştırma için bir
  satır.

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
| `MaRQ.exe`, `MaRQ.command`, `MaRQ.sh`, `launchers/` | Hiçbir kurulum gerektirmeyen başlatıcılar (Windows; macOS; Linux); `launcher/main.go` dosyasından `tools/build_launchers.py` ile derlenir |
| `MaRQ.bat`, `run_marq.py` | Python 3 üzerinden yedek başlatıcılar |
| `tests/e2e_check.py`, `tests/e2e_synthetic.py` | Çalışan bir MaRQ'nun örnek verilere ya da yapay bir kanala karşı tarayıcı testleri |
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
