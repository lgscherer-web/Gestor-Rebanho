// Service Worker do Gestor de Rebanho - IBS Agropecuária
// Estratégia: cache-first (funciona offline após a primeira visita/instalação).
// Sempre que o app for atualizado, aumente CACHE_NAME (ex: 'rebanho-v2') para forçar
// os dispositivos a baixarem a versão nova.

var CACHE_NAME = 'rebanho-v1';

var FILES_TO_CACHE = [
  './Controle_de_Rebanho_-_IBS_Agropecuaria_5.html',
  './manifest.json',
  './libs/chart.umd.js',
  './libs/xlsx.full.min.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(evt){
  self.skipWaiting();
  evt.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener('activate', function(evt){
  evt.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(evt){
  if(evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then(function(cached){
      var networkFetch = fetch(evt.request).then(function(response){
        if(response && response.status === 200){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(evt.request, copy); });
        }
        return response;
      }).catch(function(){ return cached; });
      // Cache-first: responde rápido com o cache se existir, atualiza em segundo plano.
      return cached || networkFetch;
    })
  );
});
