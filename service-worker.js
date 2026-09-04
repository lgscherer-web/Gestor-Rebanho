// Service Worker do Gestor de Rebanho - IBS Agropecuária
// Estratégia: cache-first (funciona offline após a primeira visita/instalação).
// Sempre que o app for atualizado, aumente CACHE_NAME (ex: 'rebanho-v2') para forçar
// os dispositivos a baixarem a versão nova.

// IMPORTANTE: aumente este número a cada nova versão do app, senão os aparelhos que já
// instalaram continuam abrindo o HTML antigo guardado em cache.
var CACHE_NAME = 'rebanho-v22';

var FILES_TO_CACHE = [
  './index.html',
  './',
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

  // SÓ cuidamos dos arquivos do próprio app. Sem esta checagem, as consultas ao banco de
  // dados (outra origem, e também GET) caíam no cache-first lá embaixo e o aparelho passava
  // a ler versões guardadas em vez de perguntar ao servidor — o app abria com dados antigos
  // e a lista de versões nunca mostrava as mais recentes. Gravar continuava funcionando
  // porque gravação é POST, e POST já saía na primeira linha desta função.
  var mesmaOrigem;
  try { mesmaOrigem = (new URL(evt.request.url)).origin === self.location.origin; }
  catch(e){ mesmaOrigem = false; }
  if(!mesmaOrigem) return;

  // O HTML principal usa NETWORK-FIRST: sempre tenta baixar a versão mais recente e só cai
  // para o cache se estiver sem internet. Antes ele era cache-first como o resto, e por isso
  // um aparelho que já tinha aberto o app continuava rodando uma versão antiga por tempo
  // indeterminado — o que gera divergências ao ler planilhas gravadas por versões novas.
  var ehHTML = evt.request.mode === 'navigate'
            || (evt.request.destination === 'document')
            || /\.html(\?|$)/i.test(evt.request.url);

  if(ehHTML){
    evt.respondWith(
      fetch(evt.request).then(function(response){
        if(response && response.status === 200){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(evt.request, copy); });
        }
        return response;
      }).catch(function(){
        return caches.match(evt.request);
      })
    );
    return;
  }

  // Demais arquivos (bibliotecas, ícones, manifest) mudam muito pouco e são pesados:
  // seguem cache-first, com atualização em segundo plano.
  evt.respondWith(
    caches.match(evt.request).then(function(cached){
      var networkFetch = fetch(evt.request).then(function(response){
        if(response && response.status === 200){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(evt.request, copy); });
        }
        return response;
      }).catch(function(){ return cached; });
      return cached || networkFetch;
    })
  );
});
