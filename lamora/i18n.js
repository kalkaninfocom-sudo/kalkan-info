// =========================================================
// LAMORA KALKAN — Çok Dilli Destek (TR / EN / RU)
// =========================================================
const LANGS = ['tr', 'en', 'ru'];
const LANG_NAMES = { tr: 'TR', en: 'EN', ru: 'RU' };

function getLang() {
  const saved = localStorage.getItem('lamora_lang');
  return LANGS.includes(saved) ? saved : 'tr';
}
function setLang(lang) {
  if (!LANGS.includes(lang) || lang === getLang()) return;
  localStorage.setItem('lamora_lang', lang);
  window.dispatchEvent(new CustomEvent('langchange'));
}

// ─── Sabit arayüz metinleri ──────────────────────────────────────────────────
const UI = {
  tr: {
    skip_link: 'İçeriğe geç',
    nav_story: 'Hikaye', nav_menu: 'Menü', nav_gallery: 'Galeri',
    nav_reviews: 'Yorumlar', nav_contact: 'İletişim',
    call_now: 'Hemen Ara', lang_switch_label: 'Dil seçimi', scroll_down: 'Aşağı kaydır',
    everyday: 'Her gün', reviews_word: 'Yorum', new_open: 'Yeni Açıldı', find_us_google: 'Bizi Google’da bulun', get_directions: 'Yol Tarifi Al',
    view_menu_arrow: 'Menüyü Gör →',
    about_eyebrow: 'Hikayemiz', about_heading: 'Bir aile işletmesinin <em>hikayesi</em>',
    about_signature: '— Lamora Kalkan ailesi',
    features_eyebrow: 'Farkımız', features_heading: 'Neden <em>Lamora?</em>',
    feature1_title: 'Günlük Taze Malzeme', feature1_desc: 'Her sabah taze alınan et ve sebzelerle hazırlanan lezzetler.',
    feature2_title: 'Özenli Mutfak', feature2_desc: 'Şefimizin elinden çıkan, özenle hazırlanan tabaklar.',
    feature3_title: 'Temizlik & Hijyen', feature3_desc: 'Düzenli temizlenen mutfak ve servis alanı, her zaman hijyenik ortam.',
    feature4_title: 'Uygun Fiyat', feature4_desc: 'Tatil bölgesi fiyatlarına göre cepte kalan, dürüst fiyatlandırma.',
    menu_eyebrow: 'Lezzetlerimiz', menu_heading: 'Tam Menü ve <em>Fiyat Listesi</em>',
    menu_sub: 'Bir kategoriye tıklayarak güncel fiyatları görebilirsiniz.',
    price_list_arrow: 'Fiyat listesi →',
    qr_eyebrow: 'Dijital Menü', qr_heading: "QR'ı okutun, menü elinizde",
    qr_text: 'Masanızdan kalkmadan güncel fiyatları ve tüm ürünleri görmek için kodu telefonunuzla okutun.',
    open_menu_arrow: 'Menüyü Aç →',
    gallery_eyebrow: 'Galeri', gallery_heading: 'Fotoğraflarımız',
    reviews_eyebrow: 'Misafirlerimiz', reviews_heading: 'Müşteri <em>Yorumları</em>',
    carousel_prev: 'Önceki yorum', carousel_next: 'Sonraki yorum', carousel_dots_label: 'Yorum seçici',
    review_dot: 'Yorum', source_guest: 'Misafir Yorumu',
    rating_on_google: "Google'da", rating_reviews_word: 'değerlendirme',
    location_eyebrow: 'Bizi Bulun', location_heading: 'Konum & <em>İletişim</em>',
    contact_heading: 'Bize Ulaşın', order_open_badge: '● Sipariş Alınıyor',
    label_address: 'Adres', label_phone: 'Telefon', label_hours: 'Çalışma Saatleri', label_instagram: 'Instagram',
    directions_arrow: 'Yol Tarifi Al →',
    footer_desc: "Kalkan’ın kalbinde taze ve özenli lezzetler.",
    footer_quicklinks: 'Hızlı Erişim', footer_fullmenu: 'Tam Menü', footer_contact: 'İletişim',
    footer_rights: 'Tüm hakları saklıdır.', footer_privacy: 'KVKK kapsamında kişisel veri işlenmemektedir.',
    footer_address: 'Kalkan, Kaş<br>Antalya',
    mobile_call: 'Ara', mobile_directions: 'Yol Tarifi', mobile_menu: 'Menü',
    draft_banner: 'Yönetici önizlemesi — bu taslak yalnızca sizin tarayıcınızda görünür.',
    back_to_home: 'Ana Sayfaya Dön', menu_title: 'Menü', menu_categories_label: 'Menü kategorileri',
    empty_menu: 'Henüz menü içeriği eklenmemiş.', order_call: 'Sipariş İçin Ara', back_home_arrow: '← Ana Sayfa',
    index_title: 'Lamora Kalkan | Kalkan, Kaş — Antalya',
    menu_page_title: 'Menü & Fiyat Listesi | Lamora Kalkan',
  },
  en: {
    skip_link: 'Skip to content',
    nav_story: 'Our Story', nav_menu: 'Menu', nav_gallery: 'Gallery',
    nav_reviews: 'Reviews', nav_contact: 'Contact',
    call_now: 'Call Now', lang_switch_label: 'Language selection', scroll_down: 'Scroll down',
    everyday: 'Every day', reviews_word: 'Reviews', new_open: 'Newly Opened', find_us_google: 'Find us on Google', get_directions: 'Get Directions',
    view_menu_arrow: 'View Menu →',
    about_eyebrow: 'Our Story', about_heading: 'The <em>story</em> of a family business',
    about_signature: '— The Lamora Kalkan family',
    features_eyebrow: 'What Sets Us Apart', features_heading: 'Why <em>Lamora?</em>',
    feature1_title: 'Fresh Ingredients Daily', feature1_desc: 'Dishes prepared every morning with freshly sourced meat and vegetables.',
    feature2_title: 'Careful Cuisine', feature2_desc: 'Carefully prepared plates from our chef.',
    feature3_title: 'Cleanliness & Hygiene', feature3_desc: 'A regularly cleaned kitchen and service area — always a hygienic environment.',
    feature4_title: 'Affordable Prices', feature4_desc: "Honest pricing that's easy on your wallet compared to typical resort prices.",
    menu_eyebrow: 'Our Flavors', menu_heading: 'Full Menu & <em>Price List</em>',
    menu_sub: 'Click a category to see the current prices.',
    price_list_arrow: 'Price list →',
    qr_eyebrow: 'Digital Menu', qr_heading: 'Scan the QR code, menu in hand',
    qr_text: 'Scan the code with your phone to see all items and current prices without leaving your table.',
    open_menu_arrow: 'Open Menu →',
    gallery_eyebrow: 'Gallery', gallery_heading: 'Our Photos',
    reviews_eyebrow: 'Our Guests', reviews_heading: 'Customer <em>Reviews</em>',
    carousel_prev: 'Previous review', carousel_next: 'Next review', carousel_dots_label: 'Review selector',
    review_dot: 'Review', source_guest: 'Guest Review',
    rating_on_google: 'On Google', rating_reviews_word: 'reviews',
    location_eyebrow: 'Find Us', location_heading: 'Location & <em>Contact</em>',
    contact_heading: 'Get in Touch', order_open_badge: '● Now Taking Orders',
    label_address: 'Address', label_phone: 'Phone', label_hours: 'Opening Hours', label_instagram: 'Instagram',
    directions_arrow: 'Get Directions →',
    footer_desc: 'Fresh, carefully prepared dishes in the heart of Kalkan.',
    footer_quicklinks: 'Quick Links', footer_fullmenu: 'Full Menu', footer_contact: 'Contact',
    footer_rights: 'All rights reserved.', footer_privacy: 'No personal data is processed on this site.',
    footer_address: 'Kalkan, Kaş<br>Antalya',
    mobile_call: 'Call', mobile_directions: 'Directions', mobile_menu: 'Menu',
    draft_banner: 'Admin preview — this draft is only visible in your browser.',
    back_to_home: 'Back to Home', menu_title: 'Menu', menu_categories_label: 'Menu categories',
    empty_menu: 'No menu content has been added yet.', order_call: 'Call to Order', back_home_arrow: '← Home',
    index_title: 'Lamora Kalkan | Kalkan, Kaş — Antalya',
    menu_page_title: 'Menu & Price List | Lamora Kalkan',
  },
  ru: {
    skip_link: 'Перейти к содержимому',
    nav_story: 'История', nav_menu: 'Меню', nav_gallery: 'Галерея',
    nav_reviews: 'Отзывы', nav_contact: 'Контакты',
    call_now: 'Позвонить', lang_switch_label: 'Выбор языка', scroll_down: 'Прокрутить вниз',
    everyday: 'Каждый день', reviews_word: 'отзывов', new_open: 'Только открылись', find_us_google: 'Найдите нас в Google', get_directions: 'Проложить маршрут',
    view_menu_arrow: 'Смотреть меню →',
    about_eyebrow: 'Наша история', about_heading: '<em>История</em> семейного бизнеса',
    about_signature: '— Семья Lamora Kalkan',
    features_eyebrow: 'Наши преимущества', features_heading: 'Почему <em>Lamora?</em>',
    feature1_title: 'Свежие продукты каждый день', feature1_desc: 'Блюда готовятся каждое утро из свежего мяса и овощей.',
    feature2_title: 'Забота на кухне', feature2_desc: 'Тщательно приготовленные блюда от нашего шефа.',
    feature3_title: 'Чистота и гигиена', feature3_desc: 'Регулярно убираемая кухня и зона обслуживания — всегда гигиеничная обстановка.',
    feature4_title: 'Доступные цены', feature4_desc: 'Честные цены, которые приятно удивят по сравнению с курортными расценками.',
    menu_eyebrow: 'Наши блюда', menu_heading: 'Полное меню и <em>прайс-лист</em>',
    menu_sub: 'Нажмите на категорию, чтобы увидеть актуальные цены.',
    price_list_arrow: 'Прайс-лист →',
    qr_eyebrow: 'Цифровое меню', qr_heading: 'Отсканируйте QR-код — меню под рукой',
    qr_text: 'Отсканируйте код телефоном, чтобы увидеть все блюда и актуальные цены, не вставая из-за стола.',
    open_menu_arrow: 'Открыть меню →',
    gallery_eyebrow: 'Галерея', gallery_heading: 'Наши фотографии',
    reviews_eyebrow: 'Наши гости', reviews_heading: 'Отзывы <em>клиентов</em>',
    carousel_prev: 'Предыдущий отзыв', carousel_next: 'Следующий отзыв', carousel_dots_label: 'Выбор отзыва',
    review_dot: 'Отзыв', source_guest: 'Отзыв гостя',
    rating_on_google: 'На Google', rating_reviews_word: 'отзывов',
    location_eyebrow: 'Как нас найти', location_heading: 'Адрес и <em>контакты</em>',
    contact_heading: 'Свяжитесь с нами', order_open_badge: '● Принимаем заказы',
    label_address: 'Адрес', label_phone: 'Телефон', label_hours: 'Часы работы', label_instagram: 'Instagram',
    directions_arrow: 'Маршрут →',
    footer_desc: 'Свежие и заботливо приготовленные блюда в сердце Калкана.',
    footer_quicklinks: 'Быстрые ссылки', footer_fullmenu: 'Полное меню', footer_contact: 'Контакты',
    footer_rights: 'Все права защищены.', footer_privacy: 'Персональные данные на этом сайте не обрабатываются.',
    footer_address: 'Калкан, Каш<br>Анталья',
    mobile_call: 'Позвонить', mobile_directions: 'Маршрут', mobile_menu: 'Меню',
    draft_banner: 'Предпросмотр администратора — черновик виден только в вашем браузере.',
    back_to_home: 'Вернуться на главную', menu_title: 'Меню', menu_categories_label: 'Категории меню',
    empty_menu: 'Меню пока не добавлено.', order_call: 'Позвонить для заказа', back_home_arrow: '← Главная',
    index_title: 'Lamora Kalkan | Калкан, Каш — Анталья',
    menu_page_title: 'Меню и цены | Lamora Kalkan',
  },
};

