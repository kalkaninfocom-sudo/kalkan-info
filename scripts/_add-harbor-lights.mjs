import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data/restoranlar.json', 'utf8'));

const existing = data.items.find(i => i.id === 'harbor-lights');
if (existing) {
  console.log('Already exists, updating...');
}

const newItem = {
  id: 'harbor-lights',
  name: 'Harbor Lights Artisan Cafe',
  category: 'Cafe & Bar',
  cuisine: 'Cafe / Kokteyl',
  priceRange: '₺₺',
  rating: 4.7,
  reviewCount: 0,
  location: 'İskele Sk. No:27, Yat Limanı',
  phone: null,
  website: 'https://www.instagram.com/harborlightskalkan/',
  instagram: 'https://www.instagram.com/harborlightskalkan/',
  image: '/assets/img/harbor-lights-profile.jpg',
  gallery: ['/assets/img/harbor-lights-profile.jpg'],
  summary: "Kalkan iskelesinde artisan cafe & cocktail bar. Specialty coffee, craft kokteyl ve yat limanı manzarası. Detaylı menü, fotoğraf ve güncel etkinlikler için Instagram sayfasını ziyaret edin.",
  specialties: ['Cocktail', 'Specialty Coffee', 'Artisan Menü'],
  hours: 'Yaz: Akşam',
  reservation: null,
  featured: false,
  source: 'instagram',
};

if (existing) {
  Object.assign(existing, newItem);
} else {
  data.items.push(newItem);
}

writeFileSync('data/restoranlar.json', JSON.stringify(data, null, 2) + '\n');
console.log(`✓ Harbor Lights ${existing ? 'updated' : 'added'} · total restaurants: ${data.items.length}`);
