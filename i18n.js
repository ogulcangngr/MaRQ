/* MaRQ interface languages. English is written in the page and in app.js; this file holds the
   other languages, keyed by the English text, and translates the page in place.

   Static page text: every text node, title and placeholder is looked up by its English
   wording. Blocks that mix bold, links or subscripts inside a sentence carry a
   data-i18n="key" attribute and are translated as a whole (I18N_HTML), because the word
   order differs between languages. Text built by app.js goes through t().

   The Turkish terms follow the thesis (iç kalıp, kalıplanmış parça, kopyalama kalitesi,
   ölçüt, yan duvar); numbers take a decimal comma in Turkish. Exported files (CSV, JSON)
   stay in English with decimal points, so they read the same everywhere. */

const LANGS = { en: "English", tr: "Türkçe" };

const I18N = { tr: {
  // title bar, ribbon
  "Microchannel and Replication Quality Analyzer": "Mikrokanal ve Kopyalama Kalitesi Analizörü",
  "Switch to the dark theme": "Koyu temaya geç",
  "Switch to the light theme": "Açık temaya geç",
  "Switch between the light and the dark theme": "Açık ve koyu tema arasında geç",
  "Mouse, keyboard and workflow": "Fare, klavye ve iş akışı",
  "About MaRQ: version, citation, licences": "MaRQ hakkında: sürüm, atıf, lisanslar",
  "Interface language": "Arayüz dili",
  "Open a point cloud to analyse (.txt, .xyz, .asc, .csv, .x3p)": "Analiz edilecek nokta bulutunu aç (.txt, .xyz, .asc, .csv, .x3p)",
  "Open": "Aç",
  "Level and align the surface, find the channel, measure it": "Yüzeyi yatayla ve hizala, kanalı bul, ölç",
  "Analyse": "Analiz et",
  "Keep the cropped channel of this analysis as surface A, the reference (usually the mould insert)":
    "Bu analizin kırpılmış kanalını referans olan A yüzeyi olarak ata (genellikle iç kalıp)",
  "Keep as A": "A olarak ata",
  "Keep the cropped channel of this analysis as surface B, the compared surface (usually the moulded part)":
    "Bu analizin kırpılmış kanalını karşılaştırılan B yüzeyi olarak ata (genellikle kalıplanmış parça)",
  "Keep as B": "B olarak ata",
  "Save the levelled, aligned, voxel-thinned crop of the channel as an x y z text file":
    "Kanalın yataylanmış, hizalanmış ve voksellerle seyreltilmiş kırpımını x y z metin dosyası olarak kaydet",
  "Save crop": "Kırpımı kaydet",
  "Surface": "Yüzey",
  "Open a crop file as surface A, the reference": "Bir kırpım dosyasını referans olan A yüzeyi olarak aç",
  "Open A": "A'yı aç",
  "Open a crop file as surface B, the compared surface": "Bir kırpım dosyasını karşılaştırılan B yüzeyi olarak aç",
  "Open B": "B'yi aç",
  "Compare surface B with surface A: RQ, RQdx, RQdy and RQd": "B yüzeyini A yüzeyiyle karşılaştır: RQ, RQdx, RQdy ve RQd",
  "Compare": "Karşılaştır",
  "Choose several surfaces to compare with surface A, one after the other": "A yüzeyiyle sırayla karşılaştırılacak birden çok yüzey seç",
  "Batch files…": "Toplu dosyalar…",
  "Compare surface A with every chosen surface": "A yüzeyini seçilen her yüzeyle karşılaştır",
  "Run batch": "Toplu karşılaştır",
  "Stop the running analysis and restart the engine": "Süren analizi durdur ve motoru yeniden başlat",
  "Cancel": "İptal",
  "Comparison": "Karşılaştırma",
  "Any figure as SVG or PNG, in the current or the light theme, at a chosen size": "Herhangi bir şekli SVG ya da PNG olarak, geçerli ya da açık temada, seçilen boyutta",
  "Figure": "Şekil",
  "Every number and every setting of this session": "Bu oturumun bütün sayıları ve ayarları",
  "Results JSON": "Sonuçlar (JSON)",
  "One row per analysed surface and per comparison": "Analiz edilen her yüzey ve her karşılaştırma için bir satır",
  "Results CSV": "Sonuçlar (CSV)",
  "Export": "Dışa aktar",
  "Lock the y scale of the 2D plots to the x scale, so the channel keeps its true proportions. Off: each axis fills the panel, small variations become visible.":
    "2B grafiklerde y ölçeğini x ölçeğine kilitle; kanal gerçek oranlarını korur. Kapalıyken her eksen paneli doldurur, küçük değişimler görünür olur.",
  "True proportions": "Gerçek oranlar",
  "Zoom and pan all comparison maps together": "Bütün karşılaştırma haritalarını birlikte yakınlaştır ve kaydır",
  "Link the maps": "Haritaları bağla",
  "Keep the same 3D camera for surface A, surface B and the slope error": "A yüzeyi, B yüzeyi ve eğim hatası için aynı 3B kamerayı kullan",
  "Link the 3D views": "3B görünümleri bağla",
  "Colour scale of every height map (2D and 3D)": "Bütün yükseklik haritalarının renk ölçeği (2B ve 3B)",
  "Colours": "Renkler",
  "Mesh budget of the 3D views (cells); higher is sharper but slower to turn": "3B görünümlerin ağ bütçesi (hücre); yüksek değer daha keskin ama döndürmesi daha yavaş",
  "3D detail": "3B ayrıntı",
  "Low": "Düşük", "Medium": "Orta", "High": "Yüksek",
  "Stretch the heights in the 3D views, to see shallow features": "Sığ mikroyapıları görmek için 3B görünümlerde yükseklikleri büyüt",
  "Depth scale": "Derinlik ölçeği",
  "True (×1)": "Gerçek (×1)",
  "View": "Görünüm",
  "Analysis settings (the paper defaults unless changed)": "Analiz ayarları (değiştirilmedikçe makaledeki değerler)",
  "Settings": "Ayarlar",
  "Show or hide the analysis log": "Analiz günlüğünü göster ya da gizle",
  "Log": "Günlük",
  "Setup": "Genel",

  // browser and properties
  "Browser": "Model ağacı",
  "Inputs": "Girdiler",
  "The point cloud to analyse; click or drop a file here": "Analiz edilecek nokta bulutu; tıklayın ya da dosyayı buraya bırakın",
  "Scan": "Tarama",
  "Open or drop a point cloud": "Bir nokta bulutu açın ya da bırakın",
  "Remove": "Kaldır",
  "Surface A, the reference (a crop kept from an analysis, or a crop file); click or drop a file here":
    "Referans olan A yüzeyi (bir analizden atanan kırpım ya da bir kırpım dosyası); tıklayın ya da dosyayı buraya bırakın",
  "Reference": "Referans",
  "empty": "boş",
  "Surface B, the compared surface; click or drop a file here": "Karşılaştırılan B yüzeyi; tıklayın ya da dosyayı buraya bırakın",
  "Compared": "Karşılaştırılan",
  "Surface analysis": "Yüzey analizi",
  "Alignment": "Hizalama",
  "Channel detection": "Kanal tespiti",
  "Profiles": "Profiller",
  "Cross-section and depth": "Kesit ve derinlik",
  "Width and length": "Genişlik ve uzunluk",
  "Centre line": "Merkez çizgisi",
  "Longitudinal centre": "Boyuna merkez",
  "3D view": "3B görünüm",
  "Roughness areas": "Pürüzlülük alanları",
  "A and B": "A ve B",
  "Surface A": "A yüzeyi",
  "Surface B": "B yüzeyi",
  "Slope error": "Eğim hatası",
  "Height and slope maps": "Yükseklik ve eğim haritaları",
  "Batch results": "Toplu sonuçlar",
  "Drag to resize": "Boyutlandırmak için sürükleyin",
  "Properties": "Özellikler",
  "The measured geometry, the roughness and the correlations appear here after an analysis.":
    "Ölçülen geometri, pürüzlülük ve korelasyonlar analizden sonra burada görünür.",
  "Start": "Başlangıç",
  "Open a point cloud…": "Nokta bulutu aç…",
  "You can also drop a file anywhere on this window. Everything runs on this computer; no data leave it.":
    "Dosyayı bu pencerenin herhangi bir yerine de bırakabilirsiniz. Her şey bu bilgisayarda çalışır; hiçbir veri dışarı çıkmaz.",
  // start page after a file is opened
  "Opened {name}": "{name} açıldı",
  "Point cloud opened": "Nokta bulutu açıldı",
  "Surface A opened": "A yüzeyi açıldı",
  "Surface B opened": "B yüzeyi açıldı",
  "Surfaces A and B are ready": "A ve B yüzeyleri hazır",
  "Surface A, the reference: not opened yet": "Referans olan A yüzeyi: henüz açılmadı",
  "Surface B, the compared surface: not opened yet": "Karşılaştırılan B yüzeyi: henüz açılmadı",
  "Click <b>Analyse</b> to level and align the surface, find the channel and measure it.":
    "Yüzeyi yataylamak ve hizalamak, kanalı bulup ölçmek için <b>Analiz et</b>'e tıklayın.",
  "Click <b>Compare</b> to grade how faithfully B replicates A, with RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> and RQ<sub>d</sub>.":
    "B'nin A'yı ne kadar iyi kopyaladığını RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> ve RQ<sub>d</sub> ile değerlendirmek için <b>Karşılaştır</b>'a tıklayın.",
  "Now open surface <b>B</b>, the compared surface (usually the moulded part), or analyse its scan and click <b>Keep as B</b>.":
    "Şimdi karşılaştırılan <b>B</b> yüzeyini (genellikle kalıplanmış parça) açın ya da taramasını analiz edip <b>B olarak ata</b>'ya tıklayın.",
  "Now open surface <b>A</b>, the reference (usually the mould insert), or analyse its scan and click <b>Keep as A</b>.":
    "Şimdi referans olan <b>A</b> yüzeyini (genellikle iç kalıp) açın ya da taramasını analiz edip <b>A olarak ata</b>'ya tıklayın.",
  "Open A…": "A'yı aç…",
  "Open B…": "B'yi aç…",
  "The analysis uses the default settings of the paper. To change them before you start, press <b>Settings</b>.":
    "Analiz makaledeki varsayılan ayarlarla yapılır. Başlamadan önce değiştirmek için <b>Ayarlar</b>'a basın.",
  "{n} analysis settings differ from the paper defaults. To check or change them, press <b>Settings</b>.":
    "{n} analiz ayarı makaledeki değerlerden farklı. Kontrol etmek ya da değiştirmek için <b>Ayarlar</b>'a basın.",
  "{n} analysis setting differs from the paper defaults. To check or change it, press <b>Settings</b>.":
    "{n} analiz ayarı makaledeki değerlerden farklı. Kontrol etmek ya da değiştirmek için <b>Ayarlar</b>'a basın.",
  "MaRQ is still starting; the button works in a moment.": "MaRQ hâlâ başlatılıyor; düğme birazdan çalışır.",

  // navigation bar, log, drop, status bar
  "Fit the whole plot (double-click on the plot does the same)": "Grafiğin tamamını sığdır (grafiğe çift tıklamak da aynısını yapar)",
  "Drag to pan (the wheel zooms)": "Kaydırmak için sürükleyin (tekerlek yakınlaştırır)",
  "Drag a box to zoom into it": "Yakınlaştırmak için bir kutu çizin",
  "Zoom in (+)": "Yakınlaştır (+)",
  "Zoom out (−)": "Uzaklaştır (−)",
  "Home view (H)": "Başlangıç görünümü (H)",
  "Fit the surface in the view (F; or double-click)": "Yüzeyi görünüme sığdır (F ya da çift tıklama)",
  "Top view (1)": "Üstten görünüm (1)",
  "Front view: the channel from the side, along its length (2)": "Önden görünüm: kanal yandan, boyunca (2)",
  "Right view: the cross-section of the channel (3)": "Sağdan görünüm: kanalın kesiti (3)",
  "Orthographic projection: no perspective, as in a drawing (O)": "Ortografik izdüşüm: teknik resimdeki gibi perspektifsiz (O)",
  "Save this view as a PNG image": "Bu görünümü PNG resmi olarak kaydet",
  "Analysis log": "Analiz günlüğü",
  "Close the log": "Günlüğü kapat",
  "The log of the analysis appears here.": "Analizin günlüğü burada görünür.",
  "Drop the point cloud to open it": "Açmak için nokta bulutunu bırakın",
  "Click to show the analysis log": "Analiz günlüğünü göstermek için tıklayın",
  "Open the analysis settings": "Analiz ayarlarını aç",
  "Paper defaults": "Makaledeki değerler",
  "Starting…": "Başlıyor…",

  // settings dialog
  "Analysis settings": "Analiz ayarları",
  "Close": "Kapat",
  "All values are the paper defaults.": "Bütün değerler makaledeki değerlerdir.",
  "Back to the values used in the paper": "Makalede kullanılan değerlere dön",
  "Save the current settings as a JSON file": "Geçerli ayarları JSON dosyası olarak kaydet",
  "Save…": "Kaydet…",
  "Load settings from a JSON file": "Ayarları bir JSON dosyasından yükle",
  "Load…": "Yükle…",
  "Voxel size (0 = automatic)": "Voksel boyutu (0 = otomatik)",
  "Grid cell size for downsampling; 0 picks it from the point density.": "Seyreltme için ızgara hücresi boyutu; 0 değeri nokta yoğunluğundan seçer.",
  "Field band (× median absolute deviation)": "Çevre yüzey bandı (× ortanca mutlak sapma)",
  "How tightly the flat field plane is fitted. Lower is a stricter field selection. Levelling and orientation are referenced to this field.":
    "Kanalı çevreleyen düz yüzeye (çevre yüzeye) uydurulan düzlemin ne kadar sıkı uydurulduğu. Düşük değerde çevre yüzey noktaları daha sıkı seçilir. Yataylama ve yönlendirme bu çevre yüzeye göre yapılır.",
  "Crop margin along the channel": "Kanal boyunca kırpma payı",
  "Extra distance beyond the detected channel length at each end of the crop box, in point cloud units.":
    "Kırpma kutusunun her ucunda bulunan kanal uzunluğunun ötesine eklenen mesafe, nokta bulutu biriminde.",
  "Crop margin across the channel": "Kanal enine kırpma payı",
  "Extra distance beyond the detected channel width on each side of the crop box, in point cloud units.":
    "Kırpma kutusunun her yanında bulunan kanal genişliğinin ötesine eklenen mesafe, nokta bulutu biriminde.",
  "Opening level (fraction of depth)": "Ağız seviyesi (derinlik oranı)",
  "Depth fraction where the opening width and length are read. 0.10 is the top 10 % of the depth, close to where the channel meets the flat surface.":
    "Ağız genişliğinin ve uzunluğunun okunduğu derinlik oranı. 0,10 derinliğin üstteki %10'udur, kanalın düz yüzeyle birleştiği yere yakındır.",
  "Floor level (fraction of depth)": "Taban seviyesi (derinlik oranı)",
  "Depth fraction for the floor width, the channel bottom where the nominal width is defined. 0.90 is the bottom 10 % of the depth.":
    "Taban genişliğinin okunduğu derinlik oranı; nominal genişliğin tanımlandığı kanal tabanı. 0,90 derinliğin alttaki %10'udur.",
  "Floor roughness strip width (fraction)": "Taban pürüzlülük şeridi genişliği (oran)",
  "Width of the floor roughness strip as a fraction of the channel width (its central part).": "Taban pürüzlülük şeridinin genişliği, kanal genişliğinin oranı olarak (ortadaki kısmı).",
  "Floor roughness strip length": "Taban pürüzlülük şeridi uzunluğu",
  "Length of the floor roughness strip along the channel, centred on the channel.": "Taban pürüzlülük şeridinin kanal boyunca uzunluğu, kanalın ortasında.",
  "Field roughness strip width": "Çevre yüzey pürüzlülük şeridi genişliği",
  "Fixed width of the left and right field strips. Their position is found automatically, just past the raised channel lip, on clean flat field.":
    "Sol ve sağ çevre yüzey şeritlerinin sabit genişliği. Konumları otomatik bulunur: kabarık kanal kenarının hemen ötesinde, temiz düz yüzeyde.",
  "Field roughness strip length": "Çevre yüzey pürüzlülük şeridi uzunluğu",
  "Fixed length of the field strips along the channel, centred on the channel.": "Çevre yüzey şeritlerinin kanal boyunca sabit uzunluğu, kanalın ortasında.",
  "Advanced": "Gelişmiş",
  "Edge margin": "Kenar payı",
  "Distance from each edge of the scan discarded before the analysis, removing boundary artefacts.": "Analizden önce taramanın her kenarından atılan mesafe; kenar bozulmalarını giderir.",
  "Display cell size (0 = automatic)": "Gösterim hücre boyutu (0 = otomatik)",
  "Side of the square cells of the height maps and the 3D view, in point cloud units. Display only: the geometry and the roughness are computed from the points. 0 chooses the finest cell (never below the voxel size) that keeps each map within 160 000 cells.":
    "Yükseklik haritalarının ve 3B görünümün kare hücrelerinin kenarı, nokta bulutu biriminde. Yalnızca gösterim içindir: geometri ve pürüzlülük noktalardan hesaplanır. 0, her haritayı 160 000 hücrenin altında tutan en ince hücreyi seçer (voksel boyutundan küçük değil).",
  "Display smoothing (cells)": "Gösterim yumuşatması (hücre)",
  "Gaussian blur radius on the display grids, in cells; 0 switches smoothing off.": "Gösterim ızgaralarında Gauss bulanıklığı yarıçapı, hücre olarak; 0 yumuşatmayı kapatır.",
  "Depth profile slices": "Derinlik profili dilimleri",
  "Number of slices along the channel for the local depth and its spread (the widths and the length are read on grid lines).":
    "Yerel derinlik ve dağılımı için kanal boyunca dilim sayısı (genişlikler ve uzunluk ızgara çizgilerinde okunur).",
  "Header rows to skip": "Atlanacak başlık satırları",
  "Number of header rows to skip when reading the point cloud file.": "Nokta bulutu dosyası okunurken atlanacak başlık satırı sayısı.",
  "Grid spacing (µm)": "Izgara aralığı (µm)",
  "Smoothing before the slopes (µm)": "Eğimlerden önce yumuşatma (µm)",
  "Gaussian blur before the slopes are computed. At least one grid cell is always applied, for stable slopes.":
    "Eğimler hesaplanmadan önce Gauss bulanıklığı. Kararlı eğimler için en az bir ızgara hücresi her zaman uygulanır.",
  "Number of header rows to skip when reading the point cloud files.": "Nokta bulutu dosyaları okunurken atlanacak başlık satırı sayısı.",
  "Changed values are marked and remembered on this computer. The paper defaults are the values used in the paper.":
    "Değiştirilen değerler işaretlenir ve bu bilgisayarda hatırlanır. Makaledeki değerler, makalede kullanılan değerlerdir.",

  // export dialog
  "Export a figure": "Şekli dışa aktar",
  "Format": "Biçim",
  "SVG (vector; 3D scenes embedded as images)": "SVG (vektör; 3B sahneler resim olarak gömülü)",
  "PNG, 2× resolution": "PNG, 2× çözünürlük",
  "PNG, 3× resolution": "PNG, 3× çözünürlük",
  "Theme": "Tema",
  "Light (white background, for documents)": "Açık (beyaz arka plan, belgeler için)",
  "Current theme": "Geçerli tema",
  "Dark": "Koyu",
  "Text language": "Metin dili",
  "As the interface": "Arayüzdeki gibi",
  "English": "İngilizce",
  "Turkish": "Türkçe",
  "Size (pixels)": "Boyut (piksel)",
  "As shown on screen": "Ekranda göründüğü gibi",
  "Custom": "Özel",
  "Width": "Genişlik",
  "Height": "Yükseklik",
  "The figure is rebuilt from the result in the chosen theme and size, with axes and a colour bar, so labels and line widths stay legible in a document. For a picture of the 3D viewport as it is on screen, use the camera button below the view.":
    "Şekil, seçilen tema ve boyutta, eksenler ve renk çubuğuyla sonuçtan yeniden oluşturulur; böylece etiketler ve çizgi kalınlıkları bir belgede okunaklı kalır. 3B görünümün ekrandaki hâlinin resmi için görünümün altındaki kamera düğmesini kullanın.",

  // help dialog
  "Using MaRQ": "MaRQ'ı kullanma",
  "3D views": "3B görünümler",
  "Turn": "Döndür",
  "drag with the left button (about the point under the cursor)": "sol düğmeyle sürükleyin (imlecin altındaki noktanın çevresinde)",
  "Pan": "Kaydır",
  "drag with the right or middle button, or Shift + left drag": "sağ ya da orta düğmeyle sürükleyin, ya da Shift + sol sürükleme",
  "Zoom": "Yakınlaştır",
  "mouse wheel, towards the cursor; or the + and − buttons below the view": "fare tekerleği, imlece doğru; ya da görünümün altındaki + ve − düğmeleri",
  "Standard views": "Standart görünümler",
  "click a face of the view cube, or the buttons below the view": "görünüm küpünün bir yüzüne ya da görünümün altındaki düğmelere tıklayın",
  "Fit": "Sığdır",
  "double-click, or F": "çift tıklama ya da F",
  "Keys": "Tuşlar",
  "H home, F fit, + and − zoom, 1 top, 2 front, 3 right, O orthographic or perspective": "H başlangıç, F sığdır, + ve − yakınlaştır ve uzaklaştır, 1 üst, 2 ön, 3 sağ, O ortografik ya da perspektif",
  "2D plots": "2B grafikler",
  "drag": "sürükleyin",
  "mouse wheel; the + and − buttons; or the box tool below the plot": "fare tekerleği, + ve − düğmeleri ya da grafiğin altındaki kutu aracı",
  "Reset": "Sıfırla",
  "double-click": "çift tıklama",

  // about dialog
  "About MaRQ": "MaRQ hakkında",
  "Please cite": "Lütfen atıf yapın",
  ", Measurement (submitted, 2026).": ", Measurement (gönderildi, 2026).",
  "Software and sample data:": "Yazılım ve örnek veriler:",
  "· code:": "· kod:",
  "Runtime": "Çalışma ortamı",
  "detecting…": "belirleniyor…",
  "The metrics": "Ölçütler",

  // status messages
  "Loading the Python runtime…": "Python çalışma ortamı yükleniyor…",
  "Loading the Python runtime (local bundle)…": "Python çalışma ortamı yükleniyor (yerel paket)…",
  "Loading the Python runtime (CDN)…": "Python çalışma ortamı yükleniyor (internet)…",
  "Loading numpy & scipy…": "numpy ve scipy yükleniyor…",
  "Loading analysis modules…": "Analiz modülleri yükleniyor…",
  "Ready": "Hazır",
  "Ready (offline bundle)": "Hazır (çevrimdışı paket)",
  "Offline bundle": "Çevrimdışı paket",
  "Runtime from the internet": "Çalışma ortamı internetten",
  "Analysing the surface…": "Yüzey analiz ediliyor…",
  "Surface analysis complete": "Yüzey analizi tamamlandı",
  "Comparing the two surfaces…": "İki yüzey karşılaştırılıyor…",
  "Comparison complete": "Karşılaştırma tamamlandı",
  "Batch: {n} comparisons…": "Toplu: {n} karşılaştırma…",
  "Batch {i} of {n}: {name}": "Toplu {i}/{n}: {name}",
  "Batch complete: {n} comparisons": "Toplu tamamlandı: {n} karşılaştırma",
  "Preparing the cropped channel…": "Kırpılmış kanal hazırlanıyor…",
  "Crop placed as Surface {slot}": "Kırpım {slot} yüzeyi olarak yerleştirildi",
  "Cropped channel saved": "Kırpılmış kanal kaydedildi",
  "Settings loaded": "Ayarlar yüklendi",
  "Settings file not understood": "Ayarlar dosyası anlaşılamadı",
  "Error, see the log": "Hata, günlüğe bakın",
  "Worker error": "Motor hatası",
  "Cancelled, restarting the engine…": "İptal edildi, motor yeniden başlatılıyor…",
  "MaRQ cannot start here, see the message at the top": "MaRQ burada başlayamıyor, üstteki iletiye bakın",
  "Preparing the figure…": "Şekil hazırlanıyor…",
  "Figure exported ({fmt}, {w}×{h})": "Şekil dışa aktarıldı ({fmt}, {w}×{h})",
  "Figure export failed, see the log": "Şekil dışa aktarılamadı, günlüğe bakın",
  "Step {n} of 9: {text}": "Adım {n}/9: {text}",
  "Loading": "Yükleniyor",
  "Cropping edges": "Kenarlar kırpılıyor",
  "Voxel downsampling": "Voksel seyreltme",
  "Field-plane leveling + orientation": "Çevre yüzeye göre yataylama ve yönlendirme",
  "Channel-axis alignment": "Kanal ekseni hizalama",
  "Display grids": "Gösterim ızgaraları",
  "Cross-section geometry": "Kesit geometrisi",
  "Roughness (ISO 25178)": "Pürüzlülük (ISO 25178)",
  "Comparison: loading the two surfaces…": "Karşılaştırma: iki yüzey yükleniyor…",
  "Comparison: gridding…": "Karşılaştırma: ızgaralanıyor…",
  "Comparison: slopes and correlations…": "Karşılaştırma: eğimler ve korelasyonlar…",
  "Comparison: building the figures…": "Karşılaştırma: şekiller oluşturuluyor…",
  "Building the figures…": "Şekiller oluşturuluyor…",
  "{n} files chosen": "{n} dosya seçildi",
  "1 file chosen": "1 dosya seçildi",
  "{n} value differs from the paper defaults (marked).": "{n} değer makaledeki değerlerden farklı (işaretli).",
  "{n} values differ from the paper defaults (marked).": "{n} değer makaledeki değerlerden farklı (işaretli).",
  "Settings: {n} changed from the paper": "Ayarlar: makaleye göre {n} değişiklik",
  "crop of {name}": "{name} kırpımı",
  "slope error": "eğim hatası",

  // properties panel
  "Channel geometry": "Kanal geometrisi",
  "Floor width": "Taban genişliği",
  "{p} % of depth": "derinlik %{p}",
  "Channel depth": "Kanal derinliği",
  "Wall angle": "Yan duvar açısı",
  "from vertical": "düşeyden",
  "Width variation": "Genişlik değişimi",
  "SD, central 80 %": "SS, ortadaki %80",
  "Opening width": "Ağız genişliği",
  "Corner rounding": "Köşe yuvarlaklığı",
  "floor, rim": "taban, ağız",
  "Floor length": "Taban uzunluğu",
  "Opening length": "Ağız uzunluğu",
  "Feature": "Mikroyapı",
  "depression": "çukur",
  "protrusion, rotated": "çıkıntı, döndürüldü",
  "Roughness, ISO 25178": "Pürüzlülük, ISO 25178",
  "Floor": "Taban",
  "Field, left": "Çevre yüzey, sol",
  "Field, right": "Çevre yüzey, sağ",
  "Rotation about Z": "Z ekseni etrafında dönme",
  "Residual tilt": "Kalan eğiklik",
  "Voxel size": "Voksel boyutu",
  "Surfaces": "Yüzeyler",
  "A, the reference": "A, referans",
  "B, the compared surface": "B, karşılaştırılan yüzey",
  "Correlations": "Korelasyonlar",
  "slope magnitude": "eğim büyüklüğü",
  "height": "yükseklik",
  "slope along": "boyuna eğim",
  "slope across": "enine eğim",
  "Surface B was rotated 180° about Z to match A.": "B yüzeyi A'ya uyması için Z ekseni etrafında 180° döndürüldü.",
  "Surface B was used as it is.": "B yüzeyi olduğu gibi kullanıldı.",
  "Grid {g} µm.": "Izgara {g} µm.",
  "{n} channel-interior cells ({p} % of the valid common grid).": "{n} kanal içi hücre (geçerli ortak ızgaranın %{p} kadarı).",
  "Surface A, {name}, against {n} surfaces": "A yüzeyi, {name}, {n} yüzeye karşı",
  "B orientation": "B yönü",
  "Cells": "Hücre",
  "rotated": "döndürüldü",
  "as it is": "olduğu gibi",
  "Show": "Göster",
  "Run this pair alone to see its figures": "Şekillerini görmek için bu çifti tek başına çalıştır",
  "The 3D views and maps show the last pair. Show runs one pair alone.": "3B görünümler ve haritalar son çifti gösterir. Göster, tek bir çifti çalıştırır.",
  "Surface: ": "Yüzey: ",
  "Comparison: ": "Karşılaştırma: ",
  "Surface A (3D)": "A yüzeyi (3B)",
  "Surface B (3D)": "B yüzeyi (3B)",
  "Slope error (3D)": "Eğim hatası (3B)",
  "local bundle": "yerel paket",
  "internet": "internet",

  // tooltips of the measured values
  "Channel width at the floor level (90 % of the depth by default): median over the grid lines across the central 80 % of the channel, each wall position interpolated between grid points. The figure the nominal width is compared with.":
    "Taban seviyesinde kanal genişliği (varsayılan derinliğin %90'ı): kanalın ortadaki %80'inde ızgara çizgileri üzerinden ortanca; her duvar konumu ızgara noktaları arasında ara değerlenir. Nominal genişlikle karşılaştırılan değer budur.",
  "Standard deviation of the grid-line floor widths over the central 80 % of the channel length: within-scan variation, not an uncertainty of the median.":
    "Kanal uzunluğunun ortadaki %80'inde ızgara çizgisi taban genişliklerinin standart sapması: tarama içi değişim, ortancanın belirsizliği değil.",
  "Channel width near the field (10 % of the depth by default), median of the grid lines, with their standard deviation.":
    "Çevre yüzeye yakın kanal genişliği (varsayılan derinliğin %10'u), ızgara çizgilerinin ortancası, standart sapmalarıyla birlikte.",
  "Median height of the deepest 5 % of the mean cross-section bins, below the field at z = 0.":
    "Ortalama kesitin en derin %5'lik aralıklarının ortanca yüksekliği, z = 0'daki çevre yüzeyin altında.",
  "Mid-wall angle from the vertical: a straight line through the wall positions at 25-75 % of the depth on every grid line, median over the lines and both walls (left and right in brackets). Below 3° the wall spans too few grid cells to be resolved.":
    "Düşeyden yan duvarın orta bölge açısı: her ızgara çizgisinde derinliğin %25–75'indeki yan duvar konumlarından geçen doğru; çizgiler ve iki duvar üzerinden ortanca (parantez içinde sol ve sağ). 3°'nin altında duvar, çözümlenemeyecek kadar az ızgara hücresine yayılır.",
  "Corner rounding: how far the wall lies inside the extended mid-wall line at the floor level (floor corner) and outside it at the opening level (rim corner), per corner.":
    "Köşe yuvarlaklığı: duvarın, uzatılmış orta yan duvar çizgisinin taban seviyesinde ne kadar içinde (taban köşesi) ve ağız seviyesinde ne kadar dışında (ağız köşesi) kaldığı, her köşe için.",
  "Channel length along the centre line at the floor level: median of the grid lines along the channel near its centre line, each end read from the outside in, with their standard deviation.":
    "Taban seviyesinde merkez çizgisi boyunca kanal uzunluğu: kanal boyunca merkez çizgisine yakın ızgara çizgilerinin ortancası; her uç dışarıdan içeriye doğru okunur; standart sapmalarıyla birlikte.",
  "Channel length along the centre line at the opening level.": "Ağız seviyesinde merkez çizgisi boyunca kanal uzunluğu.",
  "Whether the feature was a depression, or a protrusion rotated to a depression (a proper rotation, so handedness is kept).":
    "Mikroyapının çukur mu, yoksa çukura döndürülmüş bir çıkıntı mı olduğu (yansımasız dönme; sağ-sol yönelimi korunur).",
  "Pearson correlation of the two height maps over the channel-interior mask.": "İki yükseklik haritasının kanal içi maske üzerindeki Pearson korelasyonu.",
  "Pearson correlation of the signed slopes along the channel over the mask.": "Kanal boyunca işaretli eğimlerin maske üzerindeki Pearson korelasyonu.",
  "Pearson correlation of the signed slopes across the channel over the mask.": "Kanal enine işaretli eğimlerin maske üzerindeki Pearson korelasyonu.",
  "Pearson correlation of the slope-magnitude maps over the channel-interior mask at the stated grid cell size (5 µm in the paper). The grading metric of the paper.":
    "Eğim büyüklüğü haritalarının, belirtilen ızgara hücre boyutunda (makalede 5 µm) kanal içi maske üzerindeki Pearson korelasyonu. Makalenin derecelendirme ölçütü.",

  // view cube faces
  "Right": "Sağ", "Left": "Sol", "Top": "Üst", "Bottom": "Alt", "Front": "Ön", "Back": "Arka",

  // start-up notices
  "Start MaRQ with its launcher in the software folder: double-click MaRQ.exe (Windows) or MaRQ.command (macOS), or run sh MaRQ.sh (Linux); see README.md.":
    "MaRQ'ı yazılım klasöründeki başlatıcıyla açın: MaRQ.exe (Windows) ya da MaRQ.command (macOS) dosyasına çift tıklayın veya sh MaRQ.sh komutunu çalıştırın (Linux); README.md dosyasına bakın.",
  "MaRQ was opened as a file (index.html), so the browser blocks its analysis engine. Close this tab.":
    "MaRQ bir dosya olarak (index.html) açıldı, bu yüzden tarayıcı analiz motorunu engelliyor. Bu sekmeyi kapatın.",
  "This browser cannot run MaRQ: it lacks WebAssembly or Web Workers. Use a current Chrome, Edge, Firefox or Safari.":
    "Bu tarayıcı MaRQ'ı çalıştıramaz: WebAssembly ya da Web Worker desteği yok. Güncel bir Chrome, Edge, Firefox ya da Safari kullanın.",
  "The analysis engine could not be loaded. If MaRQ comes from the downloaded package, check that the folder software/vendor is complete (extract the whole zip again if unsure); without it MaRQ needs an internet connection. A current Chrome, Edge, Firefox or Safari is needed, and the computer needs about 1 GB of free memory.":
    "Analiz motoru yüklenemedi. MaRQ indirilen paketten geliyorsa software/vendor klasörünün eksiksiz olduğunu denetleyin (emin değilseniz zip dosyasının tamamını yeniden çıkarın); bu klasör olmadan MaRQ internet bağlantısı gerektirir. Güncel bir Chrome, Edge, Firefox ya da Safari ve yaklaşık 1 GB boş bellek gerekir.",
  "The plotting library could not be loaded: the folder software/vendor is incomplete and there is no internet connection. Extract the whole zip again.":
    "Grafik kitaplığı yüklenemedi: software/vendor klasörü eksik ve internet bağlantısı yok. Zip dosyasının tamamını yeniden çıkarın.",

  // errors, said in words
  "The analysis stopped": "Analiz durdu",
  "The comparison stopped": "Karşılaştırma durdu",
  "The batch stopped": "Toplu karşılaştırma durdu",
  "Show the log": "Günlüğü göster",
  "Error: {msg}": "Hata: {msg}",
  "The file is not a text point cloud: it looks like an image or another binary file. MaRQ reads x y z text files (.txt, .xyz, .asc, .csv) and X3P files.":
    "Dosya metin biçiminde bir nokta bulutu değil: bir görüntü ya da başka bir ikili dosya gibi görünüyor. MaRQ x y z metin dosyalarını (.txt, .xyz, .asc, .csv) ve X3P dosyalarını okur.",
  "Line {row} of the file holds text (“{s}”) where numbers are expected. MaRQ reads x y z numbers, one point per line; header lines at the top can be skipped with Header rows to skip in Settings.":
    "Dosyanın {row}. satırında sayı beklenen yerde metin (“{s}”) var. MaRQ her satırda bir nokta olmak üzere x y z sayılarını okur; dosyanın başındaki başlık satırları Ayarlar'daki Atlanacak başlık satırları ile atlanabilir.",
  "The file holds no points: it is empty or has a single line.": "Dosyada nokta yok: dosya boş ya da tek satırlık.",
  "Each line of the file needs three numbers, x y z; this file has fewer columns.":
    "Dosyanın her satırında üç sayı (x y z) olmalı; bu dosyada daha az sütun var.",
  "Too few points are left to analyse. The scan may be nearly empty, or smaller than twice the edge margin (Settings, Advanced).":
    "Analiz için çok az nokta kaldı. Tarama neredeyse boş olabilir ya da kenar payının iki katından küçük olabilir (Ayarlar, Gelişmiş).",
  "The X3P file is damaged or is not an X3P file.": "X3P dosyası bozuk ya da bir X3P dosyası değil.",
  "The browser ran out of memory. Close other tabs and try again, or use a larger voxel size (Settings).":
    "Tarayıcının belleği yetmedi. Diğer sekmeleri kapatıp yeniden deneyin ya da daha büyük bir voksel boyutu kullanın (Ayarlar).",
  "The analysis engine stopped unexpectedly. It is restarting; run the analysis again.":
    "Analiz motoru beklenmedik biçimde durdu. Yeniden başlatılıyor; analizi yeniden çalıştırın.",
  "No clear channel in this scan": "Bu taramada belirgin bir kanal yok",
  "The channel found is {d} µm deep, close to the roughness of the flat surface around it, so the measured geometry has no meaning. Check that the scan contains the channel and that the edge margin (Settings, Advanced) does not cut it away.":
    "Bulunan kanalın derinliği {d} µm, çevresindeki düz yüzeyin pürüzlülüğüne yakın; bu yüzden ölçülen geometrinin bir anlamı yok. Taramada kanalın bulunduğunu ve kenar payının (Ayarlar, Gelişmiş) kanalı kesmediğini denetleyin.",
  "the result could not be shown": "sonuç gösterilemedi",
  "The result could not be shown ({m}). The log has the details.": "Sonuç gösterilemedi ({m}). Ayrıntılar günlükte.",
  "The figure could not be exported": "Şekil dışa aktarılamadı",
  "The crop could not be prepared": "Kırpım hazırlanamadı",
  "MaRQ's server is not running any more: its window was closed. Start MaRQ again (MaRQ.exe, MaRQ.command or MaRQ.sh).":
    "MaRQ'ın sunucusu artık çalışmıyor: penceresi kapatıldı. MaRQ'ı yeniden başlatın (MaRQ.exe, MaRQ.command ya da MaRQ.sh).",
  "MaRQ is taking unusually long to start. Without the offline bundle it loads about 30 MB from the internet, which can take minutes on a slow connection. If nothing changes, close this window and start MaRQ again.":
    "MaRQ'ın açılması alışılmadık ölçüde uzun sürüyor. Çevrimdışı paket olmadan internetten yaklaşık 30 MB indirir; yavaş bir bağlantıda bu birkaç dakika sürebilir. Bir şey değişmezse bu pencereyi kapatıp MaRQ'ı yeniden başlatın.",
  "The file could not be opened": "Dosya açılamadı",
  "{name} is empty, or is a folder. Open a point cloud file.": "{name} boş ya da bir klasör. Bir nokta bulutu dosyası açın.",
  "{name} could not be read. If it is on a network or cloud drive, copy it to this computer first.":
    "{name} okunamadı. Bir ağ ya da bulut sürücüsündeyse önce bu bilgisayara kopyalayın.",
  "Only the first file, {name}, was opened. To compare several surfaces with A, drop them on Batch files… in the ribbon.":
    "Yalnızca ilk dosya ({name}) açıldı. Birkaç yüzeyi A ile karşılaştırmak için dosyaları şeritteki Toplu dosyalar… düğmesinin üzerine bırakın.",
  "Check the settings": "Ayarları denetleyin",
  "These settings are empty or out of range: {list}.": "Şu ayarlar boş ya da izin verilen aralığın dışında: {list}.",
  "Batch complete: {n} comparisons, {f} failed": "Toplu tamamlandı: {n} karşılaştırma, {f} başarısız",
  "Batch {i} of {n}": "Toplu {i}/{n}",
  "failed: {msg}": "başarısız: {msg}",
  "The 3D view is paused: the graphics card reset it. It comes back by itself in a moment.":
    "3B görünüm duraklatıldı: ekran kartı onu sıfırladı. Birazdan kendiliğinden geri gelir.",
  "Depth ×{k}": "Derinlik ×{k}",
  // File menu, sessions
  "File": "Dosya",
  "Open a point cloud…": "Nokta bulutu aç…",
  "Open a session…": "Oturum aç…",
  "Save the session…": "Oturumu kaydet…",
  "Report…": "Rapor…",
  "Export a figure…": "Şekil dışa aktar…",
  "Results as JSON": "Sonuçlar (JSON)",
  "Results as CSV": "Sonuçlar (CSV)",
  "Saving the session…": "Oturum kaydediliyor…",
  "Session saved": "Oturum kaydedildi",
  "Opening the session…": "Oturum açılıyor…",
  "Session opened: {name}": "Oturum açıldı: {name}",
  "The session could not be saved": "Oturum kaydedilemedi",
  "The session could not be opened": "Oturum açılamadı",
  "This file is not a MaRQ session.": "Bu dosya bir MaRQ oturumu değil.",
  "Wait until the engine is ready, then open the session again.": "Analiz motoru hazır olana kadar bekleyin, sonra oturumu yeniden açın.",
  "The results on screen are not saved. Open the session anyway and replace them?":
    "Ekrandaki sonuçlar kaydedilmedi. Oturum yine de açılsın ve onların yerini alsın mı?",

  // report
  "Report": "Rapor",
  "A printable page per result: the numbers, the settings and the main figures (PDF or HTML)":
    "Her sonuç için yazdırılabilir bir sayfa: sayılar, ayarlar ve ana şekiller (PDF ya da HTML)",
  "Save as HTML": "HTML olarak kaydet",
  "Print or save as PDF…": "Yazdır ya da PDF olarak kaydet…",
  "Preparing the report…": "Rapor hazırlanıyor…",
  "Report ready": "Rapor hazır",
  "the report could not be made": "rapor hazırlanamadı",
  "The report could not be made": "Rapor hazırlanamadı",
  "Values that differ from the paper defaults are in bold.": "Makaledeki değerlerden farklı olanlar kalın yazılmıştır.",
  "failed": "başarısız",
  "version": "sürüm",
  "MaRQ report": "MaRQ raporu",

  // 3D tools and the section
  "Measure: click two points on the surface for their distance (M)": "Ölç: uzaklıkları için yüzeyde iki noktaya tıklayın (M)",
  "Section: click two points on the surface for the height profile between them (S)":
    "Kesit: aralarındaki yükseklik profili için yüzeyde iki noktaya tıklayın (S)",
  "Click a point of the surface": "Yüzeyde bir noktaya tıklayın",
  "Click the second point": "İkinci noktaya tıklayın",
  "in plane": "düzlemde",
  "Distance {d} µm (in plane {p} µm, height {z} µm)": "Uzaklık {d} µm (düzlemde {p} µm, yükseklik {z} µm)",
  "Section": "Kesit",
  "The profile as a CSV file": "Profil, CSV dosyası olarak",
  "length {L} µm, from ({x1}; {y1}) to ({x2}; {y2}) µm": "uzunluk {L} µm, ({x1}; {y1}) noktasından ({x2}; {y2}) noktasına, µm",
  "Distance along the section (µm)": "Kesit boyunca uzaklık (µm)",
  "Height (µm)": "Yükseklik (µm)",

  // help: tools and sessions
  "Measure": "Ölçme",
  "the ruler below the view, then click two points of the surface (M)": "görünümün altındaki cetvel, sonra yüzeyde iki noktaya tıklayın (M)",
  "the profile button below the view, then click two points: the height profile between them opens below (S)":
    "görünümün altındaki profil düğmesi, sonra iki noktaya tıklayın: aralarındaki yükseklik profili altta açılır (S)",
  "H home, F fit, + and − zoom, 1 top, 2 front, 3 right, O orthographic or perspective, Esc clears the points":
    "H başlangıç, F sığdır, + ve − yakınlaştır ve uzaklaştır, 1 üst, 2 ön, 3 sağ, O ortografik ya da perspektif, Esc noktaları siler",
  "Sessions": "Oturumlar",
  "Save": "Kaydet",
  "File, Save the session (Ctrl+S): every result, its settings and surfaces A and B in one .marq file":
    "Dosya, Oturumu kaydet (Ctrl+S): bütün sonuçlar, ayarları ve A ile B yüzeyleri tek bir .marq dosyasında",
  "File, Open a session, or drop the .marq file on the window: the results return without a new analysis":
    "Dosya, Oturum aç ya da .marq dosyasını pencereye bırakın: sonuçlar yeni bir analiz olmadan geri gelir",

  // the analyses in the tree, the split maps, cross-sections, saving
  "Remove this analysis from the session": "Bu analizi oturumdan çıkar",
  "Remove the analysis of {name} from this session? Its results leave the session and the exports.":
    "{name} analizi bu oturumdan çıkarılsın mı? Sonuçları oturumdan ve dışa aktarmalardan çıkar.",
  "Shown as it was drawn: the engine no longer holds this analysis (it keeps the newest six). Analyse its file again to rebuild it, export it or keep its crop.":
    "Çizildiği hâliyle gösteriliyor: analiz motoru bu analizi artık tutmuyor (en yeni altısını tutar). Yeniden oluşturmak, dışa aktarmak ya da kırpımını atamak için dosyasını yeniden analiz edin.",
  "Drawing the analysis…": "Analiz çiziliyor…",
  "Height maps": "Yükseklik haritaları",
  "Slope maps": "Eğim haritaları",
  "Height and slope maps (all six)": "Yükseklik ve eğim haritaları (altısı birden)",
  "Cross-sections of A and B": "A ve B kesitleri",
  "Cross-section at a position": "Seçilen konumda kesit",
  "Cross-section": "Kesit",
  "Cross-section view": "Kesit görünümü",
  "Open this position in the cross-section view, with a slider along the channel": "Bu konumu, kanal boyunca kaydırıcısı olan kesit görünümünde aç",
  "Cross-section: click one point on the surface for the profile across the channel through it (C)":
    "Kesit: kanalı o noktadan dik kesen profil için yüzeyde bir noktaya tıklayın (C)",
  "the cross-section button below the view, then click one point: the profile across the channel through it opens below (C)":
    "görünümün altındaki kesit düğmesi, sonra bir noktaya tıklayın: kanalı o noktadan dik kesen profil altta açılır (C)",
  "at x = {x} µm": "x = {x} µm konumunda",
  "at x = {x} µm, {p} % of the channel length ({L} µm)": "x = {x} µm konumunda, kanal uzunluğunun %{p} kadarı ({L} µm)",
  "Y, across the channel (µm)": "Y, kanala dik (µm)",
  "At this position": "Bu konumda",
  "Mean cross-section": "Ortalama kesit",
  "{n} points within {w} µm of the position": "konumun {w} µm yakınında {n} nokta",
  "Position along the channel": "Kanal boyunca konum",
  "of the length": "uzunluğun oranı",
  "µm from the start": "baştan µm",
  "The cross-section as a CSV file": "Kesit, CSV dosyası olarak",
  "The cross-section could not be read": "Kesit okunamadı",
  "Saved: {name}": "Kaydedildi: {name}",
  "Saved to the downloads folder of the browser: {name}": "Tarayıcının indirme klasörüne kaydedildi: {name}",
  "out of memory": "bellek yetmedi", "not a text file": "metin dosyası değil",
  "text where numbers are expected": "sayı yerine metin", "no points in the file": "dosyada nokta yok",
  "fewer than three columns": "üçten az sütun", "too few points": "çok az nokta", "damaged X3P file": "bozuk X3P dosyası",
}};

