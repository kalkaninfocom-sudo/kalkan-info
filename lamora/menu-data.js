// =========================================================
// LAMORA KALKAN — MENÜ VERİSİ
// admin.html panelinden 05.07.2026 18:51:49 tarihinde indirildi.
// Bu dosyayı proje klasörünüzdeki eski menu-data.js'in üzerine kaydedin.
// =========================================================
// Lamora Kalkan — ÖRNEK menü iskeleti (placeholder).
// Gerçek kategori/ürün/fiyatları admin panelinden (/admin.html) girin.
const MENU_DATA = {
  "updatedAt": "2026-07-12",
  "categories": [
    {
      "id": "baslangiclar",
      "name": "Başlangıçlar",
      "items": [
        { "name": "Örnek Başlangıç 1", "desc": "Açıklama buraya gelecek.", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" },
        { "name": "Örnek Başlangıç 2", "desc": "Açıklama buraya gelecek.", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" }
      ]
    },
    {
      "id": "ana-yemekler",
      "name": "Ana Yemekler",
      "items": [
        { "name": "Örnek Ana Yemek 1", "desc": "Açıklama buraya gelecek.", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" },
        { "name": "Örnek Ana Yemek 2", "desc": "Açıklama buraya gelecek.", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" }
      ]
    },
    {
      "id": "tatlilar",
      "name": "Tatlılar",
      "items": [
        { "name": "Örnek Tatlı", "desc": "Açıklama buraya gelecek.", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" }
      ]
    },
    {
      "id": "icecekler",
      "name": "İçecekler",
      "items": [
        { "name": "Su", "desc": "", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" },
        { "name": "Sıcak / Soğuk İçecekler", "desc": "Çay, kahve, meşrubat.", "price": "XX", "allergens": [], "specialNotes": [], "calories": "" }
      ]
    }
  ]
};

// Ortak alerjen listesi — admin.html ve menu.html tarafından kullanılır.
const ALLERGEN_LIST = [
  {
    "code": "gluten",
    "label": "Gluten (Tahıl)"
  },
  {
    "code": "sut",
    "label": "Süt / Laktoz"
  },
  {
    "code": "yumurta",
    "label": "Yumurta"
  },
  {
    "code": "findik",
    "label": "Fındık / Fıstık"
  },
  {
    "code": "soya",
    "label": "Soya"
  },
  {
    "code": "balik",
    "label": "Balık"
  },
  {
    "code": "kabuklu",
    "label": "Kabuklu Deniz Ürünleri"
  },
  {
    "code": "susam",
    "label": "Susam"
  },
  {
    "code": "hardal",
    "label": "Hardal"
  },
  {
    "code": "kereviz",
    "label": "Kereviz"
  },
  {
    "code": "sulfit",
    "label": "Sülfit"
  }
];

// Özel içerik uyarıları (2026 mevzuatı — tüketici sağlığını doğrudan etkileyen bileşenler).
const SPECIAL_NOTE_LIST = [
  {
    "code": "alkol",
    "label": "Alkol içerir"
  },
  {
    "code": "domuz",
    "label": "Domuz türevi bileşen içerir"
  }
];