function T(key) {
  const lang = getLang();
  return (UI[lang] && UI[lang][key]) || UI.tr[key] || key;
}

// ─── Veritabanından gelen dinamik metinler (kategori/ürün adı, yorum, ayar metni…) ──
// Türkçe kaynak metin → çeviri. Eşleşme bulunamazsa orijinal (Türkçe) metin gösterilir.
const CONTENT = {
  en: {
    // Kategoriler
    'Ekmek Arası': 'Sandwich', 'Lavaş / Dürüm': 'Lavash Wrap', 'Lavaş Dürüm': 'Lavash Wrap',
    'Burgerler': 'Burgers', 'Yan Ürünler': 'Side Dishes', 'İçecekler': 'Drinks',
    // Ürün adları
    'Köfte': 'Meatball', 'Tavuk': 'Chicken', 'Et Tantuni': 'Beef Tantuni', 'Tavuk Tantuni': 'Chicken Tantuni',
    'Dana Kokoreç': 'Beef Kokoreç', 'Kuzu Kokoreç': 'Lamb Kokoreç', 'Hamburger': 'Hamburger', 'Çizburger': 'Cheeseburger',
    'Yoğurtlu Tavuk Tantuni': 'Chicken Tantuni with Yogurt', 'Cips': 'Fries', 'Tavuk Pilav': 'Chicken & Rice',
    'Ayran': 'Ayran', 'Büyük Ayran': 'Large Ayran', 'Soda': 'Soda Water', 'Şalgam': 'Turnip Juice (Şalgam)',
    'Ice Tea': 'Ice Tea', 'Küçük Su': 'Small Water', 'Büyük Su': 'Large Water', 'Türk Kahvesi': 'Turkish Coffee',
    'Cam Kola': 'Cola (Glass Bottle)', 'Kutu Kola': 'Cola (Can)', '1 Lt Kola': 'Cola (1L)', 'Fanta': 'Fanta',
    'Sprite': 'Sprite', 'Gazoz': 'Turkish Soda', 'K. Meyve Suyu': 'Small Fruit Juice', 'Çay': 'Tea',
    // Ürün açıklamaları
    '110 Gr Köfte, Marul, Domates, Soğan ve isteğe göre Ketçap, Mayonez': '110g meatball, lettuce, tomato, onion, with ketchup and mayo on request',
    '130 Gr Tavuk İncik, Marul, Domates, Soğan, Ketçap, Mayonez': '130g chicken thigh, lettuce, tomato, onion, ketchup, mayo',
    '110 Gr Dana Eti, Maydanoz, Domates, Soğan': '110g beef, parsley, tomato, onion',
    '110 Gr Tavuk Eti, Maydanoz, Domates, Soğan': '110g chicken, parsley, tomato, onion',
    '150gr Dana Kokoreç': '150g beef kokoreç',
    '150 gr Kuzu Kokoreç': '150g lamb kokoreç',
    '110 Gr Köfte, Marul, Domates, Soğan, Turşu, Ketçap, Mayonez': '110g meatball, lettuce, tomato, onion, pickles, ketchup, mayo',
    '110 Gr Köfte, Çedar Peyniri, Marul, Domates, Soğan, Turşu, Ketçap, Mayonez': '110g meatball, cheddar cheese, lettuce, tomato, onion, pickles, ketchup, mayo',
    '130 Gr Tavuk İncik, Marul, Domates, Soğan ve isteğe göre Ketçap, Mayonez': '130g chicken thigh, lettuce, tomato, onion, with ketchup and mayo on request',
    '130 gr Tavuk Göğsü, Maydanoz, Domates ve Soğan': '130g chicken breast, parsley, tomato and onion',
    '130 gr Tavuk Göğsü, Maydanoz, Domates ve Soğan ve üzerine Süzme yoğurt': '130g chicken breast, parsley, tomato and onion, topped with strained yogurt',
    // Alerjenler
    'Gluten (Tahıl)': 'Gluten (Cereals)', 'Süt / Laktoz': 'Milk / Lactose', 'Yumurta': 'Egg',
    'Fındık / Fıstık': 'Nuts / Peanuts', 'Soya': 'Soy', 'Balık': 'Fish',
    'Kabuklu Deniz Ürünleri': 'Shellfish', 'Susam': 'Sesame', 'Hardal': 'Mustard',
    'Kereviz': 'Celery', 'Sülfit': 'Sulphites',
    // Özel uyarılar
    'Alkol içerir': 'Contains alcohol', 'Domuz türevi bileşen içerir': 'Contains pork-derived ingredients',
    // Yorumlar
    'Kaş–Fethiye yolunda rastladığımız bu aile işletmesinden biraz çekinerek denedik, ama hiç pişman olmadık. Yemekler tazeydi ve tatil bölgesine göre gayet makul fiyatlıydı.':
      "We came across this family business on the Kaş–Fethiye road and tried it a bit hesitantly, but never regretted it. The food was fresh and quite reasonably priced for a holiday area.",
    'Karavandan bozma sevimli bir köfteci. Yarım porsiyonlar bile doyurucu, tadı gerçekten ev yemeği gibi. İşletmeci hanım son derece candan ve çalışkan.':
      'A charming meatball spot converted from a caravan. Even the half portions are filling, and it really tastes like home cooking. The owner is incredibly warm and hardworking.',
    "Uzun zamandır yediğim en lezzetli köfte ve kokoreçlerden biriydi. Mekân temiz, servis hızlı ve fiyatlar makul. Bahadır Bey'in güler yüzü sayesinde kendimizi evimizde gibi hissettik.":
      "One of the tastiest meatballs and kokoreç I've had in a long time. The place is clean, service is fast and prices are fair. Thanks to Bahadır Bey's friendly smile, we felt right at home.",
    "Harika bir işletme! Personellerin güler yüzü için bile gidilebilir, lezzet tartışılamaz. Antalya Kaş'ın en ünlü yerlerinden, kesinlikle tavsiye ederim.":
      "A wonderful place! Worth visiting just for the staff's friendly smiles, and the flavor is beyond question. One of the most famous spots in Kaş, Antalya — I highly recommend it.",
    // Ayar metinleri
    'Yolda en güzel mola, evin sıcaklığında bir lezzet.': 'The best break on the road, a taste with the warmth of home.',
    'Misafirlerimizin memnuniyeti ve evinde hissetmesi, tek amacımız': "Our guests' satisfaction and feeling at home is our only goal",
    "Lamora Kalkan, Kaş ile Kalkan arasındaki sahil yolunda, Yeşilköy Kavşağı'nda küçük bir aile işletmesi olarak yola çıktı. Mürüvvet Hanım'ın elinden çıkan köfte, tantuni ve kokoreç, yıllardır bu yoldan geçen yerli ve yabancı misafirlere ev sıcaklığında bir mola sunuyor.":
      "Lamora Kalkan started out as a small family business at Yeşilköy Junction, on the coastal road between Kaş and Kalkan. The meatballs, tantuni and kokoreç made by Mürüvvet Hanım have offered a warm, home-style break to local and international travelers passing this road for years.",
    'Kullandığımız malzemelerin tazeliğine ve mekânımızın temizliğine büyük önem veriyoruz. Amacımız sadece karın doyurmak değil; bu yoldan bir daha geçtiğinizde uğramak isteyeceğiniz bir durak olmak.':
      "We place great importance on the freshness of our ingredients and the cleanliness of our place. Our goal isn't just to fill your stomach — it's to be a stop you'll want to visit again next time you pass this way.",
    'Kaş-Fethiye Çevre Yolu Üzeri, Yeşilköy Kavşağı, Antalya': 'Kaş-Fethiye Ring Road, Yeşilköy Junction, Antalya',
  },
  ru: {
    'Ekmek Arası': 'Сэндвич', 'Lavaş / Dürüm': 'Лаваш-дюрюм', 'Lavaş Dürüm': 'Лаваш-дюрюм',
    'Burgerler': 'Бургеры', 'Yan Ürünler': 'Гарниры', 'İçecekler': 'Напитки',
    'Köfte': 'Котлета', 'Tavuk': 'Курица', 'Et Tantuni': 'Тантуни из говядины', 'Tavuk Tantuni': 'Тантуни из курицы',
    'Dana Kokoreç': 'Кокореч из говядины', 'Kuzu Kokoreç': 'Кокореч из баранины', 'Hamburger': 'Гамбургер', 'Çizburger': 'Чизбургер',
    'Yoğurtlu Tavuk Tantuni': 'Тантуни из курицы с йогуртом', 'Cips': 'Картофель фри', 'Tavuk Pilav': 'Курица с рисом',
    'Ayran': 'Айран', 'Büyük Ayran': 'Айран (большой)', 'Soda': 'Содовая', 'Şalgam': 'Сок из турнепса (Шалгам)',
    'Ice Tea': 'Айс-ти', 'Küçük Su': 'Вода (маленькая)', 'Büyük Su': 'Вода (большая)', 'Türk Kahvesi': 'Турецкий кофе',
    'Cam Kola': 'Кола (стеклянная бутылка)', 'Kutu Kola': 'Кола (банка)', '1 Lt Kola': 'Кола (1 л)', 'Fanta': 'Фанта',
    'Sprite': 'Спрайт', 'Gazoz': 'Газировка (Газоз)', 'K. Meyve Suyu': 'Сок (маленький)', 'Çay': 'Чай',
    '110 Gr Köfte, Marul, Domates, Soğan ve isteğe göre Ketçap, Mayonez': '110 г котлета, салат, помидор, лук, кетчуп и майонез по желанию',
    '130 Gr Tavuk İncik, Marul, Domates, Soğan, Ketçap, Mayonez': '130 г куриное бедро, салат, помидор, лук, кетчуп, майонез',
    '110 Gr Dana Eti, Maydanoz, Domates, Soğan': '110 г говядина, петрушка, помидор, лук',
    '110 Gr Tavuk Eti, Maydanoz, Domates, Soğan': '110 г курица, петрушка, помидор, лук',
    '150gr Dana Kokoreç': '150 г кокореч из говядины',
    '150 gr Kuzu Kokoreç': '150 г кокореч из баранины',
    '110 Gr Köfte, Marul, Domates, Soğan, Turşu, Ketçap, Mayonez': '110 г котлета, салат, помидор, лук, соленья, кетчуп, майонез',
    '110 Gr Köfte, Çedar Peyniri, Marul, Domates, Soğan, Turşu, Ketçap, Mayonez': '110 г котлета, чеддер, салат, помидор, лук, соленья, кетчуп, майонез',
    '130 Gr Tavuk İncik, Marul, Domates, Soğan ve isteğe göre Ketçap, Mayonez': '130 г куриное бедро, салат, помидор, лук, кетчуп и майонез по желанию',
    '130 gr Tavuk Göğsü, Maydanoz, Domates ve Soğan': '130 г куриная грудка, петрушка, помидор и лук',
    '130 gr Tavuk Göğsü, Maydanoz, Domates ve Soğan ve üzerine Süzme yoğurt': '130 г куриная грудка, петрушка, помидор и лук, с процеженным йогуртом',
    'Gluten (Tahıl)': 'Глютен (злаки)', 'Süt / Laktoz': 'Молоко / лактоза', 'Yumurta': 'Яйцо',
    'Fındık / Fıstık': 'Орехи / арахис', 'Soya': 'Соя', 'Balık': 'Рыба',
    'Kabuklu Deniz Ürünleri': 'Моллюски и ракообразные', 'Susam': 'Кунжут', 'Hardal': 'Горчица',
    'Kereviz': 'Сельдерей', 'Sülfit': 'Сульфиты',
    'Alkol içerir': 'Содержит алкоголь', 'Domuz türevi bileşen içerir': 'Содержит компоненты свинины',
    'Kaş–Fethiye yolunda rastladığımız bu aile işletmesinden biraz çekinerek denedik, ama hiç pişman olmadık. Yemekler tazeydi ve tatil bölgesine göre gayet makul fiyatlıydı.':
      'Мы случайно наткнулись на этот семейный бизнес на дороге Каш–Фетхие и попробовали с некоторой опаской, но ничуть не пожалели. Еда была свежей, а цены — вполне разумными для курортного региона.',
    'Karavandan bozma sevimli bir köfteci. Yarım porsiyonlar bile doyurucu, tadı gerçekten ev yemeği gibi. İşletmeci hanım son derece candan ve çalışkan.':
      'Уютная котлетная, переоборудованная из каравана. Даже половинная порция сытная, а вкус — прямо как домашняя еда. Хозяйка очень душевная и трудолюбивая.',
    "Uzun zamandır yediğim en lezzetli köfte ve kokoreçlerden biriydi. Mekân temiz, servis hızlı ve fiyatlar makul. Bahadır Bey'in güler yüzü sayesinde kendimizi evimizde gibi hissettik.":
      'Одни из самых вкусных котлет и кокореч, что я пробовал за долгое время. Место чистое, обслуживание быстрое, цены разумные. Благодаря приветливости Бахадыра-бея мы почувствовали себя как дома.',
    "Harika bir işletme! Personellerin güler yüzü için bile gidilebilir, lezzet tartışılamaz. Antalya Kaş'ın en ünlü yerlerinden, kesinlikle tavsiye ederim.":
      'Прекрасное заведение! Стоит зайти хотя бы ради приветливой улыбки персонала, а вкус вне всякой критики. Одно из самых известных мест в Каше, Анталья — искренне рекомендую.',
    'Yolda en güzel mola, evin sıcaklığında bir lezzet.': 'Лучшая остановка в пути — вкус с домашним теплом.',
    'Misafirlerimizin memnuniyeti ve evinde hissetmesi, tek amacımız': 'Удовлетворённость наших гостей и ощущение дома — наша единственная цель',
    "Lamora Kalkan, Kaş ile Kalkan arasındaki sahil yolunda, Yeşilköy Kavşağı'nda küçük bir aile işletmesi olarak yola çıktı. Mürüvvet Hanım'ın elinden çıkan köfte, tantuni ve kokoreç, yıllardır bu yoldan geçen yerli ve yabancı misafirlere ev sıcaklığında bir mola sunuyor.":
      'Lamora Kalkan начал свой путь как небольшой семейный бизнес на перекрёстке Йешилькёй, на прибрежной дороге между Кашем и Калканом. Котлеты, тантуни и кокореч, приготовленные Мюрюввет-ханым, годами дарят тёплую, по-домашнему уютную остановку местным и иностранным гостям, проезжающим по этой дороге.',
    'Kullandığımız malzemelerin tazeliğine ve mekânımızın temizliğine büyük önem veriyoruz. Amacımız sadece karın doyurmak değil; bu yoldan bir daha geçtiğinizde uğramak isteyeceğiniz bir durak olmak.':
      'Мы придаём большое значение свежести продуктов и чистоте нашего заведения. Наша цель — не просто накормить, а стать остановкой, куда вы захотите заглянуть снова, проезжая этой дорогой в следующий раз.',
    'Kaş-Fethiye Çevre Yolu Üzeri, Yeşilköy Kavşağı, Antalya': 'Кольцевая дорога Каш-Фетхие, перекрёсток Йешилькёй, Анталья',
  },
};