// Blocks with markup inside a sentence, translated whole (data-i18n="key")
const I18N_HTML = { tr: {
  "empty.1": "Bir nokta bulutunu <b>Aç</b> ve <b>Analiz et</b>: yüzey yataylanır ve hizalanır, kanal bulunur ve ölçülür.",
  "empty.2": "İç kalıp için <b>A olarak ata</b>, kalıplanmış parça için <b>B olarak ata</b>.",
  "empty.3": "Kopyalamayı RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> ve RQ<sub>d</sub> ile derecelendirmek için <b>Karşılaştır</b>.",
  "help.flow": "<b>İş akışı</b><br>1. Bir nokta bulutunu <b>Aç</b> ve <b>Analiz et</b>. 2. <b>A olarak ata</b> (iç kalıp) ya da <b>B olarak ata</b> (kalıplanmış parça). 3. İkisi de doluyken <b>Karşılaştır</b>. Her sonucun görünümleri <b>Model ağacı</b>'nda listelenir; sayılar <b>Özellikler</b> altındadır.",
  "about.what": "MaRQ, optik profilometri nokta bulutlarında mikrokanalları ölçer ve bir kanalın iç kalıptan kalıplanmış parçaya ne kadar doğru kopyalandığını derecelendirir: yükseklik korelasyonu RQ, yönlü eğim korelasyonları RQ<sub>dx</sub> ve RQ<sub>dy</sub>, ve kanal içinde eğim büyüklüğü korelasyonu RQ<sub>d</sub> ile.",
  "about.dev": "MaRQ yazılımı Mehmet Oğulcan Güngör tarafından geliştirilmiştir. Yazılım GNU Genel Kamu Lisansı, sürüm 3 ile yayımlanmıştır. Örnek veriler: CC BY 4.0.",
  "about.third": "Üçüncü taraf bileşenler: Plotly.js (MIT), three.js (MIT), Pyodide (MPL-2.0), NumPy ve SciPy (BSD-3-Clause), OpenBLAS (BSD-3-Clause). Bütün hesaplamalar bu bilgisayarda yapılır; hiçbir dosya yüklenmez.",
  "about.metrics": "<b>Ölçütler</b><br>RQ: iki yükseklik haritasının kanal içi maske üzerindeki Pearson korelasyonu. RQ<sub>dx</sub>, RQ<sub>dy</sub>: kanal boyunca ve enine işaretli eğimlerin korelasyonları. RQ<sub>d</sub>: belirtilen ızgara hücre boyutunda (makalede 5 µm) eğim büyüklüğü haritalarının korelasyonu; yükseklik korelasyonunun doyduğu yerde yan duvar biçimine duyarlı olduğu için derecelendirme ölçütüdür.",
  "about.version": "Mikrokanal ve Kopyalama Kalitesi Analizörü, sürüm <span id=\"about-version\">1.0</span>",
  "settings.spacing": "Ortak ızgaranın hücre boyutu. RQ<sub>d</sub> belirtilen bir hücre boyutunda tanımlıdır; korelasyonların karşılaştırılabilir kalması için her karşılaştırmada aynı değeri kullanın.",
}};

