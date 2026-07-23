// Service worker SAMO zato, da brskalniki ponudijo "Namesti app" (PWA namestljivost
// zahteva registriran fetch handler). NAMENOMA brez predpomnjenja/cache-a - Cloudflare
// deploja pogosto, zato bi predpomnjenje pomenilo tveganje, da uporabnik obtiči na stari
// verziji. Vsaka zahteva gre naravnost na omrežje, kot da service worker ne obstaja.
self.addEventListener('fetch', () => {});
