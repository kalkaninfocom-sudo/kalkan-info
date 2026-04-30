/**
 * directions.js — Google Maps & Apple Maps deeplink utility
 * Anahtarsız, saf URL oluşturma. map.js ve weather.js tarafından import edilir.
 */

/**
 * Google Maps yol tarifi deeplink'i oluşturur.
 * @param {number} lat
 * @param {number} lng
 * @param {string} name - İsteğe bağlı hedef adı
 * @returns {string} URL
 */
export function googleMapsLink(lat, lng, name = '') {
  const dest = encodeURIComponent(name ? `${name}@${lat},${lng}` : `${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/**
 * iOS/macOS ise Apple Maps, diğerlerinde Google Maps döndürür.
 * @param {number} lat
 * @param {number} lng
 * @param {string} name
 * @returns {string} URL
 */
export function directionsLink(lat, lng, name = '') {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !window.MSStream;
  if (isApple) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`;
  }
  return googleMapsLink(lat, lng, name);
}

/**
 * Apple Maps URL'si (iOS detect etmeksizin, doğrudan link gerektiğinde).
 * @param {number} lat
 * @param {number} lng
 * @returns {string} URL
 */
export function appleMapsLink(lat, lng) {
  return `maps://maps.apple.com/?daddr=${lat},${lng}`;
}