let LANG = "en";

function t(s, vars) {
  let out = (LANG !== "en" && I18N[LANG] && I18N[LANG][s] !== undefined) ? I18N[LANG][s] : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return out;
}

// decimal separator of the interface language, for numbers shown on screen
function decimal(str) {
  return LANG === "tr" ? String(str).replace(/(\d),(?=\d{3}(?!\d))/g, "$1\u0001").replace(/(\d)\.(\d)/g, "$1,$2").replace(/\u0001/g, ".") : String(str);
}

// Translates the page in place. The English originals are kept on the nodes, so the language
// can be switched back and forth.
const _I18N_SKIP = "script, style, svg, textarea, [data-i18n-skip]";
function applyLanguage(lang) {
  LANG = I18N[lang] ? lang : "en";
  document.documentElement.lang = LANG;
  const root = document.getElementById("app");
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.__en === undefined) el.__en = el.innerHTML;
    const tr = LANG !== "en" && I18N_HTML[LANG] && I18N_HTML[LANG][el.dataset.i18n];
    el.innerHTML = tr || el.__en;
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const el = n.nodeType === 1 ? n : n.parentElement;
      if (!el || el.closest(_I18N_SKIP) || el.closest("[data-i18n]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) {
      if (n.__en === undefined) {
        if (!/[A-Za-z]/.test(n.textContent)) continue;
        n.__en = n.textContent;
      }
      const core = n.__en.replace(/\s+/g, " ").trim();
      const tr = t(core);
      n.textContent = tr === core ? n.__en : n.__en.replace(n.__en.trim(), tr);
    } else {
      for (const a of ["title", "placeholder", "aria-label"]) {
        if (!n.hasAttribute(a)) continue;
        n.__enA = n.__enA || {};
        if (n.__enA[a] === undefined) n.__enA[a] = n.getAttribute(a);
        n.setAttribute(a, t(n.__enA[a].replace(/\s+/g, " ").trim()));
      }
    }
  }
}
