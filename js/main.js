import { EventBus } from './core/event-bus.js';
import { StorageService } from './services/storage.service.js';

import { SpotifyController } from './controllers/spotify.controller.js';
import { SetlistController } from './controllers/setlist.controller.js';

StorageService.migrate();

SetlistController.init();
SpotifyController.init();

console.log('Lyra iniciado');

EventBus.emit('app:ready');