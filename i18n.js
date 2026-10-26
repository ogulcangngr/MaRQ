/* MaRQ interface languages. English is written in the page and in app.js; this file holds the
   other languages, keyed by the English text, and translates the page in place.

   Static page text: every text node, title and placeholder is looked up by its English
   wording. Blocks that mix bold, links or subscripts inside a sentence carry a
   data-i18n="key" attribute and are translated as a whole (I18N_HTML), because the word
   order differs between languages. Text built by app.js goes through t().

   The Turkish terms follow the thesis (kopyalama kalitesi, ölçüt, yan duvar); surfaces A and B
   are named as in English, the reference and the surface compared with it (referans,
   karşılaştırılan yüzey); numbers take a decimal comma in Turkish. Exported files (CSV, JSON)
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
  "Keep the cropped channel of this analysis as surface A, the reference":
    "Bu analizin kırpılmış kanalını referans olan A yüzeyi olarak ata",
  "Keep as A": "A olarak ata",
  "Keep the cropped channel of this analysis as surface B, the surface compared with A":
    "Bu analizin kırpılmış kanalını A ile karşılaştırılacak B yüzeyi olarak ata",
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
  "Keep the same 3D camera for surface A, surface B and the slope error": "A yüzeyi, B yüzeyi ve eğim hatası için aynı 3B kamerayı kullan",
  "Colour scale of every height map (2D and 3D)": "Bütün yükseklik haritalarının renk ölçeği (2B ve 3B)",
  "Colours": "Renkler",
  "Mesh budget of the 3D views (cells); higher is sharper but slower to turn. Very high draws every measured cell, at the voxel size.": "3B görünümlerin ağ bütçesi (hücre); yüksek değer daha keskin ama döndürmesi daha yavaş. Çok yüksek, ölçülen her hücreyi voksel boyutunda çizer.",
  "3D detail": "3B ayrıntı",
  "Low": "Düşük", "Medium": "Orta", "High": "Yüksek", "Very high": "Çok yüksek",
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
  "Difference A − B": "Fark A − B",
  // questions before a step that would give a meaningless result
  "Not analysed yet?": "Henüz analiz edilmedi mi?",
  "Not analysed yet": "Henüz analiz edilmedi",
  "<b>{name}</b> does not look like a crop saved by MaRQ. Surfaces A and B are the cropped channels of analysed surfaces: levelled, aligned and cut to the channel, so that the two can be compared. A point cloud compared as it was measured gives meaningless results. Analyse it first; MaRQ then keeps it as {slot}.":
    "<b>{name}</b>, MaRQ'ın kaydettiği bir kırpıma benzemiyor. A ve B yüzeyleri, analiz edilmiş yüzeylerin kırpılmış kanallarıdır: ikisi karşılaştırılabilsin diye yataylanır, hizalanır ve kanala göre kesilir. Ölçüldüğü gibi karşılaştırılan bir nokta bulutu anlamsız sonuç verir. Önce analiz edin; MaRQ onu sonra {slot} olarak atar.",
  "Analyse it, then keep it as {slot}": "Analiz et, sonra {slot} olarak ata",
  "Use it as {slot} anyway": "Yine de {slot} olarak kullan",
  "{names}: not crops saved by MaRQ, by their names. Each batch file is compared with surface A as it is, so it has to be the crop of an analysed surface (Analyse, then Save crop). A point cloud compared as it was measured gives meaningless results.":
    "{names}: adlarına göre MaRQ'ın kaydettiği kırpımlar değil. Her toplu dosya A yüzeyiyle olduğu gibi karşılaştırılır, bu yüzden analiz edilmiş bir yüzeyin kırpımı olmalıdır (Analiz et, sonra Kırpımı kaydet). Ölçüldüğü gibi karşılaştırılan bir nokta bulutu anlamsız sonuç verir.",
  "Use them anyway": "Yine de kullan",
  "Keep {name} as {slot} instead": "Bunun yerine {name} dosyasını {slot} olarak ata",
  "<b>{scan}</b> is open but has not been analysed yet. Keep as {slot} keeps the cropped channel of an analysed surface, and the analysis on screen is that of <b>{name}</b>.":
    "<b>{scan}</b> açık ama henüz analiz edilmedi. {slot} olarak ata, analiz edilmiş bir yüzeyin kırpılmış kanalını atar; ekrandaki analiz <b>{name}</b> dosyasına ait.",
  "That one is already surface {other}.": "O dosya zaten {other} yüzeyi.",
  "Analyse {scan} first.": "Önce {scan} dosyasını analiz edin.",
  "Already surface {other}": "Zaten {other} yüzeyi",
  "<b>{name}</b> is already surface {other}. A surface compared with itself always gives RQ = 1. Open and analyse the other surface, then keep that one as {slot}.":
    "<b>{name}</b> zaten {other} yüzeyi. Kendisiyle karşılaştırılan bir yüzey her zaman RQ = 1 verir. Diğer yüzeyi açıp analiz edin, sonra onu {slot} olarak atayın.",
  "Analyse the point cloud, then keep it as {slot}": "Nokta bulutunu analiz edin, sonra {slot} olarak atayın",
  "Height and slope maps": "Yükseklik ve eğim haritaları",
  "Batch results": "Toplu sonuçlar",
  "Drag to resize": "Boyutlandırmak için sürükleyin",
  "Properties": "Özellikler",
  "The measured geometry, the roughness and the correlations appear here after an analysis.":
    "Ölçülen geometri, pürüzlülük ve korelasyonlar analizden sonra burada görünür.",
  "Start": "Başlangıç",
  "Open a point cloud…": "Nokta bulutu aç…",
  "You can also drop a file anywhere on this window.": "Dosyayı bu pencerenin herhangi bir yerine de bırakabilirsiniz.",
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
  "Click <b>Compare</b> to grade how closely B matches A, with RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> and RQ<sub>d</sub>.":
    "B'nin A'ya ne kadar benzediğini RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> ve RQ<sub>d</sub> ile değerlendirmek için <b>Karşılaştır</b>'a tıklayın.",
  "Now open surface <b>B</b>, the surface compared with A, or analyse its scan and click <b>Keep as B</b>.":
    "Şimdi A ile karşılaştırılacak <b>B</b> yüzeyini açın ya da taramasını analiz edip <b>B olarak ata</b>'ya tıklayın.",
  "Now open surface <b>A</b>, the reference, or analyse its scan and click <b>Keep as A</b>.":
    "Şimdi referans olan <b>A</b> yüzeyini açın ya da taramasını analiz edip <b>A olarak ata</b>'ya tıklayın.",
  "Open A…": "A'yı aç…",
  "Open B…": "B'yi aç…",
  "The analysis uses the default settings of the paper. To change them before you start, press <b>Settings</b>.":
    "Analiz makaledeki varsayılan ayarlarla yapılır. Başlamadan önce değiştirmek için <b>Ayarlar</b>'a basın.",
  "{n} analysis settings differ from the paper defaults. To check or change them, press <b>Settings</b>.":
    "{n} analiz ayarı makaledeki değerlerden farklı. Kontrol etmek ya da değiştirmek için <b>Ayarlar</b>'a basın.",
  "{n} analysis setting differs from the paper defaults. To check or change it, press <b>Settings</b>.":
    "{n} analiz ayarı makaledeki değerlerden farklı. Kontrol etmek ya da değiştirmek için <b>Ayarlar</b>'a basın.",
  "MaRQ is still starting; the button works in a moment.": "MaRQ hâlâ başlatılıyor; düğme birazdan çalışır.",
  // tips after each step
  "<b>Analysis finished.</b> Keep it as <b>A</b>, the reference, or as <b>B</b>.":
    "<b>Analiz tamamlandı.</b> Referans olarak <b>A</b> ya da <b>B</b> olarak atayın.",
  "<b>Analysis finished.</b> Keep it as <b>B</b> to compare it with A.":
    "<b>Analiz tamamlandı.</b> A ile karşılaştırmak için <b>B</b> olarak atayın.",
  "<b>Analysis finished.</b> Keep it as <b>A</b>, the reference for B.":
    "<b>Analiz tamamlandı.</b> B'nin referansı olarak <b>A</b> olarak atayın.",
  "<b>Analysis finished.</b> It can replace surface <b>A</b> or <b>B</b>.":
    "<b>Analiz tamamlandı.</b> <b>A</b> ya da <b>B</b> yüzeyinin yerine konabilir.",
  "<b>Surfaces A and B are set.</b> <b>Compare</b> grades how closely B matches A.":
    "<b>A ve B yüzeyleri hazır.</b> <b>Karşılaştır</b>, B'nin A'ya ne kadar benzediğini değerlendirir.",
  "<b>Surface A is set.</b> Now open and analyse the other surface.":
    "<b>A yüzeyi atandı.</b> Şimdi diğer yüzeyi açıp analiz edin.",
  "<b>Surface B is set.</b> Now open and analyse the reference.":
    "<b>B yüzeyi atandı.</b> Şimdi referansı açıp analiz edin.",
  "<b>Comparison finished.</b> RQ<sub>d</sub> is under Properties.":
    "<b>Karşılaştırma tamamlandı.</b> RQ<sub>d</sub> Özellikler altında.",
  "<b>Batch finished.</b> Every comparison is in <b>Batch results</b>.":
    "<b>Toplu karşılaştırma tamamlandı.</b> Tüm karşılaştırmalar <b>Toplu sonuçlar</b> içinde.",
  "Hide tips": "İpuçlarını gizle",
  "Turn the tips off; Help (?) turns them on again": "İpuçlarını kapat; Yardım (?) yeniden açar",
  "Tips turned off; Help (?) turns them on again": "İpuçları kapatıldı; Yardım (?) yeniden açar",
  "Show a tip after each step, with the next steps as buttons": "Her adımdan sonra, sonraki adımları düğme olarak gösteren bir ipucu göster",

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
  "Lines at the top of each point cloud file to leave out, in the analysis and in the comparison. With 0, lines of text at the top (column names, instrument data) are left out by themselves.":
    "Her nokta bulutu dosyasının başında dışarıda bırakılacak satırlar, analizde ve karşılaştırmada. 0 iken baştaki metin satırları (sütun adları, cihaz bilgileri) kendiliğinden dışarıda bırakılır.",
  "Grid spacing (µm)": "Izgara aralığı (µm)",
  "Smoothing before the slopes (µm)": "Eğimlerden önce yumuşatma (µm)",
  "Gaussian blur before the slopes are computed. At least one grid cell is always applied, for stable slopes.":
    "Eğimler hesaplanmadan önce Gauss bulanıklığı. Kararlı eğimler için en az bir ızgara hücresi her zaman uygulanır.",
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
  "floor": "taban",
  "rim": "ağız",
  "Floor length": "Taban uzunluğu",
  "Opening length": "Ağız uzunluğu",
  "Feature": "Mikroyapı",
  "depression": "çukur",
  "protrusion, rotated": "çıkıntı, döndürüldü",
  "Roughness, ISO 25178": "Pürüzlülük, ISO 25178",
  "Floor": "Taban",
  "Field, −Y side": "Çevre yüzey, −Y tarafı",
  "Field, +Y side": "Çevre yüzey, +Y tarafı",
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
  "Mid-wall angle from the vertical: a straight line through the wall positions at 25-75 % of the depth on every grid line, median over the lines and both walls (the walls at −Y and +Y in brackets). Below 3° the wall spans too few grid cells to be resolved.":
    "Düşeyden yan duvarın orta bölge açısı: her ızgara çizgisinde derinliğin %25–75'indeki yan duvar konumlarından geçen doğru; çizgiler ve iki duvar üzerinden ortanca (parantez içinde −Y ve +Y tarafındaki duvarlar). 3°'nin altında duvar, çözümlenemeyecek kadar az ızgara hücresine yayılır.",
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
  "Remove the analysis?": "Analiz çıkarılsın mı?",
  "Remove the analysis of <b>{name}</b> from this session? Its results leave the session and the exports.":
    "<b>{name}</b> analizi bu oturumdan çıkarılsın mı? Sonuçları oturumdan ve dışa aktarmalardan çıkar.",
  "Shown as it was drawn: the engine no longer holds this analysis (it keeps the newest six). Analyse its file again to rebuild it, export it or keep its crop.":
    "Çizildiği hâliyle gösteriliyor: analiz motoru bu analizi artık tutmuyor (en yeni altısını tutar). Yeniden oluşturmak, dışa aktarmak ya da kırpımını atamak için dosyasını yeniden analiz edin.",
  "Drawing the analysis…": "Analiz çiziliyor…",
  "The figures could not be drawn again": "Şekiller yeniden çizilemedi",
  "One surface has no measured texture on its floor (A {a} µm, B {b} µm), as a CAD design: against an idealised surface RQ and the channel dimensions are the primary measures, and RQ<sub>d</sub> is given as well.":
    "Yüzeylerden birinin tabanında ölçülmüş doku yok (A {a} µm, B {b} µm), bir CAD tasarımında olduğu gibi: ideal bir yüzeye karşı birincil ölçüler RQ ve kanal boyutlarıdır; RQ<sub>d</sub> de verilir.",
  "Stop the analysis?": "Analiz durdurulsun mu?",
  "Stopping restarts the analysis engine. The {n} results it holds stay on screen, but they can no longer be exported, saved in a session, kept as A or B or drawn again. Save the session first if you need them: wait for this step to finish, then File, Save the session.":
    "Durdurmak analiz motorunu yeniden başlatır. Motorun tuttuğu {n} sonuç ekranda kalır, ancak artık dışa aktarılamaz, oturuma kaydedilemez, A ya da B olarak atanamaz ve yeniden çizilemez. Bunlara ihtiyacınız varsa önce oturumu kaydedin: bu adımın bitmesini bekleyin, sonra Dosya, Oturumu kaydet.",
  "Keep running": "Devam etsin",
  "Stop": "Durdur",
  "This point cloud could not be analysed": "Bu nokta bulutu analiz edilemedi",
  "The message above the view says why. Open another point cloud, or change the settings and analyse it again.":
    "Nedeni görünümün üstündeki iletide yazıyor. Başka bir nokta bulutu açın ya da ayarları değiştirip yeniden analiz edin.",
  "Analyse again": "Yeniden analiz et",
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

  // 2026-10-25: units, the example, repeated surfaces, results made with other settings, panes, copying
  "millimetres": "milimetre", "metres": "metre", "nanometres": "nanometre",
  "Not in micrometres?": "Mikrometre değil mi?",
  "The points of <b>{name}</b> span {s} across. MaRQ reads coordinates in micrometres, where a scan of a microchannel spans hundreds to tens of thousands. This file looks like it is in {unit}. Convert it to micrometres ({k}) for the analysis?":
    "<b>{name}</b> dosyasındaki noktalar {s} genişliğe yayılıyor. MaRQ koordinatları mikrometre olarak okur; mikrometre cinsinden bir mikrokanal taraması yüzlerce ile on binlerce arasında yayılır. Bu dosya {unit} cinsinden görünüyor. Analiz için mikrometreye ({k}) çevrilsin mi?",
  "Convert to micrometres": "Mikrometreye çevir",
  "Use the numbers as they are": "Sayıları olduğu gibi kullan",
  "in {unit}, converted to micrometres": "{unit} cinsinden, mikrometreye çevrildi",
  "Point cloud units": "Nokta bulutu birimi",
  "{unit}, converted": "{unit}, çevrildi",
  "Try an example": "Örnekle dene",
  "A synthetic 600 µm channel and a copy of it, 4 µm wider and 3 µm shallower: both analysed, kept as A and B and compared, step by step":
    "Yapay bir 600 µm kanal ve 4 µm daha geniş, 3 µm daha sığ bir kopyası: ikisi de analiz edilir, A ve B olarak atanır ve adım adım karşılaştırılır",
  "Replace surfaces A and B?": "A ve B yüzeyleri değiştirilsin mi?",
  "The example keeps its two channels as A and B, in place of the surfaces there now. The results so far stay in the session.":
    "Örnek, iki kanalını şu anki yüzeylerin yerine A ve B olarak atar. Şimdiye kadarki sonuçlar oturumda kalır.",
  "Run the example": "Örneği çalıştır",
  "A and B are the same file": "A ve B aynı dosya",
  "Surfaces A and B hold the same points, so the comparison gives RQ = 1. Open or keep another surface as B.":
    "A ve B yüzeyleri aynı noktaları içeriyor, bu yüzden karşılaştırma RQ = 1 verir. B olarak başka bir yüzey açın ya da atayın.",
  "Compare anyway": "Yine de karşılaştır",
  "Repeated surfaces in the batch": "Toplu listede tekrarlanan yüzeyler",
  "{names}: the same points as surface A, so compared with it they give RQ = 1.":
    "{names}: A yüzeyiyle aynı noktalar, bu yüzden onunla karşılaştırıldığında RQ = 1 verir.",
  "{names}: the same points as another file of the batch.": "{names}: toplu listedeki başka bir dosyayla aynı noktalar.",
  "Leave them out": "Bunları çıkar",
  "Compare them anyway": "Yine de karşılaştır",
  "Made with other settings": "Başka ayarlarla yapıldı",
  "Made with other settings than those in Settings now": "Ayarlar'daki şimdiki değerlerden farklı ayarlarla yapıldı",
  "Changed since this analysis: {list}. Its numbers are those of the earlier settings; analyse the file again to use the new ones.":
    "Bu analizden sonra değişenler: {list}. Sayıları önceki ayarlarındır; yenilerini kullanmak için dosyayı yeniden analiz edin.",
  "Changed since this comparison: {list}. Its numbers are those of the earlier settings; compare again to use the new ones.":
    "Bu karşılaştırmadan sonra değişenler: {list}. Sayıları önceki ayarlarındır; yenilerini kullanmak için yeniden karşılaştırın.",
  "Replace the results?": "Sonuçlar değiştirilsin mi?",
  "Open the session": "Oturumu aç",
  "Display of the surface analysis": "Yüzey analizinin gösterimi",
  "Reading the files": "Dosyaların okunması",
  "Hide the browser; the button at the left of the view title brings it back": "Model ağacını gizle; görünüm başlığının solundaki düğme geri getirir",
  "Hide the properties; the button at the right of the view title brings them back": "Özellikleri gizle; görünüm başlığının sağındaki düğme geri getirir",
  "Show the browser": "Model ağacını göster",
  "Show the properties": "Özellikleri göster",
  "Copy the properties as a table, to paste into a spreadsheet": "Özellikleri bir hesap tablosuna yapıştırmak üzere tablo olarak kopyala",
  "Properties copied: paste them into a spreadsheet": "Özellikler kopyalandı: bir hesap tablosuna yapıştırın",
  "Copy the log": "Günlüğü kopyala",
  "Save the log as a text file": "Günlüğü metin dosyası olarak kaydet",
  "Log copied": "Günlük kopyalandı",
  "The text could not be copied": "Metin kopyalanamadı",
  "Show or hide the outline of the channel interior, the area over which the correlations are computed":
    "Korelasyonların hesaplandığı alan olan kanal içinin dış çizgisini göster ya da gizle",
  "Panes": "Bölmeler",
  "Hide": "Gizle",
  "Copy": "Kopyala",
  "the button at the right of the Browser or Properties title; the button at the edge of the view title brings the pane back":
    "Model ağacı ya da Özellikler başlığının sağındaki düğme; görünüm başlığının kenarındaki düğme bölmeyi geri getirir",
  "the copy button of Properties copies its numbers as a table, to paste into a spreadsheet":
    "Özellikler'in kopyalama düğmesi sayılarını bir hesap tablosuna yapıştırmak üzere tablo olarak kopyalar",

  // 2026-10-25: progress in the view, journal sizes, the links below the views, every comparison
  "Analysing {name}": "{name} analiz ediliyor",
  "Comparing {b} with {a}": "{b}, {a} ile karşılaştırılıyor",
  "Comparing {n} surfaces with {a}": "{n} yüzey {a} ile karşılaştırılıyor",
  "Reading the two surfaces": "İki yüzey okunuyor",
  "Common grid": "Ortak ızgara",
  "Slopes and correlations": "Eğimler ve korelasyonlar",
  "Building the figures": "Şekiller oluşturuluyor",
  "{s} s": "{s} sn",
  "Pair {i} of {n}: {name}": "Çift {i}/{n}: {name}",
  "Journal, one column (90 mm wide)": "Dergi, tek sütun (90 mm genişlik)",
  "Journal, two columns (190 mm wide)": "Dergi, iki sütun (190 mm genişlik)",
  "Width (mm)": "Genişlik (mm)",
  "Height (mm)": "Yükseklik (mm)",
  "Resolution": "Çözünürlük",
  "300 dots per inch": "inç başına 300 nokta",
  "600 dots per inch": "inç başına 600 nokta",
  "At a journal size the figure is drawn at its printed size, with its text near 7 to 9 points and without the title of the view; a PNG is made at the chosen resolution, an SVG as vectors.":
    "Dergi boyutunda şekil basılacağı boyutta, yazıları 7 ile 9 punto arasında ve görünümün başlığı olmadan çizilir; PNG seçilen çözünürlükte, SVG vektör olarak hazırlanır.",
  "Figure exported ({fmt}, {w} × {h} mm at {dpi} dots per inch)": "Şekil dışa aktarıldı ({fmt}, {w} × {h} mm, inç başına {dpi} nokta)",
  "Zoom and pan the three maps together, and the height and slope maps on the same region":
    "Üç haritayı birlikte yakınlaştır ve kaydır; yükseklik ve eğim haritaları aynı bölgeyi göstersin",
  "Remove this comparison from the session": "Bu karşılaştırmayı oturumdan çıkar",
  "Summary of the session": "Oturumun özeti",
  "Every analysis and every comparison of this session in one table": "Bu oturumun bütün analizleri ve karşılaştırmaları tek bir tabloda",
  "{n} surfaces": "{n} yüzey",
  "Batch of {n}": "{n} yüzeylik toplu",
  "vs {name}": "{name} ile",
  "Remove the comparison?": "Karşılaştırma çıkarılsın mı?",
  "Remove the comparison of <b>{b}</b> with <b>{a}</b> from this session? Its results leave the session and the exports.":
    "<b>{b}</b> ile <b>{a}</b> karşılaştırması bu oturumdan çıkarılsın mı? Sonuçları oturumdan ve dışa aktarmalardan çıkar.",
  "Analyses": "Analizler",
  "Comparisons": "Karşılaştırmalar",
  "Point cloud": "Nokta bulutu",
  "Grid": "Izgara",
  "The key result of each comparison is in colour. Show opens a result the browser lists; Results CSV saves every number with its settings.":
    "Her karşılaştırmanın temel sonucu renklidir. Göster, model ağacında listelenen bir sonucu açar; Sonuçlar (CSV) her sayıyı ayarlarıyla birlikte kaydeder.",

  // 2026-10-25: the Feature setting, Automatic, Channel or Ridge ("Feature" is above: Mikroyapı)
  "Automatic": "Otomatik",
  "Channel": "Kanal",
  "Ridge": "Sırt",
  "Automatic finds whether the scan holds a channel or a ridge, as on a mould master, and turns a ridge over into the channel it moulds. Choose Channel or Ridge when it decides wrongly, as for a channel whose rims rise higher than it is deep. The choice goes back to Automatic when another file is opened.":
    "Otomatik, taramada bir kanal mı yoksa kalıp ana parçasındaki gibi bir sırt mı olduğunu bulur ve sırtı, kalıpladığı kanala dönüştürmek için ters çevirir. Yanlış karar verdiğinde Kanal ya da Sırt seçin; örneğin kenar kabarıklıkları derinliğinden yüksek olan bir kanal için. Seçim, başka bir dosya açıldığında Otomatik'e döner.",
  "How it decides": "Nasıl karar verir",
  "Channel or ridge": "Kanal ya da sırt",
  "MaRQ measures a channel, a depression in the flat surface around it. A ridge, as on a mould master, is first turned over into the channel it moulds. Automatic decides which of the two a scan holds by how far the surface reaches below and above the flat surface, and the larger reach wins.":
    "MaRQ bir kanalı, yani çevresindeki düz yüzeyde bir çukuru ölçer. Kalıp ana parçasındaki gibi bir sırt, önce kalıpladığı kanala dönüştürmek için ters çevrilir. Otomatik, taramada bu ikisinden hangisi olduğuna yüzeyin düz yüzeyin ne kadar altına ve üstüne uzandığına bakarak karar verir; daha uzağa uzanan taraf kazanır.",
  "A channel.": "Bir kanal.",
  "Automatic measures it.": "Otomatik onu ölçer.",
  "A channel with rims lower than its depth.": "Kenar kabarıklıkları derinliğinden alçak bir kanal.",
  "A channel with rims higher than its depth.": "Kenar kabarıklıkları derinliğinden yüksek bir kanal.",
  "Automatic takes it for a ridge, so choose Channel.": "Otomatik onu sırt sanar, bu yüzden Kanal seçin.",
  "A ridge.": "Bir sırt.",
  "Automatic turns it over and measures it.": "Otomatik onu ters çevirir ve ölçer.",
  "The heights alone cannot tell the third surface from a ridge, because turned over it is an ordinary surface too, two grooves beside a raised strip. In the same way, grooves beside a ridge that are deeper than the ridge is high make it look like a channel, so choose Ridge for such a scan.":
    "Yükseklikler tek başına üçüncü yüzeyi bir sırttan ayıramaz, çünkü ters çevrildiğinde o da sıradan bir yüzeydir: kabarık bir şeridin iki yanında iki oluk. Aynı biçimde, bir sırtın yanında sırtın yüksekliğinden derin oluklar onu kanal gibi gösterir; böyle bir tarama için Sırt seçin.",
  "The choice holds for the file open now and goes back to Automatic when another file is opened. If nothing lies on the chosen side, MaRQ says so after the analysis.":
    "Seçim şu an açık dosya için geçerlidir ve başka bir dosya açıldığında Otomatik'e döner. Seçilen tarafta hiçbir şey yoksa MaRQ bunu analizden sonra bildirir.",
  "Opened {name}. Feature is Automatic again.": "{name} açıldı. Mikroyapı yeniden Otomatik.",
  "depression (Feature: Channel, in Settings)": "çukur (Ayarlar'da Mikroyapı: Kanal)",
  "raised, turned over (Feature: Ridge, in Settings)": "çıkıntı, ters çevrildi (Ayarlar'da Mikroyapı: Sırt)",
  "Check the Feature setting": "Mikroyapı ayarını denetleyin",
  "Feature is set to Channel in Settings, but nothing in this scan lies below the flat surface around it, so it most likely shows a ridge and the measured geometry has no meaning. Set Feature to Ridge or Automatic and analyse it again.":
    "Ayarlar'da Mikroyapı Kanal olarak seçili, ama bu taramada çevredeki düz yüzeyin altında hiçbir şey yok; büyük olasılıkla bir sırt gösteriyor ve ölçülen geometrinin bir anlamı yok. Mikroyapı'yı Sırt ya da Otomatik yapıp yeniden analiz edin.",
  "Feature is set to Ridge in Settings, but nothing in this scan rises above the flat surface around it, so it most likely shows a channel and the measured geometry has no meaning. Set Feature to Channel or Automatic and analyse it again.":
    "Ayarlar'da Mikroyapı Sırt olarak seçili, ama bu taramada çevredeki düz yüzeyin üstüne çıkan hiçbir şey yok; büyük olasılıkla bir kanal gösteriyor ve ölçülen geometrinin bir anlamı yok. Mikroyapı'yı Kanal ya da Otomatik yapıp yeniden analiz edin.",
  "If the scan shows a raised feature, a ridge, set Feature to Ridge in Settings and analyse it again.":
    "Tarama çıkıntı biçimli bir yapı, bir sırt gösteriyorsa Ayarlar'da Mikroyapı'yı Sırt yapıp yeniden analiz edin.",
  "The scan was turned over (Feature: Ridge, in Settings): for a channel, set Feature to Automatic or Channel and analyse it again.":
    "Tarama ters çevrildi (Ayarlar'da Mikroyapı: Sırt): bir kanal için Mikroyapı'yı Otomatik ya da Kanal yapıp yeniden analiz edin.",
  "yes": "evet",
  "no": "hayır",
  // 2026-10-27: the Options menu, the interface size, a browser zoom undone
  "Options": "Seçenekler",
  "Interface size": "Arayüz boyutu",
  "Automatic, to fit the window": "Otomatik, pencereye sığacak biçimde",
  "{p} %": "%{p}",
  "MaRQ keeps this size, and undoes a zoom of the browser (Ctrl and plus or minus).":
    "MaRQ bu boyutta kalır ve tarayıcının yakınlaştırmasını (Ctrl ile artı ya da eksi) geri alır.",
  "The browser zoom of {z} % is undone. To set the browser back to 100 %, press {key} and 0.":
    "Tarayıcının %{z} yakınlaştırması geri alındı. Tarayıcıyı %100'e döndürmek için {key} ile 0'a basın.",
  "Browser zoom detected": "Tarayıcı yakınlaştırması algılandı",
  "The browser is zoomed to {z} %, which MaRQ undoes to keep its own size. To set the browser back to 100 %, press {key} and 0.":
    "Tarayıcı %{z} yakınlaştırılmış. MaRQ kendi boyutunda kalmak için bunu geri alır. Tarayıcıyı %100'e döndürmek için {key} ile 0'a basın.",
  "Interface size: automatic": "Arayüz boyutu: otomatik",
  "Interface size: {p} %": "Arayüz boyutu: %{p}",
  "The window is small": "Pencere küçük",
  "The MaRQ window leaves its views little room. Maximize the window for more room.":
    "MaRQ penceresi görünümlere az yer bırakıyor. Daha fazla yer için pencereyi ekranı kaplayacak biçimde büyütün.",
  "Interface": "Arayüz",
  "Size": "Boyut",
  "Options, Interface size: Automatic fits the window; a zoom of the browser is undone, so MaRQ opens at its own size":
    "Seçenekler, Arayüz boyutu: Otomatik pencereye sığdırır; tarayıcının yakınlaştırması geri alınır, böylece MaRQ kendi boyutunda açılır",

  // 2026-10-25: a figure export and a report wait for each other; a damaged session file
  "Wait until the report or the figure in progress is ready": "Hazırlanan rapor ya da şekil bitene kadar bekleyin",
  "damaged session file": "bozuk oturum dosyası",
  "Wall dominance": "Duvar baskınlığı",
  "Wall dominance f_y: the share of the squared slope carried by the slope across the channel, over the channel interior (deeper than 0.20 of the depth) of the central 60 % of the crop, on a grid of the voxel size. Near 1, the slopes, and with them RQd, are governed by the sidewalls.":
    "Duvar baskınlığı f_y: eğimin karesinde kanala dik eğimin payı; kanal içinde (derinliğin 0,20'sinden derin hücreler), kırpımın orta %60'ında, voksel boyutunda bir ızgarada. 1'e yakınsa eğimler, onlarla birlikte RQd de, yan duvarlarca belirlenir.",
  "The session file is damaged or is not a MaRQ session. The log has the details.":
    "Oturum dosyası bozuk ya da bir MaRQ oturumu değil. Ayrıntılar günlükte.",
}};

// Blocks with markup inside a sentence, translated whole (data-i18n="key")
const I18N_HTML = { tr: {
  "empty.1": "Bir nokta bulutunu <b>Aç</b> ve <b>Analiz et</b>: yüzey yataylanır ve hizalanır, kanal bulunur ve ölçülür.",
  "empty.2": "Karşılaştırılacak iki yüzey için <b>A olarak ata</b> ve <b>B olarak ata</b>.",
  "empty.3": "B'nin A'ya ne kadar benzediğini RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> ve RQ<sub>d</sub> ile değerlendirmek için <b>Karşılaştır</b>.",
  "help.flow": "<b>İş akışı</b><br>1. Bir nokta bulutunu <b>Aç</b> ve <b>Analiz et</b>. 2. <b>A olarak ata</b> (referans) ve <b>B olarak ata</b> (onunla karşılaştırılan yüzey). 3. İkisi de doluyken <b>Karşılaştır</b>. Her sonucun görünümleri <b>Model ağacı</b>'nda listelenir; sayılar <b>Özellikler</b> altındadır.",
  "about.what": "MaRQ, optik profilometri nokta bulutlarında mikrokanalları ölçer ve bir kanalın iki yüzeyini, A ile B'yi, karşılaştırır: yükseklik korelasyonu RQ, yönlü eğim korelasyonları RQ<sub>dx</sub> ve RQ<sub>dy</sub>, ve kanal içinde eğim büyüklüğü korelasyonu RQ<sub>d</sub> ile.",
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