function TC(str) {
  const lang = getLang();
  if (lang === 'tr' || !str) return str;
  const dict = CONTENT[lang];
  const hit = dict && dict[String(str).trim()];
  return hit || str;
}

// ─── Kaynak (Google/Tripadvisor/Misafir) etiketi çevirisi ───────────────────
function sourceLabel(source) {
  if (source === 'google') return 'Google';
  if (source === 'tripadvisor') return 'Tripadvisor';
  return T('source_guest');
}
// Yazarsız yorumlarda "<Kaynak> değerlendirmesi/review/отзыв" ifadesi
function anonReviewLabel(source) {
  const label = sourceLabel(source);
  const lang = getLang();
  if (lang === 'en') return `${label} review`;
  if (lang === 'ru') return `Отзыв (${label})`;
  return `${label} değerlendirmesi`;
}

// ─── [data-i18n] / [data-i18n-attr] işaretli statik öğeleri güncelle ────────
function applyStaticI18n(root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = T(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr').split(';').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s && s.trim());
      if (attr && key) el.setAttribute(attr, T(key));
    });
  });
  document.documentElement.lang = getLang();
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === getLang()));
}

window.addEventListener('langchange', () => applyStaticI18n());
document.addEventListener('DOMContentLoaded', () => applyStaticI18n());
